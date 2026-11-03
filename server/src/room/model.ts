import type { ModeSelection } from '../../../src/domain/config';
import type {
  AttemptResult,
  GameDefinition,
  RoundResult,
} from '../../../src/domain/models';

export const MAX_PLAYERS = 8;

export interface Player {
  readonly id: string;
  readonly name: string;
}

/**
 * Fases da sala. Apenas `lobby` aceita novos participantes.
 * `ready` antecede o primeiro round; `round-results` também funciona como
 * confirmação de prontidão para o round seguinte.
 */
export type RoomPhase =
  'lobby' | 'ready' | 'playing' | 'round-results' | 'final';

export type PlayerRound =
  | { readonly status: 'playing'; readonly attempts: readonly AttemptResult[] }
  | { readonly status: 'completed'; readonly result: RoundResult }
  | { readonly status: 'forfeited' };

export interface Match {
  readonly definition: GameDefinition;
  /** Posição inicial do slider por round e tentativa, igual para todos. */
  readonly initialFrequencies: readonly (readonly number[])[];
  readonly roundIndex: number;
  /** Uma entrada por round iniciado, indexada pelo ID dos participantes atuais. */
  readonly rounds: readonly Readonly<Record<string, PlayerRound>>[];
  readonly readyIds: readonly string[];
}

/** Estado autoritativo e serializável de uma sala. */
export interface RoomState {
  readonly code: string;
  /** Ordem de entrada: define a transferência de host e o desempate do ranking. */
  readonly players: readonly Player[];
  readonly hostId: string;
  readonly selection: ModeSelection;
  readonly phase: RoomPhase;
  readonly match: Match | null;
  /** Aumenta a cada mudança publicada aos clientes. */
  readonly version: number;
  /** Quantidade de partidas iniciadas na sala; compõe o ID da definição. */
  readonly matchCount: number;
}

export type JoinError =
  | 'invalid-name'
  | 'name-taken'
  | 'room-full'
  | 'room-in-match'
  | 'room-not-found';

export type CommandError =
  | 'not-host'
  | 'invalid-phase'
  | 'invalid-target'
  | 'wrong-round'
  | 'wrong-attempt'
  | 'already-finished'
  | 'invalid-frequency';
