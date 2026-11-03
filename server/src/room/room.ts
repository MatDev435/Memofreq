import {
  DEFAULT_RULES,
  getModeSettings,
  ROUND_COUNT,
} from '../../../src/domain/config';
import {
  generateInitialFrequency,
  isFrequencyInRange,
} from '../../../src/domain/frequencies';
import type { RandomSource } from '../../../src/domain/frequencies';
import { createGameDefinition } from '../../../src/domain/gameDefinition';
import type { AttemptResult } from '../../../src/domain/models';
import { evaluateAttempt, meanScore } from '../../../src/domain/scoring';
import type { ClientMessage } from '../protocol';
import { MAX_PLAYERS } from './model';
import type {
  CommandError,
  JoinError,
  Match,
  Player,
  PlayerRound,
  RoomState,
} from './model';
import { nameKey, normalizeName } from './names';

export type JoinOutcome =
  | { readonly ok: true; readonly state: RoomState; readonly player: Player }
  | { readonly ok: false; readonly error: JoinError };

export type CommandOutcome =
  | {
      readonly ok: true;
      /** `null` quando a sala ficou vazia e deve ser encerrada. */
      readonly state: RoomState | null;
      /** Participante removido pelo comando (saída ou remoção pelo host). */
      readonly removed?: {
        readonly playerId: string;
        readonly reason: 'left' | 'kicked';
      };
    }
  | { readonly ok: false; readonly error: CommandError };

function bump(state: RoomState, changes: Partial<RoomState>): RoomState {
  return { ...state, ...changes, version: state.version + 1 };
}

function updateMatch(state: RoomState, match: Match): RoomState {
  return bump(state, { match });
}

// ---------- Criação, entrada e saída ----------

export function createRoom(
  code: string,
  playerId: string,
  rawName: unknown,
): JoinOutcome {
  const name = normalizeName(rawName);
  if (name === null) return { ok: false, error: 'invalid-name' };
  const player: Player = { id: playerId, name };
  return {
    ok: true,
    player,
    state: {
      code,
      players: [player],
      hostId: player.id,
      selection: { mode: 'normal' },
      phase: 'lobby',
      match: null,
      version: 1,
      matchCount: 0,
    },
  };
}

export function joinRoom(
  state: RoomState,
  playerId: string,
  rawName: unknown,
): JoinOutcome {
  const name = normalizeName(rawName);
  if (name === null) return { ok: false, error: 'invalid-name' };
  if (state.phase !== 'lobby') return { ok: false, error: 'room-in-match' };
  if (state.players.length >= MAX_PLAYERS) {
    return { ok: false, error: 'room-full' };
  }
  const key = nameKey(name);
  if (state.players.some((player) => nameKey(player.name) === key)) {
    return { ok: false, error: 'name-taken' };
  }
  const player: Player = { id: playerId, name };
  return {
    ok: true,
    player,
    state: bump(state, { players: [...state.players, player] }),
  };
}

/**
 * Remove um participante por saída, desconexão ou remoção pelo host. O host
 * passa ao participante mais antigo; a partida é reavaliada imediatamente.
 * Retorna `null` quando a sala fica vazia e o mesmo estado se o ID é desconhecido.
 */
export function removePlayer(
  state: RoomState,
  playerId: string,
): RoomState | null {
  if (!state.players.some((player) => player.id === playerId)) return state;
  const players = state.players.filter((player) => player.id !== playerId);
  const nextHost = players[0];
  if (nextHost === undefined) return null;

  const match = state.match && {
    ...state.match,
    rounds: state.match.rounds.map((round) =>
      Object.fromEntries(
        Object.entries(round).filter(([id]) => id !== playerId),
      ),
    ),
    readyIds: state.match.readyIds.filter((id) => id !== playerId),
  };

  return progress(
    bump(state, {
      players,
      hostId: state.hostId === playerId ? nextHost.id : state.hostId,
      match,
    }),
  );
}

// ---------- Progresso da partida ----------

function startRound(state: RoomState, match: Match, roundIndex: number) {
  const entries: Record<string, PlayerRound> = {};
  for (const player of state.players) {
    entries[player.id] = { status: 'playing', attempts: [] };
  }
  return bump(state, {
    phase: 'playing',
    match: {
      ...match,
      roundIndex,
      rounds: [...match.rounds.slice(0, roundIndex), entries],
      readyIds: [],
    },
  });
}

/** Avança quando todos os participantes atuais cumpriram a etapa vigente. */
function progress(state: RoomState): RoomState {
  const match = state.match;
  if (match === null) return state;
  const everyone = (test: (id: string) => boolean) =>
    state.players.every((player) => test(player.id));

  switch (state.phase) {
    case 'ready':
      return everyone((id) => match.readyIds.includes(id))
        ? startRound(state, match, match.roundIndex)
        : state;
    case 'round-results':
      return everyone((id) => match.readyIds.includes(id))
        ? startRound(state, match, match.roundIndex + 1)
        : state;
    case 'playing': {
      const round = match.rounds[match.roundIndex] ?? {};
      if (!everyone((id) => round[id]?.status !== 'playing')) return state;
      return bump(state, {
        phase: match.roundIndex + 1 >= ROUND_COUNT ? 'final' : 'round-results',
        match: { ...match, readyIds: [] },
      });
    }
    default:
      return state;
  }
}

function startMatch(state: RoomState, random: RandomSource): RoomState {
  const rules = DEFAULT_RULES;
  const matchCount = state.matchCount + 1;
  const definition = createGameDefinition(
    `${state.code}-${String(matchCount)}`,
    state.selection,
    random,
    rules,
  );
  const initialFrequencies = definition.rounds.map((round) =>
    round.references.map((target) =>
      generateInitialFrequency(target, random, rules),
    ),
  );
  return bump(state, {
    phase: 'ready',
    matchCount,
    match: {
      definition,
      initialFrequencies,
      roundIndex: 0,
      rounds: [],
      readyIds: [],
    },
  });
}

function submitGuess(
  state: RoomState,
  match: Match,
  playerId: string,
  roundIndex: number,
  attemptIndex: number,
  frequencyHz: number,
): CommandOutcome {
  if (roundIndex !== match.roundIndex)
    return { ok: false, error: 'wrong-round' };
  const round = match.rounds[roundIndex] ?? {};
  const entry = round[playerId];
  if (entry?.status !== 'playing') {
    return { ok: false, error: 'already-finished' };
  }
  if (attemptIndex !== entry.attempts.length) {
    return { ok: false, error: 'wrong-attempt' };
  }
  const { rules, selection } = match.definition;
  const target = match.definition.rounds[roundIndex]?.references[attemptIndex];
  if (target === undefined) return { ok: false, error: 'wrong-attempt' };
  if (!isFrequencyInRange(frequencyHz, rules.range)) {
    return { ok: false, error: 'invalid-frequency' };
  }

  const attempt: AttemptResult = {
    ...evaluateAttempt(target, frequencyHz, rules.zeroScoreDistanceCents),
    attemptIndex,
  };
  const attempts = [...entry.attempts, attempt];
  const { referencesPerRound } = getModeSettings(selection, rules);
  const next: PlayerRound =
    attempts.length < referencesPerRound
      ? { status: 'playing', attempts }
      : {
          status: 'completed',
          result: {
            roundIndex,
            attempts,
            score: meanScore(attempts.map((item) => item.score)),
          },
        };
  return withRoundEntry(state, match, roundIndex, playerId, next);
}

function withRoundEntry(
  state: RoomState,
  match: Match,
  roundIndex: number,
  playerId: string,
  entry: PlayerRound,
): CommandOutcome {
  const rounds = match.rounds.map((round, index) =>
    index === roundIndex ? { ...round, [playerId]: entry } : round,
  );
  return {
    ok: true,
    state: progress(updateMatch(state, { ...match, rounds })),
  };
}

// ---------- Comandos ----------

const HOST_COMMANDS = new Set<ClientMessage['type']>([
  'set-mode',
  'start-match',
  'kick',
  'play-again',
]);

/**
 * Aplica um comando de um participante. Comandos sem efeito, como repetir
 * "pronto", retornam o mesmo objeto de estado para evitar publicações.
 */
export function applyCommand(
  state: RoomState,
  playerId: string,
  command: ClientMessage,
  random: RandomSource,
): CommandOutcome {
  if (!state.players.some((player) => player.id === playerId)) {
    return { ok: false, error: 'invalid-target' };
  }
  if (HOST_COMMANDS.has(command.type) && state.hostId !== playerId) {
    return { ok: false, error: 'not-host' };
  }
  const match = state.match;

  switch (command.type) {
    case 'leave':
      return {
        ok: true,
        state: removePlayer(state, playerId),
        removed: { playerId, reason: 'left' },
      };
    case 'kick':
      if (
        command.playerId === playerId ||
        !state.players.some((player) => player.id === command.playerId)
      ) {
        return { ok: false, error: 'invalid-target' };
      }
      return {
        ok: true,
        state: removePlayer(state, command.playerId),
        removed: { playerId: command.playerId, reason: 'kicked' },
      };
    case 'set-mode':
      if (state.phase !== 'lobby') return { ok: false, error: 'invalid-phase' };
      return { ok: true, state: bump(state, { selection: command.selection }) };
    case 'start-match':
      if (state.phase !== 'lobby') return { ok: false, error: 'invalid-phase' };
      return { ok: true, state: startMatch(state, random) };
    case 'play-again':
      if (state.phase !== 'final') return { ok: false, error: 'invalid-phase' };
      return { ok: true, state: bump(state, { phase: 'lobby', match: null }) };
    case 'ready':
      if (
        match === null ||
        (state.phase !== 'ready' && state.phase !== 'round-results')
      ) {
        return { ok: false, error: 'invalid-phase' };
      }
      if (match.readyIds.includes(playerId)) return { ok: true, state };
      return {
        ok: true,
        state: progress(
          updateMatch(state, {
            ...match,
            readyIds: [...match.readyIds, playerId],
          }),
        ),
      };
    case 'submit-guess':
      if (match === null || state.phase !== 'playing') {
        return { ok: false, error: 'invalid-phase' };
      }
      return submitGuess(
        state,
        match,
        playerId,
        command.roundIndex,
        command.attemptIndex,
        command.frequencyHz,
      );
    case 'forfeit-round': {
      if (match === null || state.phase !== 'playing') {
        return { ok: false, error: 'invalid-phase' };
      }
      if (command.roundIndex !== match.roundIndex) {
        return { ok: false, error: 'wrong-round' };
      }
      const entry = match.rounds[match.roundIndex]?.[playerId];
      if (entry?.status !== 'playing') {
        return { ok: false, error: 'already-finished' };
      }
      return withRoundEntry(state, match, match.roundIndex, playerId, {
        status: 'forfeited',
      });
    }
  }
}
