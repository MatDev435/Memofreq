// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { frequencyToPosition } from '../domain/frequencies';
import { getCurrentTarget } from '../domain/gameReducer';
import { ControlledAudio } from '../test/controlledAudio';
import { GameController } from './GameController';

function fixture() {
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
    random: () => 0.5,
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
  setup.controller.startNormal();
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
    f.controller.startNormal();
    expect(f.audio.enable).toHaveBeenCalledTimes(1);
    f.controller.startNormal();
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
    f.controller.startNormal();
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
    f.controller.startNormal();
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
    f.controller.startNormal();
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
    f.controller.startNormal();
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
      f.controller.startNormal();
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
    f.controller.startNormal();
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
    f.controller.startNormal();
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
    f.controller.startNormal();
    await flush();
    f.controller.deactivate();
    await vi.advanceTimersByTimeAsync(5000);
    expect(f.audio.playReference).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    await f.controller.dispose();
    expect(f.audio.dispose).toHaveBeenCalledTimes(1);
  });
});
