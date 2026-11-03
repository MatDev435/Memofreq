// Socket falso e estados reais da sala para testar o cliente multiplayer.
import { parseClientMessage } from '../../server/src/protocol';
import type { ClientMessage } from '../../server/src/protocol';
import type { RoomState } from '../../server/src/room/model';
import { applyCommand, createRoom, joinRoom } from '../../server/src/room/room';
import { buildRoomView } from '../../server/src/room/view';
import type {
  SocketFactory,
  SocketHandle,
  SocketHandlers,
} from '../multiplayer/RoomConnection';
import type { RoomView, ServerMessage } from '../multiplayer/protocol';

export class FakeSocket implements SocketHandle {
  readonly sent: string[] = [];
  closed: { readonly code: number; readonly reason: string } | null = null;
  constructor(
    readonly url: string,
    private readonly handlers: SocketHandlers,
  ) {}
  send(data: string): void {
    this.sent.push(data);
  }
  close(code = 1000, reason = ''): void {
    this.closed = { code, reason };
  }
  open(): void {
    this.handlers.onOpen();
  }
  receive(message: ServerMessage): void {
    this.handlers.onMessage(JSON.stringify(message));
  }
  serverClose(code: number, reason = ''): void {
    this.handlers.onClose(code, reason);
  }
  /** Mensagens JSON enviadas, sem os pings. */
  messages(): ClientMessage[] {
    return this.sent
      .map((data) => parseClientMessage(data))
      .filter((message) => message !== null);
  }
}

export class FakeSockets {
  readonly all: FakeSocket[] = [];
  readonly factory: SocketFactory = (url, handlers) => {
    const socket = new FakeSocket(url, handlers);
    this.all.push(socket);
    return socket;
  };
  get last(): FakeSocket {
    const socket = this.all.at(-1);
    if (!socket) throw new Error('Nenhum socket aberto.');
    return socket;
  }
}

/** PRNG determinístico para sorteios reproduzíveis da sala. */
export function seeded(seed = 3): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  };
}

/** Sala autoritativa local, usando a mesma lógica do servidor. */
export class LocalRoom {
  state: RoomState;
  private readonly random = seeded();

  constructor(names: readonly string[]) {
    const [first = 'Ana', ...rest] = names;
    const created = createRoom('K7Q2M9XH3P', 'p1', first);
    if (!created.ok) throw new Error(created.error);
    this.state = created.state;
    rest.forEach((name, index) => {
      const joined = joinRoom(this.state, `p${String(index + 2)}`, name);
      if (!joined.ok) throw new Error(joined.error);
      this.state = joined.state;
    });
  }

  join(playerId: string, name: string): RoomView {
    const joined = joinRoom(this.state, playerId, name);
    if (!joined.ok) throw new Error(joined.error);
    this.state = joined.state;
    return this.view();
  }

  run(playerId: string, command: ClientMessage): RoomView {
    const outcome = applyCommand(this.state, playerId, command, this.random);
    if (!outcome.ok) throw new Error(`${command.type}: ${outcome.error}`);
    if (outcome.state === null) throw new Error('Sala encerrada.');
    this.state = outcome.state;
    return this.view();
  }

  view(): RoomView {
    return buildRoomView(this.state);
  }

  message(): ServerMessage {
    return { type: 'room', room: this.view() };
  }
}
