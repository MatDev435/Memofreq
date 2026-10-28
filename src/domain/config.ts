export const ROUND_COUNT = 5;
export const MAX_ROUND_SCORE = 10;
export const MAX_GAME_SCORE = ROUND_COUNT * MAX_ROUND_SCORE;

export interface FrequencyRange {
  readonly minHz: number;
  readonly maxHz: number;
}

export interface GameRules {
  readonly version: string;
  readonly range: FrequencyRange;
  readonly countdownSeconds: number;
  readonly referenceSeconds: {
    readonly normal: number;
    readonly hard: number;
    readonly extreme: number;
  };
  readonly sequenceGapSeconds: number;
  readonly minInitialDistanceCents: number;
  readonly zeroScoreDistanceCents: number;
}

export type ModeSelection =
  | { readonly mode: 'normal' }
  | { readonly mode: 'hard' }
  | { readonly mode: 'extreme'; readonly frequencyCount: 2 | 3 };

export type Modality = 'normal' | 'hard' | 'extreme-2' | 'extreme-3';

export interface ModeSettings {
  readonly modality: Modality;
  readonly referencesPerRound: 1 | 2 | 3;
  readonly referenceSeconds: number;
  readonly showFrequencyVisually: boolean;
}

export const DEFAULT_RULES: GameRules = Object.freeze({
  version: '2',
  range: Object.freeze({ minHz: 80, maxHz: 700 }),
  countdownSeconds: 3,
  referenceSeconds: Object.freeze({ normal: 3, hard: 1.5, extreme: 1.5 }),
  sequenceGapSeconds: 0.3,
  minInitialDistanceCents: 300,
  zeroScoreDistanceCents: 500,
});

export function validateRange(range: FrequencyRange): void {
  if (
    !Number.isFinite(range.minHz) ||
    !Number.isFinite(range.maxHz) ||
    range.minHz <= 0 ||
    range.maxHz <= range.minHz ||
    Math.log2(range.maxHz) <= Math.log2(range.minHz)
  ) {
    throw new RangeError('Faixa de frequências inválida.');
  }
}

export function validateRules(rules: GameRules): void {
  validateRange(rules.range);
  const positive = [
    rules.countdownSeconds,
    rules.referenceSeconds.normal,
    rules.referenceSeconds.hard,
    rules.referenceSeconds.extreme,
    rules.zeroScoreDistanceCents,
  ];
  const nonnegative = [rules.sequenceGapSeconds, rules.minInitialDistanceCents];
  const spanCents =
    1200 * (Math.log2(rules.range.maxHz) - Math.log2(rules.range.minHz));

  if (
    rules.version.trim() === '' ||
    positive.some((value) => !Number.isFinite(value) || value <= 0) ||
    nonnegative.some((value) => !Number.isFinite(value) || value < 0) ||
    rules.minInitialDistanceCents > spanCents / 2
  ) {
    throw new RangeError('Regras inválidas ou distância inicial inviável.');
  }
}

export function snapshotRules(rules: GameRules): GameRules {
  validateRules(rules);
  return Object.freeze({
    ...rules,
    range: Object.freeze({ ...rules.range }),
    referenceSeconds: Object.freeze({ ...rules.referenceSeconds }),
  });
}

export function getModeSettings(
  selection: ModeSelection,
  rules: GameRules = DEFAULT_RULES,
): ModeSettings {
  validateRules(rules);
  switch (selection.mode) {
    case 'normal':
      return Object.freeze({
        modality: 'normal',
        referencesPerRound: 1,
        referenceSeconds: rules.referenceSeconds.normal,
        showFrequencyVisually: true,
      });
    case 'hard':
      return Object.freeze({
        modality: 'hard',
        referencesPerRound: 1,
        referenceSeconds: rules.referenceSeconds.hard,
        showFrequencyVisually: false,
      });
    case 'extreme':
      if (![2, 3].includes(selection.frequencyCount)) {
        throw new RangeError('Extreme exige duas ou três frequências.');
      }
      return Object.freeze({
        modality: selection.frequencyCount === 2 ? 'extreme-2' : 'extreme-3',
        referencesPerRound: selection.frequencyCount,
        referenceSeconds: rules.referenceSeconds.extreme,
        showFrequencyVisually: false,
      });
  }
  throw new RangeError('Modo inválido.');
}
