import type {
  ClientMessage,
  ErrorCode,
  RoomView,
  ServerMessage,
} from '../src/protocol';
import { ALLOWED_ORIGIN, WS_URL } from './config';

const DEFAULT_TIMEOUT = 5000;

interface Waiter {
  readonly test: (message: ServerMessage) => boolean;
  readonly resolve: (message: ServerMessage) => void;
}

export interface Closure {
  readonly code: number;
  readonly reason: string;
}

function isServerMessage(value: unknown): value is ServerMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    (value.type === 'welcome' ||
      value.type === 'room' ||
      value.type === 'error')
  );
}

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Tempo esgotado aguardando ${label}.`));
    }, DEFAULT_TIMEOUT);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

/** Cliente WebSocket mínimo para exercitar o protocolo real. */
export class TestClient {
  readonly messages: ServerMessage[] = [];
  readonly texts: string[] = [];
  readonly closed: Promise<Closure>;
  private readonly socket: WebSocket;
  private readonly waiters = new Set<Waiter>();
  private cursor = 0;

  private constructor(path: string, origin: string) {
    this.socket = new WebSocket(`${WS_URL}${path}`, {
      headers: { Origin: origin },
    });
    this.closed = new Promise((resolve) => {
      this.socket.addEventListener('close', (event) => {
        resolve({ code: event.code, reason: event.reason });
      });
    });
    this.socket.addEventListener('message', (event) => {
      const text = String(event.data);
      this.texts.push(text);
      if (text === 'pong') return;
      const parsed: unknown = JSON.parse(text);
      if (!isServerMessage(parsed)) return;
      this.messages.push(parsed);
      for (const waiter of this.waiters) {
        if (waiter.test(parsed)) {
          this.waiters.delete(waiter);
          this.cursor = this.messages.length;
          waiter.resolve(parsed);
        }
      }
    });
  }

  static create(name: string, origin = ALLOWED_ORIGIN): TestClient {
    return new TestClient(`/rooms?name=${encodeURIComponent(name)}`, origin);
  }

  static join(code: string, name: string, origin = ALLOWED_ORIGIN): TestClient {
    return new TestClient(
      `/rooms/${encodeURIComponent(code)}?name=${encodeURIComponent(name)}`,
      origin,
    );
  }

  /** Primeira mensagem ainda não consumida que satisfaz o teste. */
  next(
    test: (message: ServerMessage) => boolean,
    label = 'mensagem',
  ): Promise<ServerMessage> {
    const index = this.messages.findIndex(
      (message, position) => position >= this.cursor && test(message),
    );
    const found = this.messages[index];
    if (found !== undefined) {
      this.cursor = index + 1;
      return Promise.resolve(found);
    }
    return withTimeout(
      new Promise((resolve) => this.waiters.add({ test, resolve })),
      label,
    );
  }

  async welcome(): Promise<string> {
    const message = await this.next(
      (item) => item.type === 'welcome',
      'welcome',
    );
    if (message.type !== 'welcome') throw new Error('Mensagem inesperada.');
    return message.playerId;
  }

  /** Estado da sala mais recente que satisfaz a condição. */
  async room(
    test: (room: RoomView) => boolean = () => true,
    label = 'estado da sala',
  ): Promise<RoomView> {
    const latest = this.latestRoom();
    if (latest !== null && test(latest)) return latest;
    const message = await this.next(
      (item) => item.type === 'room' && test(item.room),
      label,
    );
    if (message.type !== 'room') throw new Error('Mensagem inesperada.');
    return message.room;
  }

  async error(code: ErrorCode): Promise<ServerMessage> {
    return this.next(
      (item) => item.type === 'error' && item.code === code,
      `erro ${code}`,
    );
  }

  latestRoom(): RoomView | null {
    for (let index = this.messages.length - 1; index >= 0; index -= 1) {
      const message = this.messages[index];
      if (message?.type === 'room') return message.room;
    }
    return null;
  }

  send(message: ClientMessage | string): void {
    this.socket.send(
      typeof message === 'string' ? message : JSON.stringify(message),
    );
  }

  waitClosed(): Promise<Closure> {
    return withTimeout(this.closed, 'fechamento');
  }

  close(): void {
    this.socket.close();
  }
}
