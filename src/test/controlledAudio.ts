import { vi } from 'vitest';
import type {
  AudioInterruption,
  AudioPlayback,
  AudioPort,
  PlaybackResult,
  PlaybackStatus,
  ReferenceTone,
} from '../application/audioPort';

export class ControlledPlayback implements AudioPlayback {
  readonly startsAt = 0;
  readonly endsAt = null;
  private resolve: ((result: PlaybackResult) => void) | null = null;
  readonly finished = new Promise<PlaybackResult>((resolve) => {
    this.resolve = resolve;
  });
  settled = false;
  started = true;
  holdStop = false;
  constructor(readonly id: number) {}
  hasStarted(): boolean {
    return this.started;
  }
  finish(status: PlaybackStatus = 'completed'): void {
    if (this.settled) return;
    this.settled = true;
    this.resolve?.({ playbackId: this.id, status, started: this.started });
  }
  readonly stop = vi.fn(() => {
    if (!this.holdStop) this.finish('stopped');
    return this.finished;
  });
  readonly cancel = vi.fn(() => {
    this.finish('cancelled');
    return this.finished;
  });
}

export class ControlledAudio implements AudioPort {
  readonly plays: {
    readonly kind: 'sample' | 'reference' | 'attempt';
    readonly handle: ControlledPlayback;
    readonly tone: ReferenceTone | null;
  }[] = [];
  readonly enable = vi.fn(() => Promise.resolve());
  readonly setVolume = vi.fn<(volume: number) => void>();
  readonly setFrequency = vi.fn<(frequencyHz: number) => void>();
  readonly playSample = vi.fn(() => this.play('sample', null));
  readonly playReference = vi.fn((tone: ReferenceTone) =>
    this.play('reference', tone),
  );
  readonly playSequence = vi.fn((tones: readonly ReferenceTone[]) =>
    this.play('reference', tones[0] ?? null),
  );
  readonly startContinuous = vi.fn((frequencyHz: number) =>
    this.play('attempt', { frequencyHz, durationSeconds: 0 }),
  );
  readonly cancel = vi.fn(() => {
    this.current()?.finish('cancelled');
    return Promise.resolve();
  });
  readonly dispose = vi.fn(() => {
    this.current()?.finish('cancelled');
    return Promise.resolve();
  });
  constructor(readonly onInterruption: (event: AudioInterruption) => void) {}
  current(): ControlledPlayback | undefined {
    return this.plays.at(-1)?.handle;
  }
  interrupt(reason: AudioInterruption['reason'] = 'suspended'): void {
    const latest = this.current();
    const current = latest && !latest.settled ? latest : undefined;
    current?.finish('interrupted');
    this.onInterruption({
      playbackId: current?.id ?? null,
      reason,
      started: current?.started ?? false,
    });
  }
  private play(
    kind: 'sample' | 'reference' | 'attempt',
    tone: ReferenceTone | null,
  ): ControlledPlayback {
    const handle = new ControlledPlayback(this.plays.length + 1);
    this.plays.push({ kind, handle, tone });
    return handle;
  }
}
