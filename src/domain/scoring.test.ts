// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  distanceCents,
  evaluateAttempt,
  meanScore,
  totalScore,
} from './scoring';

describe('Pontuação perceptual', () => {
  it('atribui dez ao acerto exato e preserva os valores decimais', () => {
    expect(evaluateAttempt(187.1234567, 187.1234567)).toEqual({
      targetHz: 187.1234567,
      playerHz: 187.1234567,
      differenceHz: 0,
      distanceCents: 0,
      score: 10,
    });
  });

  it.each([0, 100, 250, 499, 500, 501, 1200])(
    'aplica a fórmula a %s cents nos dois sentidos',
    (cents) => {
      const target = 200;
      const player = target * 2 ** (cents / 1200);
      const expected = 10 * Math.max(0, 1 - cents / 500);
      expect(evaluateAttempt(target, player).score).toBeCloseTo(expected, 10);
      expect(evaluateAttempt(player, target).score).toBeCloseTo(expected, 10);
    },
  );

  it('usa relação proporcional, diferença absoluta e corte configurável', () => {
    expect(distanceCents(100, 200)).toBeCloseTo(1200);
    expect(distanceCents(200, 400)).toBeCloseTo(1200);
    expect(evaluateAttempt(100, 200)).toMatchObject({
      differenceHz: 100,
      score: 0,
    });
    expect(
      evaluateAttempt(100, 100 * 2 ** (250 / 1200), 1000).score,
    ).toBeCloseTo(7.5);
  });

  it.each([0, -1, NaN, Infinity, -Infinity])(
    'rejeita frequência inválida: %s',
    (value) => {
      expect(() => evaluateAttempt(value, 200)).toThrow(RangeError);
      expect(() => evaluateAttempt(200, value)).toThrow(RangeError);
    },
  );

  it.each([0, -1, NaN, Infinity])('rejeita corte inválido: %s', (value) => {
    expect(() => evaluateAttempt(100, 100, value)).toThrow(RangeError);
  });

  it('mantém as notas entre zero e dez em toda a faixa', () => {
    for (let target = 50; target <= 700; target += 13) {
      for (let player = 50; player <= 700; player += 17) {
        const score = evaluateAttempt(target, player).score;
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(10);
      }
    }
  });

  it('calcula média do Extreme e soma sem arredondar parcelas', () => {
    expect(meanScore([8, 6, 10])).toBe(8);
    expect(meanScore([8, 6])).toBe(7);
    const mean = meanScore([10, 10, 0]);
    expect(totalScore([mean, mean, mean, mean, mean])).toBe(mean * 5);
    expect(totalScore([mean, mean, mean, mean, mean])).not.toBe(33.35);
    expect(totalScore([10, 10, 10, 10, 10])).toBe(50);
  });

  it.each([[], [-1], [11], [NaN], [Infinity]].map((scores) => ({ scores })))(
    'rejeita notas inválidas %j',
    ({ scores }) => {
      expect(() => meanScore(scores)).toThrow(RangeError);
    },
  );

  it('exige exatamente cinco rounds no resultado final', () => {
    expect(() => totalScore([10, 10, 10, 10])).toThrow(RangeError);
    expect(() => totalScore([10, 10, 10, 10, 10, 10])).toThrow(RangeError);
    expect(() => totalScore([10, 10, NaN, 10, 10])).toThrow(RangeError);
  });

  it('rejeita posições ausentes em uma lista de notas', () => {
    expect(() => meanScore(new Array<number>(1))).toThrow(RangeError);
  });
});
