// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ControlledAudio } from '../test/controlledAudio';
import { FakeSockets, LocalRoom } from '../test/fakeRoomServer';
import type { FakeSocket } from '../test/fakeRoomServer';
import { MultiplayerController } from './MultiplayerController';

function fixture(url: string | null = 'ws://teste.local') {
  let visible = true;
  let audio: ControlledAudio | null = null;
  const sockets = new FakeSockets();
  const controller = new MultiplayerController({
    url,
    createAudio: (notify) => {
      audio = new ControlledAudio(notify);
      return audio;
    },
    isPageVisible: () => visible,
    initialVolume: 0.4,
    connection: { socketFactory: sockets.factory, pingIntervalMs: 1000 },
    now: () => Date.now(),
  });
  controller.activate();
  return {
    controller,
    sockets,
    get audio() {
      if (!audio) throw new Error('Áudio não criado.');
      return audio;
    },
    snapshot: () => controller.getSnapshot(),
    hide() {
      visible = false;
      controller.visibilityChanged();
    },
    show() {
      visible = true;
      controller.visibilityChanged();
    },
  };
}

async function flush() {
  await vi.advanceTimersByTimeAsync(0);
}

/** Conecta como `playerId` em uma sala local já existente. */
function enter(
  setup: ReturnType<typeof fixture>,
  room: LocalRoom,
  playerId: string,
): FakeSocket {
  if (playerId === 'p1') setup.controller.create('Ana');
  else setup.controller.join(room.state.code, 'Bia');
  const socket = setup.sockets.last;
  socket.open();
  socket.receive({ type: 'welcome', protocolVersion: 1, playerId });
  socket.receive(room.message());
  return socket;
}

async function startRound(
  setup: ReturnType<typeof fixture>,
  room: LocalRoom,
  socket: FakeSocket,
) {
  room.run('p1', { type: 'start-match' });
  for (const player of room.state.players)
    room.run(player.id, { type: 'ready' });
  socket.receive(room.message());
  await flush();
  expect(setup.snapshot().play.stage).toBe('countdown');
  await vi.advanceTimersByTimeAsync(3000);
  expect(setup.snapshot().play.stage).toBe('references');
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('entrada', () => {
  it('cria a sala com apelido normalizado e recebe o estado', () => {
    const setup = fixture();
    const room = new LocalRoom(['Ana']);
    expect(setup.controller.create('  Ana ')).toBe(true);
    expect(setup.sockets.last.url).toBe('ws://teste.local/rooms?name=Ana');
    expect(setup.snapshot().status).toBe('connecting');
    enter(setup, room, 'p1');
    expect(setup.snapshot()).toMatchObject({
      status: 'connected',
      playerId: 'p1',
      room: { code: 'K7Q2M9XH3P', phase: 'lobby' },
    });
  });

  it('entra com código digitado e codifica a URL', () => {
    const setup = fixture();
    setup.controller.join('k7q2m-9xh3p', 'Bia Lima');
    expect(setup.sockets.last.url).toBe(
      'ws://teste.local/rooms/K7Q2M9XH3P?name=Bia%20Lima',
    );
  });

  it.each([
    ['apelido vazio', '', 'K7Q2M9XH3P', 'invalid-name'],
    ['código inválido', 'Bia', 'curto', 'invalid-code'],
  ] as const)('valida %s antes de conectar', (_label, name, code, error) => {
    const setup = fixture();
    expect(setup.controller.join(code, name)).toBe(false);
    expect(setup.sockets.all).toHaveLength(0);
    expect(setup.snapshot().formError).toBe(error);
  });

  it('informa que o multiplayer não está configurado', () => {
    const setup = fixture(null);
    expect(setup.snapshot().formError).toBe('unavailable');
    expect(setup.controller.create('Ana')).toBe(false);
  });

  it.each([
    'name-taken',
    'room-in-match',
    'room-full',
    'room-not-found',
  ] as const)('volta ao formulário ao recusar a entrada com %s', (code) => {
    const setup = fixture();
    setup.controller.join('K7Q2M9XH3P', 'Bia');
    const socket = setup.sockets.last;
    socket.open();
    socket.receive({ type: 'error', code, fatal: true });
    expect(setup.snapshot()).toMatchObject({
      status: 'idle',
      formError: code,
      room: null,
    });
    expect(socket.closed).not.toBeNull();
    socket.serverClose(4000, code);
    expect(setup.snapshot().formError).toBe(code);
  });

  it('informa falha de conexão antes de entrar', () => {
    const setup = fixture();
    setup.controller.create('Ana');
    setup.sockets.last.serverClose(1006);
    expect(setup.snapshot()).toMatchObject({
      status: 'idle',
      formError: 'connection-failed',
    });
  });

  it('envia ping periódico somente após abrir', async () => {
    const setup = fixture();
    setup.controller.create('Ana');
    await vi.advanceTimersByTimeAsync(2500);
    expect(setup.sockets.last.sent).toEqual([]);
    setup.sockets.last.open();
    await vi.advanceTimersByTimeAsync(2500);
    expect(setup.sockets.last.sent).toEqual(['ping', 'ping']);
  });
});

describe('sala', () => {
  it('ignora versões antigas ou repetidas', () => {
    const setup = fixture();
    const room = new LocalRoom(['Ana']);
    const socket = enter(setup, room, 'p1');
    const old = room.message();
    room.run('p1', { type: 'set-mode', selection: { mode: 'hard' } });
    socket.receive(room.message());
    socket.receive(old);
    expect(setup.snapshot().room?.selection).toEqual({ mode: 'hard' });
  });

  it('restringe comandos de host ao host atual', () => {
    const setup = fixture();
    const room = new LocalRoom(['Ana', 'Bia']);
    const socket = enter(setup, room, 'p2');
    setup.controller.setMode({ mode: 'hard' });
    setup.controller.startMatch();
    setup.controller.kick('p1');
    expect(socket.messages()).toEqual([]);

    const left = room.run('p1', { type: 'leave' });
    socket.receive({ type: 'room', room: left });
    expect(setup.snapshot().room?.hostId).toBe('p2');
    setup.controller.setMode({ mode: 'extreme', frequencyCount: 3 });
    expect(socket.messages()).toEqual([
      { type: 'set-mode', selection: { mode: 'extreme', frequencyCount: 3 } },
    ]);
    expect(setup.snapshot().announcement).toContain(
      'Você agora é o host da sala.',
    );
  });

  it('anuncia entradas, saídas e modo sem números', () => {
    const setup = fixture();
    const room = new LocalRoom(['Ana', 'Bia']);
    const socket = enter(setup, room, 'p2');
    socket.receive({ type: 'room', room: room.join('p3', 'Caio') });
    expect(setup.snapshot().announcement).toBe('Caio entrou na sala.');
    socket.receive({ type: 'room', room: room.run('p3', { type: 'leave' }) });
    expect(setup.snapshot().announcement).toBe('Caio saiu da sala.');
    socket.receive({
      type: 'room',
      room: room.run('p1', {
        type: 'set-mode',
        selection: { mode: 'extreme', frequencyCount: 2 },
      }),
    });
    expect(setup.snapshot().announcement).toBe(
      'Modo alterado para Extreme · 2 frequências.',
    );
  });

  it('envia prontidão uma vez e habilita o áudio no gesto', () => {
    const setup = fixture();
    const room = new LocalRoom(['Ana', 'Bia']);
    const socket = enter(setup, room, 'p1');
    socket.receive({
      type: 'room',
      room: room.run('p1', { type: 'start-match' }),
    });
    expect(setup.snapshot().announcement).toBe(
      'Partida iniciada. Confirme quando estiver pronto.',
    );
    const enables = setup.audio.enable.mock.calls.length;
    setup.controller.ready();
    setup.controller.ready();
    expect(setup.audio.enable.mock.calls.length).toBe(enables + 1);
    expect(socket.messages()).toEqual([{ type: 'ready' }]);
    socket.receive({ type: 'room', room: room.run('p1', { type: 'ready' }) });
    setup.controller.ready();
    expect(socket.messages()).toHaveLength(1);
    socket.receive({ type: 'room', room: room.run('p2', { type: 'ready' }) });
    expect(setup.snapshot().room?.phase).toBe('playing');
  });

  it('trata erros não fatais como aviso', () => {
    const setup = fixture();
    const room = new LocalRoom(['Ana']);
    const socket = enter(setup, room, 'p1');
    socket.receive({
      type: 'error',
      code: 'invalid-phase',
      fatal: false,
      request: 'ready',
    });
    expect(setup.snapshot()).toMatchObject({
      status: 'connected',
      notice: 'Essa ação não está disponível neste momento.',
    });
  });

  it.each([
    [4001, 'kicked'],
    [4002, 'inactive'],
    [4003, 'rate-limited'],
    [1006, 'connection-lost'],
    [1000, 'room-closed'],
  ] as const)('encerra com o código %i como %s', (code, reason) => {
    const setup = fixture();
    const room = new LocalRoom(['Ana', 'Bia']);
    const socket = enter(setup, room, 'p2');
    socket.serverClose(code);
    expect(setup.snapshot()).toMatchObject({
      status: 'ended',
      endReason: reason,
      room: null,
    });
    setup.controller.backToEntry();
    expect(setup.snapshot().status).toBe('idle');
  });

  it('prioriza a mensagem fatal recebida antes do fechamento', () => {
    const setup = fixture();
    const room = new LocalRoom(['Ana', 'Bia']);
    const socket = enter(setup, room, 'p2');
    socket.receive({ type: 'error', code: 'kicked', fatal: true });
    socket.serverClose(1006);
    expect(setup.snapshot().endReason).toBe('kicked');
  });

  it('sai enviando leave e fechando a conexão', () => {
    const setup = fixture();
    const room = new LocalRoom(['Ana']);
    const socket = enter(setup, room, 'p1');
    setup.controller.leave();
    expect(socket.messages()).toEqual([{ type: 'leave' }]);
    expect(socket.closed).toEqual({ code: 1000, reason: 'left' });
    expect(setup.snapshot()).toMatchObject({ status: 'idle', room: null });
    socket.receive(room.message());
    expect(setup.snapshot().room).toBeNull();
  });
});

describe('round', () => {
  it('toca a referência do servidor, envia o palpite e aguarda', async () => {
    const setup = fixture();
    const room = new LocalRoom(['Ana', 'Bia']);
    const socket = enter(setup, room, 'p1');
    await startRound(setup, room, socket);
    const round = room.view().match?.currentRound;
    expect(setup.audio.playReference).toHaveBeenCalledWith({
      frequencyHz: round?.references[0],
      durationSeconds: 3,
    });
    expect(setup.snapshot().announcement).toBe('');

    setup.audio.current()?.finish();
    await flush();
    expect(setup.snapshot().play).toMatchObject({
      stage: 'attempt',
      attemptIndex: 0,
      frequencyHz: round?.initialFrequencies[0],
    });
    expect(setup.audio.startContinuous).toHaveBeenCalledWith(
      round?.initialFrequencies[0],
    );
    setup.controller.setPosition(0.5);
    const chosen = setup.snapshot().play;
    setup.controller.confirm(setup.snapshot().execution - 1);
    expect(socket.messages()).toEqual([]);
    setup.controller.confirm(setup.snapshot().execution);
    setup.controller.confirm(setup.snapshot().execution);
    const guesses = socket
      .messages()
      .filter((message) => message.type === 'submit-guess');
    expect(guesses).toEqual([
      {
        type: 'submit-guess',
        roundIndex: 0,
        attemptIndex: 0,
        frequencyHz: chosen.stage === 'attempt' ? chosen.frequencyHz : 0,
      },
    ]);
    await flush();
    expect(setup.snapshot().play.stage).toBe('submitted');
    expect(setup.snapshot().announcement).toBe(
      'Palpites registrados. Aguardando os demais participantes.',
    );
  });

  it('Extreme envia cada palpite e troca a posição na mesma voz', async () => {
    const setup = fixture();
    const room = new LocalRoom(['Ana']);
    const socket = enter(setup, room, 'p1');
    room.run('p1', {
      type: 'set-mode',
      selection: { mode: 'extreme', frequencyCount: 3 },
    });
    await startRound(setup, room, socket);
    expect(setup.audio.playSequence).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ durationSeconds: 1.5 }),
      ]),
      0.3,
    );
    setup.audio.current()?.finish();
    await flush();
    const initial = room.view().match?.currentRound?.initialFrequencies ?? [];
    for (let index = 0; index < 3; index += 1) {
      expect(setup.snapshot().play).toMatchObject({
        stage: 'attempt',
        attemptIndex: index,
        frequencyHz: initial[index],
      });
      setup.controller.confirm(setup.snapshot().execution);
    }
    expect(setup.audio.startContinuous).toHaveBeenCalledTimes(1);
    expect(setup.audio.setFrequency).toHaveBeenCalledWith(initial[1]);
    expect(setup.audio.setFrequency).toHaveBeenCalledWith(initial[2]);
    const guesses = socket
      .messages()
      .filter((message) => message.type === 'submit-guess');
    expect(guesses.map((message) => message.attemptIndex)).toEqual([0, 1, 2]);
    await flush();
    expect(setup.snapshot().play.stage).toBe('submitted');
  });

  it('pausa a contagem oculta sem penalidade e recomeça por gesto', async () => {
    const setup = fixture();
    const room = new LocalRoom(['Ana']);
    const socket = enter(setup, room, 'p1');
    room.run('p1', { type: 'start-match' });
    room.run('p1', { type: 'ready' });
    socket.receive(room.message());
    await flush();
    setup.hide();
    expect(setup.snapshot().play.stage).toBe('blocked');
    await vi.advanceTimersByTimeAsync(5000);
    expect(setup.audio.playReference).not.toHaveBeenCalled();
    setup.show();
    setup.controller.resumeRound();
    await flush();
    expect(setup.snapshot().play.stage).toBe('countdown');
    expect(
      socket.messages().some((message) => message.type === 'forfeit-round'),
    ).toBe(false);
  });

  it('começa bloqueado se o round chega com a página oculta', async () => {
    const setup = fixture();
    const room = new LocalRoom(['Ana']);
    const socket = enter(setup, room, 'p1');
    room.run('p1', { type: 'start-match' });
    room.run('p1', { type: 'ready' });
    setup.hide();
    socket.receive(room.message());
    await flush();
    expect(setup.snapshot().play.stage).toBe('blocked');
  });

  it('bloqueia quando o navegador não libera o áudio sem gesto', async () => {
    const setup = fixture();
    const room = new LocalRoom(['Ana']);
    const socket = enter(setup, room, 'p1');
    setup.audio.enable.mockImplementation(() =>
      Promise.reject(new Error('bloqueado')),
    );
    room.run('p1', { type: 'start-match' });
    room.run('p1', { type: 'ready' });
    socket.receive(room.message());
    await flush();
    expect(setup.snapshot().play.stage).toBe('blocked');
    setup.audio.enable.mockImplementation(() => Promise.resolve());
    setup.controller.resumeRound();
    await flush();
    expect(setup.snapshot().play.stage).toBe('countdown');
  });

  it('perde o round ao ocultar durante a referência', async () => {
    const setup = fixture();
    const room = new LocalRoom(['Ana', 'Bia']);
    const socket = enter(setup, room, 'p1');
    await startRound(setup, room, socket);
    setup.hide();
    expect(socket.messages().at(-1)).toEqual({
      type: 'forfeit-round',
      roundIndex: 0,
    });
    expect(setup.snapshot().play.stage).toBe('forfeited');
  });

  it('suspende a tentativa oculta e retoma na mesma frequência', async () => {
    const setup = fixture();
    const room = new LocalRoom(['Ana', 'Bia']);
    const socket = enter(setup, room, 'p1');
    await startRound(setup, room, socket);
    setup.audio.current()?.finish();
    await flush();
    setup.controller.setPosition(0.25);
    const play = setup.snapshot().play;
    const frequencyHz = play.stage === 'attempt' ? play.frequencyHz : 0;
    setup.hide();
    expect(setup.snapshot().play).toMatchObject({
      stage: 'paused',
      frequencyHz,
    });
    expect(
      socket.messages().some((message) => message.type === 'forfeit-round'),
    ).toBe(false);
    setup.show();
    setup.controller.resumeRound();
    await flush();
    expect(setup.snapshot().play).toMatchObject({
      stage: 'attempt',
      frequencyHz,
    });
    expect(setup.audio.startContinuous).toHaveBeenLastCalledWith(frequencyHz);
  });

  it('suspende a tentativa quando o áudio é interrompido e permite desistir', async () => {
    const setup = fixture();
    const room = new LocalRoom(['Ana', 'Bia']);
    const socket = enter(setup, room, 'p1');
    await startRound(setup, room, socket);
    setup.audio.current()?.finish();
    await flush();
    setup.audio.interrupt('suspended');
    expect(setup.snapshot().play.stage).toBe('paused');
    expect(setup.snapshot().notice).toContain('áudio foi interrompido');
    setup.controller.forfeitRound();
    expect(socket.messages().at(-1)).toEqual({
      type: 'forfeit-round',
      roundIndex: 0,
    });
  });

  it('volta ao estado ocioso quando o round termina no servidor', async () => {
    const setup = fixture();
    const room = new LocalRoom(['Ana', 'Bia']);
    const socket = enter(setup, room, 'p1');
    await startRound(setup, room, socket);
    setup.audio.current()?.finish();
    await flush();
    setup.controller.confirm(setup.snapshot().execution);
    await flush();
    const target = room.view().match?.currentRound?.references[0] ?? 300;
    room.run('p1', {
      type: 'submit-guess',
      roundIndex: 0,
      attemptIndex: 0,
      frequencyHz: target,
    });
    socket.receive(room.message());
    // A própria conclusão não gera outro anúncio.
    expect(setup.snapshot().announcement).toBe(
      'Palpites registrados. Aguardando os demais participantes.',
    );
    room.run('p2', {
      type: 'submit-guess',
      roundIndex: 0,
      attemptIndex: 0,
      frequencyHz: target,
    });
    socket.receive(room.message());
    expect(setup.snapshot()).toMatchObject({
      play: { stage: 'idle' },
      room: { phase: 'round-results' },
      announcement: 'Round 1 concluído. Resultados disponíveis.',
    });
  });

  it('anuncia quem concluiu enquanto o jogador aguarda', async () => {
    const setup = fixture();
    const room = new LocalRoom(['Ana', 'Bia', 'Caio']);
    const socket = enter(setup, room, 'p1');
    await startRound(setup, room, socket);
    setup.audio.current()?.finish();
    await flush();
    setup.controller.confirm(setup.snapshot().execution);
    await flush();
    const target = room.view().match?.currentRound?.references[0] ?? 300;
    room.run('p1', {
      type: 'submit-guess',
      roundIndex: 0,
      attemptIndex: 0,
      frequencyHz: target,
    });
    room.run('p2', { type: 'forfeit-round', roundIndex: 0 });
    socket.receive(room.message());
    expect(setup.snapshot().announcement).toBe('Bia perdeu o round.');
  });
});
