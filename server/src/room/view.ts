import { getModeSettings, ROUND_COUNT } from '../../../src/domain/config';
import { totalScore } from '../../../src/domain/scoring';
import type {
  MatchView,
  PlayerRoundView,
  ProgressView,
  RankingEntry,
  RoomView,
  RoundResultsView,
} from '../protocol';
import { MAX_PLAYERS } from './model';
import type { Match, Player, RoomState } from './model';

function roundResults(
  players: readonly Player[],
  match: Match,
  roundIndex: number,
): RoundResultsView {
  const round = match.rounds[roundIndex] ?? {};
  const results: PlayerRoundView[] = [];
  for (const player of players) {
    const entry = round[player.id];
    if (entry?.status === 'completed') {
      results.push({
        playerId: player.id,
        name: player.name,
        status: 'completed',
        score: entry.result.score,
        attempts: entry.result.attempts,
      });
    } else if (entry?.status === 'forfeited') {
      results.push({
        playerId: player.id,
        name: player.name,
        status: 'forfeited',
        score: 0,
        attempts: [],
      });
    }
  }
  return {
    roundIndex,
    references: match.definition.rounds[roundIndex]?.references ?? [],
    players: results,
  };
}

/**
 * Ordena pela soma dos cinco rounds (round perdido vale zero). Empates exatos,
 * na precisão interna, compartilham a posição e mantêm a ordem de entrada.
 */
export function buildRanking(
  players: readonly Player[],
  match: Match,
): RankingEntry[] {
  const rows = players.map((player, order) => {
    const roundScores = Array.from({ length: ROUND_COUNT }, (_, index) => {
      const entry = match.rounds[index]?.[player.id];
      return entry?.status === 'completed' ? entry.result.score : 0;
    });
    return { player, order, roundScores, total: totalScore(roundScores) };
  });
  rows.sort((a, b) => b.total - a.total || a.order - b.order);
  return rows.map((row) => ({
    position: 1 + rows.filter((other) => other.total > row.total).length,
    playerId: row.player.id,
    name: row.player.name,
    totalScore: row.total,
    roundScores: row.roundScores,
  }));
}

function matchView(state: RoomState, match: Match): MatchView {
  const { definition, roundIndex } = match;
  const settings = getModeSettings(definition.selection, definition.rules);
  const playing = state.phase === 'playing';
  const final = state.phase === 'final';
  const round = match.rounds[roundIndex] ?? {};

  const progress: ProgressView[] = playing
    ? state.players.map((player) => {
        const entry = round[player.id];
        return {
          playerId: player.id,
          status: entry?.status ?? 'playing',
          attemptsSubmitted:
            entry?.status === 'playing'
              ? entry.attempts.length
              : entry?.status === 'completed'
                ? entry.result.attempts.length
                : 0,
        };
      })
    : [];

  return {
    modality: settings.modality,
    settings,
    rules: definition.rules,
    roundIndex,
    roundCount: ROUND_COUNT,
    readyIds: match.readyIds,
    progress,
    currentRound: playing
      ? {
          roundIndex,
          references: definition.rounds[roundIndex]?.references ?? [],
          initialFrequencies: match.initialFrequencies[roundIndex] ?? [],
        }
      : null,
    lastRound:
      state.phase === 'round-results' || final
        ? roundResults(state.players, match, roundIndex)
        : null,
    ranking: final ? buildRanking(state.players, match) : null,
    rounds: final
      ? Array.from({ length: ROUND_COUNT }, (_, index) =>
          roundResults(state.players, match, index),
        )
      : null,
  };
}

/** Visão pública da sala, igual para todos os participantes conectados. */
export function buildRoomView(state: RoomState): RoomView {
  return {
    code: state.code,
    version: state.version,
    phase: state.phase,
    hostId: state.hostId,
    maxPlayers: MAX_PLAYERS,
    selection: state.selection,
    players: state.players.map(({ id, name }) => ({ id, name })),
    match: state.match && matchView(state, state.match),
  };
}
