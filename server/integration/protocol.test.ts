import { afterEach, describe, expect, it } from 'vitest';
import type { RoomView } from '../src/protocol';
import { TestClient } from './client';
import { HTTP_URL, INACTIVE_AFTER_MS } from './config';

const clients: TestClient[] = [];

function track(client: TestClient): TestClient {
  clients.push(client);
  return client;
}

afterEach(() => {
  for (const client of clients.splice(0)) client.close();
});

async function createRoom(name = 'Host') {
  const host = track(TestClient.create(name));
  const hostId = await host.welcome();
  const room = await host.room();
  return { host, hostId, code: room.code };
}

async function joinRoom(code: string, name: string) {
  const client = track(TestClient.join(code, name));
  const id = await client.welcome();
  await client.room((room) => room.players.some((player) => player.id === id));
  return { client, id };
}

/** Responde todas as tentativas do round vigente com os próprios alvos. */
async function answerRound(client: TestClient, factor = 1): Promise<void> {
  const room = await client.room((view) => view.phase === 'playing');
  const round = room.match?.currentRound;
  if (!round) throw new Error('Round indisponível.');
  round.references.forEach((targetHz, attemptIndex) => {
    client.send({
      type: 'submit-guess',
      roundIndex: round.roundIndex,
      attemptIndex,
      frequencyHz: Math.min(700, Math.max(80, targetHz * factor)),
    });
  });
}

const phaseIs =
  (phase: RoomView['phase'], roundIndex?: number) => (room: RoomView) =>
    room.phase === phase &&
    (roundIndex === undefined || room.match?.roundIndex === roundIndex);

describe('HTTP do Worker', () => {
  it('responde saúde, rotas desconhecidas e requisições sem upgrade', async () => {
    const health = await fetch(`${HTTP_URL}/health`);
    expect(await health.json()).toEqual({ ok: true, protocolVersion: 1 });
    expect((await fetch(`${HTTP_URL}/nada`)).status).toBe(404);
    expect((await fetch(`${HTTP_URL}/rooms`)).status).toBe(426);
  });

  it('recusa origens fora da lista', async () => {
    const client = track(TestClient.create('Ana', 'https://outro.example'));
    const closure = await client.waitClosed();
    expect(closure.code).not.toBe(1000);
    expect(client.messages).toEqual([]);
  });
});

describe('criação e entrada', () => {
  it('cria a sala, aceita código digitado e sincroniza a lista', async () => {
    const { host, hostId, code } = await createRoom('Ana');
    expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{10}$/);
    const typed = `${code.slice(0, 5).toLowerCase()}-${code.slice(5)}`;
    const { client, id } = await joinRoom(typed, 'Bia');
    const hostView = await host.room((room) => room.players.length === 2);
    expect(hostView).toMatchObject({
      phase: 'lobby',
      hostId,
      players: [
        { id: hostId, name: 'Ana' },
        { id, name: 'Bia' },
      ],
    });
    expect((await client.room()).version).toBe(hostView.version);
  });

  it.each([
    ['apelido duplicado', 'ana', 'name-taken'],
    ['apelido inválido', '', 'invalid-name'],
  ] as const)('recusa %s com erro e fechamento', async (_label, name, code) => {
    const room = await createRoom('Ana');
    const rejected = track(TestClient.join(room.code, name));
    await rejected.error(code);
    expect(await rejected.waitClosed()).toEqual({ code: 4000, reason: code });
  });

  it('informa sala inexistente', async () => {
    for (const code of ['ZZZZZZZZZZ', 'inválido']) {
      const client = track(TestClient.join(code, 'Ana'));
      await client.error('room-not-found');
      expect((await client.waitClosed()).code).toBe(4000);
    }
  });

  it('responde ping sem alterar o estado', async () => {
    const { host } = await createRoom();
    const before = await host.room();
    host.send('ping');
    await expect.poll(() => host.texts.includes('pong')).toBe(true);
    expect(host.latestRoom()?.version).toBe(before.version);
  });

  it('informa mensagens inválidas e permissões sem fechar', async () => {
    const { host, code } = await createRoom();
    const { client } = await joinRoom(code, 'Bia');
    host.send('{"type":"inexistente"}');
    await host.error('invalid-message');
    client.send({ type: 'start-match' });
    expect(await client.error('not-host')).toMatchObject({
      fatal: false,
      request: 'start-match',
    });
    host.send({ type: 'ready' });
    await host.error('invalid-phase');
    expect((await host.room()).phase).toBe('lobby');
  });
});

describe('partida completa', () => {
  it('sincroniza cinco rounds do Extreme, ranking e jogar novamente', async () => {
    const { host, hostId, code } = await createRoom('Ana');
    const { client: guest, id: guestId } = await joinRoom(code, 'Bia');

    host.send({
      type: 'set-mode',
      selection: { mode: 'extreme', frequencyCount: 2 },
    });
    await guest.room((room) => room.selection.mode === 'extreme');
    host.send({ type: 'start-match' });
    const ready = await guest.room(phaseIs('ready'));
    expect(ready.match?.currentRound).toBeNull();

    const late = track(TestClient.join(code, 'Caio'));
    await late.error('room-in-match');

    for (let roundIndex = 0; roundIndex < 5; roundIndex += 1) {
      const gate = roundIndex === 0 ? 'ready' : 'round-results';
      await host.room(phaseIs(gate, roundIndex === 0 ? 0 : roundIndex - 1));
      host.send({ type: 'ready' });
      guest.send({ type: 'ready' });
      const playing = await guest.room(phaseIs('playing', roundIndex));
      expect(playing.match?.currentRound?.references).toHaveLength(2);
      expect(playing.match?.modality).toBe('extreme-2');

      await answerRound(host);
      const waiting = await guest.room(
        (room) =>
          room.match?.progress.some(
            (item) => item.playerId === hostId && item.status === 'completed',
          ) === true,
      );
      expect(JSON.stringify(waiting)).not.toContain('playerHz');
      await answerRound(guest, 1.2);
    }

    const final = await host.room(phaseIs('final'));
    expect(final.match?.ranking).toMatchObject([
      { position: 1, playerId: hostId, totalScore: 50 },
      { position: 2, playerId: guestId },
    ]);
    expect(final.match?.rounds).toHaveLength(5);
    expect(final.match?.lastRound?.roundIndex).toBe(4);

    guest.send({ type: 'play-again' });
    await guest.error('not-host');
    host.send({ type: 'play-again' });
    const lobby = await guest.room(phaseIs('lobby'));
    expect(lobby.match).toBeNull();
    const { id: caioId } = await joinRoom(code, 'Caio');
    expect(
      (await host.room((room) => room.players.length === 3)).players.at(-1)?.id,
    ).toBe(caioId);
  });

  it('recusa palpites inválidos e duplicados', async () => {
    const { host } = await createRoom();
    host.send({ type: 'start-match' });
    await host.room(phaseIs('ready'));
    host.send({ type: 'ready' });
    const playing = await host.room(phaseIs('playing'));
    const targetHz = playing.match?.currentRound?.references[0] ?? 300;

    host.send({
      type: 'submit-guess',
      roundIndex: 0,
      attemptIndex: 0,
      frequencyHz: 900,
    });
    await host.error('invalid-frequency');
    host.send({
      type: 'submit-guess',
      roundIndex: 1,
      attemptIndex: 0,
      frequencyHz: targetHz,
    });
    await host.error('wrong-round');
    host.send({
      type: 'submit-guess',
      roundIndex: 0,
      attemptIndex: 0,
      frequencyHz: targetHz,
    });
    const results = await host.room(phaseIs('round-results', 0));
    expect(results.match?.lastRound?.players[0]?.score).toBe(10);
    host.send({
      type: 'submit-guess',
      roundIndex: 0,
      attemptIndex: 0,
      frequencyHz: targetHz,
    });
    await host.error('invalid-phase');
  });

  it('aceita perda do round por interrupção e continua', async () => {
    const { host, code } = await createRoom();
    const { client: guest, id: guestId } = await joinRoom(code, 'Bia');
    host.send({ type: 'start-match' });
    await guest.room(phaseIs('ready'));
    host.send({ type: 'ready' });
    guest.send({ type: 'ready' });
    await guest.room(phaseIs('playing', 0));
    guest.send({ type: 'forfeit-round', roundIndex: 0 });
    await answerRound(host);
    const results = await guest.room(phaseIs('round-results', 0));
    expect(
      results.match?.lastRound?.players.find((p) => p.playerId === guestId),
    ).toMatchObject({ status: 'forfeited', score: 0, attempts: [] });
  });
});

describe('saídas, remoções e host', () => {
  it('remove pelo host e avança quem estava esperando', async () => {
    const { host, code } = await createRoom();
    const { client: idle, id: idleId } = await joinRoom(code, 'Parado');
    host.send({ type: 'start-match' });
    await host.room(phaseIs('ready'));
    host.send({ type: 'ready' });
    host.send({ type: 'kick', playerId: idleId });
    // O cliente fecha ao receber erro fatal; o fechamento do servidor pode
    // chegar depois (no workerd local, cerca de 10 s após a remoção).
    expect(await idle.error('kicked')).toMatchObject({ fatal: true });
    idle.close();
    const playing = await host.room(phaseIs('playing', 0));
    expect(playing.players.map((player) => player.id)).not.toContain(idleId);
  });

  it('remove quem desconecta, transfere o host e encerra o round', async () => {
    const { host, code } = await createRoom('Ana');
    const { client: bia, id: biaId } = await joinRoom(code, 'Bia');
    const { client: caio } = await joinRoom(code, 'Caio');
    host.send({ type: 'start-match' });
    await caio.room(phaseIs('ready'));
    for (const client of [host, bia, caio]) client.send({ type: 'ready' });
    await caio.room(phaseIs('playing', 0));
    await answerRound(bia);
    await answerRound(caio);
    await caio.room(
      (room) =>
        room.match?.progress.filter((item) => item.status === 'completed')
          .length === 2,
    );

    host.close();
    const results = await caio.room(phaseIs('round-results', 0));
    expect(results.hostId).toBe(biaId);
    expect(results.players.map((player) => player.name)).toEqual([
      'Bia',
      'Caio',
    ]);
    expect(results.match?.lastRound?.players).toHaveLength(2);
  });

  it('sai voluntariamente com fechamento normal', async () => {
    const { host, code } = await createRoom();
    const { client, id } = await joinRoom(code, 'Bia');
    client.send({ type: 'leave' });
    expect((await client.waitClosed()).code).toBe(1000);
    const room = await host.room((view) => view.players.length === 1);
    expect(room.players.map((player) => player.id)).not.toContain(id);
  });

  it('encerra a sala com a saída do último participante', async () => {
    const { host, code } = await createRoom();
    host.send({ type: 'leave' });
    expect((await host.waitClosed()).code).toBe(1000);
    const again = track(TestClient.join(code, 'Ana'));
    await again.error('room-not-found');
  });
});

describe('limites e conexões silenciosas', () => {
  it('remove conexões sem ping e mantém as que enviam ping', async () => {
    const { host, code } = await createRoom();
    const { client: silent, id: silentId } = await joinRoom(code, 'Mudo');
    const keepAlive = setInterval(() => {
      host.send('ping');
    }, INACTIVE_AFTER_MS / 4);
    try {
      expect(await silent.error('inactive')).toMatchObject({ fatal: true });
      silent.close();
      const room = await host.room((view) => view.players.length === 1);
      expect(room.players.map((player) => player.id)).not.toContain(silentId);
    } finally {
      clearInterval(keepAlive);
    }
  });

  it('desconecta quem excede o limite de mensagens', async () => {
    const { host, code } = await createRoom();
    const { client: noisy } = await joinRoom(code, 'Ruidoso');
    for (let index = 0; index < 40; index += 1) noisy.send({ type: 'ready' });
    await noisy.error('rate-limited');
    expect((await noisy.waitClosed()).code).toBe(4003);
    await host.room((room) => room.players.length === 1);
  });
});
