// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { frequencyToPosition } from '../domain/frequencies';
import type { ModeSelection } from '../domain/config';
import { distanceCents } from '../domain/scoring';
import { getCurrentTarget } from '../domain/gameReducer';
import { ControlledAudio } from '../test/controlledAudio';
import { GameController } from './GameController';

function fixture(random = () => 0.5) {
  let visible = true;
  let id = 0;
  let audio: ControlledAudio | null = null;
  const controller = new GameController({
    createAudio: (notify) => {
      audio = new ControlledAudio(notify);
      return audio;
    },
    isPageVisible: () => visible,
    initialVolume: 0.4,
    createId: () => `game-${String(++id)}`,
    random,
    now: () => Date.now(),
  });
  controller.activate();
  return {
    controller,
    get audio() {
      if (!audio) throw new Error('Áudio não criado.');
      return audio;
    },
    hide() {
      visible = false;
      controller.visibilityChanged();
    },
    show() {
      visible = true;
      controller.visibilityChanged();
    },
  };
}

async function flush() {
  await vi.advanceTimersByTimeAsync(0);
}
async function toAttempt(setup: ReturnType<typeof fixture>) {
  setup.controller.start({ mode: 'normal' });
  await flush();
  await vi.advanceTimersByTimeAsync(3000);
  expect(setup.controller.getSnapshot().game.phase).toBe('references');
  setup.audio.current()?.finish();
  await flush();
  expect(setup.controller.getSnapshot().game.phase).toBe('attempt');
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('Coordenação do Normal Mode', () => {
  it('habilita no gesto, respeita contagem e toca uma referência de três segundos', async () => {
    const f = fixture();
    f.controller.start({ mode: 'normal' });
    expect(f.audio.enable).toHaveBeenCalledTimes(1);
    f.controller.start({ mode: 'normal' });
    await flush();
    expect(f.controller.getSnapshot().countdown).toBe(3);
    await vi.advanceTimersByTimeAsync(2999);
    expect(f.audio.playReference).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(f.audio.playReference).toHaveBeenCalledTimes(1);
    expect(f.audio.plays[0]?.tone?.durationSeconds).toBe(3);
    expect(f.controller.getSnapshot().announcement).toBe('');
    await f.controller.dispose();
  });

  it('completa cinco rounds, soma os resultados e reinicia com um novo desafio', async () => {
    const f = fixture();
    f.controller.start({ mode: 'normal' });
    await flush();
    for (let round = 0; round < 5; round += 1) {
      await vi.advanceTimersByTimeAsync(3000);
      f.audio.current()?.finish();
      await flush();
      const game = f.controller.getSnapshot().game;
      if (game.phase !== 'attempt') throw new Error('Tentativa ausente.');
      f.controller.setPosition(
        frequencyToPosition(getCurrentTarget(game.session)),
      );
      f.controller.confirm();
      f.controller.confirm();
      await flush();
      expect(f.controller.getSnapshot().game.phase).toBe('round-result');
      f.controller.advance();
      await flush();
    }
    const final = f.controller.getSnapshot().game;
    if (final.phase !== 'final-result')
      throw new Error('Resultado final ausente.');
    expect(final.result.score).toBeCloseTo(50, 10);
    expect(final.result.rounds).toHaveLength(5);
    expect(f.audio.playReference).toHaveBeenCalledTimes(5);
    expect(f.audio.startContinuous).toHaveBeenCalledTimes(5);
    expect(vi.getTimerCount()).toBe(0);
    f.controller.start({ mode: 'normal' });
    await flush();
    const restarted = f.controller.getSnapshot().game;
    if (restarted.phase === 'home') throw new Error('Reinício ausente.');
    expect(restarted.session.definition.id).not.toBe(final.result.gameId);
    await f.controller.dispose();
  });

  it('mantém a mesma voz em ajustes e congela a resposta antes de encerrar a cauda', async () => {
    const f = fixture();
    await toAttempt(f);
    const handle = f.audio.current();
    if (!handle) throw new Error('Tom ausente.');
    handle.holdStop = true;
    f.controller.setPosition(0.2);
    f.controller.adjustPosition(0.001);
    const game = f.controller.getSnapshot().game;
    if (game.phase !== 'attempt') throw new Error('Tentativa ausente.');
    const frequency = game.frequencyHz;
    f.controller.confirm();
    f.controller.setPosition(0.8);
    expect(f.controller.getSnapshot().busy).toBe(true);
    expect(f.controller.getSnapshot().announcement).toBe('');
    expect(f.controller.getSnapshot().game.phase).toBe('attempt-result');
    f.hide();
    handle.finish('stopped');
    await flush();
    f.show();
    const result = f.controller.getSnapshot().game;
    if (result.phase === 'home') throw new Error('Resposta ausente.');
    expect(result.session.attempts[0]?.playerHz).toBe(frequency);
    expect(f.audio.startContinuous).toHaveBeenCalledTimes(1);
    expect(handle.stop).toHaveBeenCalledTimes(1);
    f.controller.advance();
    await flush();
    expect(f.controller.getSnapshot().game.phase).toBe('countdown');
    await f.controller.dispose();
  });

  it('permite testar som e alterar volume antes de iniciar, sem sobreposição', async () => {
    const f = fixture();
    f.controller.setVolume(0.25);
    f.controller.testAudio();
    await flush();
    expect(f.audio.setVolume).toHaveBeenCalledWith(0.25);
    expect(f.controller.getSnapshot().sample).toBe('playing');
    expect(f.controller.getSnapshot().announcement).toBe('');
    const sample = f.audio.current();
    f.controller.start({ mode: 'normal' });
    await flush();
    expect(sample?.cancel).toHaveBeenCalledTimes(1);
    expect(f.controller.getSnapshot().sample).toBe('idle');
    expect(f.controller.getSnapshot().game.phase).toBe('countdown');
    await f.controller.dispose();
  });

  it('para um teste explicitamente e silencia ao sair durante a tentativa', async () => {
    const f = fixture();
    f.controller.testAudio();
    await flush();
    f.controller.stopSample();
    await flush();
    expect(f.controller.getSnapshot().sample).toBe('idle');
    await toAttempt(f);
    f.controller.leave();
    await flush();
    expect(f.controller.getSnapshot().game.phase).toBe('home');
    expect(f.audio.current()?.settled).toBe(true);
    expect(f.controller.getSnapshot().busy).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    await f.controller.dispose();
  });
});

describe('Visibilidade, interrupções e callbacks', () => {
  it('pausa contagem e só a reinicia por nova interação', async () => {
    const f = fixture();
    f.controller.start({ mode: 'normal' });
    await flush();
    await vi.advanceTimersByTimeAsync(1000);
    f.hide();
    await flush();
    f.show();
    await vi.advanceTimersByTimeAsync(5000);
    expect(f.controller.getSnapshot().game.phase).toBe('awaiting-resume');
    expect(f.audio.playReference).not.toHaveBeenCalled();
    f.controller.resume();
    await flush();
    expect(f.controller.getSnapshot().countdown).toBe(3);
    await vi.advanceTimersByTimeAsync(3000);
    expect(f.audio.playReference).toHaveBeenCalledTimes(1);
    await f.controller.dispose();
  });

  it('interrompe referências ou tentativas ocultas e não permite replay', async () => {
    for (const phase of ['references', 'attempt']) {
      const f = fixture();
      f.controller.start({ mode: 'normal' });
      await flush();
      await vi.advanceTimersByTimeAsync(3000);
      if (phase === 'attempt') {
        f.audio.current()?.finish();
        await flush();
      }
      f.hide();
      await flush();
      f.show();
      f.controller.resume();
      expect(f.controller.getSnapshot().game.phase).toBe('interrupted');
      expect(f.audio.playReference).toHaveBeenCalledTimes(1);
      await f.controller.dispose();
    }
  });

  it('preserva resultado em outra aba e avança somente por ação explícita', async () => {
    const f = fixture();
    await toAttempt(f);
    f.controller.confirm();
    await flush();
    const result = f.controller.getSnapshot().game;
    f.hide();
    await flush();
    f.show();
    await vi.advanceTimersByTimeAsync(10000);
    expect(f.controller.getSnapshot().game.phase).toBe('round-result');
    const restored = f.controller.getSnapshot().game;
    if (result.phase === 'home' || restored.phase === 'home')
      throw new Error('Resultado ausente.');
    expect(restored.session).toBe(result.session);
    expect(f.audio.playReference).toHaveBeenCalledTimes(1);
    await f.controller.dispose();
  });

  it('ignora conclusão atrasada de habilitação depois de sair', async () => {
    const f = fixture();
    f.controller.testAudio();
    await flush();
    f.controller.stopSample();
    await flush();
    let resolve: (() => void) | undefined;
    f.audio.enable.mockImplementationOnce(
      () =>
        new Promise<void>((accept) => {
          resolve = accept;
        }),
    );
    f.controller.start({ mode: 'normal' });
    f.controller.leave();
    resolve?.();
    await flush();
    await vi.advanceTimersByTimeAsync(5000);
    expect(f.controller.getSnapshot().game.phase).toBe('home');
    expect(f.audio.playReference).not.toHaveBeenCalled();
    await f.controller.dispose();
  });

  it('trata falha de autoplay sem iniciar som e permite retomada explícita', async () => {
    const f = fixture();
    f.controller.testAudio();
    await flush();
    f.controller.stopSample();
    await flush();
    f.audio.enable.mockRejectedValueOnce(new Error('Bloqueado'));
    f.controller.start({ mode: 'normal' });
    await flush();
    expect(f.controller.getSnapshot().game.phase).toBe('awaiting-resume');
    expect(f.controller.getSnapshot().error).toBeTruthy();
    f.controller.resume();
    await flush();
    expect(f.controller.getSnapshot().game.phase).toBe('countdown');
    await f.controller.dispose();
  });

  it('notificação da engine interrompe a tentativa sem corromper resultados', async () => {
    const f = fixture();
    await toAttempt(f);
    f.audio.interrupt();
    await flush();
    expect(f.controller.getSnapshot().game.phase).toBe('interrupted');
    expect(f.controller.getSnapshot().busy).toBe(false);
    await f.controller.dispose();
  });

  it('troca uma engine fechada em resultados e ignora notificações da instância antiga', async () => {
    const f = fixture();
    await toAttempt(f);
    f.controller.confirm();
    await flush();
    const oldAudio = f.audio;
    oldAudio.interrupt('closed');
    expect(f.controller.getSnapshot().game.phase).toBe('round-result');
    f.controller.advance();
    await flush();
    expect(f.audio).not.toBe(oldAudio);
    expect(f.controller.getSnapshot().game.phase).toBe('countdown');
    oldAudio.interrupt('suspended');
    expect(f.controller.getSnapshot().game.phase).toBe('countdown');
    await f.controller.dispose();
  });

  it('preserva confirmação se a API de parada falhar, limpando antes de liberar o resultado', async () => {
    const f = fixture();
    await toAttempt(f);
    f.audio.current()?.stop.mockImplementationOnce(() => {
      throw new Error('Falha nativa');
    });
    f.controller.confirm();
    await flush();
    expect(f.controller.getSnapshot().game.phase).toBe('round-result');
    expect(f.controller.getSnapshot().busy).toBe(false);
    expect(f.audio.current()?.settled).toBe(true);
    expect(f.controller.getSnapshot().error).toContain('Resposta registrada');
    await f.controller.dispose();
  });

  it('desativa imediatamente timers e callbacks ao desmontar', async () => {
    const f = fixture();
    f.controller.start({ mode: 'normal' });
    await flush();
    f.controller.deactivate();
    await vi.advanceTimersByTimeAsync(5000);
    expect(f.audio.playReference).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    await f.controller.dispose();
    expect(f.audio.dispose).toHaveBeenCalledTimes(1);
  });
});

function sequenceFixture() {
  let draw = 0;
  return fixture(() => ((++draw % 7) + 1) / 10);
}

const additionalModes: readonly ModeSelection[] = [
  { mode: 'hard' },
  { mode: 'extreme', frequencyCount: 2 },
  { mode: 'extreme', frequencyCount: 3 },
];

describe.each(additionalModes)(
  'Coordenação de $mode $frequencyCount',
  (selection) => {
    it('completa cinco rounds em ordem, sem replay, com médias e soma precisas', async () => {
      const f = sequenceFixture();
      const count = selection.mode === 'extreme' ? selection.frequencyCount : 1;
      f.controller.start(selection);
      await flush();
      for (let round = 0; round < 5; round += 1) {
        await vi.advanceTimersByTimeAsync(3000);
        if (count === 1) {
          expect(f.audio.plays.at(-1)?.tone?.durationSeconds).toBe(1.5);
        } else {
          const game = f.controller.getSnapshot().game;
          if (game.phase !== 'references')
            throw new Error('Sequência ausente.');
          expect(f.audio.playSequence).toHaveBeenLastCalledWith(
            game.session.definition.rounds[round]?.references.map(
              (frequencyHz) => ({
                frequencyHz,
                durationSeconds: 1.5,
              }),
            ),
            0.3,
          );
        }
        f.audio.current()?.finish();
        await flush();
        for (let attempt = 0; attempt < count; attempt += 1) {
          const game = f.controller.getSnapshot().game;
          if (game.phase !== 'attempt') throw new Error('Tentativa ausente.');
          expect(game.session.attemptIndex).toBe(attempt);
          expect(game.session.definition.selection).toEqual(selection);
          const target = getCurrentTarget(game.session);
          expect(distanceCents(game.initialHz, target)).toBeGreaterThanOrEqual(
            300,
          );
          f.controller.start({ mode: 'normal' });
          expect(f.controller.getSnapshot().game).toBe(game);
          f.controller.setPosition(
            frequencyToPosition(
              target * 2 ** (((attempt + 1) * 37.123) / 1200),
            ),
          );
          f.controller.confirm();
          f.controller.confirm();
          await flush();
          const result = f.controller.getSnapshot().game;
          if (result.phase === 'home') throw new Error('Resposta ausente.');
          expect(result.session.attempts[attempt]?.targetHz).toBe(target);
          expect(result.phase).toBe(
            attempt === count - 1 ? 'round-result' : 'attempt-result',
          );
          expect(f.audio.playReference).toHaveBeenCalledTimes(
            count === 1 ? round + 1 : 0,
          );
          expect(f.audio.playSequence).toHaveBeenCalledTimes(
            count > 1 ? round + 1 : 0,
          );
          const recorded = result.session.attempts[attempt];
          if (attempt < count - 1) {
            f.controller.advance();
            f.controller.advance();
            await flush();
            const next = f.controller.getSnapshot().game;
            if (next.phase !== 'attempt')
              throw new Error('Próxima tentativa ausente.');
            expect(next.session.attempts[attempt]).toBe(recorded);
          }
        }
        const completed = f.controller.getSnapshot().game;
        if (completed.phase !== 'round-result')
          throw new Error('Round ausente.');
        const mean =
          completed.session.attempts.reduce(
            (sum, attempt) => sum + attempt.score,
            0,
          ) / count;
        expect(completed.session.completedRounds[round]?.score).toBe(mean);
        expect(mean).not.toBe(Number(mean.toFixed(2)));
        f.controller.advance();
        await flush();
      }
      const final = f.controller.getSnapshot().game;
      if (final.phase !== 'final-result')
        throw new Error('Resultado final ausente.');
      expect(final.result.score).toBe(
        final.result.rounds.reduce((sum, round) => sum + round.score, 0),
      );
      expect(f.audio.startContinuous).toHaveBeenCalledTimes(5 * count);
      expect(vi.getTimerCount()).toBe(0);
      f.controller.restart();
      await flush();
      const restart = f.controller.getSnapshot().game;
      if (restart.phase === 'home') throw new Error('Reinício ausente.');
      expect(restart.session.definition.selection).toEqual(selection);
      expect(restart.session.definition.id).not.toBe(final.result.gameId);
      await f.controller.dispose();
    });
  },
);

describe('Interrupções e retomadas do Extreme', () => {
  async function firstResult() {
    const f = sequenceFixture();
    f.controller.start({ mode: 'extreme', frequencyCount: 3 });
    await flush();
    await vi.advanceTimersByTimeAsync(3000);
    f.audio.current()?.finish();
    await flush();
    f.controller.confirm();
    await flush();
    expect(f.controller.getSnapshot().game.phase).toBe('attempt-result');
    return f;
  }

  it.each(['hidden', 'suspended'] as const)(
    'interrompe a sequência por %s e cancela sua conclusão',
    async (reason) => {
      const f = sequenceFixture();
      f.controller.start({ mode: 'extreme', frequencyCount: 3 });
      await flush();
      await vi.advanceTimersByTimeAsync(3000);
      const sequence = f.audio.current();
      if (reason === 'hidden') f.hide();
      else f.audio.interrupt();
      await flush();
      f.show();
      sequence?.finish();
      f.controller.resume();
      expect(f.controller.getSnapshot().game.phase).toBe('interrupted');
      expect(f.audio.startContinuous).not.toHaveBeenCalled();
      expect(f.audio.playSequence).toHaveBeenCalledTimes(1);
      f.controller.restart();
      await flush();
      const restart = f.controller.getSnapshot().game;
      if (restart.phase === 'home') throw new Error('Reinício ausente.');
      expect(restart.session.definition.selection).toEqual({
        mode: 'extreme',
        frequencyCount: 3,
      });
      await f.controller.dispose();
    },
  );

  it('preserva a resposta em outra aba e retoma preparação da próxima sem referência ou contagem', async () => {
    const f = await firstResult();
    const first = f.controller.getSnapshot().game;
    f.hide();
    await flush();
    f.show();
    await vi.advanceTimersByTimeAsync(5000);
    expect(f.controller.getSnapshot().game.phase).toBe('attempt-result');
    let enabled: (() => void) | undefined;
    f.audio.enable.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          enabled = resolve;
        }),
    );
    f.controller.advance();
    f.hide();
    await flush();
    enabled?.();
    await flush();
    f.show();
    const paused = f.controller.getSnapshot().game;
    if (paused.phase !== 'awaiting-resume') throw new Error('Pausa ausente.');
    expect(paused.preparation.destination).toBe('attempt');
    expect(paused.session.attempts).toBe(
      first.phase === 'home' ? null : first.session.attempts,
    );
    f.controller.resume();
    await flush();
    const resumed = f.controller.getSnapshot().game;
    if (resumed.phase !== 'attempt') throw new Error('Tentativa ausente.');
    expect(resumed.session.attemptIndex).toBe(1);
    expect(f.audio.startContinuous).toHaveBeenCalledTimes(2);
    expect(f.audio.playSequence).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    await f.controller.dispose();
  });

  it('retoma falha de habilitação e troca contexto fechado entre tentativas, sem replay', async () => {
    const f = await firstResult();
    const oldAudio = f.audio;
    oldAudio.interrupt('closed');
    f.controller.advance();
    await flush();
    expect(f.audio).not.toBe(oldAudio);
    expect(f.controller.getSnapshot().game.phase).toBe('attempt');
    oldAudio.interrupt();
    expect(f.controller.getSnapshot().game.phase).toBe('attempt');
    f.controller.confirm();
    await flush();
    f.audio.enable.mockRejectedValueOnce(new Error('Bloqueado'));
    f.controller.advance();
    await flush();
    expect(f.controller.getSnapshot().game.phase).toBe('awaiting-resume');
    f.controller.resume();
    await flush();
    const resumed = f.controller.getSnapshot().game;
    if (resumed.phase !== 'attempt') throw new Error('Tentativa ausente.');
    expect(resumed.session.attemptIndex).toBe(2);
    expect(f.audio.playSequence).not.toHaveBeenCalled();
    await f.controller.dispose();
  });

  it('preserva a primeira confirmação ao ocultar durante o fade e mantém resultados imutáveis', async () => {
    const f = sequenceFixture();
    f.controller.start({ mode: 'extreme', frequencyCount: 2 });
    await flush();
    await vi.advanceTimersByTimeAsync(3000);
    f.audio.current()?.finish();
    await flush();
    const handle = f.audio.current();
    if (!handle) throw new Error('Tom ausente.');
    handle.holdStop = true;
    f.controller.confirm();
    f.hide();
    handle.finish('stopped');
    await flush();
    f.show();
    const result = f.controller.getSnapshot().game;
    if (result.phase !== 'attempt-result') throw new Error('Resposta ausente.');
    expect(Object.isFrozen(result.session.attempts[0])).toBe(true);
    f.controller.advance();
    await flush();
    expect(f.controller.getSnapshot().game.phase).toBe('attempt');
    expect(f.audio.playSequence).toHaveBeenCalledTimes(1);
    await f.controller.dispose();
  });
});
