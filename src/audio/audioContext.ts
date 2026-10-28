/** Somente a parte de AudioContext usada pela engine; permite renderização controlada. */
export interface EngineAudioContext {
  readonly currentTime: number;
  readonly sampleRate: number;
  readonly state: string;
  readonly destination: AudioDestinationNode;
  createGain(): GainNode;
  createOscillator(): OscillatorNode;
  createBiquadFilter(): BiquadFilterNode;
  createWaveShaper(): WaveShaperNode;
  createDynamicsCompressor(): DynamicsCompressorNode;
  resume(): Promise<void>;
  close(): Promise<void>;
  addEventListener(type: 'statechange', listener: () => void): void;
  removeEventListener(type: 'statechange', listener: () => void): void;
}

export interface LinearRamp {
  readonly from: number;
  readonly to: number;
  readonly start: number;
  readonly end: number;
}

export function rampValue(ramp: LinearRamp, time: number): number {
  if (ramp.end <= ramp.start) return ramp.to;
  if (time <= ramp.start) return ramp.from;
  if (time >= ramp.end) return ramp.to;
  return (
    ramp.from +
    (ramp.to - ramp.from) * ((time - ramp.start) / (ramp.end - ramp.start))
  );
}

export function holdParameter(
  param: AudioParam,
  time: number,
  fallbackValue: number,
): void {
  if (typeof param.cancelAndHoldAtTime === 'function') {
    param.cancelAndHoldAtTime(time);
  } else {
    param.cancelScheduledValues(time);
    param.setValueAtTime(fallbackValue, time);
  }
}
