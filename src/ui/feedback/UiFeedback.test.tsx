import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { UiSounds } from '../../audio/UiSounds';
import type { UiSound } from '../../audio/UiSounds';
import { SoundToggle } from '../components/SoundToggle';
import {
  QuietUi,
  UiFeedbackProvider,
  UI_SOUNDS_STORAGE_KEY,
} from './UiFeedback';
import { useUiFeedback } from './uiFeedbackContext';

class RecordingSounds extends UiSounds {
  readonly played: string[] = [];
  constructor() {
    super(() => null);
  }
  override play(sound: UiSound): void {
    this.played.push(sound);
  }
  override playResult(): void {
    this.played.push('result');
  }
  override playFinal(): void {
    this.played.push('final');
  }
}

function Tick() {
  const { countdownTick } = useUiFeedback();
  return (
    <button
      type="button"
      data-testid="tick"
      onPointerDown={() => {
        countdownTick(false);
      }}
    />
  );
}

function setup(quiet: boolean) {
  const sounds = new RecordingSounds();
  const view = render(
    <UiFeedbackProvider motionPaused={false} createSounds={() => sounds}>
      <QuietUi quiet={quiet} />
      <button type="button">Iniciar</button>
      <button type="button" className="exit-button">
        Sair
      </button>
      <SoundToggle />
      <Tick />
    </UiFeedbackProvider>,
  );
  return { sounds, view };
}

afterEach(() => {
  window.localStorage.clear();
});

describe('Efeitos sonoros da interface', () => {
  it('vêm ligados por padrão e diferenciam confirmar e voltar', () => {
    const { sounds } = setup(false);
    expect(
      screen.getByRole('button', { name: 'Efeitos sonoros' }),
    ).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }));
    expect(sounds.played).toEqual(['click', 'back']);
  });

  it('ficam em silêncio durante a partida, exceto a contagem', () => {
    const { sounds } = setup(true);
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar' }));
    fireEvent.pointerDown(screen.getByTestId('tick'));
    expect(sounds.played).toEqual(['tick']);
  });

  it('guardam a preferência e silenciam tudo quando desligados', () => {
    const { sounds, view } = setup(false);
    act(() => {
      screen.getByRole('button', { name: 'Efeitos sonoros' }).click();
    });
    expect(window.localStorage.getItem(UI_SOUNDS_STORAGE_KEY)).toBe('off');
    sounds.played.length = 0;
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar' }));
    fireEvent.pointerDown(screen.getByTestId('tick'));
    expect(sounds.played).toEqual([]);
    view.unmount();
    setup(false);
    expect(
      screen.getByRole('button', { name: 'Efeitos sonoros' }),
    ).toHaveAttribute('aria-pressed', 'false');
  });

  it('não falham sem Web Audio', () => {
    const sounds = new UiSounds(() => null);
    expect(() => {
      sounds.play('click');
      sounds.playResult(1);
      sounds.playFinal(0.2);
    }).not.toThrow();
  });
});
