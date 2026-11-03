// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES } from '../../../src/domain/config';
import { evaluateAttempt, meanScore } from '../../../src/domain/scoring';
import { MAX_PLAYERS } from './model';
import type { RoomState } from './model';
import { applyCommand, createRoom, joinRoom, removePlayer } from './room';
import {
  answerRound,
  random,
  readyAll,
  roomWith,
  run,
  target,
} from './testing';
import { buildRoomView } from './view';

function startedRoom(...names: string[]): RoomState {
  return run(roomWith(...names), 'p1', { type: 'start-match' });
}

function playingRoom(...names: string[]): RoomState {
  return readyAll(startedRoom(...names));
}

function finishRound(
  state: RoomState,
  guess?: (targetHz: number) => number,
): RoomState {
  return state.players.reduce(
    (current, player) => answerRound(current, player.id, guess),
    state,
  );
}

describe('criação e entrada', () => {
  it('cria a sala no lobby com o criador como host', () => {
    const outcome = createRoom('ABCDEFGHJK', 'p1', '  Ana   Maria ');
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.player.name).toBe('Ana Maria');
    expect(outcome.state).toMatchObject({
      code: 'ABCDEFGHJK',
      phase: 'lobby',
      hostId: 'p1',
      match: null,
      selection: { mode: 'normal' },
    });
  });

  it.each([
    ['vazio', '   '],
    ['longo demais', 'a'.repeat(21)],
    ['com controle', 'Ana\u0000'],
    ['com caractere invisível', 'An​a'],
    ['não textual', 42],
  ])('recusa apelido %s', (_label, name) => {
    expect(createRoom('ABCDEFGHJK', 'p1', name)).toEqual({
      ok: false,
      error: 'invalid-name',
    });
    expect(joinRoom(roomWith('Host'), 'p2', name)).toEqual({
      ok: false,
      error: 'invalid-name',
    });
  });

  it('conta grafemas no limite do apelido', () => {
    expect(createRoom('ABCDEFGHJK', 'p1', '😀'.repeat(20)).ok).toBe(true);
    expect(
      createRoom('ABCDEFGHJK', 'p1', 'é'.normalize('NFD').repeat(20)).ok,
    ).toBe(true);
    expect(createRoom('ABCDEFGHJK', 'p1', '😀'.repeat(21)).ok).toBe(false);
  });

  it('aceita apelidos de até vinte caracteres e preserva a ordem de entrada', () => {
    const state = roomWith('Host', 'b'.repeat(20), 'Caio');
    expect(state.players.map((player) => player.id)).toEqual([
      'p1',
      'p2',
      'p3',
    ]);
  });

  it.each(['ana', 'ANA', ' Ana ', 'Ａｎａ'])(
    'recusa apelido duplicado equivalente a "Ana": %s',
    (name) => {
      expect(joinRoom(roomWith('Ana'), 'p2', name)).toEqual({
        ok: false,
        error: 'name-taken',
      });
    },
  );

  it(`limita a sala a ${String(MAX_PLAYERS)} participantes`, () => {
    const names = Array.from(
      { length: MAX_PLAYERS },
      (_, i) => `J${String(i)}`,
    );
    const full = roomWith(...names);
    expect(full.players).toHaveLength(MAX_PLAYERS);
    expect(joinRoom(full, 'extra', 'Extra')).toEqual({
      ok: false,
      error: 'room-full',
    });
  });

  it('recusa entradas fora do lobby e volta a aceitar após jogar novamente', () => {
    let state = startedRoom('Host');
    expect(joinRoom(state, 'p9', 'Novo')).toEqual({
      ok: false,
      error: 'room-in-match',
    });
    state = readyAll(state);
    for (let round = 0; round < 5; round += 1) {
      expect(joinRoom(state, 'p9', 'Novo').ok).toBe(false);
      state = finishRound(state);
      if (state.phase === 'round-results') state = readyAll(state);
    }
    expect(state.phase).toBe('final');
    expect(joinRoom(state, 'p9', 'Novo')).toEqual({
      ok: false,
      error: 'room-in-match',
    });
    state = run(state, 'p1', { type: 'play-again' });
    expect(joinRoom(state, 'p9', 'Novo').ok).toBe(true);
  });
});

describe('permissões do host', () => {
  it.each([
    { type: 'set-mode', selection: { mode: 'hard' } },
    { type: 'start-match' },
    { type: 'kick', playerId: 'p1' },
    { type: 'play-again' },
  ] as const)('recusa $type de quem não é host', (command) => {
    const state = roomWith('Host', 'Bia');
    expect(applyCommand(state, 'p2', command, random)).toEqual({
      ok: false,
      error: 'not-host',
    });
  });

  it('seleciona as quatro modalidades apenas no lobby', () => {
    let state = roomWith('Host');
    for (const selection of [
      { mode: 'hard' },
      { mode: 'extreme', frequencyCount: 2 },
      { mode: 'extreme', frequencyCount: 3 },
      { mode: 'normal' },
    ] as const) {
      state = run(state, 'p1', { type: 'set-mode', selection });
      expect(state.selection).toEqual(selection);
    }
    state = run(state, 'p1', { type: 'start-match' });
    expect(
      applyCommand(
        state,
        'p1',
        { type: 'set-mode', selection: { mode: 'hard' } },
        random,
      ),
    ).toEqual({ ok: false, error: 'invalid-phase' });
    expect(applyCommand(state, 'p1', { type: 'start-match' }, random)).toEqual({
      ok: false,
      error: 'invalid-phase',
    });
    expect(applyCommand(state, 'p1', { type: 'play-again' }, random)).toEqual({
      ok: false,
      error: 'invalid-phase',
    });
  });

  it('recusa comandos de quem não pertence à sala', () => {
    expect(
      applyCommand(roomWith('Host'), 'intruso', { type: 'ready' }, random),
    ).toEqual({ ok: false, error: 'invalid-target' });
  });
});

describe('sincronização dos rounds', () => {
  it('inicia em prontidão sem revelar alvos', () => {
    const state = startedRoom('Host', 'Bia');
    expect(state.phase).toBe('ready');
    const view = buildRoomView(state);
    expect(view.match?.currentRound).toBeNull();
    expect(JSON.stringify(view)).not.toContain('"references"');
    expect(JSON.stringify(view)).not.toContain('"initialFrequencies"');
  });

  it('libera o round somente quando todos estão prontos', () => {
    let state = startedRoom('Host', 'Bia');
    state = run(state, 'p1', { type: 'ready' });
    expect(state.phase).toBe('ready');
    const repeated = run(state, 'p1', { type: 'ready' });
    expect(repeated).toBe(state);
    state = run(state, 'p2', { type: 'ready' });
    expect(state.phase).toBe('playing');
    expect(state.match?.roundIndex).toBe(0);
  });

  it('expõe somente o round vigente e posições iniciais válidas', () => {
    const state = playingRoom('Host');
    const match = state.match;
    const view = buildRoomView(state).match;
    expect(view?.currentRound?.references).toEqual(
      match?.definition.rounds[0]?.references,
    );
    const otherRounds = match?.definition.rounds
      .slice(1)
      .flatMap((round) => round.references);
    const json = JSON.stringify(buildRoomView(state));
    for (const hz of otherRounds ?? []) expect(json).not.toContain(String(hz));
    view?.currentRound?.initialFrequencies.forEach((hz, index) => {
      const targetHz = view.currentRound?.references[index] ?? 0;
      expect(1200 * Math.abs(Math.log2(hz / targetHz))).toBeGreaterThanOrEqual(
        DEFAULT_RULES.minInitialDistanceCents,
      );
    });
  });

  it('não revela palpites alheios antes do fim do round', () => {
    let state = playingRoom('Host', 'Bia');
    state = answerRound(state, 'p1', (hz) => hz * 1.01);
    const view = buildRoomView(state);
    expect(view.phase).toBe('playing');
    expect(JSON.stringify(view)).not.toContain('playerHz');
    expect(view.match?.progress).toEqual([
      { playerId: 'p1', status: 'completed', attemptsSubmitted: 1 },
      { playerId: 'p2', status: 'playing', attemptsSubmitted: 0 },
    ]);
  });

  it('encerra o round, publica resultados e exige nova prontidão', () => {
    let state = finishRound(playingRoom('Host', 'Bia'));
    expect(state.phase).toBe('round-results');
    const results = buildRoomView(state).match?.lastRound;
    expect(results?.players.map((player) => player.playerId)).toEqual([
      'p1',
      'p2',
    ]);
    expect(results?.players[0]?.attempts[0]?.playerHz).toBe(
      results?.references[0],
    );
    expect(buildRoomView(state).match?.currentRound).toBeNull();
    state = run(state, 'p1', { type: 'ready' });
    expect(state.phase).toBe('round-results');
    state = run(state, 'p2', { type: 'ready' });
    expect(state.phase).toBe('playing');
    expect(state.match?.roundIndex).toBe(1);
  });

  it('recusa prontidão durante o lobby e durante as tentativas', () => {
    expect(
      applyCommand(roomWith('Host'), 'p1', { type: 'ready' }, random),
    ).toEqual({ ok: false, error: 'invalid-phase' });
    expect(
      applyCommand(playingRoom('Host'), 'p1', { type: 'ready' }, random),
    ).toEqual({ ok: false, error: 'invalid-phase' });
  });
});

describe('palpites e pontuação', () => {
  it('pontua no servidor com as regras do domínio', () => {
    let state = playingRoom('Host');
    const targetHz = target(state, 0);
    const guess = Math.min(700, targetHz * 1.05);
    state = answerRound(state, 'p1', () => guess);
    const attempt =
      buildRoomView(state).match?.lastRound?.players[0]?.attempts[0];
    expect(attempt).toEqual({
      ...evaluateAttempt(targetHz, guess, 500),
      attemptIndex: 0,
    });
  });

  it('dá dez pontos ao acerto exato', () => {
    const state = answerRound(playingRoom('Host'), 'p1');
    expect(buildRoomView(state).match?.lastRound?.players[0]?.score).toBe(10);
  });

  it.each([
    [
      'round errado',
      { roundIndex: 1, attemptIndex: 0, frequencyHz: 300 },
      'wrong-round',
    ],
    [
      'tentativa fora de ordem',
      { roundIndex: 0, attemptIndex: 1, frequencyHz: 300 },
      'wrong-attempt',
    ],
    [
      'abaixo da faixa',
      { roundIndex: 0, attemptIndex: 0, frequencyHz: 79.99 },
      'invalid-frequency',
    ],
    [
      'acima da faixa',
      { roundIndex: 0, attemptIndex: 0, frequencyHz: 700.01 },
      'invalid-frequency',
    ],
  ] as const)('recusa palpite com %s', (_label, guess, error) => {
    expect(
      applyCommand(
        playingRoom('Host', 'Bia'),
        'p1',
        { type: 'submit-guess', ...guess },
        random,
      ),
    ).toEqual({ ok: false, error });
  });

  it('aceita os limites da faixa', () => {
    const state = playingRoom('Host', 'Bia');
    for (const frequencyHz of [80, 700]) {
      expect(
        applyCommand(
          state,
          'p1',
          { type: 'submit-guess', roundIndex: 0, attemptIndex: 0, frequencyHz },
          random,
        ).ok,
      ).toBe(true);
    }
  });

  it('recusa confirmação duplicada e palpites fora das tentativas', () => {
    const state = answerRound(playingRoom('Host', 'Bia'), 'p1');
    expect(
      applyCommand(
        state,
        'p1',
        {
          type: 'submit-guess',
          roundIndex: 0,
          attemptIndex: 0,
          frequencyHz: 300,
        },
        random,
      ),
    ).toEqual({ ok: false, error: 'already-finished' });
    expect(
      applyCommand(
        roomWith('Host'),
        'p1',
        {
          type: 'submit-guess',
          roundIndex: 0,
          attemptIndex: 0,
          frequencyHz: 300,
        },
        random,
      ),
    ).toEqual({ ok: false, error: 'invalid-phase' });
  });

  it.each([2, 3] as const)(
    'Extreme com %i frequências registra cada palpite e usa a média',
    (frequencyCount) => {
      let state = run(roomWith('Host', 'Bia'), 'p1', {
        type: 'set-mode',
        selection: { mode: 'extreme', frequencyCount },
      });
      state = readyAll(run(state, 'p1', { type: 'start-match' }));
      const view = buildRoomView(state).match;
      expect(view?.modality).toBe(`extreme-${String(frequencyCount)}`);
      expect(view?.currentRound?.references).toHaveLength(frequencyCount);
      expect(view?.currentRound?.initialFrequencies).toHaveLength(
        frequencyCount,
      );

      state = run(state, 'p1', {
        type: 'submit-guess',
        roundIndex: 0,
        attemptIndex: 0,
        frequencyHz: target(state, 0),
      });
      expect(state.phase).toBe('playing');
      expect(buildRoomView(state).match?.progress[0]).toEqual({
        playerId: 'p1',
        status: 'playing',
        attemptsSubmitted: 1,
      });

      const factors = [1, 1.1, 0.9];
      for (
        let attemptIndex = 1;
        attemptIndex < frequencyCount;
        attemptIndex += 1
      ) {
        state = run(state, 'p1', {
          type: 'submit-guess',
          roundIndex: 0,
          attemptIndex,
          frequencyHz: Math.min(
            700,
            target(state, attemptIndex) * (factors[attemptIndex] ?? 1),
          ),
        });
      }
      state = answerRound(state, 'p2');
      expect(state.phase).toBe('round-results');
      const host = buildRoomView(state).match?.lastRound?.players[0];
      expect(host?.attempts).toHaveLength(frequencyCount);
      expect(host?.score).toBe(
        meanScore(host?.attempts.map((attempt) => attempt.score) ?? []),
      );
    },
  );
});

describe('round perdido por interrupção', () => {
  it('zera o round, descarta palpites parciais e permite continuar', () => {
    let state = run(roomWith('Host', 'Bia'), 'p1', {
      type: 'set-mode',
      selection: { mode: 'extreme', frequencyCount: 3 },
    });
    state = readyAll(run(state, 'p1', { type: 'start-match' }));
    state = run(state, 'p2', {
      type: 'submit-guess',
      roundIndex: 0,
      attemptIndex: 0,
      frequencyHz: target(state, 0),
    });
    state = run(state, 'p2', { type: 'forfeit-round', roundIndex: 0 });
    expect(buildRoomView(state).match?.progress[1]).toEqual({
      playerId: 'p2',
      status: 'forfeited',
      attemptsSubmitted: 0,
    });
    state = answerRound(state, 'p1');
    expect(buildRoomView(state).match?.lastRound?.players[1]).toEqual({
      playerId: 'p2',
      name: 'Bia',
      status: 'forfeited',
      score: 0,
      attempts: [],
    });
    state = readyAll(state);
    expect(state.match?.rounds[1]?.p2).toEqual({
      status: 'playing',
      attempts: [],
    });
  });

  it('recusa perda fora do round vigente ou após concluir', () => {
    const state = playingRoom('Host', 'Bia');
    expect(
      applyCommand(
        state,
        'p1',
        { type: 'forfeit-round', roundIndex: 2 },
        random,
      ),
    ).toEqual({ ok: false, error: 'wrong-round' });
    expect(
      applyCommand(
        answerRound(state, 'p1'),
        'p1',
        { type: 'forfeit-round', roundIndex: 0 },
        random,
      ),
    ).toEqual({ ok: false, error: 'already-finished' });
    expect(
      applyCommand(
        roomWith('Host'),
        'p1',
        { type: 'forfeit-round', roundIndex: 0 },
        random,
      ),
    ).toEqual({ ok: false, error: 'invalid-phase' });
  });
});

describe('saída e remoção de participantes', () => {
  it('avança o round quando o único pendente sai', () => {
    let state = answerRound(playingRoom('Host', 'Bia', 'Caio'), 'p1');
    state = answerRound(state, 'p2');
    expect(state.phase).toBe('playing');
    const next = removePlayer(state, 'p3');
    expect(next?.phase).toBe('round-results');
    expect(
      next && buildRoomView(next).match?.lastRound?.players.map((p) => p.name),
    ).toEqual(['Host', 'Bia']);
  });

  it('reavalia a prontidão ao remover quem faltava', () => {
    let state = startedRoom('Host', 'Bia');
    state = run(state, 'p1', { type: 'ready' });
    const outcome = applyCommand(
      state,
      'p1',
      { type: 'kick', playerId: 'p2' },
      random,
    );
    expect(outcome).toMatchObject({
      ok: true,
      removed: { playerId: 'p2', reason: 'kicked' },
    });
    expect(outcome.ok && outcome.state?.phase).toBe('playing');
  });

  it('recusa remover a si mesmo ou um participante desconhecido', () => {
    const state = roomWith('Host', 'Bia');
    for (const playerId of ['p1', 'p9']) {
      expect(
        applyCommand(state, 'p1', { type: 'kick', playerId }, random),
      ).toEqual({ ok: false, error: 'invalid-target' });
    }
  });

  it('remove dados do participante de resultados e ranking', () => {
    let state = finishRound(playingRoom('Host', 'Bia'));
    const removed = removePlayer(state, 'p2');
    if (removed === null) throw new Error('Sala encerrada.');
    state = removed;
    expect(state.match?.rounds[0]).not.toHaveProperty('p2');
    expect(state.match?.readyIds).not.toContain('p2');
    state = readyAll(state);
    for (let round = 1; round < 5; round += 1) {
      state = finishRound(state);
      if (state.phase === 'round-results') state = readyAll(state);
    }
    const view = buildRoomView(state).match;
    expect(view?.ranking?.map((entry) => entry.playerId)).toEqual(['p1']);
    expect(view?.rounds?.every((round) => round.players.length === 1)).toBe(
      true,
    );
  });

  it('sai voluntariamente e informa a remoção', () => {
    const outcome = applyCommand(
      roomWith('Host', 'Bia'),
      'p2',
      { type: 'leave' },
      random,
    );
    expect(outcome).toMatchObject({
      ok: true,
      removed: { playerId: 'p2', reason: 'left' },
    });
    expect(outcome.ok && outcome.state?.players.map((p) => p.id)).toEqual([
      'p1',
    ]);
  });

  it('ignora a remoção de um ID desconhecido', () => {
    const state = roomWith('Host');
    expect(removePlayer(state, 'p9')).toBe(state);
  });
});

describe('transferência de host', () => {
  it('passa ao participante mais antigo restante', () => {
    let state = roomWith('Host', 'Bia', 'Caio');
    state = removePlayer(state, 'p2') ?? state;
    expect(state.hostId).toBe('p1');
    state = removePlayer(state, 'p1') ?? state;
    expect(state.hostId).toBe('p3');
    expect(run(state, 'p3', { type: 'start-match' }).phase).toBe('ready');
  });

  it('transfere durante a partida e preserva o progresso', () => {
    let state = answerRound(playingRoom('Host', 'Bia', 'Caio'), 'p2');
    state = removePlayer(state, 'p1') ?? state;
    expect(state.hostId).toBe('p2');
    expect(state.phase).toBe('playing');
    state = answerRound(state, 'p3');
    expect(state.phase).toBe('round-results');
  });
});

describe('ranking final', () => {
  it('ordena pela soma, compartilha empates exatos e mantém a ordem de entrada', () => {
    let state = playingRoom('Host', 'Bia', 'Caio', 'Duda');
    const guesses: Record<string, (hz: number) => number> = {
      p1: (hz) => Math.max(80, hz / 1.1),
      p2: (hz) => hz,
      p3: (hz) => Math.max(80, hz / 1.1),
      p4: (hz) => Math.min(700, hz * 1.5),
    };
    for (let round = 0; round < 5; round += 1) {
      for (const player of state.players) {
        state = answerRound(state, player.id, guesses[player.id]);
      }
      if (state.phase === 'round-results') state = readyAll(state);
    }
    expect(state.phase).toBe('final');
    const ranking = buildRoomView(state).match?.ranking ?? [];
    expect(ranking.map((entry) => [entry.position, entry.playerId])).toEqual([
      [1, 'p2'],
      [2, 'p1'],
      [2, 'p3'],
      [4, 'p4'],
    ]);
    expect(ranking[0]?.totalScore).toBe(50);
    expect(ranking[0]?.roundScores).toEqual([10, 10, 10, 10, 10]);
    for (const entry of ranking) {
      expect(entry.totalScore).toBeGreaterThanOrEqual(0);
      expect(entry.totalScore).toBeLessThanOrEqual(50);
      expect(entry.totalScore).toBeCloseTo(
        entry.roundScores.reduce((sum, score) => sum + score, 0),
        12,
      );
    }
  });

  it('conta rounds perdidos como zero e funciona com um participante', () => {
    let state = playingRoom('Solo');
    for (let round = 0; round < 5; round += 1) {
      state =
        round === 2
          ? run(state, 'p1', { type: 'forfeit-round', roundIndex: 2 })
          : answerRound(state, 'p1');
      if (state.phase === 'round-results') state = readyAll(state);
    }
    const [entry] = buildRoomView(state).match?.ranking ?? [];
    expect(entry).toMatchObject({
      position: 1,
      totalScore: 40,
      roundScores: [10, 10, 0, 10, 10],
    });
  });
});

describe('jogar novamente e encerramento', () => {
  function finishedRoom(): RoomState {
    let state = playingRoom('Host', 'Bia');
    for (let round = 0; round < 5; round += 1) {
      state = finishRound(state);
      if (state.phase === 'round-results') state = readyAll(state);
    }
    return state;
  }

  it('volta ao lobby descartando a partida e permite outro modo', () => {
    let state = run(finishedRoom(), 'p1', { type: 'play-again' });
    expect(state.phase).toBe('lobby');
    expect(state.match).toBeNull();
    expect(buildRoomView(state).match).toBeNull();
    state = run(state, 'p1', {
      type: 'set-mode',
      selection: { mode: 'extreme', frequencyCount: 2 },
    });
    state = run(state, 'p1', { type: 'start-match' });
    expect(state.match?.definition.id).toBe('ABCDEFGHJK-2');
    expect(state.match?.rounds).toEqual([]);
    expect(state.match?.definition.rounds[0]?.references).toHaveLength(2);
  });

  it('mantém a sala no resultado final até o host decidir', () => {
    const state = finishedRoom();
    expect(applyCommand(state, 'p2', { type: 'ready' }, random)).toEqual({
      ok: false,
      error: 'invalid-phase',
    });
    expect(state.phase).toBe('final');
  });

  it('encerra a sala quando o último participante sai', () => {
    expect(removePlayer(roomWith('Host'), 'p1')).toBeNull();
    let state: RoomState | null = playingRoom('Host', 'Bia');
    state = removePlayer(state, 'p1');
    state = state && removePlayer(state, 'p2');
    expect(state).toBeNull();
    const outcome = applyCommand(
      roomWith('Host'),
      'p1',
      { type: 'leave' },
      random,
    );
    expect(outcome).toEqual({
      ok: true,
      state: null,
      removed: { playerId: 'p1', reason: 'left' },
    });
  });

  it('aumenta a versão a cada mudança publicada', () => {
    const state = roomWith('Host');
    const next = run(state, 'p1', {
      type: 'set-mode',
      selection: { mode: 'hard' },
    });
    expect(next.version).toBeGreaterThan(state.version);
  });
});
