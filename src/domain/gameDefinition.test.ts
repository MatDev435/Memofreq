// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { ModeSelection } from './config';
import { DEFAULT_RULES, getModeSettings } from './config';
import { createGameDefinition, snapshotGameDefinition } from './gameDefinition';
import type { RoundDefinition } from './models';

const selections: ModeSelection[] = [
  { mode: 'normal' },
  { mode: 'hard' },
  { mode: 'extreme', frequencyCount: 2 },
  { mode: 'extreme', frequencyCount: 3 },
];

describe('Definição de desafios', () => {
  it.each(selections)(
    'gera cinco rounds para %j sem depender do navegador',
    (selection) => {
      let draw = 0;
      const definition = createGameDefinition(
        'partida',
        selection,
        () => (++draw % 19) / 19,
      );
      expect(definition.rounds).toHaveLength(5);
      for (const round of definition.rounds) {
        expect(round.references).toHaveLength(
          getModeSettings(selection).referencesPerRound,
        );
        expect(new Set(round.references).size).toBe(round.references.length);
        expect(
          round.references.every(
            (frequency) => frequency >= 50 && frequency <= 700,
          ),
        ).toBe(true);
      }
    },
  );

  it('mantém um snapshot independente e imutável de alvos e regras', () => {
    const input = {
      id: 'snapshot',
      selection: { mode: 'normal' } satisfies ModeSelection,
      rules: { ...DEFAULT_RULES, range: { minHz: 50, maxHz: 700 } },
      rounds: Array.from({ length: 5 }, () => ({ references: [200] })),
    };
    const result = snapshotGameDefinition(input);
    input.rounds[0]?.references.push(300);
    input.rules.range.maxHz = 800;
    expect(result.rounds[0]?.references).toEqual([200]);
    expect(result.rules.range.maxHz).toBe(700);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.rounds[0]?.references)).toBe(true);
  });

  it('rejeita definições incompletas, duplicadas ou fora da faixa', () => {
    const input = {
      id: 'partida',
      selection: { mode: 'normal' } satisfies ModeSelection,
      rules: DEFAULT_RULES,
      rounds: Array.from({ length: 5 }, () => ({ references: [200] })),
    };
    expect(() => snapshotGameDefinition({ ...input, id: ' ' })).toThrow(
      RangeError,
    );
    expect(() =>
      snapshotGameDefinition({ ...input, rounds: input.rounds.slice(1) }),
    ).toThrow(RangeError);
    for (const references of [[NaN], [701], [200, 200], []]) {
      expect(() =>
        snapshotGameDefinition({
          ...input,
          rounds: Array.from({ length: 5 }, () => ({ references })),
        }),
      ).toThrow(RangeError);
    }
    expect(() =>
      snapshotGameDefinition({
        ...input,
        selection: { mode: 'extreme', frequencyCount: 2 },
        rounds: Array.from({ length: 5 }, () => ({ references: [200, 200] })),
      }),
    ).toThrow(RangeError);
  });

  it('rejeita rounds ou referências ausentes em arrays esparsos', () => {
    const base = createGameDefinition('sparse', { mode: 'normal' }, () => 0.5);
    expect(() =>
      snapshotGameDefinition({
        ...base,
        rounds: new Array<RoundDefinition>(5),
      }),
    ).toThrow(RangeError);
    expect(() =>
      snapshotGameDefinition({
        ...base,
        rounds: Array.from({ length: 5 }, () => ({
          references: new Array<number>(1),
        })),
      }),
    ).toThrow(RangeError);
  });
});
