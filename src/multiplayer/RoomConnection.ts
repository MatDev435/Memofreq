import { PING_MESSAGE, parseServerMessage } from './protocol';
import type { ClientMessage, ServerMessage } from './protocol';

export interface SocketHandlers {
  readonly onOpen: () => void;
  readonly onMessage: (data: string) => void;
  readonly onClose: (code: number, reason: string) => void;
}

export interface SocketHandle {
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

export type SocketFactory = (
  url: string,
  handlers: SocketHandlers,
) => SocketHandle;

export const browserSocket: SocketFactory = (url, handlers) => {
  const socket = new WebSocket(url);
  socket.addEventListener('open', () => {
    handlers.onOpen();
  });
  socket.addEventListener('message', (event) => {
    if (typeof event.data === 'string') handlers.onMessage(event.data);
  });
  socket.addEventListener('close', (event) => {
    handlers.onClose(event.code, event.reason);
  });
  return {
    send: (data) => {
      socket.send(data);
    },
    close: (code, reason) => {
      socket.close(code, reason);
    },
  };
};

export interface ConnectionListener {
  readonly onMessage: (message: ServerMessage) => void;
  readonly onClose: (code: number, reason: string) => void;
}

export interface ConnectionOptions {
  readonly socketFactory?: SocketFactory;
  /** Intervalo do ping de presença; o servidor remove após 75 s sem sinal. */
  readonly pingIntervalMs?: number;
}

/** 1006: fechamento anormal, também usado quando a conexão nem abre. */
export const ABNORMAL_CLOSE = 1006;

/**
 * WebSocket de uma única sessão de sala. Não reconecta: depois de fechada,
 * nenhuma mensagem ou fechamento tardio chega ao ouvinte.
 */
export class RoomConnection {
  private handle: SocketHandle | null = null;
  private open = false;
  private finished = false;
  private ping: ReturnType<typeof setInterval> | null = null;

  constructor(
    url: string,
    private readonly listener: ConnectionListener,
    options: ConnectionOptions = {},
  ) {
    const factory = options.socketFactory ?? browserSocket;
    const interval = options.pingIntervalMs ?? 25_000;
    try {
      this.handle = factory(url, {
        onOpen: () => {
          if (this.finished) return;
          this.open = true;
          this.ping = setInterval(() => {
            this.sendRaw(PING_MESSAGE);
          }, interval);
        },
        onMessage: (data) => {
          if (this.finished || data === 'pong') return;
          const message = parseServerMessage(data);
          if (message) this.listener.onMessage(message);
        },
        onClose: (code, reason) => {
          if (this.finished) return;
          this.stop();
          this.listener.onClose(code, reason);
        },
      });
    } catch {
      this.stop();
      queueMicrotask(() => {
        listener.onClose(ABNORMAL_CLOSE, 'connection-failed');
      });
    }
  }

  send(message: ClientMessage): boolean {
    return this.sendRaw(JSON.stringify(message));
  }

  /** Fecha sem notificar o ouvinte; idempotente. */
  close(code = 1000, reason = 'left'): void {
    if (this.finished) return;
    const handle = this.handle;
    this.stop();
    try {
      handle?.close(code, reason);
    } catch {
      // A conexão já estava encerrada.
    }
  }

  private sendRaw(data: string): boolean {
    if (!this.open || this.finished || this.handle === null) return false;
    try {
      this.handle.send(data);
      return true;
    } catch {
      return false;
    }
  }

  private stop(): void {
    this.finished = true;
    this.open = false;
    if (this.ping !== null) clearInterval(this.ping);
    this.ping = null;
  }
}
