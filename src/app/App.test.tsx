import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameController } from '../application/GameController';
import { ControlledAudio } from '../test/controlledAudio';
import { App } from './App';

describe('Fundação do Memofreq', () => {
  it('apresenta a proposta do jogo dentro do conteúdo principal', () => {
    render(<App />);

    expect(screen.getByRole('main')).toContainElement(
      screen.getByRole('heading', { level: 1, name: 'Memofreq' }),
    );
    expect(
      screen.getByRole('button', { name: 'Iniciar partida' }),
    ).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Testar áudio' })).toBeEnabled();
  });

  it('oferece acesso ao conteúdo pelo primeiro foco de teclado', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.tab();

    expect(
      screen.getByRole('link', { name: 'Ir para o conteúdo' }),
    ).toHaveFocus();
    expect(screen.getByRole('main')).toHaveAttribute('id', 'conteudo');
  });
});

async function clickButton(element: HTMLElement) {
  await act(async () => {
    fireEvent.click(element);
    await Promise.resolve();
  });
}

function controlledApp() {
  const audios: ControlledAudio[] = [];
  const createController = () =>
    new GameController({
      createAudio: (notify) => {
        const audio = new ControlledAudio(notify);
        audios.push(audio);
        return audio;
      },
      isPageVisible: () => true,
      initialVolume: 0.4,
      createId: () => 'ui-game',
      random: () => 0.5,
      now: () => Date.now(),
    });
  return {
    createController,
    get audio() {
      const audio = audios[0];
      if (!audio) throw new Error('Áudio ausente.');
      return audio;
    },
    audios,
  };
}

describe('Normal Mode integrado', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('oferece teste e volume e conclui os cinco rounds com teclado', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    const f = controlledApp();
    render(<App createController={f.createController} />);
    await clickButton(screen.getByRole('button', { name: 'Testar áudio' }));
    expect(f.audio.playSample).toHaveBeenCalledTimes(1);
    await act(async () => {
      f.audio.current()?.finish();
      await Promise.resolve();
    });
    await clickButton(screen.getByRole('button', { name: 'Iniciar partida' }));
    for (let round = 0; round < 5; round += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });
      expect(screen.getByText('Ouça e memorize')).toBeVisible();
      await act(async () => {
        f.audio.current()?.finish();
        await Promise.resolve();
      });
      const slider = screen.getByRole('slider', { name: 'Ajustar tom' });
      expect(slider).toBeEnabled();
      expect(slider).toHaveAttribute('aria-valuetext', 'Ajuste pelo som');
      expect(screen.getByRole('status')).toBeEmptyDOMElement();
      expect(
        screen.getByRole('button', { name: 'Encerrar partida' }),
      ).toHaveFocus();
      slider.focus();
      act(() => {
        fireEvent.keyDown(slider, { key: 'Home' });
        fireEvent.keyDown(slider, { key: 'ArrowRight' });
      });
      expect(Number(slider.getAttribute('value'))).toBeCloseTo(0.001, 10);
      expect(screen.getByRole('status')).toBeEmptyDOMElement();
      await clickButton(
        screen.getByRole('button', { name: 'Confirmar tentativa' }),
      );
      expect(screen.getByText('Frequência alvo')).toBeVisible();
      expect(screen.getByRole('status')).toHaveTextContent(
        'Resposta confirmada.',
      );
      expect(screen.getByRole('status')).not.toHaveTextContent('Hz');
      await clickButton(
        screen.getByRole('button', {
          name: round === 4 ? 'Ver resultado final' : 'Próximo round',
        }),
      );
    }
    expect(
      screen.getByRole('heading', { name: 'Resultado da partida' }),
    ).toHaveFocus();
    expect(screen.getAllByRole('row')).toHaveLength(6);
    expect(f.audio.playReference).toHaveBeenCalledTimes(5);
    await clickButton(screen.getByRole('button', { name: 'Voltar ao início' }));
    expect(
      screen.getByRole('button', { name: 'Iniciar partida' }),
    ).toHaveFocus();
  });

  it('funciona com StrictMode e cancela áudio ao desmontar', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    const f = controlledApp();
    const view = render(
      <StrictMode>
        <App createController={f.createController} />
      </StrictMode>,
    );
    expect(f.audios).toHaveLength(0);
    await clickButton(screen.getByRole('button', { name: 'Iniciar partida' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    await act(async () => {
      f.audio.current()?.finish();
      await Promise.resolve();
    });
    expect(f.audios).toHaveLength(1);
    expect(screen.getByRole('slider', { name: 'Ajustar tom' })).toBeEnabled();
    view.unmount();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(f.audio.current()?.settled).toBe(true);
    expect(f.audio.dispose).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
