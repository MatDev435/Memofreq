export interface ReferenceTone {
  readonly frequencyHz: number;
  readonly durationSeconds: number;
}

export type PlaybackStatus =
  'completed' | 'stopped' | 'cancelled' | 'interrupted';

export interface PlaybackResult {
  readonly playbackId: number;
  readonly status: PlaybackStatus;
  readonly started: boolean;
}

export interface AudioPlayback {
  readonly id: number;
  readonly startsAt: number;
  readonly endsAt: number | null;
  readonly finished: Promise<PlaybackResult>;
  hasStarted(): boolean;
  stop(): Promise<PlaybackResult>;
  cancel(): Promise<PlaybackResult>;
}

export interface AudioInterruption {
  readonly playbackId: number | null;
  readonly reason: 'suspended' | 'interrupted' | 'closed';
  readonly started: boolean;
}

export interface AudioPort {
  enable(): Promise<void>;
  playSample(): AudioPlayback;
  playReference(tone: ReferenceTone): AudioPlayback;
  playSequence(
    tones: readonly ReferenceTone[],
    gapSeconds: number,
  ): AudioPlayback;
  startContinuous(frequencyHz: number): AudioPlayback;
  setFrequency(frequencyHz: number): void;
  setVolume(volume: number): void;
  cancel(): Promise<void>;
  dispose(): Promise<void>;
}
