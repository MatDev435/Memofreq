// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RULES,
  getModeSettings,
  MAX_GAME_SCORE,
  ROUND_COUNT,
  snapshotRules,
  validateRules,
} from './config';

describe('Configuração e modalidades', () => {
  it('centraliza cinco rounds, cinquenta pontos, faixa e tempos aprovados', () => {
    expect(ROUND_COUNT).toBe(5);
    expect(MAX_GAME_SCORE).toBe(50);
    expect(DEFAULT_RULES).toMatchObject({
      range: { minHz: 50, maxHz: 700 },
      countdownSeconds: 3,
      referenceSeconds: { normal: 3, hard: 1.5, extreme: 1.5 },
      sequenceGapSeconds: 0.3,
      minInitialDistanceCents: 300,
      zeroScoreDistanceCents: 500,
    });
  });

  it('diferencia Normal, Hard e os dois tamanhos do Extreme', () => {
    expect(getModeSettings({ mode: 'normal' })).toEqual({
      modality: 'normal',
      referencesPerRound: 1,
      referenceSeconds: 3,
      showFrequencyVisually: true,
    });
    expect(getModeSettings({ mode: 'hard' })).toEqual({
      modality: 'hard',
      referencesPerRound: 1,
      referenceSeconds: 1.5,
      showFrequencyVisually: false,
    });
    for (const count of [2, 3] satisfies (2 | 3)[]) {
      expect(
        getModeSettings({ mode: 'extreme', frequencyCount: count }),
      ).toEqual({
        modality: `extreme-${String(count)}`,
        referencesPerRound: count,
        referenceSeconds: 1.5,
        showFrequencyVisually: false,
      });
    }
  });

  it.each([0, -1, NaN, Infinity])(
    'rejeita duração inválida: %s',
    (countdownSeconds) => {
      expect(() => {
        validateRules({ ...DEFAULT_RULES, countdownSeconds });
      }).toThrow(RangeError);
    },
  );

  it('rejeita distância inviável, pausas negativas, versão vazia e corte nulo', () => {
    for (const rules of [
      { ...DEFAULT_RULES, minInitialDistanceCents: 5000 },
      { ...DEFAULT_RULES, sequenceGapSeconds: -0.1 },
      { ...DEFAULT_RULES, zeroScoreDistanceCents: 0 },
      { ...DEFAULT_RULES, version: ' ' },
      {
        ...DEFAULT_RULES,
        referenceSeconds: { ...DEFAULT_RULES.referenceSeconds, hard: NaN },
      },
    ])
      expect(() => {
        validateRules(rules);
      }).toThrow(RangeError);
  });

  it('copia e congela configurações sem congelar o objeto do chamador', () => {
    const input = { ...DEFAULT_RULES, range: { minHz: 50, maxHz: 700 } };
    const snapshot = snapshotRules(input);
    input.range.minHz = 80;
    expect(snapshot.range.minHz).toBe(50);
    expect(Object.isFrozen(snapshot.range)).toBe(true);
    expect(Object.isFrozen(snapshot.referenceSeconds)).toBe(true);
  });
});
