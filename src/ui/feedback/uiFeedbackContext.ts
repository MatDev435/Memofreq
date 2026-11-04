import { createContext, useContext, useEffect } from 'react';
import type { UiSound } from '../../audio/UiSounds';

export interface UiFeedback {
  readonly soundsEnabled: boolean;
  readonly toggleSounds: () => void;
  /** Animações decorativas permitidas (preferência do app e do sistema). */
  readonly motion: boolean;
  /** Sons da contagem: tocam mesmo com a interface silenciada. */
  readonly countdownTick: (final: boolean) => void;
  readonly roundResult: (ratio: number) => void;
  readonly finalResult: (ratio: number) => void;
  readonly cue: (sound: Extract<UiSound, 'join' | 'leave'>) => void;
  /** Silencia sons de interface enquanto `quiet` for verdadeiro. */
  readonly setQuiet: (quiet: boolean) => void;
}

const noop = () => undefined;
export const UiFeedbackContext = createContext<UiFeedback>({
  soundsEnabled: false,
  toggleSounds: noop,
  motion: false,
  countdownTick: noop,
  roundResult: noop,
  finalResult: noop,
  cue: noop,
  setQuiet: noop,
});

export function useUiFeedback(): UiFeedback {
  return useContext(UiFeedbackContext);
}

/** Mantém a interface sem efeitos sonoros durante referência e tentativa. */
export function useQuietUi(quiet: boolean): void {
  const { setQuiet } = useUiFeedback();
  useEffect(() => {
    setQuiet(quiet);
    return () => {
      setQuiet(false);
    };
  }, [quiet, setQuiet]);
}
