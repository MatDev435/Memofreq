import type {
  AudioInterruption,
  AudioPlayback,
  AudioPort,
  PlaybackResult,
  PlaybackStatus,
  ReferenceTone,
} from '../application/audioPort';
import { holdParameter, rampValue } from './audioContext';
import type { EngineAudioContext, LinearRamp } from './audioContext';
import { AUDIO_SETTINGS } from './config';

export interface AudioEngineOptions {
  readonly range: { readonly minHz: number; readonly maxHz: number };
  readonly createContext?: () => EngineAudioContext;
  readonly onInterruption?: (event: AudioInterruption) => void;
}

function deferred<T>() {
  let resolve: ((value: T) => void) | undefined;
  let reject: ((reason: unknown) => void) | undefined;
  const promise = new Promise<T>((accept, refuse) => {
    resolve = accept;
    reject = refuse;
  });
  if (!resolve || !reject) throw new Error('Falha ao criar promessa de áudio.');
  return { promise, resolve, reject };
}

interface Voice {
  readonly oscillator: OscillatorNode;
  readonly gain: GainNode;
  readonly startsAt: number;
  readonly endsAt: number | null;
  readonly attackSeconds: number;
  readonly releaseSeconds: number;
  frequencyRamp: LinearRamp;
  stopRamp: LinearRamp | null;
  scheduled: boolean;
  cleaned: boolean;
}

interface PlaybackGroup {
  readonly id: number;
  readonly startsAt: number;
  readonly endsAt: number | null;
  readonly continuous: boolean;
  readonly voices: Set<Voice>;
  readonly completion: ReturnType<typeof deferred<PlaybackResult>>;
  status: PlaybackStatus;
  stopping: boolean;
  settled: boolean;
  started: boolean;
}

export class WebAudioEngine implements AudioPort {
  private readonly range: AudioEngineOptions['range'];
  private readonly createContext: () => EngineAudioContext;
  private readonly onInterruption: AudioEngineOptions['onInterruption'];
  private context: EngineAudioContext | null = null;
  private master: GainNode | null = null;
  private masterRamp: LinearRamp | null = null;
  private volume: number = AUDIO_SETTINGS.initialVolume;
  private active: PlaybackGroup | null = null;
  private nextId = 1;
  private disposed = false;
  private disposePromise: Promise<void> | null = null;
  private pendingEnable: {
    readonly completion: ReturnType<typeof deferred<undefined>>;
    readonly timeout: ReturnType<typeof setTimeout>;
  } | null = null;
  private lastContextState: string | null = null;

  constructor(options: AudioEngineOptions) {
    const { minHz, maxHz } = options.range;
    if (
      !Number.isFinite(minHz) ||
      !Number.isFinite(maxHz) ||
      minHz <= 0 ||
      maxHz <= minHz
    ) {
      throw new RangeError('Faixa de áudio inválida.');
    }
    this.range = Object.freeze({ minHz, maxHz });
    this.createContext = options.createContext ?? (() => new AudioContext());
    this.onInterruption = options.onInterruption;
  }

  enable(): Promise<void> {
    if (this.disposed) return Promise.reject(new Error('Engine descartada.'));
    if (this.pendingEnable) return this.pendingEnable.completion.promise;
    let context: EngineAudioContext;
    try {
      context = this.getOrCreateContext();
    } catch (error) {
      return Promise.reject(
        error instanceof Error
          ? error
          : new Error('Falha ao criar contexto de áudio.', { cause: error }),
      );
    }
    if (context.state === 'running') {
      this.lastContextState = 'running';
      return Promise.resolve();
    }
    if (context.state === 'closed')
      return Promise.reject(new Error('Contexto de áudio fechado.'));
    const completion = deferred<undefined>();
    const pending = {
      completion,
      timeout: setTimeout(() => {
        if (this.pendingEnable === pending)
          this.rejectEnable(
            new Error(
              'O navegador não habilitou o áudio. Tente novamente por uma interação.',
            ),
          );
      }, AUDIO_SETTINGS.enableTimeoutMs),
    };
    this.pendingEnable = pending;
    // resume() é chamado antes de qualquer await, dentro do gesto que invoca enable().
    try {
      void context.resume().then(
        () => {
          if (this.pendingEnable !== pending) return;
          if (context.state !== 'running') {
            this.rejectEnable(new Error('Contexto de áudio não está ativo.'));
            return;
          }
          clearTimeout(pending.timeout);
          this.lastContextState = 'running';
          this.pendingEnable = null;
          completion.resolve(undefined);
        },
        (error: unknown) => {
          if (this.pendingEnable === pending) this.rejectEnable(error);
        },
      );
    } catch (error) {
      this.rejectEnable(error);
    }
    return completion.promise;
  }

  playSample(): AudioPlayback {
    const frequencyHz =
      2 ** ((Math.log2(this.range.minHz) + Math.log2(this.range.maxHz)) / 2);
    return this.playReference({
      frequencyHz,
      durationSeconds: AUDIO_SETTINGS.sampleDurationSeconds,
    });
  }

  playReference(tone: ReferenceTone): AudioPlayback {
    return this.playSequence([tone], 0);
  }

  playSequence(
    tones: readonly ReferenceTone[],
    gapSeconds: number,
  ): AudioPlayback {
    const context = this.requireReady();
    if (tones.length === 0 || !Number.isFinite(gapSeconds) || gapSeconds < 0) {
      throw new RangeError('Sequência ou intervalo inválido.');
    }
    const startsAt = context.currentTime + AUDIO_SETTINGS.schedulingLeadSeconds;
    let cursor = startsAt;
    const scheduled = Array.from(tones, (tone) => {
      this.validateFrequency(tone.frequencyHz, context);
      if (!Number.isFinite(tone.durationSeconds) || tone.durationSeconds <= 0)
        throw new RangeError('Duração inválida.');
      const start = cursor;
      const end = start + tone.durationSeconds;
      if (!Number.isFinite(end) || end <= start)
        throw new RangeError('Duração não representável no relógio de áudio.');
      cursor = end + gapSeconds;
      return { frequencyHz: tone.frequencyHz, startsAt: start, endsAt: end };
    });
    const last = scheduled.at(-1);
    if (!last) throw new RangeError('Sequência vazia.');
    const group = this.beginGroup(startsAt, last.endsAt, false);
    try {
      for (const tone of scheduled) {
        this.scheduleVoice(group, tone.frequencyHz, tone.startsAt, tone.endsAt);
      }
    } catch (error) {
      this.hardFinish(group, 'interrupted');
      throw error;
    }
    return this.handle(group);
  }

  startContinuous(frequencyHz: number): AudioPlayback {
    const context = this.requireReady();
    this.validateFrequency(frequencyHz, context);
    const group = this.beginGroup(
      context.currentTime + AUDIO_SETTINGS.schedulingLeadSeconds,
      null,
      true,
    );
    try {
      this.scheduleVoice(group, frequencyHz, group.startsAt, null);
    } catch (error) {
      this.hardFinish(group, 'interrupted');
      throw error;
    }
    return this.handle(group);
  }

  setFrequency(frequencyHz: number): void {
    const context = this.requireReady();
    this.validateFrequency(frequencyHz, context);
    const group = this.active;
    const voice = group?.voices.values().next().value;
    if (!group?.continuous || group.stopping || !voice)
      throw new Error('Nenhum tom contínuo ajustável.');
    const now = context.currentTime;
    const current = rampValue(voice.frequencyRamp, now);
    holdParameter(voice.oscillator.frequency, now, current);
    voice.oscillator.frequency.linearRampToValueAtTime(
      frequencyHz,
      now + AUDIO_SETTINGS.smoothingSeconds,
    );
    voice.frequencyRamp = {
      from: current,
      to: frequencyHz,
      start: now,
      end: now + AUDIO_SETTINGS.smoothingSeconds,
    };
  }

  setVolume(volume: number): void {
    if (this.disposed) throw new Error('Engine descartada.');
    if (!Number.isFinite(volume) || volume < 0 || volume > 1)
      throw new RangeError('Volume deve estar entre zero e um.');
    this.volume = volume;
    const { context, master, masterRamp } = this;
    if (!context || !master || !masterRamp) return;
    const now = context.currentTime;
    const target = volume * AUDIO_SETTINGS.maximumGain;
    const current = rampValue(masterRamp, now);
    holdParameter(master.gain, now, current);
    const end =
      context.state === 'running' ? now + AUDIO_SETTINGS.smoothingSeconds : now;
    if (end === now) master.gain.setValueAtTime(target, now);
    else master.gain.linearRampToValueAtTime(target, end);
    this.masterRamp = { from: current, to: target, start: now, end };
  }

  cancel(): Promise<void> {
    this.rejectEnable(
      new DOMException('Habilitação de áudio cancelada.', 'AbortError'),
    );
    return this.active
      ? this.stopGroup(this.active, 'cancelled').then(() => undefined)
      : Promise.resolve();
  }

  dispose(): Promise<void> {
    if (this.disposePromise) return this.disposePromise;
    this.disposed = true;
    this.disposePromise = this.shutdown();
    return this.disposePromise;
  }

  private async shutdown(): Promise<void> {
    try {
      await this.cancel();
    } finally {
      const context = this.context;
      if (context) {
        context.removeEventListener('statechange', this.handleStateChange);
        try {
          this.master?.disconnect();
        } finally {
          if (context.state !== 'closed') await context.close();
        }
      }
    }
  }

  private getOrCreateContext(): EngineAudioContext {
    if (this.context) return this.context;
    const context = this.createContext();
    try {
      const master = context.createGain();
      const gain = this.volume * AUDIO_SETTINGS.maximumGain;
      master.gain.setValueAtTime(gain, context.currentTime);
      master.connect(context.destination);
      this.master = master;
      this.masterRamp = {
        from: gain,
        to: gain,
        start: context.currentTime,
        end: context.currentTime,
      };
      this.lastContextState = context.state;
      context.addEventListener('statechange', this.handleStateChange);
      this.context = context;
      return context;
    } catch (error) {
      this.master?.disconnect();
      this.master = null;
      void context.close().catch(() => undefined);
      throw error;
    }
  }

  private requireReady(): EngineAudioContext {
    if (this.disposed) throw new Error('Engine descartada.');
    if (!this.context || this.context.state !== 'running') {
      if (this.context) this.handleStateChange();
      throw new Error('Habilite o áudio antes de reproduzir.');
    }
    this.lastContextState = 'running';
    return this.context;
  }

  private validateFrequency(
    frequencyHz: number,
    context: EngineAudioContext,
  ): void {
    if (
      !Number.isFinite(frequencyHz) ||
      frequencyHz < this.range.minHz ||
      frequencyHz > this.range.maxHz ||
      frequencyHz >= context.sampleRate / 2
    ) {
      throw new RangeError('Frequência fora da faixa de áudio.');
    }
  }

  private beginGroup(
    startsAt: number,
    endsAt: number | null,
    continuous: boolean,
  ): PlaybackGroup {
    if (this.active)
      throw new Error(
        'Aguarde o término ou cancelamento da reprodução anterior.',
      );
    const group: PlaybackGroup = {
      id: this.nextId++,
      startsAt,
      endsAt,
      continuous,
      voices: new Set(),
      completion: deferred<PlaybackResult>(),
      status: 'completed',
      stopping: false,
      settled: false,
      started: false,
    };
    this.active = group;
    return group;
  }

  private scheduleVoice(
    group: PlaybackGroup,
    frequencyHz: number,
    startsAt: number,
    endsAt: number | null,
  ): void {
    const context = this.requireReady();
    const master = this.master;
    if (!master) throw new Error('Ganho mestre indisponível.');
    const oscillator = context.createOscillator();
    let gain: GainNode;
    try {
      gain = context.createGain();
    } catch (error) {
      oscillator.disconnect();
      throw error;
    }
    const duration = endsAt === null ? Infinity : endsAt - startsAt;
    const voice: Voice = {
      oscillator,
      gain,
      startsAt,
      endsAt,
      attackSeconds: Math.min(AUDIO_SETTINGS.attackSeconds, duration / 2),
      releaseSeconds: Math.min(AUDIO_SETTINGS.releaseSeconds, duration / 2),
      frequencyRamp: {
        from: frequencyHz,
        to: frequencyHz,
        start: startsAt,
        end: startsAt,
      },
      stopRamp: null,
      scheduled: false,
      cleaned: false,
    };
    group.voices.add(voice);
    oscillator.onended = () => {
      this.finishVoice(group, voice);
    };
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequencyHz, startsAt);
    oscillator.connect(gain);
    gain.connect(master);
    gain.gain.setValueAtTime(0, startsAt);
    gain.gain.linearRampToValueAtTime(1, startsAt + voice.attackSeconds);
    if (endsAt !== null) {
      gain.gain.setValueAtTime(1, endsAt - voice.releaseSeconds);
      gain.gain.linearRampToValueAtTime(0, endsAt);
    }
    oscillator.start(startsAt);
    voice.scheduled = true;
    if (endsAt !== null) oscillator.stop(endsAt);
  }

  private handle(group: PlaybackGroup): AudioPlayback {
    return Object.freeze({
      id: group.id,
      startsAt: group.startsAt,
      endsAt: group.endsAt,
      finished: group.completion.promise,
      hasStarted: () => this.hasStarted(group),
      stop: () => this.stopGroup(group, 'stopped'),
      cancel: () => this.stopGroup(group, 'cancelled'),
    });
  }

  private hasStarted(group: PlaybackGroup): boolean {
    if (
      !group.settled &&
      this.context &&
      this.context.currentTime >= group.startsAt
    )
      group.started = true;
    return group.started;
  }

  private voiceGain(voice: Voice, now: number): number {
    if (voice.stopRamp) return rampValue(voice.stopRamp, now);
    if (now < voice.startsAt) return 0;
    if (voice.endsAt !== null && now >= voice.endsAt) return 0;
    const attack = Math.min(1, (now - voice.startsAt) / voice.attackSeconds);
    const release =
      voice.endsAt === null
        ? 1
        : Math.min(1, (voice.endsAt - now) / voice.releaseSeconds);
    return Math.min(attack, release);
  }

  private stopGroup(
    group: PlaybackGroup,
    status: 'stopped' | 'cancelled',
  ): Promise<PlaybackResult> {
    if (group.settled) return group.completion.promise;
    if (status === 'cancelled' || !group.stopping) group.status = status;
    if (group.stopping) return group.completion.promise;
    group.stopping = true;
    const context = this.context;
    if (!context || context.state !== 'running') {
      this.hardFinish(group, group.status);
      return group.completion.promise;
    }
    this.hasStarted(group);
    const now = context.currentTime;
    try {
      for (const voice of [...group.voices]) {
        if (
          now < voice.startsAt ||
          (voice.endsAt !== null && now >= voice.endsAt)
        ) {
          this.stopImmediately(voice, now);
          this.finishVoice(group, voice);
          continue;
        }
        const current = this.voiceGain(voice, now);
        const end = Math.min(
          now + AUDIO_SETTINGS.releaseSeconds,
          voice.endsAt ?? Infinity,
        );
        holdParameter(voice.gain.gain, now, current);
        voice.gain.gain.linearRampToValueAtTime(0, end);
        voice.stopRamp = { from: current, to: 0, start: now, end };
        voice.oscillator.stop(end);
      }
    } catch (error) {
      this.hardFinish(group, 'interrupted');
      throw error;
    }
    return group.completion.promise;
  }

  private stopImmediately(voice: Voice, now: number): void {
    if (!voice.scheduled) return;
    try {
      voice.oscillator.stop(now);
    } catch {
      /* O contexto pode estar fechado ou a fonte já ter terminado. */
    }
  }

  private finishVoice(group: PlaybackGroup, voice: Voice): void {
    if (voice.cleaned) return;
    this.hasStarted(group);
    voice.cleaned = true;
    voice.oscillator.onended = null;
    voice.oscillator.disconnect();
    voice.gain.disconnect();
    group.voices.delete(voice);
    this.settleGroup(group);
  }

  private hardFinish(group: PlaybackGroup, status: PlaybackStatus): void {
    if (group.settled) return;
    this.hasStarted(group);
    group.status = status;
    for (const voice of [...group.voices]) {
      this.stopImmediately(voice, this.context?.currentTime ?? 0);
      this.finishVoice(group, voice);
    }
    this.settleGroup(group);
  }

  private settleGroup(group: PlaybackGroup): void {
    if (group.voices.size > 0 || group.settled) return;
    group.settled = true;
    if (this.active === group) this.active = null;
    group.completion.resolve(
      Object.freeze({
        playbackId: group.id,
        status: group.status,
        started: group.started,
      }),
    );
  }

  private rejectEnable(error: unknown): void {
    const pending = this.pendingEnable;
    if (!pending) return;
    clearTimeout(pending.timeout);
    this.pendingEnable = null;
    pending.completion.reject(error);
  }

  private readonly handleStateChange = (): void => {
    const context = this.context;
    if (!context || context.state === this.lastContextState) return;
    this.lastContextState = context.state;
    if (context.state === 'running') return;
    const group = this.active;
    const started = group ? this.hasStarted(group) : false;
    this.rejectEnable(new Error('O contexto de áudio foi interrompido.'));
    if (group) this.hardFinish(group, 'interrupted');
    if (!this.disposed)
      this.onInterruption?.(
        Object.freeze({
          playbackId: group?.id ?? null,
          reason:
            context.state === 'closed'
              ? 'closed'
              : context.state === 'interrupted'
                ? 'interrupted'
                : 'suspended',
          started,
        }),
      );
  };
}
