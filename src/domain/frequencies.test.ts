// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_RULES } from './config';
import {
  frequencyToPosition,
  generateInitialFrequency,
  generateReferenceSequence,
  positionToFrequency,
} from './frequencies';
import { distanceCents } from './scoring';

describe('Frequências e slider logarítmico', () => {
  it('preserva extremos, centro geométrico e inversão da escala', () => {
    expect(positionToFrequency(0)).toBe(80);
    expect(positionToFrequency(1)).toBe(700);
    expect(positionToFrequency(0.5)).toBeCloseTo(Math.sqrt(80 * 700), 10);
    let previous = 0;
    for (let step = 0; step <= 100; step += 1) {
      const frequency = positionToFrequency(step / 100);
      expect(frequency).toBeGreaterThan(previous);
      expect(frequencyToPosition(frequency)).toBeCloseTo(step / 100, 12);
      previous = frequency;
    }
  });

  it('deslocamentos iguais representam distâncias perceptuais iguais', () => {
    expect(
      distanceCents(positionToFrequency(0), positionToFrequency(0.1)),
    ).toBeCloseTo(
      distanceCents(positionToFrequency(0.8), positionToFrequency(0.9)),
      10,
    );
  });

  it('gera referências decimais distintas preservando a ordem de sorteio', () => {
    const random = vi
      .fn()
      .mockReturnValueOnce(0.7)
      .mockReturnValueOnce(0.7)
      .mockReturnValueOnce(0.2)
      .mockReturnValueOnce(0.4);
    const sequence = generateReferenceSequence(3, random);
    expect(sequence).toEqual([
      positionToFrequency(0.7),
      positionToFrequency(0.2),
      positionToFrequency(0.4),
    ]);
    expect(sequence.some((frequency) => !Number.isInteger(frequency))).toBe(
      true,
    );
    expect(Object.isFrozen(sequence)).toBe(true);
  });

  it('falha de forma limitada se a fonte nunca produzir referências distintas', () => {
    const random = vi.fn(() => 0);
    expect(() => generateReferenceSequence(3, random)).toThrow(RangeError);
    expect(random).toHaveBeenCalledTimes(96);
  });

  it.each([-1, 0, 4, 1.5, NaN])(
    'rejeita tamanho de sequência inválido: %s',
    (count) => {
      expect(() => generateReferenceSequence(count, () => 0.5)).toThrow(
        RangeError,
      );
    },
  );

  it.each([-0.1, 1, NaN, Infinity])(
    'rejeita valor aleatório inválido: %s',
    (value) => {
      expect(() => generateReferenceSequence(1, () => value)).toThrow(
        RangeError,
      );
      expect(() => generateInitialFrequency(200, () => value)).toThrow(
        RangeError,
      );
    },
  );

  it('mantém faixa e distância mínima para alvos e quantis inclusive nas bordas', () => {
    for (let targetStep = 0; targetStep <= 100; targetStep += 1) {
      const target = positionToFrequency(targetStep / 100);
      for (let draw = 0; draw <= 20; draw += 1) {
        const random = vi.fn(() =>
          draw === 20 ? 1 - Number.EPSILON : draw / 20,
        );
        const initial = generateInitialFrequency(target, random);
        expect(initial).toBeGreaterThanOrEqual(80);
        expect(initial).toBeLessThanOrEqual(700);
        expect(distanceCents(initial, target)).toBeGreaterThanOrEqual(300);
        expect(random).toHaveBeenCalledTimes(1);
      }
    }
  });

  it('pondera os intervalos válidos pela largura logarítmica', () => {
    const target = Math.sqrt(80 * 700);
    const lowerEnd = target / 2 ** (300 / 1200);
    const upperStart = target * 2 ** (300 / 1200);
    expect(generateInitialFrequency(target, () => 0.25)).toBeCloseTo(
      Math.sqrt(80 * lowerEnd),
      10,
    );
    expect(generateInitialFrequency(target, () => 0.75)).toBeCloseTo(
      Math.sqrt(700 * upperStart),
      10,
    );
  });

  it('suporta distância zero e o caso limite com apenas extremos válidos', () => {
    expect(
      generateInitialFrequency(200, () => 0.5, {
        ...DEFAULT_RULES,
        minInitialDistanceCents: 0,
      }),
    ).toBeCloseTo(positionToFrequency(0.5), 10);
    const rules = {
      ...DEFAULT_RULES,
      range: { minHz: 50, maxHz: 800 },
      minInitialDistanceCents: 2400,
    };
    expect([50, 800]).toContain(
      generateInitialFrequency(200, () => 0.5, rules),
    );
  });

  it.each([0, 50, 79.9, 700.1, NaN, Infinity])(
    'rejeita alvo ou posição fora da faixa: %s',
    (value) => {
      expect(() => generateInitialFrequency(value, () => 0.5)).toThrow(
        RangeError,
      );
      expect(() => frequencyToPosition(value)).toThrow(RangeError);
    },
  );

  it.each([-0.1, 1.1, NaN, Infinity])(
    'rejeita posição normalizada inválida: %s',
    (value) => {
      expect(() => positionToFrequency(value)).toThrow(RangeError);
    },
  );

  it('rejeita configurações impossíveis e faixas inválidas', () => {
    expect(() =>
      generateInitialFrequency(200, () => 0, {
        ...DEFAULT_RULES,
        minInitialDistanceCents: 5000,
      }),
    ).toThrow(RangeError);
    for (const range of [
      { minHz: 0, maxHz: 700 },
      { minHz: 700, maxHz: 50 },
      { minHz: 50, maxHz: Infinity },
    ]) {
      expect(() => positionToFrequency(0.5, range)).toThrow(RangeError);
    }
  });
});
