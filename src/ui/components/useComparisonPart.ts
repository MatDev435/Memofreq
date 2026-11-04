import { useEffect, useState } from 'react';
import {
  COMPARISON_GAP_SECONDS,
  COMPARISON_TONE_SECONDS,
} from '../../application/comparison';

export interface ComparisonControl {
  /** Token da reprodução desta tentativa, ou `null` se não estiver tocando. */
  readonly playing: number | null;
  readonly onPlay: () => void;
  readonly onStop: () => void;
}

export type ComparisonPart = 'target' | 'player' | null;

/** Qual som da escuta comparativa está tocando, para o destaque visual. */
export function useComparisonPart(token: number | null): ComparisonPart {
  const [state, setState] = useState<{
    readonly token: number | null;
    readonly part: ComparisonPart;
  }>({ token: null, part: null });
  useEffect(() => {
    if (token === null) return;
    const tone = COMPARISON_TONE_SECONDS * 1000;
    const gap = COMPARISON_GAP_SECONDS * 1000;
    const timers = [
      setTimeout(() => {
        setState({ token, part: null });
      }, tone),
      setTimeout(() => {
        setState({ token, part: 'player' });
      }, tone + gap),
      setTimeout(
        () => {
          setState({ token, part: null });
        },
        tone * 2 + gap,
      ),
    ];
    return () => {
      for (const timer of timers) clearTimeout(timer);
    };
  }, [token]);
  if (token === null) return null;
  // Até o primeiro temporizador, a reprodução está no alvo.
  return state.token === token ? state.part : 'target';
}
