import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { UiSounds } from '../../audio/UiSounds';
import type { UiSound } from '../../audio/UiSounds';
import {
  UiFeedbackContext,
  useQuietUi,
  useUiFeedback,
} from './uiFeedbackContext';
import type { UiFeedback } from './uiFeedbackContext';

export const UI_SOUNDS_STORAGE_KEY = 'memofreq:ui-sounds';
const BACK_SELECTOR =
  '.exit-button, .header-home, .quiet-button, [data-sfx="back"]';

function readEnabled(): boolean {
  try {
    return window.localStorage.getItem(UI_SOUNDS_STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

function storeEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(UI_SOUNDS_STORAGE_KEY, enabled ? 'on' : 'off');
  } catch {
    // Armazenamento indisponível: a preferência vale só nesta sessão.
  }
}

function reducedMotion(): boolean {
  // Sem matchMedia (ambientes de teste), as animações por script ficam desligadas.
  return (
    typeof window.matchMedia !== 'function' ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function focusVisible(element: Element): boolean {
  try {
    return element.matches(':focus-visible');
  } catch {
    return false;
  }
}

function interactive(element: Element | null): Element | null {
  const found = element?.closest('button, a[href], label') ?? null;
  if (!found) return null;
  if (found instanceof HTMLButtonElement && found.disabled) return null;
  if (
    found.tagName === 'LABEL' &&
    !found.querySelector('input[type="radio"]:not(:disabled)')
  )
    return null;
  return found;
}

export function QuietUi({ quiet }: { readonly quiet: boolean }) {
  useQuietUi(quiet);
  return null;
}

/** Toca o som de revelação uma vez por montagem; `ratio` vai de 0 a 1. */
export function ResultCue({
  ratio,
  final = false,
}: {
  readonly ratio: number;
  readonly final?: boolean;
}) {
  const { roundResult, finalResult } = useUiFeedback();
  const played = useRef(false);
  useEffect(() => {
    if (played.current) return;
    played.current = true;
    (final ? finalResult : roundResult)(ratio);
  }, [ratio, final, roundResult, finalResult]);
  return null;
}

export function UiFeedbackProvider({
  motionPaused,
  createSounds = () => new UiSounds(),
  children,
}: {
  readonly motionPaused: boolean;
  readonly createSounds?: () => UiSounds;
  readonly children: ReactNode;
}) {
  const [sounds] = useState(createSounds);
  const [soundsEnabled, setSoundsEnabled] = useState(readEnabled);
  const quiet = useRef(false);
  const enabled = useRef(soundsEnabled);
  useEffect(() => {
    enabled.current = soundsEnabled;
  }, [soundsEnabled]);

  useEffect(
    () => () => {
      sounds.dispose();
    },
    [sounds],
  );

  const ui = useCallback(
    (sound: UiSound) => {
      if (enabled.current && !quiet.current) sounds.play(sound);
    },
    [sounds],
  );

  useEffect(() => {
    let hovered: Element | null = null;
    const target = (event: Event): Element | null =>
      event.target instanceof Element ? event.target : null;
    const onPointerOver = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      const element = interactive(target(event));
      if (element === hovered) return;
      hovered = element;
      if (element) ui('hover');
    };
    const onFocusIn = (event: FocusEvent) => {
      const element = target(event);
      if (element && interactive(element) && focusVisible(element)) ui('hover');
    };
    const onClick = (event: MouseEvent) => {
      const element = target(event)?.closest('button, a[href]');
      if (!element) return;
      if (element instanceof HTMLButtonElement && element.disabled) return;
      ui(element.matches(BACK_SELECTOR) ? 'back' : 'click');
    };
    const onChange = (event: Event) => {
      const element = target(event);
      if (element instanceof HTMLInputElement && element.type === 'radio')
        ui('click');
    };
    document.addEventListener('pointerover', onPointerOver);
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('click', onClick, true);
    document.addEventListener('change', onChange);
    return () => {
      document.removeEventListener('pointerover', onPointerOver);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('change', onChange);
    };
  }, [ui]);

  const toggleSounds = useCallback(() => {
    const next = !enabled.current;
    enabled.current = next;
    storeEnabled(next);
    setSoundsEnabled(next);
    // O clique delegado já tocou ao desligar; ao ligar, confirma com um clique.
    if (next && !quiet.current) sounds.play('click');
  }, [sounds]);
  const countdownTick = useCallback(
    (final: boolean) => {
      if (enabled.current) sounds.play(final ? 'tick-final' : 'tick');
    },
    [sounds],
  );
  const roundResult = useCallback(
    (ratio: number) => {
      if (enabled.current) sounds.playResult(ratio);
    },
    [sounds],
  );
  const finalResult = useCallback(
    (ratio: number) => {
      if (enabled.current) sounds.playFinal(ratio);
    },
    [sounds],
  );
  const cue = useCallback(
    (sound: Extract<UiSound, 'join' | 'leave'>) => {
      ui(sound);
    },
    [ui],
  );
  const setQuiet = useCallback((next: boolean) => {
    quiet.current = next;
  }, []);

  const motion = !motionPaused && !reducedMotion();
  const value = useMemo<UiFeedback>(
    () => ({
      soundsEnabled,
      toggleSounds,
      motion,
      countdownTick,
      roundResult,
      finalResult,
      cue,
      setQuiet,
    }),
    [
      soundsEnabled,
      toggleSounds,
      motion,
      countdownTick,
      roundResult,
      finalResult,
      cue,
      setQuiet,
    ],
  );

  return (
    <UiFeedbackContext.Provider value={value}>
      {children}
    </UiFeedbackContext.Provider>
  );
}
