import {
  DEFAULT_RULES,
  getModeSettings,
  ROUND_COUNT,
  snapshotRules,
} from '../domain/config';
import type { GameRules, ModeSelection } from '../domain/config';
import {
  frequencyToPosition,
  generateInitialFrequency,
  positionToFrequency,
} from '../domain/frequencies';
import type { RandomSource } from '../domain/frequencies';
import { createGameDefinition } from '../domain/gameDefinition';
import {
  createInitialState,
  gameReducer,
  getCurrentTarget,
  getEventContext,
} from '../domain/gameReducer';
import type { EventContext, GameAction, GameState } from '../domain/models';
import type { AudioInterruption, AudioPlayback, AudioPort } from './audioPort';

export interface GameSnapshot {
  readonly game: GameState;
  readonly volume: number;
  readonly busy: boolean;
  readonly sample: 'idle' | 'preparing' | 'playing';
  readonly countdown: number | null;
  readonly error: string | null;
  readonly announcement: string;
}

export interface GameControllerOptions {
  readonly createAudio: (
    onInterruption: (event: AudioInterruption) => void,
  ) => AudioPort;
  readonly random: RandomSource;
  readonly createId: () => string;
  readonly isPageVisible: () => boolean;
  readonly initialVolume: number;
  readonly rules?: GameRules;
  readonly now?: () => number;
}

export class GameController {
  private snapshot: GameSnapshot;
  private readonly listeners = new Set<() => void>();
  private readonly rules: GameRules;
  private readonly now: () => number;
  private audio: AudioPort | null = null;
  private audioVersion = 0;
  private playback: {
    readonly handle: AudioPlayback;
    readonly kind: 'sample' | 'reference' | 'attempt';
  } | null = null;
  private silence: Promise<void> = Promise.resolve();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private active = false;
  private disposed = false;
  private operation = 0;

  constructor(private readonly options: GameControllerOptions) {
    this.rules = snapshotRules(options.rules ?? DEFAULT_RULES);
    this.now = options.now ?? (() => performance.now());
    this.snapshot = Object.freeze({
      game: createInitialState(options.isPageVisible()),
      volume: options.initialVolume,
      busy: false,
      sample: 'idle',
      countdown: null,
      error: null,
      announcement: '',
    });
  }

  readonly getSnapshot = (): GameSnapshot => this.snapshot;
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
    this.operation += 1;
    this.clearTimer();
    void this.quiet();
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
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

  readonly start = (selection: ModeSelection): void => {
    const phase = this.snapshot.game.phase;
    if (
      !this.canAct() ||
      !['home', 'final-result', 'interrupted'].includes(phase)
    )
      return;
    const operation = ++this.operation;
    try {
      const definition = createGameDefinition(
        this.options.createId(),
        selection,
        this.options.random,
        this.rules,
      );
      // Habilitar no próprio gesto, antes de aguardar a cauda de um teste anterior.
      const enabled = this.enableAudio();
      const previous = this.playback;
      this.playback = null;
      const stopped = previous
        ? previous.handle.cancel().then(() => undefined)
        : this.silence;
      this.update({
        busy: true,
        sample: 'idle',
        error: null,
        announcement: '',
      });
      this.send({ type: 'START_GAME', definition });
      this.finishPreparation(
        enabled,
        stopped,
        getEventContext(this.snapshot.game),
        operation,
      );
    } catch {
      this.failCurrent();
    }
  };

  readonly restart = (): void => {
    const game = this.snapshot.game;
    if (game.phase === 'final-result' || game.phase === 'interrupted')
      this.start(game.session.definition.selection);
  };

  readonly testAudio = (): void => {
    if (
      !this.canAct() ||
      this.snapshot.game.phase !== 'home' ||
      this.snapshot.sample !== 'idle'
    )
      return;
    const operation = ++this.operation;
    this.update({
      sample: 'preparing',
      busy: true,
      error: null,
      announcement: '',
    });
    try {
      const audio = this.getAudio();
      const enabled = this.enableAudio();
      void Promise.all([enabled, this.silence])
        .then(() => {
          if (!this.currentOperation(operation) || !this.syncVisibility())
            return;
          const handle = audio.playSample();
          this.playback = { handle, kind: 'sample' };
          this.update({ sample: 'playing', busy: false });
          return handle.finished.then((result) => {
            if (!this.currentOperation(operation)) return;
            if (this.playback?.handle.id === handle.id) this.playback = null;
            this.update({
              sample: 'idle',
              busy: false,
              announcement:
                result.status === 'completed' ? 'Teste concluído.' : '',
            });
          });
        })
        .catch(() => {
          if (this.currentOperation(operation)) this.failCurrent();
        });
    } catch {
      this.failCurrent();
    }
  };

  readonly stopSample = (): void => {
    if (!this.active || this.snapshot.sample !== 'playing') return;
    const operation = ++this.operation;
    this.update({ busy: true, announcement: '' });
    void this.quiet().then(() => {
      if (this.currentOperation(operation))
        this.update({ sample: 'idle', busy: false });
    });
  };

  readonly setVolume = (volume: number): void => {
    if (!this.active || !Number.isFinite(volume) || volume < 0 || volume > 1)
      return;
    try {
      this.audio?.setVolume(volume);
      this.update({ volume });
    } catch {
      this.failCurrent();
    }
  };

  readonly setPosition = (position: number): void => {
    if (
      !this.canAct() ||
      this.snapshot.game.phase !== 'attempt' ||
      !Number.isFinite(position) ||
      position < 0 ||
      position > 1
    )
      return;
    try {
      const frequencyHz = positionToFrequency(position, this.rules.range);
      this.audio?.setFrequency(frequencyHz);
      this.send({ type: 'SET_FREQUENCY', frequencyHz });
    } catch {
      this.failCurrent();
    }
  };

  readonly adjustPosition = (delta: number): void => {
    const game = this.snapshot.game;
    if (game.phase !== 'attempt' || !Number.isFinite(delta)) return;
    this.setPosition(
      Math.min(
        1,
        Math.max(
          0,
          frequencyToPosition(game.frequencyHz, this.rules.range) + delta,
        ),
      ),
    );
  };

  readonly confirm = (executionId: number): void => {
    if (
      !this.canAct() ||
      this.snapshot.game.executionId !== executionId ||
      this.snapshot.game.phase !== 'attempt' ||
      this.playback?.kind !== 'attempt'
    )
      return;
    const game = this.snapshot.game;
    const nextTarget =
      game.session.definition.rounds[game.session.roundIndex]?.references[
        game.session.attemptIndex + 1
      ];
    if (nextTarget !== undefined) {
      try {
        const nextInitialHz = generateInitialFrequency(
          nextTarget,
          this.options.random,
          this.rules,
        );
        this.audio?.setFrequency(nextInitialHz);
        this.send({ type: 'CONFIRM_ATTEMPT', nextInitialHz });
      } catch {
        this.failCurrent();
      }
      return;
    }
    const handle = this.playback.handle;
    this.update({ busy: true, announcement: '' });
    // A primeira confirmação vence uma interrupção posterior; valores só aparecem após a cauda.
    this.send({ type: 'CONFIRM_ATTEMPT' });
    const context = getEventContext(this.snapshot.game);
    try {
      void handle
        .stop()
        .then(() => {
          if (!this.matches(context)) return;
          if (this.playback?.handle.id === handle.id) this.playback = null;
          this.syncVisibility();
          this.send({ type: 'COMPLETE_ROUND' }, context);
          this.update({
            busy: false,
            announcement: this.snapshot.game.pageVisible
              ? 'Resposta confirmada.'
              : '',
          });
        })
        .catch(() => {
          if (this.matches(context)) this.finishFailedConfirmation(context);
        });
    } catch {
      this.finishFailedConfirmation(context);
    }
  };

  readonly advance = (): void => {
    if (!this.canAct()) return;
    if (this.snapshot.game.phase === 'attempt-result')
      this.send({ type: 'COMPLETE_ROUND' });
    const game = this.snapshot.game;
    if (game.phase !== 'round-result') return;
    if (game.session.roundIndex === ROUND_COUNT - 1) {
      this.send({ type: 'FINISH_GAME' });
      this.update({ announcement: 'Partida concluída.' });
      return;
    }
    try {
      const enabled = this.enableAudio();
      this.update({ busy: true, announcement: '', error: null });
      this.send({ type: 'NEXT_ROUND' });
      this.finishPreparation(
        enabled,
        this.silence,
        getEventContext(this.snapshot.game),
        this.operation,
      );
    } catch {
      this.failCurrent();
    }
  };

  readonly resume = (): void => {
    if (!this.canAct() || this.snapshot.game.phase !== 'awaiting-resume')
      return;
    try {
      const enabled = this.enableAudio();
      this.update({ busy: true, error: null, announcement: '' });
      this.send({ type: 'RESUME' });
      this.finishPreparation(
        enabled,
        this.silence,
        getEventContext(this.snapshot.game),
        this.operation,
      );
    } catch {
      this.failCurrent();
    }
  };

  readonly leave = (): void => {
    if (!this.active) return;
    const operation = ++this.operation;
    this.send({ type: 'RETURN_HOME' });
    this.update({
      busy: true,
      sample: 'idle',
      countdown: null,
      error: null,
      announcement: '',
    });
    void this.quiet().then(() => {
      if (this.currentOperation(operation)) this.update({ busy: false });
    });
  };

  readonly visibilityChanged = (): void => {
    if (!this.active) return;
    const visible = this.options.isPageVisible();
    if (visible === this.snapshot.game.pageVisible) return;
    const referenceStarted =
      this.playback?.kind === 'reference' && this.playback.handle.hasStarted();
    this.send({ type: 'VISIBILITY_CHANGED', visible, referenceStarted });
    if (visible) return;
    if (this.snapshot.game.phase === 'home') this.operation += 1;
    this.update({ countdown: null, announcement: '', sample: 'idle' });
    const context = getEventContext(this.snapshot.game);
    void this.quiet().then(() => {
      if (this.matches(context)) this.update({ busy: false });
    });
  };

  private finishPreparation(
    enabled: Promise<void>,
    stopped: Promise<void>,
    context: EventContext,
    operation: number,
  ): void {
    void Promise.all([enabled, stopped])
      .then(() => {
        if (!this.currentOperation(operation) || !this.visibleMatch(context))
          return;
        this.update({ busy: false });
        this.send({ type: 'AUDIO_READY' }, context);
        if (this.snapshot.game.phase === 'countdown') this.beginCountdown();
      })
      .catch(() => {
        if (this.matches(context)) this.failCurrent();
      });
  }

  private beginCountdown(): void {
    const context = getEventContext(this.snapshot.game);
    const deadline = this.now() + this.rules.countdownSeconds * 1000;
    const tick = () => {
      this.timer = null;
      if (!this.visibleMatch(context)) return;
      const remaining = Math.max(0, Math.ceil((deadline - this.now()) / 1000));
      if (remaining === 0) {
        this.update({ countdown: null });
        this.send({ type: 'COUNTDOWN_FINISHED' }, context);
        this.presentReference();
        return;
      }
      if (remaining !== this.snapshot.countdown)
        this.update({ countdown: remaining });
      this.timer = setTimeout(
        tick,
        Math.min(100, Math.max(1, deadline - this.now())),
      );
    };
    tick();
  }

  private presentReference(): void {
    const game = this.snapshot.game;
    if (game.phase !== 'references') return;
    const context = getEventContext(game);
    try {
      const audio = this.getAudio();
      const settings = getModeSettings(
        game.session.definition.selection,
        game.session.definition.rules,
      );
      const tones = game.session.definition.rounds[
        game.session.roundIndex
      ]?.references.map((frequencyHz) => ({
        frequencyHz,
        durationSeconds: settings.referenceSeconds,
      }));
      if (!tones?.[0]) throw new Error('Referência ausente.');
      const handle =
        settings.referencesPerRound === 1
          ? audio.playReference(tones[0])
          : audio.playSequence(tones, this.rules.sequenceGapSeconds);
      this.playback = { handle, kind: 'reference' };
      void handle.finished
        .then((result) => {
          if (!this.visibleMatch(context)) return;
          if (result.status !== 'completed') {
            this.failCurrent();
            return;
          }
          this.playback = null;
          const initialHz = generateInitialFrequency(
            getCurrentTarget(game.session),
            this.options.random,
            this.rules,
          );
          this.send({ type: 'REFERENCES_FINISHED', initialHz }, context);
          this.beginAttempt();
        })
        .catch(() => {
          if (this.matches(context)) this.failCurrent();
        });
    } catch {
      this.failCurrent();
    }
  }

  private beginAttempt(): void {
    const game = this.snapshot.game;
    if (game.phase !== 'attempt') return;
    try {
      const handle = this.getAudio().startContinuous(game.frequencyHz);
      this.playback = { handle, kind: 'attempt' };
      void handle.finished.then(() => {
        if (
          this.active &&
          this.playback?.handle === handle &&
          this.snapshot.game.phase === 'attempt'
        )
          this.failCurrent();
      });
    } catch {
      this.failCurrent();
    }
  }

  private readonly onInterruption = (event: AudioInterruption): void => {
    if (
      !this.active ||
      (event.playbackId !== null &&
        event.playbackId !== this.playback?.handle.id)
    )
      return;
    const referenceStarted =
      this.playback?.kind === 'reference' && event.started;
    this.send({
      type: 'AUDIO_INTERRUPTED',
      reason: event.reason === 'closed' ? 'audio-failed' : 'audio-suspended',
      referenceStarted,
    });
    this.playback = null;
    if (event.reason === 'closed') {
      const audio = this.audio;
      this.audio = null;
      this.audioVersion += 1;
      this.silence =
        audio?.dispose().catch(() => undefined) ?? Promise.resolve();
    }
    if (this.snapshot.game.phase === 'home') this.operation += 1;
    this.update({
      busy: false,
      sample: 'idle',
      countdown: null,
      error:
        'O áudio foi interrompido. Você pode habilitá-lo novamente para continuar ou iniciar outra partida.',
    });
  };

  private finishFailedConfirmation(context: EventContext): void {
    if (!this.matches(context)) return;
    void this.quiet().then(() => {
      if (!this.matches(context)) return;
      this.syncVisibility();
      this.send({ type: 'COMPLETE_ROUND' }, context);
      this.update({
        busy: false,
        error: 'Resposta registrada. O áudio precisou ser encerrado.',
        announcement: '',
      });
    });
  }

  private failCurrent(): void {
    if (!this.active) return;
    this.operation += 1;
    this.send({
      type: 'AUDIO_INTERRUPTED',
      reason: 'audio-failed',
      referenceStarted:
        this.playback?.kind === 'reference' &&
        this.playback.handle.hasStarted(),
    });
    const context = getEventContext(this.snapshot.game);
    this.update({
      busy: true,
      sample: 'idle',
      countdown: null,
      announcement: '',
      error:
        'Não foi possível reproduzir o áudio. Tente habilitá-lo novamente.',
    });
    void this.quiet().then(() => {
      if (this.matches(context))
        this.update({
          busy: false,
          announcement: this.snapshot.game.pageVisible
            ? 'Áudio indisponível.'
            : '',
        });
    });
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

  private enableAudio(): Promise<void> {
    const enabled = this.getAudio().enable();
    // Também tratar rejeição se outra operação síncrona falhar antes de preparar o fluxo.
    void enabled.catch(() => undefined);
    return enabled;
  }

  private canAct(): boolean {
    return (
      this.active &&
      !this.disposed &&
      !this.snapshot.busy &&
      this.syncVisibility()
    );
  }
  private syncVisibility(): boolean {
    this.visibilityChanged();
    return this.snapshot.game.pageVisible;
  }
  private currentOperation(operation: number): boolean {
    return this.active && !this.disposed && operation === this.operation;
  }
  private matches(context: EventContext): boolean {
    const current = getEventContext(this.snapshot.game);
    return (
      this.active &&
      !this.disposed &&
      context.gameId === current.gameId &&
      context.executionId === current.executionId
    );
  }
  private visibleMatch(context: EventContext): boolean {
    return this.syncVisibility() && this.matches(context);
  }

  private send(
    action: GameAction,
    context = getEventContext(this.snapshot.game),
  ): void {
    const game = gameReducer(this.snapshot.game, { ...context, ...action });
    if (game === this.snapshot.game) return;
    if (game.executionId !== this.snapshot.game.executionId) this.clearTimer();
    this.update({ game });
  }

  private clearTimer(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }
  private update(patch: Partial<GameSnapshot>): void {
    this.snapshot = Object.freeze({ ...this.snapshot, ...patch });
    for (const listener of this.listeners) listener();
  }
}
