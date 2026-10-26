import {
  DEFAULT_RULES,
  getModeSettings,
  ROUND_COUNT,
  snapshotRules,
} from './config';
import type { GameRules, ModeSelection } from './config';
import { generateReferenceSequence, isFrequencyInRange } from './frequencies';
import type { RandomSource } from './frequencies';
import type { GameDefinition } from './models';

export function snapshotGameDefinition(
  definition: GameDefinition,
): GameDefinition {
  if (definition.id.trim() === '' || definition.rounds.length !== ROUND_COUNT) {
    throw new RangeError('A partida exige um identificador e cinco rounds.');
  }
  const rules = snapshotRules(definition.rules);
  const settings = getModeSettings(definition.selection, rules);
  const rounds = Array.from({ length: ROUND_COUNT }, (_, index) => {
    const round = definition.rounds[index];
    if (!round) throw new RangeError('Round ausente.');
    const references = Array.from(round.references);
    if (
      round.references.length !== settings.referencesPerRound ||
      new Set(round.references).size !== round.references.length ||
      references.some((value) => !isFrequencyInRange(value, rules.range))
    ) {
      throw new RangeError('Referências inválidas para a modalidade.');
    }
    return Object.freeze({ references: Object.freeze(references) });
  });
  return Object.freeze({
    id: definition.id,
    selection: Object.freeze({ ...definition.selection }),
    rules,
    rounds: Object.freeze(rounds),
  });
}

export function createGameDefinition(
  id: string,
  selection: ModeSelection,
  random: RandomSource,
  rules: GameRules = DEFAULT_RULES,
): GameDefinition {
  const settings = getModeSettings(selection, rules);
  return snapshotGameDefinition({
    id,
    selection,
    rules,
    rounds: Array.from({ length: ROUND_COUNT }, () => ({
      references: generateReferenceSequence(
        settings.referencesPerRound,
        random,
        rules.range,
      ),
    })),
  });
}
