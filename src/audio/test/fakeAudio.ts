import { vi } from 'vitest';

export class FakeAudioParam {
  static supportsHold = true;
  value = 0;
  readonly setValueAtTime = vi.fn<
    (value: number, time: number) => FakeAudioParam
  >((value) => {
    this.value = value;
    return this;
  });
  readonly linearRampToValueAtTime = vi.fn<
    (value: number, time: number) => FakeAudioParam
  >(() => this);
  readonly cancelScheduledValues = vi.fn<(time: number) => FakeAudioParam>(
    () => this,
  );
  readonly cancelAndHoldAtTime: ((time: number) => void) | undefined =
    FakeAudioParam.supportsHold
      ? vi.fn<(time: number) => FakeAudioParam>(() => this)
      : undefined;
}

class FakeGain {
  readonly gain = new FakeAudioParam();
  readonly connect = vi.fn<(destination: unknown) => undefined>(
    () => undefined,
  );
  readonly disconnect = vi.fn();
}

class FakeOscillator {
  readonly frequency = new FakeAudioParam();
  type = 'sine';
  onended: (() => void) | null = null;
  startsAt: number | null = null;
  stopsAt: number | null = null;
  ended = false;
  readonly connect = vi.fn<(destination: unknown) => undefined>(
    () => undefined,
  );
  readonly disconnect = vi.fn();
  readonly start = vi.fn((time: number) => {
    this.startsAt = time;
  });
  readonly stop = vi.fn((time: number) => {
    this.stopsAt = time;
  });
}

/** Contexto controlado; o avanço de tempo é sempre explícito nos testes. */
export class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  currentTime = 10;
  sampleRate = 48000;
  state = 'suspended';
  readonly destination = {};
  readonly gains: FakeGain[] = [];
  readonly oscillators: FakeOscillator[] = [];
  readonly listeners = new Set<() => void>();
  readonly createGain = vi.fn(() => {
    const node = new FakeGain();
    this.gains.push(node);
    return node;
  });
  readonly createOscillator = vi.fn(() => {
    const node = new FakeOscillator();
    this.oscillators.push(node);
    return node;
  });
  readonly resume = vi.fn((): Promise<void> => {
    this.state = 'running';
    return Promise.resolve();
  });
  readonly close = vi.fn(() => {
    this.state = 'closed';
    return Promise.resolve();
  });
  readonly addEventListener = vi.fn((_type: string, listener: () => void) => {
    this.listeners.add(listener);
  });
  readonly removeEventListener = vi.fn(
    (_type: string, listener: () => void) => {
      this.listeners.delete(listener);
    },
  );

  constructor() {
    FakeAudioContext.instances.push(this);
  }

  advanceTo(time: number): void {
    this.currentTime = time;
    for (const oscillator of this.oscillators) {
      if (
        !oscillator.ended &&
        oscillator.stopsAt !== null &&
        oscillator.stopsAt <= time
      ) {
        oscillator.ended = true;
        oscillator.onended?.();
      }
    }
  }

  changeState(state: string): void {
    this.state = state;
    for (const listener of this.listeners) listener();
  }
}
