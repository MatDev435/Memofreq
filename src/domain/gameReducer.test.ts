// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, getModeSettings } from './config';
import type { ModeSelection } from './config';
import {
  createInitialState,
  gameReducer,
  getCurrentTarget,
  getEventContext,
} from './gameReducer';
import type {
  GameAction,
  GameDefinition,
  GameEvent,
  GameSession,
  GameState,
} from './models';

const selections: ModeSelection[] = [
  { mode: 'normal' },
  { mode: 'hard' },
  { mode: 'extreme', frequencyCount: 2 },
  { mode: 'extreme', frequencyCount: 3 },
];

function definition(
  selection: ModeSelection = { mode: 'normal' },
  id = 'game',
): GameDefinition {
  const count = getModeSettings(selection).referencesPerRound;
  return {
    id,
    selection,
    rules: DEFAULT_RULES,
    rounds: Array.from({ length: 5 }, () => ({
      references: [100, 200, 300].slice(0, count),
    })),
  };
}

function dispatch(state: GameState, action: GameAction): GameState {
  return gameReducer(state, { ...getEventContext(state), ...action });
}

function session(state: GameState): GameSession {
  if (state.phase === 'home') throw new Error('O teste exige uma partida.');
  return state.session;
}

function start(selection: ModeSelection = { mode: 'normal' }): GameState {
  return dispatch(createInitialState(), {
    type: 'START_GAME',
    definition: definition(selection),
  });
}

function toAttempt(state = start()): GameState {
  state = dispatch(state, { type: 'AUDIO_READY' });
  state = dispatch(state, { type: 'COUNTDOWN_FINISHED' });
  return dispatch(state, { type: 'REFERENCES_FINISHED', initialHz: 650 });
}

function finishRound(
  state: GameState,
  errorsCents: readonly number[] = [],
): GameState {
  state = toAttempt(state);
  const count = getModeSettings(
    session(state).definition.selection,
  ).referencesPerRound;
  for (let attempt = 0; attempt < count; attempt += 1) {
    const target = getCurrentTarget(session(state));
    state = dispatch(state, {
      type: 'SET_FREQUENCY',
      frequencyHz: target * 2 ** ((errorsCents[attempt] ?? 0) / 1200),
    });
    state = dispatch(
      state,
      attempt + 1 < count
        ? { type: 'CONFIRM_ATTEMPT', nextInitialHz: 650 }
        : { type: 'CONFIRM_ATTEMPT' },
    );
  }
  return dispatch(state, { type: 'COMPLETE_ROUND' });
}

function finishGame(selection: ModeSelection): GameState {
  let state = start(selection);
  for (let round = 0; round < 5; round += 1) {
    state = finishRound(state);
    state = dispatch(state, {
      type: round === 4 ? 'FINISH_GAME' : 'NEXT_ROUND',
    });
  }
  return state;
}

describe('Partidas completas e resultados', () => {
  it.each(selections)('completa exatamente cinco rounds em %j', (selection) => {
    const state = finishGame(selection);
    expect(state.phase).toBe('final-result');
    if (state.phase !== 'final-result')
      throw new Error('Resultado final ausente.');
    expect(state.result.modality).toBe(getModeSettings(selection).modality);
    expect(state.result.rounds).toHaveLength(5);
    expect(state.result.score).toBe(50);
    expect(state.result.rules).toEqual(DEFAULT_RULES);
    state.result.rounds.forEach((round, index) => {
      expect(round.roundIndex).toBe(index);
      expect(round.attempts).toHaveLength(
        getModeSettings(selection).referencesPerRound,
      );
      expect(round.score).toBe(10);
      expect(round.attempts.map((attempt) => attempt.targetHz)).toEqual(
        [100, 200, 300].slice(0, round.attempts.length),
      );
    });
    expect(dispatch(state, { type: 'NEXT_ROUND' })).toBe(state);
    expect(dispatch(state, { type: 'CONFIRM_ATTEMPT' })).toBe(state);
  });

  it('calcula médias do Extreme sem arredondamento intermediário', () => {
    let state = start({ mode: 'extreme', frequencyCount: 3 });
    for (let round = 0; round < 5; round += 1) {
      state = finishRound(state, [0, 0, 500]);
      state = dispatch(state, {
        type: round === 4 ? 'FINISH_GAME' : 'NEXT_ROUND',
      });
    }
    if (state.phase !== 'final-result')
      throw new Error('Resultado final ausente.');
    expect(state.result.score).toBeCloseTo(100 / 3, 10);
    expect(state.result.score).not.toBe(33.35);
    expect(state.result.rounds[0]?.score).toBeCloseTo(20 / 3, 10);
  });

  it('calcula a média 8 de notas 8, 6 e 10 em ordem', () => {
    const state = finishRound(
      start({ mode: 'extreme', frequencyCount: 3 }),
      [100, 200, 0],
    );
    expect(session(state).completedRounds[0]?.score).toBeCloseTo(8, 10);
    expect(
      session(state).completedRounds[0]?.attempts.map(
        (attempt) => attempt.attemptIndex,
      ),
    ).toEqual([0, 1, 2]);
  });

  it('preserva a resposta definitiva e os estados anteriores', () => {
    const before = dispatch(toAttempt(), {
      type: 'SET_FREQUENCY',
      frequencyHz: 123.456789,
    });
    const after = dispatch(before, { type: 'CONFIRM_ATTEMPT' });
    expect(session(before).attempts).toHaveLength(0);
    expect(session(after).attempts[0]?.playerHz).toBe(123.456789);
    expect(dispatch(after, { type: 'SET_FREQUENCY', frequencyHz: 100 })).toBe(
      after,
    );
    expect(Object.isFrozen(session(after).attempts[0])).toBe(true);
    expect(Object.isFrozen(session(after).attempts)).toBe(true);
    expect(Object.isFrozen(after)).toBe(true);
  });
});

describe('Transições inválidas e eventos antigos', () => {
  it('bloqueia confirmações fora da tentativa e avanço de round incompleto', () => {
    const preparing = start();
    const countdown = dispatch(preparing, { type: 'AUDIO_READY' });
    const references = dispatch(countdown, { type: 'COUNTDOWN_FINISHED' });
    const result = dispatch(toAttempt(), { type: 'CONFIRM_ATTEMPT' });
    for (const state of [
      createInitialState(),
      preparing,
      countdown,
      references,
      result,
    ]) {
      expect(dispatch(state, { type: 'CONFIRM_ATTEMPT' })).toBe(state);
      expect(dispatch(state, { type: 'NEXT_ROUND' })).toBe(state);
      expect(dispatch(state, { type: 'FINISH_GAME' })).toBe(state);
    }
    const extreme = dispatch(
      toAttempt(start({ mode: 'extreme', frequencyCount: 3 })),
      { type: 'CONFIRM_ATTEMPT' },
    );
    expect(dispatch(extreme, { type: 'COMPLETE_ROUND' })).toBe(extreme);
  });

  it('ignora duplo início e dupla confirmação com o mesmo contexto', () => {
    const home = createInitialState();
    const begin: GameEvent = {
      ...getEventContext(home),
      type: 'START_GAME',
      definition: definition(),
    };
    const started = gameReducer(home, begin);
    expect(gameReducer(started, begin)).toBe(started);
    const attempt = toAttempt(started);
    const confirm: GameEvent = {
      ...getEventContext(attempt),
      type: 'CONFIRM_ATTEMPT',
    };
    const result = gameReducer(attempt, confirm);
    expect(gameReducer(result, confirm)).toBe(result);
    expect(session(result).attempts).toHaveLength(1);
  });

  it('registra e avança atomicamente, rejeitando confirmação antiga na próxima tentativa', () => {
    const first = dispatch(
      toAttempt(start({ mode: 'extreme', frequencyCount: 3 })),
      {
        type: 'SET_FREQUENCY',
        frequencyHz: 123.456789,
      },
    );
    const confirm: GameEvent = {
      ...getEventContext(first),
      type: 'CONFIRM_ATTEMPT',
      nextInitialHz: 650,
    };
    const second = gameReducer(first, confirm);
    expect(second.phase).toBe('attempt');
    expect(session(second).attemptIndex).toBe(1);
    expect(session(second).attempts[0]?.playerHz).toBe(123.456789);
    expect(Object.isFrozen(session(second).attempts[0])).toBe(true);
    expect(session(first).attempts).toHaveLength(0);
    expect(gameReducer(second, confirm)).toBe(second);
    expect(dispatch(second, { type: 'COMPLETE_ROUND' })).toBe(second);
    const third = dispatch(second, {
      type: 'CONFIRM_ATTEMPT',
      nextInitialHz: 650,
    });
    expect(third.phase).toBe('attempt');
    expect(session(third).attemptIndex).toBe(2);
    expect(session(third).attempts).toHaveLength(2);
    expect(dispatch(third, { type: 'CONFIRM_ATTEMPT' }).phase).toBe(
      'attempt-result',
    );
  });

  it('não repete referência nem troca a modalidade durante tentativa ou resultado', () => {
    const attempt = toAttempt();
    const result = dispatch(attempt, { type: 'CONFIRM_ATTEMPT' });
    for (const state of [attempt, result]) {
      expect(dispatch(state, { type: 'COUNTDOWN_FINISHED' })).toBe(state);
      expect(
        dispatch(state, { type: 'REFERENCES_FINISHED', initialHz: 650 }),
      ).toBe(state);
      expect(dispatch(state, { type: 'AUDIO_READY' })).toBe(state);
      expect(
        dispatch(state, {
          type: 'START_GAME',
          definition: definition({ mode: 'hard' }),
        }),
      ).toBe(state);
    }
    const round = dispatch(result, { type: 'COMPLETE_ROUND' });
    expect(dispatch(round, { type: 'COMPLETE_ROUND' })).toBe(round);
    expect(dispatch(round, { type: 'FINISH_GAME' })).toBe(round);
  });

  it('rejeita eventos de outra partida e de antes de voltar à inicial', () => {
    const attempt = toAttempt();
    const stale: GameEvent = {
      ...getEventContext(attempt),
      type: 'CONFIRM_ATTEMPT',
    };
    expect(gameReducer(attempt, { ...stale, gameId: 'other-game' })).toBe(
      attempt,
    );
    const home = dispatch(attempt, { type: 'RETURN_HOME' });
    const restarted = toAttempt(
      dispatch(home, { type: 'START_GAME', definition: definition() }),
    );
    expect(gameReducer(restarted, stale)).toBe(restarted);
    expect(restarted.executionId).toBeGreaterThan(attempt.executionId);
  });

  it.each([0, 49, 701, NaN, Infinity])(
    'ignora frequência inválida de ajuste: %s',
    (frequencyHz) => {
      const state = toAttempt();
      expect(dispatch(state, { type: 'SET_FREQUENCY', frequencyHz })).toBe(
        state,
      );
    },
  );

  it('só inicia tentativas com posição inicial válida, inclusive no Extreme', () => {
    const references = dispatch(dispatch(start(), { type: 'AUDIO_READY' }), {
      type: 'COUNTDOWN_FINISHED',
    });
    for (const initialHz of [100, 105, 49, 701, NaN]) {
      expect(
        dispatch(references, { type: 'REFERENCES_FINISHED', initialHz }),
      ).toBe(references);
    }
    const attempt = toAttempt(start({ mode: 'extreme', frequencyCount: 2 }));
    expect(dispatch(attempt, { type: 'CONFIRM_ATTEMPT' })).toBe(attempt);
    for (const nextInitialHz of [200, 205, 49, 701, NaN, Infinity]) {
      expect(
        dispatch(attempt, { type: 'CONFIRM_ATTEMPT', nextInitialHz }),
      ).toBe(attempt);
      expect(session(attempt).attempts).toHaveLength(0);
    }
  });
});

describe('Interrupções por estado', () => {
  const hidden: GameAction = {
    type: 'VISIBILITY_CHANGED',
    visible: false,
    referenceStarted: false,
  };
  const visible: GameAction = {
    type: 'VISIBILITY_CHANGED',
    visible: true,
    referenceStarted: false,
  };
  const suspended: GameAction = {
    type: 'AUDIO_INTERRUPTED',
    reason: 'audio-suspended',
    referenceStarted: false,
  };

  it('não inicia partida oculta e não avança automaticamente ao voltar', () => {
    const home = createInitialState(false);
    expect(
      dispatch(home, { type: 'START_GAME', definition: definition() }),
    ).toBe(home);
    expect(dispatch(home, visible).phase).toBe('home');
  });

  it('cancela contagem, descarta término antigo e exige retomada explícita', () => {
    const countdown = dispatch(start(), { type: 'AUDIO_READY' });
    const staleEnd: GameEvent = {
      ...getEventContext(countdown),
      type: 'COUNTDOWN_FINISHED',
    };
    const paused = dispatch(countdown, hidden);
    expect(paused.phase).toBe('awaiting-resume');
    expect(paused.pageVisible).toBe(false);
    expect(gameReducer(paused, staleEnd)).toBe(paused);
    expect(dispatch(paused, { type: 'RESUME' })).toBe(paused);
    const returned = dispatch(paused, visible);
    expect(returned.phase).toBe('awaiting-resume');
    expect(dispatch(returned, { type: 'AUDIO_READY' })).toBe(returned);
    const resumed = dispatch(returned, { type: 'RESUME' });
    expect(dispatch(resumed, { type: 'AUDIO_READY' }).phase).toBe('countdown');
  });

  it('considera a corrida com início da referência como partida interrompida', () => {
    const countdown = dispatch(start(), { type: 'AUDIO_READY' });
    const state = dispatch(countdown, { ...hidden, referenceStarted: true });
    expect(state.phase).toBe('interrupted');
    expect(dispatch(state, visible).phase).toBe('interrupted');
    expect(dispatch(state, { type: 'RESUME' })).toBe(state);
  });

  it('interrompe referências e tentativas por ocultação ou falha sonora', () => {
    const references = dispatch(dispatch(start(), { type: 'AUDIO_READY' }), {
      type: 'COUNTDOWN_FINISHED',
    });
    for (const current of [references, toAttempt()]) {
      for (const action of [
        hidden,
        suspended,
        {
          type: 'AUDIO_INTERRUPTED',
          reason: 'audio-failed',
          referenceStarted: false,
        } satisfies GameAction,
      ]) {
        const state = dispatch(current, action);
        expect(state.phase).toBe('interrupted');
        expect(dispatch(state, { type: 'CONFIRM_ATTEMPT' })).toBe(state);
        expect(
          dispatch(state, { type: 'REFERENCES_FINISHED', initialHz: 650 }),
        ).toBe(state);
      }
    }
  });

  it('preserva resultados da tentativa, do round e da partida ao ocultar', () => {
    const attemptResult = dispatch(toAttempt(), { type: 'CONFIRM_ATTEMPT' });
    const roundResult = dispatch(attemptResult, { type: 'COMPLETE_ROUND' });
    const finalResult = finishGame({ mode: 'normal' });
    for (const current of [attemptResult, roundResult, finalResult]) {
      const state = dispatch(current, hidden);
      expect(state.phase).toBe(current.phase);
      expect(session(state)).toBe(session(current));
      expect(dispatch(state, suspended)).toBe(state);
      expect(dispatch(state, { type: 'NEXT_ROUND' })).toBe(state);
      expect(dispatch(state, visible).phase).toBe(current.phase);
    }
  });

  it('interrompe o Extreme ao ocultar após o primeiro palpite sem tratar como resultado', () => {
    const first = toAttempt(start({ mode: 'extreme', frequencyCount: 2 }));
    const second = dispatch(first, {
      type: 'CONFIRM_ATTEMPT',
      nextInitialHz: 650,
    });
    const hiddenState = dispatch(second, hidden);
    expect(hiddenState.phase).toBe('interrupted');
    expect(session(hiddenState).attemptIndex).toBe(1);
    expect(session(hiddenState).attempts).toHaveLength(1);
    const returned = dispatch(hiddenState, visible);
    expect(dispatch(returned, { type: 'RESUME' })).toBe(returned);
  });

  it('consolida somente respostas completas enquanto oculta sem avançar o round', () => {
    const first = toAttempt(start({ mode: 'extreme', frequencyCount: 2 }));
    const second = dispatch(first, {
      type: 'CONFIRM_ATTEMPT',
      nextInitialHz: 650,
    });
    expect(
      dispatch(dispatch(second, hidden), { type: 'COMPLETE_ROUND' }).phase,
    ).toBe('interrupted');
    const confirmed = dispatch(second, { type: 'CONFIRM_ATTEMPT' });
    const result = dispatch(dispatch(confirmed, hidden), {
      type: 'COMPLETE_ROUND',
    });
    expect(result.phase).toBe('round-result');
    expect(session(result).completedRounds[0]?.attempts).toHaveLength(2);
    expect(dispatch(result, { type: 'NEXT_ROUND' })).toBe(result);
  });

  it('aguarda retomada em falha na preparação ou contagem e permite nova partida após interrupção', () => {
    const preparing = start();
    for (const state of [
      preparing,
      dispatch(preparing, { type: 'AUDIO_READY' }),
    ]) {
      expect(dispatch(state, suspended).phase).toBe('awaiting-resume');
    }
    const interrupted = dispatch(toAttempt(), suspended);
    const fresh = dispatch(interrupted, {
      type: 'START_GAME',
      definition: definition({ mode: 'hard' }, 'fresh'),
    });
    expect(fresh.phase).toBe('preparing-audio');
    expect(session(fresh).attempts).toHaveLength(0);
    expect(session(fresh).definition.id).toBe('fresh');
  });

  it('resolve confirmação versus interrupção pela primeira ação válida', () => {
    const state = toAttempt();
    const result = dispatch(state, { type: 'CONFIRM_ATTEMPT' });
    expect(dispatch(result, suspended)).toBe(result);
    const interrupted = dispatch(state, suspended);
    expect(dispatch(interrupted, { type: 'CONFIRM_ATTEMPT' })).toBe(
      interrupted,
    );
  });
});
