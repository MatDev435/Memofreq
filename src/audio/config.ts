export const AUDIO_SETTINGS = Object.freeze({
  attackSeconds: 0.025,
  releaseSeconds: 0.17,
  smoothingSeconds: 0.015,
  schedulingLeadSeconds: 0.01,
  enableTimeoutMs: 5000,
  maximumGain: 0.15,
  initialVolume: 0.4,
  sampleDurationSeconds: 0.5,
});

export const TIMBRE = Object.freeze({
  partials: Object.freeze([
    Object.freeze({ multiplier: 0.5, gain: 0.28 }),
    Object.freeze({ multiplier: 1, gain: 0 }),
    Object.freeze({ multiplier: 1.5, gain: 0 }),
    Object.freeze({ multiplier: 2, gain: 0.44 }),
    Object.freeze({ multiplier: 3, gain: 0.24 }),
    Object.freeze({ multiplier: 4, gain: 0.12 }),
    Object.freeze({ multiplier: 5, gain: 0.07 }),
    Object.freeze({ multiplier: 6, gain: 0 }),
  ]),
  lowpassHz: 1000,
  lowpassQ: 0.1,
  saturation: 0.09,
  postLowpassHz: 9000,
  compressor: Object.freeze({
    threshold: -14,
    knee: 12,
    ratio: 10,
    attack: 0.003,
    release: 0.18,
  }),
});

export const ACTIVE_PARTIALS = Object.freeze(
  TIMBRE.partials.filter(({ gain }) => gain > 0),
);
export const TIMBRE_NORMALIZATION =
  0.72 /
  Math.max(
    1,
    Math.sqrt(TIMBRE.partials.reduce((sum, { gain }) => sum + gain ** 2, 0)),
  );

/** Curva ímpar e normalizada; criada uma vez, sem processamento JS por amostra. */
export function createSaturationCurve(): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(4097);
  const k = 1 + TIMBRE.saturation * 7;
  for (let i = 0; i < curve.length; i += 1) {
    const x = (2 * i) / (curve.length - 1) - 1;
    curve[i] = Math.tanh(x * k) / Math.tanh(k);
  }
  return curve;
}
