import { CLOSE_CODES, serializeServerMessage } from './protocol';
import type { ErrorCode } from './protocol';

/**
 * Recusa uma entrada com um WebSocket efêmero, fora da hibernação.
 * Navegadores não leem o status HTTP de um upgrade recusado; por isso a causa
 * segue em uma mensagem de erro antes do fechamento.
 */
export function rejectedSocket(code: ErrorCode): Response {
  const pair = new WebSocketPair();
  const [client, server] = [pair[0], pair[1]];
  server.accept();
  server.send(serializeServerMessage({ type: 'error', code, fatal: true }));
  server.close(CLOSE_CODES.joinRejected, code);
  return new Response(null, { status: 101, webSocket: client });
}
