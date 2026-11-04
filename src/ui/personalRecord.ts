import type { Modality } from '../domain/config';

/**
 * Recorde pessoal guardado apenas neste navegador (`localStorage`). Não há
 * histórico nem envio a servidor: só a melhor pontuação de cada modo.
 */
export interface PersonalRecord {
  readonly score: number;
  /** Partida que estabeleceu o recorde. */
  readonly gameId: string;
}

const PREFIX = 'memofreq:record:';

function parse(raw: string | null): PersonalRecord | null {
  if (raw === null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (
      typeof value === 'object' &&
      value !== null &&
      'score' in value &&
      'gameId' in value &&
      typeof value.score === 'number' &&
      Number.isFinite(value.score) &&
      typeof value.gameId === 'string'
    )
      return { score: value.score, gameId: value.gameId };
  } catch {
    // Valor corrompido: tratado como inexistente.
  }
  return null;
}

/**
 * Registra a partida e devolve o recorde vigente. Idempotente para o mesmo
 * `gameId`, de modo que renderizações repetidas não alteram o resultado.
 */
export function recordGame(
  modality: Modality,
  gameId: string,
  score: number,
  storage: Pick<Storage, 'getItem' | 'setItem'> | null = browserStorage(),
): { readonly record: PersonalRecord; readonly isNew: boolean } {
  const current: PersonalRecord = { score, gameId };
  if (storage === null) return { record: current, isNew: false };
  let previous: PersonalRecord | null;
  try {
    previous = parse(storage.getItem(PREFIX + modality));
  } catch {
    return { record: current, isNew: false };
  }
  if (
    previous !== null &&
    (previous.gameId === gameId || previous.score >= score)
  )
    return { record: previous, isNew: previous.gameId === gameId };
  try {
    storage.setItem(PREFIX + modality, JSON.stringify(current));
  } catch {
    return { record: current, isNew: false };
  }
  return { record: current, isNew: true };
}

function browserStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}
