/**
 * Vibração curta em aparelhos compatíveis (Android). Navegadores sem a API,
 * como o Safari no iPhone, simplesmente ignoram.
 */
export type HapticPattern = 'tick' | 'tick-final' | 'result' | 'final';

const PATTERNS: Record<HapticPattern, number | readonly number[]> = {
  tick: 25,
  'tick-final': [25, 60, 25],
  result: [40, 50, 40],
  final: [60, 70, 60, 70, 120],
};

export function vibrate(pattern: HapticPattern): void {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
  try {
    const value = PATTERNS[pattern];
    navigator.vibrate(typeof value === 'number' ? value : [...value]);
  } catch {
    // Alguns navegadores bloqueiam vibração sem gesto recente: ignorar.
  }
}
