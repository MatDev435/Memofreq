import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameController } from '../application/GameController';
import { MultiplayerController } from '../application/MultiplayerController';
import { ControlledAudio } from '../test/controlledAudio';
import { FakeSockets, LocalRoom } from '../test/fakeRoomServer';
import type { FakeSocket } from '../test/fakeRoomServer';
import { App } from './App';

function setup({
  hash = '',
  available = true,
}: { hash?: string; available?: boolean } = {}) {
  window.history.replaceState(null, '', `/${hash}`);
  const sockets = new FakeSockets();
  const audios: ControlledAudio[] = [];
  const createAudio = (
    notify: ConstructorParameters<typeof ControlledAudio>[0],
  ) => {
    const audio = new ControlledAudio(notify);
    audios.push(audio);
    return audio;
  };
  render(
    <App
      createController={() =>
        new GameController({
          createAudio,
          isPageVisible: () => true,
          initialVolume: 0.4,
          createId: () => 'jogo',
          random: () => 0.5,
          now: () => Date.now(),
        })
      }
      createMultiplayerController={(volume) =>
        new MultiplayerController({
          url: 'ws://teste.local',
          createAudio,
          isPageVisible: () => true,
          initialVolume: volume,
          connection: { socketFactory: sockets.factory },
          now: () => Date.now(),
        })
      }
      multiplayerAvailable={available}
    />,
  );
  return { sockets, audios };
}

/** Região viva da aplicação (há outras regiões de status locais). */
function liveRegion(): HTMLElement {
  const region = screen
    .getAllByRole('status')
    .find((element) => element.getAttribute('aria-live') === 'polite');
  if (!region) throw new Error('Região viva ausente.');
  return region;
}

async function click(element: HTMLElement) {
  await act(async () => {
    fireEvent.click(element);
    await Promise.resolve();
  });
}

function deliver(socket: FakeSocket, room: LocalRoom) {
  act(() => {
    socket.receive(room.message());
  });
}

/** Entra na sala local como `playerId` pela interface. */
async function enterRoom(
  sockets: FakeSockets,
  room: LocalRoom,
  playerId: string,
  name: string,
) {
  await click(screen.getByRole('button', { name: 'Jogar com amigos' }));
  fireEvent.change(screen.getByLabelText('Seu apelido'), {
    target: { value: name },
  });
  if (playerId === 'p1') {
    await click(screen.getByRole('button', { name: 'Criar sala' }));
  } else {
    fireEvent.change(screen.getByLabelText('Código da sala'), {
      target: { value: room.state.code },
    });
    await click(screen.getByRole('button', { name: 'Entrar na sala' }));
  }
  const socket = sockets.last;
  act(() => {
    socket.open();
    socket.receive({ type: 'welcome', protocolVersion: 1, playerId });
    socket.receive(room.message());
  });
  return socket;
}

beforeEach(() => {
  window.history.replaceState(null, '', '/');
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('entrada no multiplayer', () => {
  it('apresenta a entrada na tela inicial sem remover os modos individuais', async () => {
    setup();
    expect(screen.getByRole('radio', { name: /Normal/ })).toBeChecked();
    expect(
      screen.getByRole('button', { name: 'Iniciar partida' }),
    ).toBeEnabled();
    await click(screen.getByRole('button', { name: 'Jogar com amigos' }));
    expect(
      screen.getByRole('heading', { name: 'Jogue com amigos' }),
    ).toHaveFocus();
    await click(screen.getByRole('button', { name: 'Voltar ao menu' }));
    expect(
      screen.getByRole('button', { name: 'Jogar com amigos' }),
    ).toHaveFocus();
  });

  it('desabilita a entrada quando o servidor não está configurado', () => {
    setup({ available: false });
    expect(
      screen.getByRole('button', { name: 'Jogar com amigos' }),
    ).toBeDisabled();
    expect(
      screen.getByText('Indisponível nesta instalação.'),
    ).toBeInTheDocument();
  });

  it('abre o convite pelo link com o código preenchido', () => {
    setup({ hash: '#sala=k7q2m9xh3p' });
    expect(
      screen.getByRole('heading', { name: 'Convite para uma sala' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Código da sala')).toHaveValue('K7Q2M9XH3P');
  });

  it('mostra erros de apelido e de sala com foco no campo', async () => {
    const { sockets } = setup({ hash: '#sala=K7Q2M9XH3P' });
    await click(screen.getByRole('button', { name: 'Entrar na sala' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Use um apelido de 1 a 20 caracteres visíveis.',
    );
    expect(screen.getByLabelText('Seu apelido')).toHaveFocus();
    expect(screen.getByLabelText('Seu apelido')).toHaveAttribute(
      'aria-invalid',
      'true',
    );

    fireEvent.change(screen.getByLabelText('Seu apelido'), {
      target: { value: 'Bia' },
    });
    await click(screen.getByRole('button', { name: 'Entrar na sala' }));
    act(() => {
      sockets.last.open();
      sockets.last.receive({
        type: 'error',
        code: 'room-in-match',
        fatal: true,
      });
    });
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Essa sala está em uma partida.',
    );
    expect(screen.getByLabelText('Código da sala')).toHaveFocus();
    expect(screen.getByLabelText('Seu apelido')).toHaveValue('Bia');
  });

  it('recusa apelido repetido mantendo o formulário', async () => {
    const { sockets } = setup();
    const room = new LocalRoom(['Ana']);
    await click(screen.getByRole('button', { name: 'Jogar com amigos' }));
    fireEvent.change(screen.getByLabelText('Seu apelido'), {
      target: { value: 'ana' },
    });
    fireEvent.change(screen.getByLabelText('Código da sala'), {
      target: { value: room.state.code },
    });
    await click(screen.getByRole('button', { name: 'Entrar na sala' }));
    act(() => {
      sockets.last.open();
      sockets.last.receive({ type: 'error', code: 'name-taken', fatal: true });
    });
    expect(screen.getByRole('alert')).toHaveTextContent(
      'apelido já está em uso',
    );
    expect(screen.getByLabelText('Seu apelido')).toHaveFocus();
  });
});

describe('lobby', () => {
  it('dá ao host convite, modo, início e remoção', async () => {
    const { sockets } = setup();
    const room = new LocalRoom(['Ana', 'Bia']);
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const socket = await enterRoom(sockets, room, 'p1', 'Ana');

    expect(screen.getByRole('heading', { name: 'Lobby' })).toHaveFocus();
    expect(window.location.hash).toBe('#sala=K7Q2M9XH3P');
    expect(screen.getByText('K7Q2M9XH3P')).toBeInTheDocument();
    const link = screen.getByLabelText('Link de convite');
    expect(link).toHaveValue(`${window.location.origin}/#sala=K7Q2M9XH3P`);
    await click(screen.getByRole('button', { name: 'Copiar convite' }));
    expect(writeText).toHaveBeenCalledWith(
      `${window.location.origin}/#sala=K7Q2M9XH3P`,
    );
    expect(screen.getByText('Link de convite copiado.')).toBeInTheDocument();

    const players = screen.getByRole('list', { name: 'Participantes da sala' });
    expect(within(players).getAllByRole('listitem')).toHaveLength(2);
    expect(within(players).getByText('Host')).toBeInTheDocument();

    await click(screen.getByRole('radio', { name: /Extreme/ }));
    expect(socket.messages().at(-1)).toEqual({
      type: 'set-mode',
      selection: { mode: 'extreme', frequencyCount: 2 },
    });

    await click(screen.getByRole('button', { name: 'Remover Bia' }));
    expect(
      screen.getByRole('button', { name: 'Confirmar remoção de Bia' }),
    ).toHaveFocus();
    await click(
      screen.getByRole('button', { name: 'Cancelar remoção de Bia' }),
    );
    expect(screen.getByRole('button', { name: 'Remover Bia' })).toHaveFocus();
    await click(screen.getByRole('button', { name: 'Remover Bia' }));
    await click(
      screen.getByRole('button', { name: 'Confirmar remoção de Bia' }),
    );
    expect(socket.messages().at(-1)).toEqual({ type: 'kick', playerId: 'p2' });

    await click(screen.getByRole('button', { name: 'Iniciar partida' }));
    expect(socket.messages().at(-1)).toEqual({ type: 'start-match' });
  });

  it('mostra as configurações sem permitir alterações a quem não é host', async () => {
    const { sockets } = setup();
    const room = new LocalRoom(['Ana', 'Bia']);
    const socket = await enterRoom(sockets, room, 'p2', 'Bia');
    expect(screen.getByRole('radio', { name: /Normal/ })).toBeDisabled();
    expect(screen.getByRole('radio', { name: /Normal/ })).toBeChecked();
    expect(
      screen.queryByRole('button', { name: 'Iniciar partida' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Remover/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Aguardando o host')).toBeInTheDocument();

    // O host sai: Bia assume e ganha os controles.
    room.run('p1', { type: 'leave' });
    deliver(socket, room);
    expect(screen.getByRole('radio', { name: /Normal/ })).toBeEnabled();
    expect(
      screen.getByRole('button', { name: 'Iniciar partida' }),
    ).toBeInTheDocument();
    expect(liveRegion()).toHaveTextContent(
      'Ana saiu da sala. Você agora é o host da sala.',
    );
  });
});

describe('partida', () => {
  it('confirma prontidão uma vez e mostra quem está pronto', async () => {
    const { sockets } = setup();
    const room = new LocalRoom(['Ana', 'Bia']);
    const socket = await enterRoom(sockets, room, 'p2', 'Bia');
    room.run('p1', { type: 'start-match' });
    room.run('p1', { type: 'ready' });
    deliver(socket, room);
    expect(
      screen.getByRole('heading', { name: 'Prepare-se para o round 1' }),
    ).toHaveFocus();
    const list = screen.getByRole('list', {
      name: 'Prontidão dos participantes',
    });
    expect(within(list).getAllByText('Pronto')).toHaveLength(1);
    const button = screen.getByRole('button', { name: 'Estou pronto' });
    button.focus();
    await click(button);
    await click(button);
    expect(socket.messages()).toEqual([{ type: 'ready' }]);
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveFocus();
  });

  it('espera os demais sem revelar palpites e mostra os resultados', async () => {
    const { sockets, audios } = setup();
    const room = new LocalRoom(['Ana', 'Bia']);
    const socket = await enterRoom(sockets, room, 'p2', 'Bia');
    room.run('p1', { type: 'start-match' });
    room.run('p1', { type: 'ready' });
    room.run('p2', { type: 'ready' });
    vi.useFakeTimers();
    try {
      deliver(socket, room);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });
      const audio = audios.at(-1);
      act(() => {
        audio?.current()?.finish();
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      const tone = screen.getByRole('slider', { name: 'Ajustar tom' });
      expect(tone).toBeEnabled();
      expect(liveRegion()).toBeEmptyDOMElement();
      await click(screen.getByRole('button', { name: 'Confirmar tentativa' }));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
    } finally {
      vi.useRealTimers();
    }
    const guess = socket.messages().at(-1);
    expect(guess).toMatchObject({ type: 'submit-guess', roundIndex: 0 });
    if (guess?.type !== 'submit-guess') throw new Error('Palpite ausente.');
    room.run('p2', guess);
    deliver(socket, room);
    expect(
      screen.getByRole('heading', { name: 'Palpites registrados' }),
    ).toHaveFocus();
    expect(screen.queryByText(/Hz/)).not.toBeInTheDocument();
    const progress = screen.getByRole('list', {
      name: 'Progresso dos participantes',
    });
    expect(within(progress).getByText('Concluiu')).toBeInTheDocument();
    expect(within(progress).getByText('Jogando')).toBeInTheDocument();

    const target = room.view().match?.currentRound?.references[0] ?? 300;
    room.run('p1', {
      type: 'submit-guess',
      roundIndex: 0,
      attemptIndex: 0,
      frequencyHz: target,
    });
    deliver(socket, room);
    expect(
      screen.getByRole('heading', { name: 'Resultado do round 1' }),
    ).toHaveFocus();
    const table = screen.getByRole('table', { name: 'Palpites do round 1' });
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    expect(within(table).getByText('10,00')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Pronto para o round 2' }),
    ).toBeInTheDocument();
  });

  it('apresenta o ranking do servidor e Jogar novamente só ao host', async () => {
    const { sockets } = setup();
    const room = new LocalRoom(['Ana', 'Bia']);
    const socket = await enterRoom(sockets, room, 'p2', 'Bia');
    room.run('p1', { type: 'start-match' });
    for (let round = 0; round < 5; round += 1) {
      room.run('p1', { type: 'ready' });
      room.run('p2', { type: 'ready' });
      const target = room.view().match?.currentRound?.references[0] ?? 300;
      for (const [id, factor] of [
        ['p1', 1.2],
        ['p2', 1],
      ] as const)
        room.run(id, {
          type: 'submit-guess',
          roundIndex: round,
          attemptIndex: 0,
          frequencyHz: Math.min(700, target * factor),
        });
    }
    deliver(socket, room);
    expect(
      screen.getByRole('heading', { name: 'Ranking final' }),
    ).toHaveFocus();
    const items = within(
      screen.getByRole('list', { name: 'Classificação' }),
    ).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('1º lugar: Bia');
    expect(items[0]).toHaveAttribute('data-self', 'true');
    expect(items[0]).toHaveTextContent('50,00');
    expect(
      screen.queryByRole('button', { name: 'Jogar novamente' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('table', { name: /Pontuação dos rounds/ }),
    ).toBeInTheDocument();

    room.run('p1', { type: 'play-again' });
    deliver(socket, room);
    expect(screen.getByRole('heading', { name: 'Lobby' })).toHaveFocus();
  });

  it('explica a remoção e oferece caminhos de saída', async () => {
    const { sockets } = setup();
    const room = new LocalRoom(['Ana', 'Bia']);
    const socket = await enterRoom(sockets, room, 'p2', 'Bia');
    act(() => {
      socket.receive({ type: 'error', code: 'kicked', fatal: true });
    });
    expect(
      screen.getByRole('heading', { name: 'Você foi removido da sala' }),
    ).toHaveFocus();
    await click(screen.getByRole('button', { name: 'Entrar em outra sala' }));
    expect(
      screen.getByRole('heading', { name: 'Jogue com amigos' }),
    ).toHaveFocus();
  });

  it('sai da sala pelo cabeçalho e volta ao menu', async () => {
    const { sockets } = setup();
    const room = new LocalRoom(['Ana']);
    const socket = await enterRoom(sockets, room, 'p1', 'Ana');
    await click(screen.getByRole('button', { name: 'Sair da sala' }));
    expect(socket.messages().at(-1)).toEqual({ type: 'leave' });
    expect(window.location.hash).toBe('');
    expect(
      screen.getByRole('button', { name: 'Iniciar partida' }),
    ).toBeInTheDocument();
  });
});
