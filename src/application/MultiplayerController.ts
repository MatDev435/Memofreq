import type { ModeSelection } from '../domain/config';
import {
  frequencyToPosition,
  positionToFrequency,
} from '../domain/frequencies';
import { joinNames, modeLabel } from '../multiplayer/labels';
import { JOIN_ERRORS, reasonMessage } from '../multiplayer/messages';
import type { MultiplayerReason } from '../multiplayer/messages';
import {
  CLOSE_CODES,
  createRoomUrl,
  joinRoomUrl,
  normalizeName,
  normalizeRoomCode,
} from '../multiplayer/protocol';
import type {
  ClientMessage,
  MatchView,
  RoomView,
  ServerMessage,
} from '../multiplayer/protocol';
import { RoomConnection } from '../multiplayer/RoomConnection';
import type { ConnectionOptions } from '../multiplayer/RoomConnection';
import type { AudioInterruption, AudioPlayback, AudioPort } from './audioPort';

/**
 * Execução local do round vigente. O servidor define alvos, posições
 * iniciais, aceitação dos palpites e resultados; aqui só há áudio e ajuste.
 */
export type RoundPlay =
  | { readonly stage: 'idle' }
  | {
      readonly stage:
        | 'preparing'
        | 'blocked'
        | 'references'
        | 'sending'
        | 'submitted'
        | 'forfeited';
      readonly roundIndex: number;
    }
  | {
      readonly stage: 'countdown';
      readonly roundIndex: number;
      readonly remaining: number;
    }
  | {
      readonly stage: 'attempt' | 'paused';
      readonly roundIndex: number;
      readonly attemptIndex: number;
      readonly frequencyHz: number;
    };

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'ended';

export interface MultiplayerSnapshot {
  readonly status: ConnectionStatus;
  readonly playerId: string | null;
  readonly room: RoomView | null;
  /** Motivo da saída involuntária (tela de saída). */
  readonly endReason: MultiplayerReason | null;
  /** Erro do formulário de entrada. */
  readonly formError: MultiplayerReason | null;
  /** Aviso não fatal dentro da sala. */
  readonly notice: string | null;
  readonly announcement: string;
  readonly volume: number;
  readonly play: RoundPlay;
  /** Identifica a etapa local vigente; protege confirmações e callbacks. */
  readonly execution: number;
  /** Prontidão enviada e ainda não refletida pelo servidor. */
  readonly readyKey: string | null;
  readonly pageVisible: boolean;
}

export interface MultiplayerControllerOptions {
  readonly url: string | null;
  readonly createAudio: (
    onInterruption: (event: AudioInterruption) => void,
  ) => AudioPort;
  readonly isPageVisible: () => boolean;
  readonly initialVolume: number;
  readonly connection?: ConnectionOptions;
  readonly now?: () => number;
}

const IDLE: RoundPlay = Object.freeze({ stage: 'idle' });
/** Etapas com som ativo ou iminente: nenhuma mensagem viva é publicada. */
const SOUND_STAGES = new Set<RoundPlay['stage']>([
  'preparing',
  'countdown',
  'references',
  'attempt',
  'sending',
]);

function readyKeyOf(room: RoomView | null): string | null {
  if (
    !room?.match ||
    (room.phase !== 'ready' && room.phase !== 'round-results')
  )
    return null;
  return `${room.phase}:${String(room.match.roundIndex)}`;
}

function closeReason(
  code: number,
  reason: string,
  joined: boolean,
): MultiplayerReason {
  if (code === CLOSE_CODES.kicked) return 'kicked';
  if (code === CLOSE_CODES.inactive) return 'inactive';
  if (code === CLOSE_CODES.abuse) return 'rate-limited';
  if (code === CLOSE_CODES.joinRejected) {
    for (const known of JOIN_ERRORS) if (known === reason) return known;
    return 'room-not-found';
  }
  if (!joined) return 'connection-failed';
  return code === CLOSE_CODES.left ? 'room-closed' : 'connection-lost';
}

export class MultiplayerController {
  private snapshot: MultiplayerSnapshot;
  private readonly listeners = new Set<() => void>();
  private readonly now: () => number;
  private connection: RoomConnection | null = null;
  private session = 0;
  private audio: AudioPort | null = null;
  private audioVersion = 0;
  private playback: {
    readonly handle: AudioPlayback;
    readonly kind: 'reference' | 'attempt';
  } | null = null;
  private silence: Promise<void> = Promise.resolve();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private active = false;
  private disposed = false;
  /** Execução da tentativa suspensa cuja retomada está em andamento. */
  private resuming: number | null = null;

  constructor(private readonly options: MultiplayerControllerOptions) {
    this.now = options.now ?? (() => performance.now());
    this.snapshot = Object.freeze({
      status: 'idle',
      playerId: null,
      room: null,
      endReason: null,
      formError: options.url === null ? 'unavailable' : null,
      notice: null,
      announcement: '',
      volume: options.initialVolume,
      play: IDLE,
      execution: 0,
      readyKey: null,
      pageVisible: options.isPageVisible(),
    });
  }

  readonly getSnapshot = (): MultiplayerSnapshot => this.snapshot;
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  readonly isActive = (): boolean => this.active;

  activate(): void {
    if (this.disposed) return;
    this.active = true;
    this.visibilityChanged();
  }

  deactivate(): void {
    this.active = false;
    void this.quiet();
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.leaveRoom();
    this.deactivate();
    this.disposed = true;
    const audio = this.audio;
    this.audio = null;
    try {
      await this.silence;
    } finally {
      await audio?.dispose();
    }
    this.listeners.clear();
  }

  // ---------- Entrada e saída ----------

  readonly create = (rawName: string): boolean => this.connect(rawName, null);

  readonly join = (rawCode: string, rawName: string): boolean =>
    this.connect(rawName, rawCode);

  /** Sai da sala por decisão do jogador; o servidor remove imediatamente. */
  readonly leave = (): void => {
    this.leaveRoom();
    this.reset({ status: 'idle', endReason: null, formError: null });
  };

  /** Após uma saída involuntária, volta ao formulário de entrada. */
  readonly backToEntry = (): void => {
    if (this.snapshot.status !== 'ended') return;
    this.reset({ status: 'idle', endReason: null, formError: null });
  };

  // ---------- Comandos da sala ----------

  readonly setMode = (selection: ModeSelection): void => {
    if (this.isHost() && this.snapshot.room?.phase === 'lobby')
      this.command({ type: 'set-mode', selection });
  };

  readonly startMatch = (): void => {
    if (!this.isHost() || this.snapshot.room?.phase !== 'lobby') return;
    this.enableInGesture();
    this.command({ type: 'start-match' });
  };

  /** Também habilita o áudio, pois é o gesto que antecede cada round. */
  readonly ready = (): void => {
    const room = this.snapshot.room;
    const key = readyKeyOf(room);
    const me = this.snapshot.playerId;
    if (
      !this.active ||
      key === null ||
      me === null ||
      this.snapshot.readyKey === key ||
      room?.match?.readyIds.includes(me) === true
    )
      return;
    this.enableInGesture();
    if (this.command({ type: 'ready' })) this.update({ readyKey: key });
  };

  readonly kick = (playerId: string): void => {
    if (this.isHost() && playerId !== this.snapshot.playerId)
      this.command({ type: 'kick', playerId });
  };

  readonly playAgain = (): void => {
    if (this.isHost() && this.snapshot.room?.phase === 'final')
      this.command({ type: 'play-again' });
  };

  // ---------- Round ----------

  readonly setVolume = (volume: number): void => {
    if (!Number.isFinite(volume) || volume < 0 || volume > 1) return;
    try {
      this.audio?.setVolume(volume);
    } catch {
      // A engine é recriada no próximo gesto se tiver falhado.
    }
    this.update({ volume });
  };

  readonly setPosition = (position: number): void => {
    const play = this.snapshot.play;
    const range = this.match()?.rules.range;
    if (
      !this.active ||
      play.stage !== 'attempt' ||
      range === undefined ||
      !Number.isFinite(position) ||
      position < 0 ||
      position > 1
    )
      return;
    const frequencyHz = positionToFrequency(position, range);
    try {
      this.audio?.setFrequency(frequencyHz);
    } catch {
      this.pauseAttempt(true);
      return;
    }
    this.update({ play: { ...play, frequencyHz } });
  };

  readonly adjustPosition = (delta: number): void => {
    const play = this.snapshot.play;
    const range = this.match()?.rules.range;
    if (play.stage !== 'attempt' || range === undefined) return;
    if (!Number.isFinite(delta)) return;
    const position = frequencyToPosition(play.frequencyHz, range) + delta;
    this.setPosition(Math.min(1, Math.max(0, position)));
  };

  /** Envia o palpite da tentativa vigente; o servidor calcula a nota. */
  readonly confirm = (execution: number): void => {
    const play = this.snapshot.play;
    const round = this.match()?.currentRound;
    const playback = this.playback;
    if (
      !this.active ||
      play.stage !== 'attempt' ||
      execution !== this.snapshot.execution ||
      playback?.kind !== 'attempt' ||
      round?.roundIndex !== play.roundIndex
    )
      return;
    if (
      !this.command({
        type: 'submit-guess',
        roundIndex: play.roundIndex,
        attemptIndex: play.attemptIndex,
        frequencyHz: play.frequencyHz,
      })
    )
      return;

    const nextHz = round.initialFrequencies[play.attemptIndex + 1];
    if (nextHz !== undefined) {
      // Extreme: mesma voz, nova posição inicial, sem resultado intermediário.
      try {
        this.audio?.setFrequency(nextHz);
      } catch {
        // A falha será tratada pelo fim inesperado da voz.
      }
      this.setPlay({
        stage: 'attempt',
        roundIndex: play.roundIndex,
        attemptIndex: play.attemptIndex + 1,
        frequencyHz: nextHz,
      });
      return;
    }

    const handle = playback.handle;
    const sending = this.setPlay({
      stage: 'sending',
      roundIndex: play.roundIndex,
    });
    void handle
      .stop()
      .catch(() => undefined)
      .then(() => {
        if (this.playback?.handle === handle) this.playback = null;
        if (!this.current(sending)) return;
        this.setPlay({ stage: 'submitted', roundIndex: play.roundIndex });
        this.announce(
          'Palpites registrados. Aguardando os demais participantes.',
        );
      });
  };

  /** Gesto para começar o round ou retomar uma tentativa suspensa. */
  readonly resumeRound = (): void => {
    const play = this.snapshot.play;
    if (!this.active || !this.visible()) return;
    if (play.stage === 'blocked') {
      this.resumeBlocked(play.roundIndex);
      return;
    }
    if (play.stage !== 'paused' || this.resuming === this.snapshot.execution)
      return;
    // A tentativa continua suspensa até o áudio voltar: nunca reapresenta
    // a referência, mesmo que a página seja ocultada neste intervalo.
    const { roundIndex, attemptIndex, frequencyHz } = play;
    const execution = this.snapshot.execution;
    const enabled = this.tryEnable();
    if (enabled === null) return;
    this.resuming = execution;
    this.update({ notice: null });
    void Promise.all([enabled, this.silence]).then(
      () => {
        this.resuming = null;
        if (this.current(execution) && this.visible())
          this.startAttempt(roundIndex, attemptIndex, frequencyHz);
      },
      () => {
        this.resuming = null;
        if (this.current(execution))
          this.update({
            notice: 'Não foi possível habilitar o áudio. Tente novamente.',
          });
      },
    );
  };

  /** Desistência explícita: o round vale zero e a partida continua. */
  readonly forfeitRound = (): void => {
    const stage = this.snapshot.play.stage;
    if (stage === 'blocked' || stage === 'paused') this.forfeit();
  };

  readonly visibilityChanged = (): void => {
    if (!this.active) return;
    const visible = this.options.isPageVisible();
    if (visible === this.snapshot.pageVisible) return;
    this.update({ pageVisible: visible });
    if (!visible) this.interrupt();
  };

  private resumeBlocked(roundIndex: number): void {
    const enabled = this.tryEnable();
    if (enabled === null) return;
    const preparing = this.setPlay({ stage: 'preparing', roundIndex });
    this.update({ notice: null });
    void Promise.all([enabled, this.silence]).then(
      () => {
        if (!this.current(preparing)) return;
        if (this.visible()) this.beginCountdown(roundIndex);
        else this.setPlay({ stage: 'blocked', roundIndex });
      },
      () => {
        if (!this.current(preparing)) return;
        this.setPlay({ stage: 'blocked', roundIndex });
        this.update({
          notice: 'Não foi possível habilitar o áudio. Tente novamente.',
        });
      },
    );
  }

  private tryEnable(): Promise<void> | null {
    try {
      return this.getAudio().enable();
    } catch {
      this.update({ notice: 'Não foi possível habilitar o áudio.' });
      return null;
    }
  }

  // ---------- Conexão ----------

  private connect(rawName: string, rawCode: string | null): boolean {
    const status = this.snapshot.status;
    if (!this.active || status === 'connecting' || status === 'connected')
      return false;
    const base = this.options.url;
    if (base === null) {
      this.update({ formError: 'unavailable' });
      return false;
    }
    const name = normalizeName(rawName);
    if (name === null) {
      this.update({ formError: 'invalid-name' });
      return false;
    }
    const code = rawCode === null ? null : normalizeRoomCode(rawCode);
    if (rawCode !== null && code === null) {
      this.update({ formError: 'invalid-code' });
      return false;
    }
    // O clique de entrada já libera o áudio para o primeiro round.
    this.enableInGesture();
    const session = ++this.session;
    this.reset({ status: 'connecting', endReason: null, formError: null });
    this.connection = new RoomConnection(
      code === null ? createRoomUrl(base, name) : joinRoomUrl(base, code, name),
      {
        onMessage: (message) => {
          if (session === this.session) this.receive(message);
        },
        onClose: (closeCode, reason) => {
          if (session === this.session)
            this.end(
              closeReason(closeCode, reason, this.snapshot.room !== null),
            );
        },
      },
      this.options.connection,
    );
    return true;
  }

  private receive(message: ServerMessage): void {
    switch (message.type) {
      case 'welcome':
        this.update({ playerId: message.playerId });
        return;
      case 'room':
        this.applyRoom(message.room);
        return;
      case 'error':
        if (message.fatal) {
          this.end(message.code);
          return;
        }
        this.update({ notice: reasonMessage(message.code) });
        this.announce(reasonMessage(message.code));
        return;
    }
  }

  private end(reason: MultiplayerReason): void {
    const joined = this.snapshot.room !== null;
    this.leaveRoom(false);
    if (
      !joined &&
      (JOIN_ERRORS.has(reason) || reason === 'connection-failed')
    ) {
      this.reset({ status: 'idle', endReason: null, formError: reason });
      return;
    }
    this.reset({ status: 'ended', endReason: reason, formError: null });
  }

  private leaveRoom(notify = true): void {
    this.session += 1;
    const connection = this.connection;
    this.connection = null;
    if (connection) {
      if (notify) connection.send({ type: 'leave' });
      connection.close();
    }
    void this.quiet();
  }

  private reset(
    patch: Pick<MultiplayerSnapshot, 'status' | 'endReason' | 'formError'>,
  ): void {
    this.update({
      ...patch,
      playerId: null,
      room: null,
      notice: null,
      announcement: '',
      play: IDLE,
      execution: this.snapshot.execution + 1,
      readyKey: null,
    });
  }

  private command(message: ClientMessage): boolean {
    if (!this.active || this.snapshot.status !== 'connected') return false;
    const sent = this.connection?.send(message) ?? false;
    if (!sent) this.update({ notice: reasonMessage('connection-lost') });
    return sent;
  }

  private applyRoom(room: RoomView): void {
    const previous = this.snapshot.room;
    if (previous?.code === room.code && room.version <= previous.version)
      return;
    const changes = this.describeChanges(previous, room);
    const phaseChanged =
      previous?.phase !== room.phase ||
      previous.match?.roundIndex !== room.match?.roundIndex;
    this.update({
      status: 'connected',
      room,
      readyKey:
        this.snapshot.readyKey === readyKeyOf(room)
          ? this.snapshot.readyKey
          : null,
      notice: phaseChanged ? null : this.snapshot.notice,
    });
    this.syncPlay(room);
    if (changes.length > 0) this.announce(changes.join(' '));
  }

  /** Mensagens curtas sobre participantes e etapas, nunca sobre valores. */
  private describeChanges(previous: RoomView | null, next: RoomView) {
    if (previous === null) return [];
    const me = this.snapshot.playerId;
    const name = (id: string) =>
      next.players.find((player) => player.id === id)?.name ??
      previous.players.find((player) => player.id === id)?.name ??
      '';
    const before = new Set(previous.players.map((player) => player.id));
    const after = new Set(next.players.map((player) => player.id));
    const messages: string[] = [];

    const joined = next.players.filter((player) => !before.has(player.id));
    const left = previous.players.filter((player) => !after.has(player.id));
    if (joined.length > 0)
      messages.push(`${joinNames(joined.map((p) => p.name))} entrou na sala.`);
    if (left.length > 0)
      messages.push(`${joinNames(left.map((p) => p.name))} saiu da sala.`);
    if (previous.hostId !== next.hostId)
      messages.push(
        next.hostId === me
          ? 'Você agora é o host da sala.'
          : `${name(next.hostId)} agora é o host da sala.`,
      );

    if (previous.phase !== next.phase) {
      const round = (next.match?.roundIndex ?? 0) + 1;
      if (next.phase === 'ready')
        messages.push('Partida iniciada. Confirme quando estiver pronto.');
      else if (next.phase === 'round-results')
        messages.push(
          `Round ${String(round)} concluído. Resultados disponíveis.`,
        );
      else if (next.phase === 'final')
        messages.push('Partida concluída. Ranking final disponível.');
      else if (next.phase === 'lobby') messages.push('A sala voltou ao lobby.');
      return messages;
    }

    if (
      next.phase === 'lobby' &&
      next.hostId !== me &&
      modeLabel(previous.selection) !== modeLabel(next.selection)
    )
      messages.push(`Modo alterado para ${modeLabel(next.selection)}.`);

    const sameRound = previous.match?.roundIndex === next.match?.roundIndex;
    if (sameRound && next.match && previous.match) {
      const wasReady = new Set(previous.match.readyIds);
      const ready = next.match.readyIds.filter(
        (id) => id !== me && !wasReady.has(id),
      );
      if (ready.length > 0)
        messages.push(`${joinNames(ready.map(name))} confirmou prontidão.`);
      const earlier = new Map(
        previous.match.progress.map((item) => [item.playerId, item.status]),
      );
      for (const item of next.match.progress) {
        if (item.playerId === me || earlier.get(item.playerId) !== 'playing')
          continue;
        if (item.status === 'completed')
          messages.push(`${name(item.playerId)} concluiu o round.`);
        else if (item.status === 'forfeited')
          messages.push(`${name(item.playerId)} perdeu o round.`);
      }
    }
    return messages;
  }

  // ---------- Execução local do round ----------

  private syncPlay(room: RoomView): void {
    const match = room.match;
    const round = match?.currentRound;
    const play = this.snapshot.play;
    if (room.phase !== 'playing' || !match || !round) {
      if (play.stage !== 'idle') {
        void this.quiet();
        this.setPlay(IDLE);
      }
      return;
    }
    if (play.stage !== 'idle' && play.roundIndex === round.roundIndex) return;
    void this.quiet();
    const mine = match.progress.find(
      (item) => item.playerId === this.snapshot.playerId,
    );
    if (mine && mine.status !== 'playing') {
      this.setPlay({
        stage: mine.status === 'forfeited' ? 'forfeited' : 'submitted',
        roundIndex: round.roundIndex,
      });
      return;
    }
    this.beginRound(round.roundIndex);
  }

  /** O round chega sem gesto: só toca se o áudio já estiver liberado. */
  private beginRound(roundIndex: number): void {
    if (!this.visible()) {
      this.setPlay({ stage: 'blocked', roundIndex });
      return;
    }
    let enabled: Promise<void>;
    try {
      enabled = this.getAudio().enable();
    } catch {
      this.setPlay({ stage: 'blocked', roundIndex });
      return;
    }
    const preparing = this.setPlay({ stage: 'preparing', roundIndex });
    void Promise.all([enabled, this.silence]).then(
      () => {
        if (!this.current(preparing)) return;
        if (this.visible()) this.beginCountdown(roundIndex);
        else this.setPlay({ stage: 'blocked', roundIndex });
      },
      () => {
        if (this.current(preparing))
          this.setPlay({ stage: 'blocked', roundIndex });
      },
    );
  }

  private beginCountdown(roundIndex: number): void {
    const seconds = this.match()?.rules.countdownSeconds ?? 3;
    const deadline = this.now() + seconds * 1000;
    const execution = this.setPlay({
      stage: 'countdown',
      roundIndex,
      remaining: seconds,
    });
    const tick = () => {
      this.timer = null;
      const play = this.snapshot.play;
      if (!this.current(execution) || play.stage !== 'countdown') return;
      const remaining = Math.max(0, Math.ceil((deadline - this.now()) / 1000));
      if (remaining === 0) {
        this.presentReferences(roundIndex);
        return;
      }
      if (remaining !== play.remaining)
        this.update({ play: { ...play, remaining } });
      this.timer = setTimeout(
        tick,
        Math.min(100, Math.max(1, deadline - this.now())),
      );
    };
    tick();
  }

  private presentReferences(roundIndex: number): void {
    const match = this.match();
    const round = match?.currentRound;
    if (!match || round?.roundIndex !== roundIndex) return;
    const execution = this.setPlay({ stage: 'references', roundIndex });
    try {
      const audio = this.getAudio();
      const tones = round.references.map((frequencyHz) => ({
        frequencyHz,
        durationSeconds: match.settings.referenceSeconds,
      }));
      const first = tones[0];
      if (first === undefined) throw new Error('Referência ausente.');
      const handle =
        tones.length === 1
          ? audio.playReference(first)
          : audio.playSequence(tones, match.rules.sequenceGapSeconds);
      this.playback = { handle, kind: 'reference' };
      void handle.finished.then(
        (result) => {
          if (!this.current(execution)) return;
          if (this.playback?.handle === handle) this.playback = null;
          const initialHz = round.initialFrequencies[0];
          if (
            result.status !== 'completed' ||
            !this.visible() ||
            initialHz === undefined
          ) {
            this.forfeit();
            return;
          }
          this.startAttempt(roundIndex, 0, initialHz);
        },
        () => {
          if (this.current(execution)) this.forfeit();
        },
      );
    } catch {
      this.forfeit();
    }
  }

  private startAttempt(
    roundIndex: number,
    attemptIndex: number,
    frequencyHz: number,
  ): void {
    this.setPlay({ stage: 'attempt', roundIndex, attemptIndex, frequencyHz });
    try {
      const handle = this.getAudio().startContinuous(frequencyHz);
      this.playback = { handle, kind: 'attempt' };
      void handle.finished.then(() => {
        if (
          this.playback?.handle === handle &&
          this.snapshot.play.stage === 'attempt'
        )
          this.pauseAttempt(true);
      });
    } catch {
      this.pauseAttempt(true);
    }
  }

  /** Tentativa suspensa: sem penalidade, retomada por um gesto. */
  private pauseAttempt(audioFailed = false): void {
    const play = this.snapshot.play;
    if (play.stage !== 'attempt') return;
    void this.quiet();
    this.setPlay({ ...play, stage: 'paused' });
    if (audioFailed)
      this.update({
        notice:
          'O tom da tentativa foi interrompido. Retome quando estiver pronto.',
      });
  }

  /** Política por etapa ao ocultar a página ou perder o áudio. */
  private interrupt(): void {
    const play = this.snapshot.play;
    switch (play.stage) {
      case 'preparing':
      case 'countdown':
        void this.quiet();
        this.setPlay({ stage: 'blocked', roundIndex: play.roundIndex });
        return;
      case 'references':
        this.forfeit();
        return;
      case 'attempt':
        this.pauseAttempt();
        return;
      default:
        return;
    }
  }

  private forfeit(): void {
    const play = this.snapshot.play;
    if (
      play.stage === 'idle' ||
      play.stage === 'sending' ||
      play.stage === 'submitted' ||
      play.stage === 'forfeited'
    )
      return;
    void this.quiet();
    this.command({ type: 'forfeit-round', roundIndex: play.roundIndex });
    this.setPlay({ stage: 'forfeited', roundIndex: play.roundIndex });
    this.announce('Round perdido. Aguardando os demais participantes.');
  }

  private readonly onInterruption = (event: AudioInterruption): void => {
    if (
      !this.active ||
      (event.playbackId !== null &&
        event.playbackId !== this.playback?.handle.id)
    )
      return;
    if (event.reason === 'closed') {
      const audio = this.audio;
      this.audio = null;
      this.audioVersion += 1;
      this.playback = null;
      this.silence =
        audio?.dispose().catch(() => undefined) ?? Promise.resolve();
    }
    const stage = this.snapshot.play.stage;
    this.interrupt();
    if (stage === 'attempt')
      this.update({
        notice:
          'O áudio foi interrompido. Retome a tentativa quando estiver pronto.',
      });
  };

  // ---------- Infraestrutura ----------

  private match(): MatchView | null {
    return this.snapshot.room?.match ?? null;
  }

  private isHost(): boolean {
    const room = this.snapshot.room;
    return room !== null && room.hostId === this.snapshot.playerId;
  }

  private visible(): boolean {
    this.visibilityChanged();
    return this.snapshot.pageVisible;
  }

  private current(execution: number): boolean {
    return (
      this.active && !this.disposed && execution === this.snapshot.execution
    );
  }

  private setPlay(play: RoundPlay): number {
    if (play.stage !== 'countdown') this.clearTimer();
    const execution = this.snapshot.execution + 1;
    // A região viva fica vazia enquanto houver som de jogo.
    this.update(
      SOUND_STAGES.has(play.stage)
        ? { play, execution, announcement: '' }
        : { play, execution },
    );
    return execution;
  }

  /** Mensagem viva curta; suprimida enquanto houver som de jogo. */
  private announce(text: string): void {
    if (SOUND_STAGES.has(this.snapshot.play.stage)) return;
    // Repetir o mesmo texto não seria lido de novo; alterna um espaço fixo.
    const announcement =
      text === this.snapshot.announcement ? `${text}\u00a0` : text;
    this.update({ announcement });
  }

  private enableInGesture(): void {
    try {
      void this.getAudio()
        .enable()
        .catch(() => undefined);
    } catch {
      // Uma nova tentativa ocorrerá no próximo gesto.
    }
  }

  private getAudio(): AudioPort {
    if (!this.audio) {
      const version = ++this.audioVersion;
      this.audio = this.options.createAudio((event) => {
        if (version === this.audioVersion) this.onInterruption(event);
      });
      this.audio.setVolume(this.snapshot.volume);
    }
    return this.audio;
  }

  private quiet(): Promise<void> {
    this.clearTimer();
    this.playback = null;
    try {
      this.silence =
        this.audio?.cancel().catch(() => undefined) ?? this.silence;
    } catch {
      this.silence = Promise.resolve();
    }
    return this.silence;
  }

  private clearTimer(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  private update(patch: Partial<MultiplayerSnapshot>): void {
    this.snapshot = Object.freeze({ ...this.snapshot, ...patch });
    for (const listener of this.listeners) listener();
  }
}
