import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatHz } from '../ui/format';
import { positionToFrequency } from '../domain/frequencies';
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
  let draw = 0;
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
      random: () => ((++draw % 7) + 1) / 10,
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
    expect(
      screen.getByRole('img', { name: 'Gráfico de pontuação dos rounds' }),
    ).toBeVisible();
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

describe.each([
  { mode: 'Hard', count: 1 },
  { mode: 'Extreme', count: 2 },
  { mode: 'Extreme', count: 3 },
])('$mode com $count referências', ({ mode, count }) => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('seleciona, joga cinco rounds com valores ocultos e preserva a modalidade no reinício', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    const f = controlledApp();
    render(<App createController={f.createController} />);
    await clickButton(
      screen.getByRole('radio', { name: new RegExp(`^${mode}`) }),
    );
    if (mode === 'Extreme') {
      await clickButton(
        screen.getByRole('radio', { name: `${String(count)} frequências` }),
      );
    }
    await clickButton(screen.getByRole('button', { name: 'Iniciar partida' }));
    for (let round = 0; round < 5; round += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });
      await act(async () => {
        f.audio.current()?.finish();
        await Promise.resolve();
      });
      for (let attempt = 0; attempt < count; attempt += 1) {
        expect(screen.queryByRole('radio')).not.toBeInTheDocument();
        expect(screen.queryByText(/Hz/)).not.toBeInTheDocument();
        expect(document.querySelector('.frequency-readout')).toBeNull();
        const slider = screen.getByRole('slider', { name: 'Ajustar tom' });
        expect(slider).toBeEnabled();
        expect(slider).toHaveAttribute('aria-valuetext', 'Ajuste pelo som');
        expect(slider).not.toHaveAttribute('title');
        expect(slider).not.toHaveAttribute('aria-describedby');
        expect(Number(slider.getAttribute('value'))).toBeGreaterThanOrEqual(0);
        expect(Number(slider.getAttribute('value'))).toBeLessThanOrEqual(1);
        expect(screen.getByRole('status')).toBeEmptyDOMElement();
        if (count > 1)
          expect(
            screen.getByText(
              `Frequência ${String(attempt + 1)} de ${String(count)}`,
            ),
          ).toBeVisible();
        act(() => {
          fireEvent.keyDown(slider, { key: 'End' });
          fireEvent.keyDown(slider, { key: 'PageDown' });
          fireEvent.keyDown(slider, { key: 'ArrowLeft' });
        });
        expect(Number(slider.getAttribute('value'))).toBeCloseTo(0.989, 10);
        await clickButton(screen.getByRole('button', { name: 'Diminuir tom' }));
        expect(Number(slider.getAttribute('value'))).toBeCloseTo(0.988, 10);
        const confirm = screen.getByRole('button', {
          name: 'Confirmar tentativa',
        });
        act(() => {
          confirm.focus();
        });
        const voice = f.audio.current();
        await clickButton(confirm);
        if (attempt < count - 1) {
          expect(screen.queryByText('Frequência alvo')).not.toBeInTheDocument();
          expect(screen.queryByText(/Hz/)).not.toBeInTheDocument();
          expect(screen.queryByText(/Média do round/)).not.toBeInTheDocument();
          expect(
            screen.queryByRole('button', { name: 'Próxima tentativa' }),
          ).not.toBeInTheDocument();
          expect(screen.getByRole('status')).toBeEmptyDOMElement();
          expect(
            screen.getByRole('button', { name: 'Confirmar tentativa' }),
          ).toBe(confirm);
          expect(confirm).toHaveFocus();
          expect(f.audio.current()).toBe(voice);
          expect(voice?.stop).not.toHaveBeenCalled();
          expect(voice?.cancel).not.toHaveBeenCalled();
          expect(Number(slider.getAttribute('value'))).not.toBeCloseTo(
            0.988,
            8,
          );
          const position = slider.getAttribute('value');
          act(() => {
            fireEvent.click(confirm, { detail: 2 });
            fireEvent.keyDown(confirm, { key: 'Enter', repeat: true });
          });
          expect(slider).toHaveAttribute('value', position);
          expect(
            screen.getByText(
              `Frequência ${String(attempt + 2)} de ${String(count)}`,
            ),
          ).toBeVisible();
        } else {
          expect(screen.getAllByText('Frequência alvo')).toHaveLength(count);
          expect(screen.getByRole('status')).toHaveTextContent(
            'Resposta confirmada.',
          );
          expect(screen.getByRole('status')).not.toHaveTextContent(/Hz|\d/);
        }
      }
      if (count > 1) {
        expect(
          screen.getByRole('heading', { name: /Média do round:/ }),
        ).toBeVisible();
        const references = f.audio.playSequence.mock.calls[round]?.[0];
        references?.forEach((reference, index) => {
          const result = screen.getByRole('region', {
            name: `Frequência ${String(index + 1)} de ${String(count)}`,
          });
          expect(
            within(result).getByText(formatHz(reference.frequencyHz)),
          ).toBeVisible();
          expect(
            within(result).getByText(formatHz(positionToFrequency(0.988))),
          ).toBeVisible();
          expect(within(result).getByText('Diferença')).toBeVisible();
          expect(
            within(result).getByText('Pontuação da tentativa'),
          ).toBeVisible();
        });
      }
      await clickButton(
        screen.getByRole('button', {
          name: round === 4 ? 'Ver resultado final' : 'Próximo round',
        }),
      );
    }
    expect(
      screen.getByRole('heading', { name: 'Resultado da partida' }),
    ).toHaveFocus();
    expect(screen.getByText(new RegExp(`^Modo ${mode}`))).toBeVisible();
    expect(screen.getAllByRole('row')).toHaveLength(6);
    expect(
      screen.getByRole('img', { name: 'Gráfico de pontuação dos rounds' }),
    ).toBeVisible();
    expect(f.audio.playReference).toHaveBeenCalledTimes(count === 1 ? 5 : 0);
    expect(f.audio.playSequence).toHaveBeenCalledTimes(count > 1 ? 5 : 0);
    expect(f.audio.startContinuous).toHaveBeenCalledTimes(5);
    await clickButton(screen.getByRole('button', { name: 'Jogar novamente' }));
    expect(
      screen.getByRole('heading', { name: new RegExp(`^Modo ${mode}`) }),
    ).toBeVisible();
    await clickButton(screen.getByRole('button', { name: 'Encerrar partida' }));
    expect(
      screen.getByRole('radio', { name: new RegExp(`^${mode}`) }),
    ).toBeChecked();
    if (count > 1)
      expect(
        screen.getByRole('radio', { name: `${String(count)} frequências` }),
      ).toBeChecked();
  });
});
