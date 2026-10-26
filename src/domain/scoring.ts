import { DEFAULT_RULES, MAX_ROUND_SCORE, ROUND_COUNT } from './config';

export interface FrequencyScore {
  readonly targetHz: number;
  readonly playerHz: number;
  readonly differenceHz: number;
  readonly distanceCents: number;
  readonly score: number;
}

export function distanceCents(firstHz: number, secondHz: number): number {
  if (
    !Number.isFinite(firstHz) ||
    !Number.isFinite(secondHz) ||
    firstHz <= 0 ||
    secondHz <= 0
  ) {
    throw new RangeError('Frequências devem ser positivas e finitas.');
  }
  return 1200 * Math.abs(Math.log2(firstHz) - Math.log2(secondHz));
}

export function evaluateAttempt(
  targetHz: number,
  playerHz: number,
  zeroScoreDistanceCents = DEFAULT_RULES.zeroScoreDistanceCents,
): FrequencyScore {
  if (!Number.isFinite(zeroScoreDistanceCents) || zeroScoreDistanceCents <= 0) {
    throw new RangeError('Limite de pontuação inválido.');
  }
  const distance = distanceCents(playerHz, targetHz);
  return Object.freeze({
    targetHz,
    playerHz,
    differenceHz: Math.abs(playerHz - targetHz),
    distanceCents: distance,
    score: MAX_ROUND_SCORE * Math.max(0, 1 - distance / zeroScoreDistanceCents),
  });
}

function validateScores(scores: readonly number[]): void {
  if (
    scores.length === 0 ||
    Array.from(scores).some(
      (score) =>
        !Number.isFinite(score) || score < 0 || score > MAX_ROUND_SCORE,
    )
  ) {
    throw new RangeError('Pontuações inválidas.');
  }
}

export function meanScore(scores: readonly number[]): number {
  validateScores(scores);
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

export function totalScore(roundScores: readonly number[]): number {
  validateScores(roundScores);
  if (roundScores.length !== ROUND_COUNT) {
    throw new RangeError('O resultado final exige exatamente cinco rounds.');
  }
  return roundScores.reduce((sum, score) => sum + score, 0);
}
