// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseMultiplayerUrl } from './config';
import { inviteUrl, readInviteCode } from './invite';
import { joinNames, modeLabel } from './labels';
import { parseServerMessage } from './protocol';
import { RoomConnection } from './RoomConnection';
import { FakeSockets, LocalRoom } from '../test/fakeRoomServer';

describe('configuração', () => {
  it.each([
    ['ws://127.0.0.1:8787', 'ws://127.0.0.1:8787'],
    [
      'wss://memofreq.example.workers.dev/',
      'wss://memofreq.example.workers.dev',
    ],
    [' wss://host.test/base/ ', 'wss://host.test/base'],
  ])('aceita %s', (value, expected) => {
    expect(parseMultiplayerUrl(value)).toBe(expected);
  });

  it.each([undefined, '', 'http://host.test', 'wss://host.test/?x=1', 'nada'])(
    'recusa %j',
    (value) => {
      expect(parseMultiplayerUrl(value)).toBeNull();
    },
  );
});

describe('convite', () => {
  it('lê e gera links com o código normalizado', () => {
    expect(readInviteCode('#sala=k7q2m9xh3p')).toBe('K7Q2M9XH3P');
    expect(readInviteCode('#sala=errado')).toBeNull();
    expect(readInviteCode('')).toBeNull();
    expect(
      inviteUrl(
        {
          origin: 'https://memofreq.vercel.app',
          pathname: '/jogo/',
          search: '',
        },
        'K7Q2M9XH3P',
      ),
    ).toBe('https://memofreq.vercel.app/jogo/#sala=K7Q2M9XH3P');
  });
});

describe('rótulos', () => {
  it('descreve modos e listas de nomes', () => {
    expect(modeLabel({ mode: 'extreme', frequencyCount: 3 })).toBe(
      'Extreme · 3 frequências',
    );
    expect(joinNames(['Ana'])).toBe('Ana');
    expect(joinNames(['Ana', 'Bia', 'Caio'])).toBe('Ana, Bia e Caio');
  });
});

describe('mensagens do servidor', () => {
  it('aceita mensagens reais e ignora formas desconhecidas', () => {
    const room = new LocalRoom(['Ana']);
    expect(parseServerMessage(JSON.stringify(room.message()))).toEqual(
      room.message(),
    );
    expect(
      parseServerMessage(
        '{"type":"welcome","playerId":"a","protocolVersion":1}',
      ),
    ).not.toBeNull();
    for (const raw of [
      'pong',
      '{}',
      '{"type":"room","room":{"phase":"outra"}}',
      '{"type":"error","code":"x"}',
    ])
      expect(parseServerMessage(raw)).toBeNull();
  });
});

describe('RoomConnection', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('não envia antes de abrir e silencia eventos após fechar', () => {
    const sockets = new FakeSockets();
    const messages: unknown[] = [];
    const closes: number[] = [];
    const connection = new RoomConnection(
      'ws://x',
      {
        onMessage: (message) => messages.push(message),
        onClose: (code) => closes.push(code),
      },
      { socketFactory: sockets.factory, pingIntervalMs: 100 },
    );
    expect(connection.send({ type: 'ready' })).toBe(false);
    sockets.last.open();
    expect(connection.send({ type: 'ready' })).toBe(true);
    sockets.last.receive({
      type: 'welcome',
      protocolVersion: 1,
      playerId: 'a',
    });
    connection.close();
    sockets.last.receive({
      type: 'welcome',
      protocolVersion: 1,
      playerId: 'b',
    });
    sockets.last.serverClose(1006);
    vi.advanceTimersByTime(500);
    expect(messages).toHaveLength(1);
    expect(closes).toEqual([]);
    expect(sockets.last.sent).toEqual(['{"type":"ready"}']);
    expect(sockets.last.closed).toEqual({ code: 1000, reason: 'left' });
  });

  it('notifica falha quando o socket não pode ser criado', async () => {
    const closes: number[] = [];
    new RoomConnection(
      'ws://x',
      { onMessage: () => undefined, onClose: (code) => closes.push(code) },
      {
        socketFactory: () => {
          throw new Error('URL inválida');
        },
      },
    );
    await Promise.resolve();
    expect(closes).toEqual([1006]);
  });
});
