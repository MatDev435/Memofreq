/**
 * Efeitos sonoros da interface, separados da engine dos tons do jogo.
 *
 * Usa um AudioContext próprio, criado sob demanda no primeiro som (sempre após
 * um gesto do usuário). Cliques e contagem são ruído filtrado, sem altura
 * definida, para não deixar referência de altura na memória do jogador. Os
 * sons com nota tocam apenas depois do palpite (resultados).
 */
export type UiSound =
  'hover' | 'click' | 'back' | 'tick' | 'tick-final' | 'join' | 'leave';

export const UI_SOUNDS_VOLUME = 0.35;

type ContextFactory = () => AudioContext | null;

function browserContext(): AudioContext | null {
  if (typeof window === 'undefined' || typeof AudioContext === 'undefined')
    return null;
  try {
    return new AudioContext();
  } catch {
    return null;
  }
}

export class UiSounds {
  private context: AudioContext | null = null;
  private output: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private unavailable = false;
  private lastHover = 0;

  constructor(
    private readonly createContext: ContextFactory = browserContext,
  ) {}

  play(sound: UiSound): void {
    const ctx = this.ready();
    if (!ctx) return;
    const t = ctx.currentTime + 0.005;
    switch (sound) {
      case 'hover':
        if (t - this.lastHover < 0.045) return;
        this.lastHover = t;
        this.burst(ctx, t, { freq: 5200, q: 1.4, gain: 0.08, decay: 0.018 });
        return;
      case 'click':
        this.burst(ctx, t, { freq: 2600, q: 1.1, gain: 0.32, decay: 0.035 });
        this.burst(ctx, t, { freq: 900, q: 0.8, gain: 0.18, decay: 0.05 });
        return;
      case 'back':
        this.burst(ctx, t, { freq: 1300, q: 0.9, gain: 0.26, decay: 0.05 });
        return;
      case 'tick':
        this.burst(ctx, t, { freq: 1800, q: 2.2, gain: 0.4, decay: 0.045 });
        return;
      case 'tick-final':
        this.burst(ctx, t, { freq: 1800, q: 2.2, gain: 0.45, decay: 0.045 });
        this.burst(ctx, t + 0.07, {
          freq: 2600,
          q: 2.2,
          gain: 0.3,
          decay: 0.04,
        });
        return;
      case 'join':
        this.notes(ctx, t, [660, 880], 0.09, 0.16);
        return;
      case 'leave':
        this.notes(ctx, t, [700, 520], 0.09, 0.14);
        return;
    }
  }

  /** Som curto após a revelação de um round; `ratio` vai de 0 a 1. */
  playResult(ratio: number): void {
    const ctx = this.ready();
    if (!ctx) return;
    const t = ctx.currentTime + 0.02;
    if (ratio >= 0.8) this.notes(ctx, t, [523.25, 659.25, 783.99], 0.08, 0.22);
    else if (ratio >= 0.5) this.notes(ctx, t, [523.25, 659.25], 0.1, 0.2);
    else this.notes(ctx, t, [392, 349.23], 0.12, 0.18);
  }

  /** Fanfarra curta do resultado final; `ratio` vai de 0 a 1. */
  playFinal(ratio: number): void {
    const ctx = this.ready();
    if (!ctx) return;
    const t = ctx.currentTime + 0.05;
    if (ratio >= 0.8) {
      this.notes(ctx, t, [523.25, 659.25, 783.99], 0.11, 0.2);
      this.chord(ctx, t + 0.36, [523.25, 659.25, 783.99, 1046.5], 0.9, 0.12);
    } else if (ratio >= 0.5) {
      this.notes(ctx, t, [440, 554.37], 0.12, 0.2);
      this.chord(ctx, t + 0.26, [440, 554.37, 659.25], 0.7, 0.12);
    } else {
      this.notes(ctx, t, [392, 440], 0.13, 0.18);
      this.chord(ctx, t + 0.28, [349.23, 440, 523.25], 0.6, 0.1);
    }
  }

  dispose(): void {
    const ctx = this.context;
    this.context = null;
    this.output = null;
    if (ctx) void ctx.close().catch(() => undefined);
  }

  private ready(): AudioContext | null {
    if (this.unavailable) return null;
    if (!this.context) {
      const ctx = this.createContext();
      if (!ctx) {
        this.unavailable = true;
        return null;
      }
      const output = ctx.createGain();
      output.gain.value = UI_SOUNDS_VOLUME;
      output.connect(ctx.destination);
      this.context = ctx;
      this.output = output;
    }
    if (this.context.state === 'suspended')
      void this.context.resume().catch(() => undefined);
    return this.context;
  }

  private noiseBuffer(ctx: AudioContext): AudioBuffer {
    if (!this.noise) {
      const length = Math.floor(ctx.sampleRate * 0.12);
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
      this.noise = buffer;
    }
    return this.noise;
  }

  private burst(
    ctx: AudioContext,
    t: number,
    {
      freq,
      q,
      gain,
      decay,
    }: { freq: number; q: number; gain: number; decay: number },
  ): void {
    if (!this.output) return;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = q;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(gain, t + 0.002);
    env.gain.exponentialRampToValueAtTime(0.0001, t + decay * 3);
    source.connect(filter).connect(env).connect(this.output);
    source.start(t);
    source.stop(t + decay * 3 + 0.01);
  }

  private tone(
    ctx: AudioContext,
    t: number,
    freq: number,
    duration: number,
    gain: number,
  ): void {
    if (!this.output) return;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(gain, t + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(env).connect(this.output);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  private notes(
    ctx: AudioContext,
    t: number,
    freqs: readonly number[],
    step: number,
    gain: number,
  ): void {
    freqs.forEach((freq, i) => {
      this.tone(ctx, t + i * step, freq, step * 2.2, gain);
    });
  }

  private chord(
    ctx: AudioContext,
    t: number,
    freqs: readonly number[],
    duration: number,
    gain: number,
  ): void {
    for (const freq of freqs) this.tone(ctx, t, freq, duration, gain);
  }
}
