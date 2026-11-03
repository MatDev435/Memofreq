// Utilitários exclusivos dos testes unitários da sala.
import type { RandomSource } from '../../../src/domain/frequencies';
import type { ClientMessage } from '../protocol';
import type { RoomState } from './model';
import { applyCommand, createRoom, joinRoom } from './room';

/** PRNG determinístico (mulberry32) para sorteios reproduzíveis. */
export function seededRandom(seed = 1): RandomSource {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  };
}

export const random = seededRandom(7);

export function roomWith(...names: string[]): RoomState {
  const [first = 'Host', ...rest] = names;
  const created = createRoom('ABCDEFGHJK', 'p1', first);
  if (!created.ok) throw new Error(created.error);
  let state = created.state;
  rest.forEach((name, index) => {
    const joined = joinRoom(state, `p${String(index + 2)}`, name);
    if (!joined.ok) throw new Error(joined.error);
    state = joined.state;
  });
  return state;
}

/** Aplica um comando que deve ser aceito e manter a sala aberta. */
export function run(
  state: RoomState,
  playerId: string,
  command: ClientMessage,
): RoomState {
  const outcome = applyCommand(state, playerId, command, random);
  if (!outcome.ok) throw new Error(`${command.type}: ${outcome.error}`);
  if (outcome.state === null) throw new Error('Sala encerrada.');
  return outcome.state;
}

export function readyAll(state: RoomState): RoomState {
  return state.players.reduce(
    (current, player) => run(current, player.id, { type: 'ready' }),
    state,
  );
}

export function target(state: RoomState, attemptIndex: number): number {
  const match = state.match;
  if (match === null) throw new Error('Sem partida.');
  const value =
    match.definition.rounds[match.roundIndex]?.references[attemptIndex];
  if (value === undefined) throw new Error('Alvo inexistente.');
  return value;
}

/** Envia todos os palpites do round vigente para um participante. */
export function answerRound(
  state: RoomState,
  playerId: string,
  guess: (targetHz: number, attemptIndex: number) => number = (hz) => hz,
): RoomState {
  const match = state.match;
  if (match === null) throw new Error('Sem partida.');
  const count =
    match.definition.rounds[match.roundIndex]?.references.length ?? 0;
  let current = state;
  for (let attemptIndex = 0; attemptIndex < count; attemptIndex += 1) {
    current = run(current, playerId, {
      type: 'submit-guess',
      roundIndex: match.roundIndex,
      attemptIndex,
      frequencyHz: guess(target(current, attemptIndex), attemptIndex),
    });
  }
  return current;
}
