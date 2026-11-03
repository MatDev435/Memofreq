import { DurableObject } from 'cloudflare:workers';
import { createPlayerId, cryptoRandom } from './codes';
import { INTENT_HEADER, ROOM_CODE_HEADER } from './env';
import type { Env } from './env';
import {
  CLOSE_CODES,
  PING_MESSAGE,
  PONG_MESSAGE,
  PROTOCOL_VERSION,
  parseClientMessage,
  serializeServerMessage,
} from './protocol';
import type { ErrorCode, ServerMessage } from './protocol';
import { rejectedSocket } from './reject';
import type { JoinOutcome } from './room/room';
import { applyCommand, createRoom, joinRoom, removePlayer } from './room/room';
import type { RoomState } from './room/model';
import { buildRoomView } from './room/view';

const STORAGE_KEY = 'room';
/** Intervalo da verificação de conexões silenciosamente mortas. */
const DEFAULT_SWEEP_INTERVAL_MS = 30_000;
/** Sem ping nem mensagem por esse tempo, o participante é removido. */
const DEFAULT_INACTIVE_AFTER_MS = 75_000;
const RATE_WINDOW_MS = 10_000;
const RATE_LIMIT = 30;

interface Attachment {
  readonly playerId: string;
  readonly lastSeenAt: number;
}

function isAttachment(value: unknown): value is Attachment {
  return (
    typeof value === 'object' &&
    value !== null &&
    'playerId' in value &&
    typeof value.playerId === 'string' &&
    'lastSeenAt' in value &&
    typeof value.lastSeenAt === 'number'
  );
}

/** Lê um tempo opcional do ambiente; os testes usam valores curtos. */
function duration(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function readAttachment(ws: WebSocket): Attachment | null {
  const value: unknown = ws.deserializeAttachment();
  return isAttachment(value) ? value : null;
}

function send(ws: WebSocket, message: ServerMessage | string): void {
  try {
    ws.send(
      typeof message === 'string' ? message : serializeServerMessage(message),
    );
  } catch {
    // A conexão já fechou; o evento de fechamento cuidará da remoção.
  }
}

function close(ws: WebSocket, code: number, reason: string): void {
  try {
    ws.close(code, reason);
  } catch {
    // Fechar de novo uma conexão encerrada não tem efeito útil.
  }
}

function reject(ws: WebSocket, code: ErrorCode, closeCode: number): void {
  send(ws, { type: 'error', code, fatal: true });
  close(ws, closeCode, code);
}

/**
 * Uma instância por sala: serializa todos os eventos e mantém a autoridade.
 * Usa a API de hibernação; o estado fica em uma única chave do storage para
 * sobreviver à remoção da memória entre mensagens.
 */
export class RoomObject extends DurableObject<Env> {
  private room: RoomState | null = null;
  private readonly rates = new Map<
    string,
    { readonly start: number; count: number }
  >();
  private readonly sweepIntervalMs: number;
  private readonly inactiveAfterMs: number;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sweepIntervalMs = duration(
      env.SWEEP_INTERVAL_MS,
      DEFAULT_SWEEP_INTERVAL_MS,
    );
    this.inactiveAfterMs = duration(
      env.INACTIVE_AFTER_MS,
      DEFAULT_INACTIVE_AFTER_MS,
    );
    ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair(PING_MESSAGE, PONG_MESSAGE),
    );
    void ctx.blockConcurrencyWhile(async () => {
      this.room = (await ctx.storage.get<RoomState>(STORAGE_KEY)) ?? null;
      await this.dropOrphans();
    });
  }

  override async fetch(request: Request): Promise<Response> {
    const intent = request.headers.get(INTENT_HEADER);
    const code = request.headers.get(ROOM_CODE_HEADER);
    if (code === null || (intent !== 'create' && intent !== 'join')) {
      return new Response('Bad request', { status: 400 });
    }
    if (intent === 'create' && this.room !== null) {
      return new Response(null, { status: 409 });
    }

    const name = new URL(request.url).searchParams.get('name');
    const playerId = createPlayerId();
    const outcome: JoinOutcome =
      intent === 'create'
        ? createRoom(code, playerId, name)
        : this.room
          ? joinRoom(this.room, playerId, name)
          : { ok: false, error: 'room-not-found' };

    if (!outcome.ok) return rejectedSocket(outcome.error);

    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({
      playerId,
      lastSeenAt: Date.now(),
    } satisfies Attachment);
    send(server, {
      type: 'welcome',
      protocolVersion: PROTOCOL_VERSION,
      playerId,
    });
    await this.commit(outcome.state);
    await this.ensureSweep();
    return new Response(null, { status: 101, webSocket: client });
  }

  override async webSocketMessage(
    ws: WebSocket,
    message: string | ArrayBuffer,
  ): Promise<void> {
    const attachment = readAttachment(ws);
    const room = this.room;
    if (
      attachment === null ||
      room === null ||
      !room.players.some((player) => player.id === attachment.playerId)
    ) {
      close(ws, CLOSE_CODES.abuse, 'unknown-connection');
      return;
    }
    const { playerId } = attachment;
    if (this.exceedsRate(playerId)) {
      reject(ws, 'rate-limited', CLOSE_CODES.abuse);
      await this.commit(removePlayer(room, playerId));
      return;
    }
    ws.serializeAttachment({
      playerId,
      lastSeenAt: Date.now(),
    } satisfies Attachment);

    const command =
      typeof message === 'string' ? parseClientMessage(message) : null;
    if (command === null) {
      send(ws, { type: 'error', code: 'invalid-message', fatal: false });
      return;
    }
    const outcome = applyCommand(room, playerId, command, cryptoRandom);
    if (!outcome.ok) {
      send(ws, {
        type: 'error',
        code: outcome.error,
        fatal: false,
        request: command.type,
      });
      return;
    }

    const removed = outcome.removed;
    const sockets = removed ? this.socketsOf(removed.playerId) : [];
    await this.commit(outcome.state);
    for (const socket of sockets) {
      if (removed?.reason === 'kicked') {
        reject(socket, 'kicked', CLOSE_CODES.kicked);
      } else close(socket, CLOSE_CODES.left, 'left');
    }
  }

  override async webSocketClose(ws: WebSocket): Promise<void> {
    await this.disconnect(ws);
  }

  override async webSocketError(ws: WebSocket): Promise<void> {
    await this.disconnect(ws);
  }

  /** Remove conexões que pararam de enviar ping sem fechar o WebSocket. */
  override async alarm(): Promise<void> {
    let state = this.room;
    const now = Date.now();
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = readAttachment(ws);
      if (attachment === null) continue;
      const autoResponse =
        this.ctx.getWebSocketAutoResponseTimestamp(ws)?.getTime() ?? 0;
      if (
        now - Math.max(attachment.lastSeenAt, autoResponse) >
        this.inactiveAfterMs
      ) {
        reject(ws, 'inactive', CLOSE_CODES.inactive);
        state = state && removePlayer(state, attachment.playerId);
      }
    }
    await this.commit(state);
    if (this.room !== null) {
      await this.ctx.storage.setAlarm(now + this.sweepIntervalMs);
    }
  }

  private async disconnect(ws: WebSocket): Promise<void> {
    const attachment = readAttachment(ws);
    if (attachment === null || this.room === null) return;
    this.rates.delete(attachment.playerId);
    await this.commit(removePlayer(this.room, attachment.playerId));
  }

  private socketsOf(playerId: string): WebSocket[] {
    return this.ctx
      .getWebSockets()
      .filter((ws) => readAttachment(ws)?.playerId === playerId);
  }

  private exceedsRate(playerId: string): boolean {
    const now = Date.now();
    const window = this.rates.get(playerId);
    if (window === undefined || now - window.start >= RATE_WINDOW_MS) {
      this.rates.set(playerId, { start: now, count: 1 });
      return false;
    }
    window.count += 1;
    return window.count > RATE_LIMIT;
  }

  private async ensureSweep(): Promise<void> {
    if ((await this.ctx.storage.getAlarm()) === null) {
      await this.ctx.storage.setAlarm(Date.now() + this.sweepIntervalMs);
    }
  }

  /**
   * Após um reinício, conexões podem ter desaparecido sem evento de
   * fechamento. Participantes sem WebSocket ativo deixam a sala.
   */
  private async dropOrphans(): Promise<void> {
    const connected = new Set(
      this.ctx.getWebSockets().map((ws) => readAttachment(ws)?.playerId),
    );
    let state = this.room;
    for (const player of state?.players ?? []) {
      if (!connected.has(player.id)) {
        state = state && removePlayer(state, player.id);
      }
    }
    await this.commit(state);
  }

  /** Persiste e publica uma nova versão; `null` encerra a sala. */
  private async commit(next: RoomState | null): Promise<void> {
    if (next === this.room) return;
    this.room = next;
    if (next === null) {
      this.rates.clear();
      await this.ctx.storage.deleteAlarm();
      await this.ctx.storage.deleteAll();
      for (const ws of this.ctx.getWebSockets()) {
        close(ws, CLOSE_CODES.left, 'room-closed');
      }
      return;
    }
    await this.ctx.storage.put(STORAGE_KEY, next);
    const payload = serializeServerMessage({
      type: 'room',
      room: buildRoomView(next),
    });
    const members = new Set(next.players.map((player) => player.id));
    for (const ws of this.ctx.getWebSockets()) {
      const playerId = readAttachment(ws)?.playerId;
      if (playerId !== undefined && members.has(playerId)) send(ws, payload);
    }
  }
}
