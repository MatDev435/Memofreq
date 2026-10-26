// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AudioInterruption } from '../application/audioPort';
import { DEFAULT_RULES } from '../domain/config';
import { AUDIO_SETTINGS } from './config';
import { FakeAudioContext, FakeAudioParam } from './test/fakeAudio';
import { WebAudioEngine } from './WebAudioEngine';

function context(): FakeAudioContext {
  const current = FakeAudioContext.instances[0];
  if (!current) throw new Error('Contexto não criado.');
  return current;
}

function pendingResume() {
  let resolve: (() => void) | undefined;
  let reject: ((error: Error) => void) | undefined;
  const promise = new Promise<void>((accept, refuse) => {
    resolve = accept;
    reject = refuse;
  });
  if (!resolve || !reject) throw new Error('Falha no fixture.');
  return { promise, resolve, reject };
}

beforeEach(() => {
  FakeAudioContext.instances = [];
  FakeAudioParam.supportsHold = true;
  vi.stubGlobal('AudioContext', FakeAudioContext);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Habilitação e ciclo de vida', () => {
  it('não cria contexto no construtor nem ao tentar tocar antes de habilitar', async () => {
    const engine = new WebAudioEngine({ range: DEFAULT_RULES.range });
    expect(() => engine.startContinuous(200)).toThrow();
    await engine.cancel();
    await engine.dispose();
    expect(FakeAudioContext.instances).toHaveLength(0);
  });

  it('reutiliza contexto e ganho mestre entre referências e tentativas', async () => {
    const engine = new WebAudioEngine({ range: DEFAULT_RULES.range });
    await engine.enable();
    await engine.enable();
    const ctx = context();
    const reference = engine.playReference({
      frequencyHz: 200,
      durationSeconds: 3,
    });
    ctx.advanceTo(14);
    expect(await reference.finished).toMatchObject({
      status: 'completed',
      started: true,
    });
    const continuous = engine.startContinuous(300);
    await continuous.cancel();
    expect(FakeAudioContext.instances).toHaveLength(1);
    expect(ctx.resume).toHaveBeenCalledTimes(1);
    expect(ctx.gains[0]?.gain.setValueAtTime.mock.calls[0]?.[0]).toBeCloseTo(
      0.08,
      12,
    );
    expect(ctx.gains[0]?.gain.setValueAtTime.mock.calls[0]?.[1]).toBe(10);
    await engine.dispose();
    expect(ctx.close).toHaveBeenCalledTimes(1);
  });

  it('coalesce habilitações concorrentes e chama resume sem aguardar microtask', async () => {
    const engine = new WebAudioEngine({ range: DEFAULT_RULES.range });
    const first = engine.enable();
    const second = engine.enable();
    expect(context().resume).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
    await first;
    await engine.dispose();
  });

  it('cancela habilitação pendente e ignora sua conclusão antiga', async () => {
    const engine = new WebAudioEngine({ range: DEFAULT_RULES.range });
    await engine.enable();
    context().changeState('suspended');
    const deferred = pendingResume();
    context().resume.mockImplementationOnce(() => deferred.promise);
    const enabling = engine.enable();
    const rejected = expect(enabling).rejects.toMatchObject({
      name: 'AbortError',
    });
    await engine.cancel();
    await rejected;
    context().state = 'running';
    deferred.resolve();
    await Promise.resolve();
    expect(context().oscillators).toHaveLength(0);
    await engine.enable();
    await engine.dispose();
  });

  it('limita a espera de autoplay e permite nova tentativa explícita', async () => {
    vi.useFakeTimers();
    const engine = new WebAudioEngine({ range: DEFAULT_RULES.range });
    await engine.enable();
    context().changeState('suspended');
    const deferred = pendingResume();
    context().resume.mockImplementationOnce(() => deferred.promise);
    const rejected = expect(engine.enable()).rejects.toThrow('não habilitou');
    await vi.advanceTimersByTimeAsync(AUDIO_SETTINGS.enableTimeoutMs);
    await rejected;
    expect(vi.getTimerCount()).toBe(0);
    await engine.enable();
    deferred.resolve();
    await engine.dispose();
  });

  it('reporta falha de resume e contexto que não chega ao estado running', async () => {
    const engine = new WebAudioEngine({ range: DEFAULT_RULES.range });
    await engine.enable();
    context().changeState('suspended');
    context().resume.mockRejectedValueOnce(new Error('autoplay bloqueado'));
    await expect(engine.enable()).rejects.toThrow('autoplay bloqueado');
    context().resume.mockImplementationOnce(() => Promise.resolve());
    await expect(engine.enable()).rejects.toThrow('não está ativo');
    await engine.dispose();
  });

  it('descarte concorrente remove listener e fecha o contexto uma única vez', async () => {
    const engine = new WebAudioEngine({ range: DEFAULT_RULES.range });
    await engine.enable();
    const playback = engine.startContinuous(200);
    const first = engine.dispose();
    expect(engine.dispose()).toBe(first);
    await first;
    expect(await playback.finished).toMatchObject({
      status: 'cancelled',
      started: false,
    });
    expect(context().listeners.size).toBe(0);
    expect(context().close).toHaveBeenCalledTimes(1);
    expect(context().gains[0]?.disconnect).toHaveBeenCalledTimes(1);
    await expect(engine.enable()).rejects.toThrow('descartada');
    expect(() => engine.startContinuous(200)).toThrow('descartada');
  });

  it('mantém o listener até encerrar a cauda e limpa ao suspender durante dispose', async () => {
    const engine = new WebAudioEngine({ range: DEFAULT_RULES.range });
    await engine.enable();
    const playback = engine.startContinuous(200);
    context().advanceTo(11);
    const disposed = engine.dispose();
    context().changeState('suspended');
    await disposed;
    expect(await playback.finished).toMatchObject({ status: 'interrupted' });
    expect(context().listeners.size).toBe(0);
  });

  it('fecha o contexto mesmo se uma parada nativa falhar no descarte', async () => {
    const engine = new WebAudioEngine({ range: DEFAULT_RULES.range });
    await engine.enable();
    const playback = engine.startContinuous(200);
    context().advanceTo(11);
    context().oscillators[0]?.stop.mockImplementationOnce(() => {
      throw new Error('Falha ao parar');
    });
    await expect(engine.dispose()).rejects.toThrow('Falha ao parar');
    expect(await playback.finished).toMatchObject({ status: 'interrupted' });
    expect(context().listeners.size).toBe(0);
    expect(context().close).toHaveBeenCalledTimes(1);
  });

  it('descarta durante resume pendente sem reativar a engine no callback antigo', async () => {
    const engine = new WebAudioEngine({ range: DEFAULT_RULES.range });
    await engine.enable();
    context().changeState('suspended');
    const pending = pendingResume();
    context().resume.mockImplementationOnce(() => pending.promise);
    const rejected = expect(engine.enable()).rejects.toMatchObject({
      name: 'AbortError',
    });
    await engine.dispose();
    await rejected;
    pending.resolve();
    await Promise.resolve();
    expect(context().state).toBe('closed');
    expect(context().oscillators).toHaveLength(0);
    await expect(engine.enable()).rejects.toThrow('descartada');
  });
});

describe('Referências e agendamento', () => {
  it.each([0.01, 1.5, 3])(
    'agenda referência de %s segundos com envelopes dentro da duração',
    async (durationSeconds) => {
      const engine = new WebAudioEngine({ range: DEFAULT_RULES.range });
      await engine.enable();
      const handle = engine.playReference({
        frequencyHz: 123.456,
        durationSeconds,
      });
      const oscillator = context().oscillators[0];
      const gain = context().gains[1];
      expect(handle.startsAt).toBeCloseTo(10.01);
      expect(handle.endsAt).toBeCloseTo(10.01 + durationSeconds);
      expect(oscillator?.start).toHaveBeenCalledWith(handle.startsAt);
      expect(oscillator?.stop).toHaveBeenCalledWith(handle.endsAt);
      expect(oscillator?.frequency.setValueAtTime).toHaveBeenCalledWith(
        123.456,
        handle.startsAt,
      );
      expect(oscillator?.type).toBe('sine');
      expect(gain?.gain.setValueAtTime).toHaveBeenCalledWith(
        0,
        handle.startsAt,
      );
      expect(gain?.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
        0,
        handle.endsAt,
      );
      context().advanceTo(14);
      expect(await handle.finished).toMatchObject({ status: 'completed' });
      await engine.dispose();
    },
  );

  it('agenda toda a sequência pelo relógio do áudio e conclui após a última voz', async () => {
    const engine = new WebAudioEngine({ range: DEFAULT_RULES.range });
    await engine.enable();
    const sequence = engine.playSequence(
      [100, 200, 300].map((frequencyHz) => ({
        frequencyHz,
        durationSeconds: 1.5,
      })),
      0.3,
    );
    expect(context().oscillators.map((node) => node.startsAt)).toEqual([
      expect.closeTo(10.01, 10),
      expect.closeTo(11.81, 10),
      expect.closeTo(13.61, 10),
    ]);
    expect(sequence.endsAt).toBeCloseTo(15.11);
    const settled = vi.fn();
    void sequence.finished.then(settled);
    context().advanceTo(12);
    await Promise.resolve();
    expect(settled).not.toHaveBeenCalled();
    context().advanceTo(16);
    expect(await sequence.finished).toMatchObject({
      status: 'completed',
      started: true,
    });
    expect(context().oscillators.every((node) => node.onended === null)).toBe(
      true,
    );
    expect(
      context().oscillators.every(
        (node) => node.disconnect.mock.calls.length === 1,
      ),
    ).toBe(true);
    await engine.dispose();
  });

  it('impede sobreposição e mantém sample independente dos alvos', async () => {
    const engine = new WebAudioEngine({ range: DEFAULT_RULES.range });
    await engine.enable();
    const sample = engine.playSample();
    expect(
      context().oscillators[0]?.frequency.setValueAtTime.mock.calls[0]?.[0],
    ).toBeCloseTo(Math.sqrt(50 * 700));
    expect(() => engine.startContinuous(200)).toThrow('anterior');
    context().advanceTo(11);
    await sample.finished;
    expect(engine.startContinuous(200).id).toBeGreaterThan(sample.id);
    await engine.dispose();
  });

  it('valida toda a sequência antes de criar vozes ou interromper uma reprodução válida', async () => {
    const engine = new WebAudioEngine({ range: DEFAULT_RULES.range });
    await engine.enable();
    expect(() =>
      engine.playSequence(
        [
          { frequencyHz: 100, durationSeconds: 1 },
          { frequencyHz: NaN, durationSeconds: 1 },
        ],
        0.3,
      ),
    ).toThrow(RangeError);
    expect(context().oscillators).toHaveLength(0);
    const current = engine.startContinuous(200);
    expect(() =>
      engine.playReference({ frequencyHz: Infinity, durationSeconds: 1 }),
    ).toThrow(RangeError);
    expect(await current.cancel()).toMatchObject({ status: 'cancelled' });
    await engine.dispose();
  });

  it('limpa uma sequência parcialmente agendada se a Web Audio API falhar', async () => {
    const engine = new WebAudioEngine({ range: DEFAULT_RULES.range });
    await engine.enable();
    const createOscillator = context().createOscillator.getMockImplementation();
    if (!createOscillator) throw new Error('Fixture ausente.');
    context()
      .createOscillator.mockImplementationOnce(createOscillator)
      .mockImplementationOnce(() => {
        throw new Error('Falha nativa');
      });
    expect(() =>
      engine.playSequence(
        [
          { frequencyHz: 200, durationSeconds: 1 },
          { frequencyHz: 300, durationSeconds: 1 },
        ],
        0.3,
      ),
    ).toThrow('Falha nativa');
    expect(context().oscillators[0]?.disconnect).toHaveBeenCalledTimes(1);
    expect(context().oscillators[0]?.onended).toBeNull();
    expect(engine.startContinuous(200)).toBeDefined();
    await engine.dispose();
  });
});

describe('Tom contínuo, volume e suavização', () => {
  it('atualiza frequência no mesmo oscilador e substitui rampas rapidamente', async () => {
    const engine = new WebAudioEngine({ range: DEFAULT_RULES.range });
    await engine.enable();
    engine.startContinuous(100);
    context().advanceTo(11);
    engine.setFrequency(200);
    engine.setFrequency(300);
    const oscillator = context().oscillators[0];
    expect(context().oscillators).toHaveLength(1);
    expect(oscillator?.start).toHaveBeenCalledTimes(1);
    expect(oscillator?.frequency.cancelAndHoldAtTime).toHaveBeenCalledWith(11);
    expect(
      oscillator?.frequency.linearRampToValueAtTime,
    ).toHaveBeenLastCalledWith(300, 11.015);
    const stopped = engine.cancel();
    context().advanceTo(12);
    await stopped;
    await engine.dispose();
  });

  it('fallback sem cancelAndHold preserva o valor interpolado, sem acumular rampas', async () => {
    FakeAudioParam.supportsHold = false;
    const engine = new WebAudioEngine({ range: DEFAULT_RULES.range });
    await engine.enable();
    engine.startContinuous(100);
    context().advanceTo(11);
    engine.setFrequency(200);
    context().advanceTo(11.0075);
    engine.setFrequency(300);
    const frequency = context().oscillators[0]?.frequency;
    expect(frequency?.cancelScheduledValues).toHaveBeenCalledWith(11.0075);
    expect(frequency?.setValueAtTime.mock.calls.at(-1)?.[0]).toBeCloseTo(
      150,
      8,
    );
    const stopped = engine.cancel();
    context().advanceTo(12);
    await stopped;
    await engine.dispose();
  });

  it('controla volume pelo ganho mestre sem reiniciar a voz e aceita silêncio', async () => {
    const engine = new WebAudioEngine({ range: DEFAULT_RULES.range });
    engine.setVolume(0);
    expect(FakeAudioContext.instances).toHaveLength(0);
    await engine.enable();
    engine.startContinuous(200);
    engine.setVolume(1);
    expect(
      context().gains[0]?.gain.linearRampToValueAtTime,
    ).toHaveBeenLastCalledWith(0.2, 10.015);
    expect(context().oscillators).toHaveLength(1);
    await engine.dispose();
  });

  it('faz fade de saída, resolve após ended e bloqueia ajuste durante a parada', async () => {
    const engine = new WebAudioEngine({ range: DEFAULT_RULES.range });
    await engine.enable();
    const tone = engine.startContinuous(200);
    context().advanceTo(11);
    const stopped = tone.stop();
    expect(() => {
      engine.setFrequency(300);
    }).toThrow('ajustável');
    expect(
      context().gains[1]?.gain.linearRampToValueAtTime,
    ).toHaveBeenLastCalledWith(0, 11.015);
    expect(context().oscillators[0]?.disconnect).not.toHaveBeenCalled();
    context().advanceTo(12);
    expect(await stopped).toMatchObject({ status: 'stopped', started: true });
    expect(context().oscillators[0]?.disconnect).toHaveBeenCalledTimes(1);
    await engine.dispose();
  });

  it('fallback preserva o ganho real ao cancelar durante o ataque', async () => {
    FakeAudioParam.supportsHold = false;
    const engine = new WebAudioEngine({ range: DEFAULT_RULES.range });
    await engine.enable();
    const tone = engine.startContinuous(200);
    const now = tone.startsAt + AUDIO_SETTINGS.attackSeconds / 2;
    context().advanceTo(now);
    const cancelled = tone.cancel();
    expect(
      context().gains[1]?.gain.setValueAtTime.mock.calls.at(-1)?.[0],
    ).toBeCloseTo(0.5, 10);
    context().advanceTo(12);
    expect(await cancelled).toMatchObject({ status: 'cancelled' });
    await engine.dispose();
  });

  it('volume alterado em suspensão permanece correto na próxima rampa', async () => {
    FakeAudioParam.supportsHold = false;
    const engine = new WebAudioEngine({ range: DEFAULT_RULES.range });
    await engine.enable();
    context().changeState('suspended');
    engine.setVolume(0.5);
    engine.setVolume(1);
    await engine.enable();
    engine.setVolume(0);
    expect(
      context().gains[0]?.gain.setValueAtTime.mock.calls.at(-1)?.[0],
    ).toBeCloseTo(0.2, 12);
    await engine.dispose();
  });
});

describe('Cancelamento e interrupções', () => {
  it('cancela vozes futuras sem deixá-las tocar e não reporta conclusão normal', async () => {
    const engine = new WebAudioEngine({ range: DEFAULT_RULES.range });
    await engine.enable();
    const sequence = engine.playSequence(
      [100, 200, 300].map((frequencyHz) => ({
        frequencyHz,
        durationSeconds: 1.5,
      })),
      0.3,
    );
    expect(await sequence.cancel()).toMatchObject({
      status: 'cancelled',
      started: false,
    });
    context().advanceTo(20);
    expect(sequence.hasStarted()).toBe(false);
    expect(
      context().oscillators.every(
        (node) => node.disconnect.mock.calls.length === 1,
      ),
    ).toBe(true);
    expect(context().oscillators.every((node) => node.stopsAt === 10)).toBe(
      true,
    );
    await engine.dispose();
  });

  it('cancela a voz atual suavemente e as próximas imediatamente', async () => {
    const engine = new WebAudioEngine({ range: DEFAULT_RULES.range });
    await engine.enable();
    const sequence = engine.playSequence(
      [100, 200, 300].map((frequencyHz) => ({
        frequencyHz,
        durationSeconds: 1.5,
      })),
      0.3,
    );
    context().advanceTo(11);
    const cancelled = sequence.cancel();
    expect(sequence.cancel()).toBe(cancelled);
    expect(context().oscillators[1]?.disconnect).toHaveBeenCalledTimes(1);
    expect(context().oscillators[0]?.stop).toHaveBeenLastCalledWith(11.015);
    context().advanceTo(12);
    expect(await cancelled).toMatchObject({
      status: 'cancelled',
      started: true,
    });
    await engine.dispose();
  });

  it('callback ou cancelamento de uma reprodução antiga não interfere na nova', async () => {
    const engine = new WebAudioEngine({ range: DEFAULT_RULES.range });
    await engine.enable();
    const old = engine.startContinuous(200);
    const lateEnded = context().oscillators[0]?.onended;
    await old.cancel();
    const current = engine.startContinuous(300);
    lateEnded?.();
    await old.stop();
    expect(context().oscillators[1]?.disconnect).not.toHaveBeenCalled();
    expect(current.id).not.toBe(old.id);
    await engine.dispose();
  });

  it.each(['suspended', 'interrupted', 'closed'])(
    'interrompe e desconecta tudo em %s, sem retomar sons antigos',
    async (state) => {
      const interruptions: AudioInterruption[] = [];
      const engine = new WebAudioEngine({
        range: DEFAULT_RULES.range,
        onInterruption: (event) => {
          interruptions.push(event);
        },
      });
      await engine.enable();
      const sequence = engine.playSequence(
        [
          { frequencyHz: 200, durationSeconds: 3 },
          { frequencyHz: 300, durationSeconds: 1.5 },
        ],
        0.3,
      );
      context().advanceTo(11);
      context().changeState(state);
      expect(await sequence.finished).toMatchObject({
        status: 'interrupted',
        started: true,
      });
      expect(interruptions).toEqual([
        { playbackId: sequence.id, reason: state, started: true },
      ]);
      context().changeState(state);
      expect(interruptions).toHaveLength(1);
      expect(
        context().oscillators.every(
          (node) => node.disconnect.mock.calls.length === 1,
        ),
      ).toBe(true);
      if (state !== 'closed') {
        await engine.enable();
        expect(context().oscillators).toHaveLength(2);
      } else await expect(engine.enable()).rejects.toThrow('fechado');
      await engine.dispose();
    },
  );

  it('notifica suspensão sem reprodução ativa para permitir tratar uma contagem', async () => {
    const interrupted = vi.fn();
    const engine = new WebAudioEngine({
      range: DEFAULT_RULES.range,
      onInterruption: interrupted,
    });
    await engine.enable();
    context().changeState('suspended');
    expect(interrupted).toHaveBeenCalledWith({
      playbackId: null,
      reason: 'suspended',
      started: false,
    });
    await engine.dispose();
  });
});

describe('Parâmetros inválidos', () => {
  it.each([NaN, Infinity, 49, 701, 0])(
    'rejeita frequência %s sem criar osciladores',
    async (frequencyHz) => {
      const engine = new WebAudioEngine({ range: DEFAULT_RULES.range });
      await engine.enable();
      expect(() => engine.startContinuous(frequencyHz)).toThrow(RangeError);
      expect(context().oscillators).toHaveLength(0);
      await engine.dispose();
    },
  );

  it.each([0, -1, NaN, Infinity, Number.MIN_VALUE])(
    'rejeita duração %s',
    async (durationSeconds) => {
      const engine = new WebAudioEngine({ range: DEFAULT_RULES.range });
      await engine.enable();
      expect(() =>
        engine.playReference({ frequencyHz: 200, durationSeconds }),
      ).toThrow(RangeError);
      await engine.dispose();
    },
  );

  it.each([-1, NaN, Infinity, 1.1])('rejeita volume %s', (volume) => {
    const engine = new WebAudioEngine({ range: DEFAULT_RULES.range });
    expect(() => {
      engine.setVolume(volume);
    }).toThrow(RangeError);
  });

  it('rejeita vazio, intervalo negativo, faixa inválida e frequência acima de Nyquist', async () => {
    expect(
      () => new WebAudioEngine({ range: { minHz: 0, maxHz: 700 } }),
    ).toThrow(RangeError);
    const engine = new WebAudioEngine({ range: DEFAULT_RULES.range });
    await engine.enable();
    expect(() => engine.playSequence([], 0)).toThrow(RangeError);
    expect(() =>
      engine.playSequence([{ frequencyHz: 200, durationSeconds: 1 }], -1),
    ).toThrow(RangeError);
    context().sampleRate = 1000;
    expect(() => engine.startContinuous(600)).toThrow(RangeError);
    await engine.dispose();
  });
});
