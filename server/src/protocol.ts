/**
 * Contrato WebSocket do multiplayer. Mensagens são objetos JSON com `type`.
 * A única exceção é o texto `ping`, respondido com `pong` sem acordar a sala.
 * Documentação: docs/multiplayer-protocol.md.
 */
import type {
  GameRules,
  Modality,
  ModeSelection,
  ModeSettings,
} from '../../src/domain/config';
import type { AttemptResult } from '../../src/domain/models';
import type { CommandError, JoinError, RoomPhase } from './room/model';

export const PROTOCOL_VERSION = 1;
export const MAX_MESSAGE_LENGTH = 2048;
export const PING_MESSAGE = 'ping';
export const PONG_MESSAGE = 'pong';

/** Códigos de fechamento enviados pelo servidor, além de 1000 (saída normal). */
export const CLOSE_CODES = Object.freeze({
  left: 1000,
  joinRejected: 4000,
  kicked: 4001,
  inactive: 4002,
  abuse: 4003,
});

// ---------- Cliente → servidor ----------

export type ClientMessage =
  | { readonly type: 'set-mode'; readonly selection: ModeSelection }
  | { readonly type: 'start-match' }
  | { readonly type: 'ready' }
  | {
      readonly type: 'submit-guess';
      readonly roundIndex: number;
      readonly attemptIndex: number;
      readonly frequencyHz: number;
    }
  | { readonly type: 'forfeit-round'; readonly roundIndex: number }
  | { readonly type: 'kick'; readonly playerId: string }
  | { readonly type: 'play-again' }
  | { readonly type: 'leave' };

export type ClientMessageType = ClientMessage['type'];

// ---------- Servidor → cliente ----------

export type ErrorCode =
  | JoinError
  | CommandError
  | 'invalid-message'
  | 'rate-limited'
  | 'kicked'
  | 'inactive';

export interface PlayerView {
  readonly id: string;
  readonly name: string;
}

export interface ProgressView {
  readonly playerId: string;
  readonly status: 'playing' | 'completed' | 'forfeited';
  readonly attemptsSubmitted: number;
}

/** Dados necessários para tocar e responder o round vigente. */
export interface CurrentRoundView {
  readonly roundIndex: number;
  readonly references: readonly number[];
  readonly initialFrequencies: readonly number[];
}

export interface PlayerRoundView {
  readonly playerId: string;
  readonly name: string;
  readonly status: 'completed' | 'forfeited';
  /** Média das tentativas; zero quando o round foi perdido. */
  readonly score: number;
  /** Vazio quando o round foi perdido. */
  readonly attempts: readonly AttemptResult[];
}

export interface RoundResultsView {
  readonly roundIndex: number;
  readonly references: readonly number[];
  readonly players: readonly PlayerRoundView[];
}

export interface RankingEntry {
  /** Competição padrão: empates exatos compartilham a posição (1, 1, 3). */
  readonly position: number;
  readonly playerId: string;
  readonly name: string;
  readonly totalScore: number;
  readonly roundScores: readonly number[];
}

export interface MatchView {
  readonly modality: Modality;
  readonly settings: ModeSettings;
  readonly rules: GameRules;
  readonly roundIndex: number;
  readonly roundCount: number;
  /** Participantes prontos em `ready` e `round-results`. */
  readonly readyIds: readonly string[];
  /** Progresso sem valores; preenchido somente em `playing`. */
  readonly progress: readonly ProgressView[];
  /** Somente em `playing`; nunca contém rounds futuros. */
  readonly currentRound: CurrentRoundView | null;
  /** Último round encerrado, em `round-results` e `final`. */
  readonly lastRound: RoundResultsView | null;
  /** Somente em `final`. */
  readonly ranking: readonly RankingEntry[] | null;
  /** Somente em `final`: os cinco rounds dos participantes restantes. */
  readonly rounds: readonly RoundResultsView[] | null;
}

export interface RoomView {
  readonly code: string;
  readonly version: number;
  readonly phase: RoomPhase;
  readonly hostId: string;
  readonly maxPlayers: number;
  readonly selection: ModeSelection;
  /** Ordem de entrada. */
  readonly players: readonly PlayerView[];
  readonly match: MatchView | null;
}

export type ServerMessage =
  | {
      readonly type: 'welcome';
      readonly protocolVersion: number;
      readonly playerId: string;
    }
  | { readonly type: 'room'; readonly room: RoomView }
  | {
      readonly type: 'error';
      readonly code: ErrorCode;
      /** Quando verdadeiro, o servidor fecha a conexão em seguida. */
      readonly fatal: boolean;
      readonly request?: ClientMessageType;
    };

// ---------- Validação ----------

type JsonRecord = Readonly<Record<string, unknown>>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isIndex(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function parseSelection(value: unknown): ModeSelection | null {
  if (!isRecord(value)) return null;
  switch (value.mode) {
    case 'normal':
      return { mode: 'normal' };
    case 'hard':
      return { mode: 'hard' };
    case 'extreme':
      return value.frequencyCount === 2 || value.frequencyCount === 3
        ? { mode: 'extreme', frequencyCount: value.frequencyCount }
        : null;
    default:
      return null;
  }
}

/** Valida a forma da mensagem. Regras de fase e permissão ficam na sala. */
export function parseClientMessage(raw: string): ClientMessage | null {
  if (raw.length > MAX_MESSAGE_LENGTH) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(data)) return null;

  switch (data.type) {
    case 'start-match':
    case 'ready':
    case 'play-again':
    case 'leave':
      return { type: data.type };
    case 'set-mode': {
      const selection = parseSelection(data.selection);
      return selection ? { type: 'set-mode', selection } : null;
    }
    case 'submit-guess':
      return isIndex(data.roundIndex) &&
        isIndex(data.attemptIndex) &&
        typeof data.frequencyHz === 'number' &&
        Number.isFinite(data.frequencyHz)
        ? {
            type: 'submit-guess',
            roundIndex: data.roundIndex,
            attemptIndex: data.attemptIndex,
            frequencyHz: data.frequencyHz,
          }
        : null;
    case 'forfeit-round':
      return isIndex(data.roundIndex)
        ? { type: 'forfeit-round', roundIndex: data.roundIndex }
        : null;
    case 'kick':
      return typeof data.playerId === 'string' &&
        data.playerId.length > 0 &&
        data.playerId.length <= 64
        ? { type: 'kick', playerId: data.playerId }
        : null;
    default:
      return null;
  }
}

export function serializeServerMessage(message: ServerMessage): string {
  return JSON.stringify(message);
}
