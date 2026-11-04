import type { ReferenceTone } from './audioPort';

/**
 * Escuta comparativa após o resultado: o alvo e, em seguida, o palpite, com
 * o mesmo timbre do jogo. Só existe em telas de resultado.
 */
export const COMPARISON_TONE_SECONDS = 1.5;
export const COMPARISON_GAP_SECONDS = 0.6;

export interface ComparisonState {
  readonly roundIndex: number;
  readonly attemptIndex: number;
  /** Muda a cada reprodução, para reiniciar o destaque visual. */
  readonly token: number;
}

export function comparisonTones(
  targetHz: number,
  playerHz: number,
): readonly ReferenceTone[] {
  return [
    { frequencyHz: targetHz, durationSeconds: COMPARISON_TONE_SECONDS },
    { frequencyHz: playerHz, durationSeconds: COMPARISON_TONE_SECONDS },
  ];
}
