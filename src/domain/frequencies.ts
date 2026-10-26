import { DEFAULT_RULES, validateRange, validateRules } from './config';
import type { FrequencyRange, GameRules } from './config';
import { distanceCents } from './scoring';

export type RandomSource = () => number;

function randomUnit(random: RandomSource): number {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError('A fonte aleatória deve retornar um valor em [0, 1).');
  }
  return value;
}

export function isFrequencyInRange(
  frequencyHz: number,
  range: FrequencyRange,
): boolean {
  return (
    Number.isFinite(frequencyHz) &&
    frequencyHz >= range.minHz &&
    frequencyHz <= range.maxHz
  );
}

export function positionToFrequency(
  position: number,
  range: FrequencyRange = DEFAULT_RULES.range,
): number {
  validateRange(range);
  if (!Number.isFinite(position) || position < 0 || position > 1) {
    throw new RangeError('Posição deve estar entre zero e um.');
  }
  if (position === 0) return range.minHz;
  if (position === 1) return range.maxHz;
  const logHz =
    Math.log2(range.minHz) +
    position * (Math.log2(range.maxHz) - Math.log2(range.minHz));
  return Math.min(range.maxHz, Math.max(range.minHz, 2 ** logHz));
}

export function frequencyToPosition(
  frequencyHz: number,
  range: FrequencyRange = DEFAULT_RULES.range,
): number {
  validateRange(range);
  if (!isFrequencyInRange(frequencyHz, range)) {
    throw new RangeError('Frequência fora da faixa.');
  }
  return (
    (Math.log2(frequencyHz) - Math.log2(range.minHz)) /
    (Math.log2(range.maxHz) - Math.log2(range.minHz))
  );
}

export function generateReferenceSequence(
  count: number,
  random: RandomSource,
  range: FrequencyRange = DEFAULT_RULES.range,
): readonly number[] {
  validateRange(range);
  if (!Number.isInteger(count) || count < 1 || count > 3) {
    throw new RangeError('A sequência exige de uma a três frequências.');
  }
  const references = new Set<number>();
  // Uma fonte defeituosa não pode prender o jogo em um laço de rejeição.
  for (let draw = 0; references.size < count && draw < 32 * count; draw += 1) {
    references.add(positionToFrequency(randomUnit(random), range));
  }
  if (references.size !== count) {
    throw new RangeError(
      'A fonte aleatória não produziu frequências distintas.',
    );
  }
  return Object.freeze([...references]);
}

export function isValidInitialFrequency(
  frequencyHz: number,
  targetHz: number,
  rules: GameRules,
): boolean {
  return (
    isFrequencyInRange(frequencyHz, rules.range) &&
    isFrequencyInRange(targetHz, rules.range) &&
    distanceCents(frequencyHz, targetHz) >= rules.minInitialDistanceCents
  );
}

export function generateInitialFrequency(
  targetHz: number,
  random: RandomSource,
  rules: GameRules = DEFAULT_RULES,
): number {
  validateRules(rules);
  if (!isFrequencyInRange(targetHz, rules.range)) {
    throw new RangeError('Alvo fora da faixa.');
  }

  const min = Math.log2(rules.range.minHz);
  const max = Math.log2(rules.range.maxHz);
  const target = Math.log2(targetHz);
  const margin = rules.minInitialDistanceCents / 1200;
  const lowerEnd = Math.max(min, Math.min(max, target - margin));
  const upperStart = Math.min(max, Math.max(min, target + margin));
  const lowerWidth = lowerEnd - min;
  const upperWidth = max - upperStart;
  const unit = randomUnit(random);
  const offset = unit * (lowerWidth + upperWidth);
  const logHz =
    offset < lowerWidth ? min + offset : upperStart + offset - lowerWidth;
  let frequency = Math.min(
    rules.range.maxHz,
    Math.max(rules.range.minHz, 2 ** logHz),
  );

  // Corrigir apenas erro de ponto flutuante na borda dos 300 cents.
  for (let correction = 0; correction < 4; correction += 1) {
    if (isValidInitialFrequency(frequency, targetHz, rules)) return frequency;
    const direction = frequency < targetHz ? -1 : 1;
    frequency = Math.min(
      rules.range.maxHz,
      Math.max(
        rules.range.minHz,
        frequency + direction * Math.max(1, frequency) * Number.EPSILON * 4,
      ),
    );
  }

  // No limite de viabilidade, o conjunto permitido pode conter só extremos.
  const endpoints = [rules.range.minHz, rules.range.maxHz].filter((value) =>
    isValidInitialFrequency(value, targetHz, rules),
  );
  const endpoint =
    endpoints[
      Math.min(endpoints.length - 1, Math.floor(unit * endpoints.length))
    ];
  if (endpoint === undefined) {
    throw new RangeError('Nenhuma posição inicial válida para esse alvo.');
  }
  return endpoint;
}
