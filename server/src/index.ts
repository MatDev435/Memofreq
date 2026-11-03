import { generateRoomCode, normalizeRoomCode } from './codes';
import { INTENT_HEADER, ROOM_CODE_HEADER } from './env';
import type { Env, Intent } from './env';
import { isAllowedOrigin } from './origin';
import { PROTOCOL_VERSION } from './protocol';
import { rejectedSocket } from './reject';

export { RoomObject } from './RoomObject';

const CREATE_ATTEMPTS = 3;

function forward(
  request: Request,
  env: Env,
  code: string,
  intent: Intent,
): Promise<Response> {
  const headers = new Headers(request.headers);
  headers.set(INTENT_HEADER, intent);
  headers.set(ROOM_CODE_HEADER, code);
  const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
  return stub.fetch(new Request(request.url, { method: 'GET', headers }));
}

async function createRoom(request: Request, env: Env): Promise<Response> {
  for (let attempt = 0; attempt < CREATE_ATTEMPTS; attempt += 1) {
    const response = await forward(request, env, generateRoomCode(), 'create');
    // 409: colisão improvável com uma sala ativa; sorteia outro código.
    if (response.status !== 409) return response;
  }
  return new Response('Room code unavailable', { status: 503 });
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/health') {
      return Response.json({ ok: true, protocolVersion: PROTOCOL_VERSION });
    }

    const route = /^\/rooms(?:\/([^/]+))?\/?$/u.exec(url.pathname);
    if (route === null) return new Response('Not found', { status: 404 });
    if (
      request.method !== 'GET' ||
      request.headers.get('Upgrade')?.toLowerCase() !== 'websocket'
    ) {
      return new Response('Expected WebSocket upgrade', { status: 426 });
    }
    if (!isAllowedOrigin(request.headers.get('Origin'), env.ALLOWED_ORIGINS)) {
      return new Response('Origin not allowed', { status: 403 });
    }

    const rawCode = route[1];
    if (rawCode === undefined) return createRoom(request, env);
    const code = normalizeRoomCode(rawCode);
    return code === null
      ? rejectedSocket('room-not-found')
      : forward(request, env, code, 'join');
  },
} satisfies ExportedHandler<Env>;
