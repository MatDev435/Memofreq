/**
 * Ponto único de acesso do frontend ao contrato do servidor multiplayer.
 * Tipos, códigos e normalizações vêm de `server/src`, sem duplicação.
 */
import type { ServerMessage } from '../../server/src/protocol';

export type {
  ClientMessage,
  ErrorCode,
  MatchView,
  PlayerRoundView,
  PlayerView,
  ProgressView,
  RankingEntry,
  RoomView,
  RoundResultsView,
  ServerMessage,
} from '../../server/src/protocol';
export type { RoomPhase } from '../../server/src/room/model';
export {
  CLOSE_CODES,
  PING_MESSAGE,
  PROTOCOL_VERSION,
} from '../../server/src/protocol';
export { MAX_PLAYERS } from '../../server/src/room/model';
export { normalizeRoomCode, ROOM_CODE_LENGTH } from '../../server/src/codes';
export { MAX_NAME_LENGTH, normalizeName } from '../../server/src/room/names';

export function createRoomUrl(base: string, name: string): string {
  return `${base}/rooms?name=${encodeURIComponent(name)}`;
}

export function joinRoomUrl(base: string, code: string, name: string): string {
  return `${base}/rooms/${encodeURIComponent(code)}?name=${encodeURIComponent(name)}`;
}

const PHASES = new Set(['lobby', 'ready', 'playing', 'round-results', 'final']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Confere a forma essencial das mensagens do próprio servidor. Mensagens
 * desconhecidas ou malformadas são ignoradas pelo cliente.
 */
function isServerMessage(value: unknown): value is ServerMessage {
  if (!isRecord(value)) return false;
  switch (value.type) {
    case 'welcome':
      return (
        typeof value.playerId === 'string' &&
        typeof value.protocolVersion === 'number'
      );
    case 'error':
      return typeof value.code === 'string' && typeof value.fatal === 'boolean';
    case 'room': {
      const room = value.room;
      return (
        isRecord(room) &&
        typeof room.code === 'string' &&
        typeof room.version === 'number' &&
        typeof room.hostId === 'string' &&
        typeof room.phase === 'string' &&
        PHASES.has(room.phase) &&
        Array.isArray(room.players) &&
        isRecord(room.selection) &&
        (room.match === null || isRecord(room.match))
      );
    }
    default:
      return false;
  }
}

export function parseServerMessage(raw: string): ServerMessage | null {
  try {
    const value: unknown = JSON.parse(raw);
    return isServerMessage(value) ? value : null;
  } catch {
    return null;
  }
}
