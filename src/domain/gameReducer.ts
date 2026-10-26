import { getModeSettings, ROUND_COUNT } from './config';
import { isFrequencyInRange, isValidInitialFrequency } from './frequencies';
import { snapshotGameDefinition } from './gameDefinition';
import type {
  EventContext,
  GameEvent,
  GamePhase,
  GameSession,
  GameState,
  InterruptionReason,
  Preparation,
} from './models';
import { evaluateAttempt, meanScore, totalScore } from './scoring';

export function createInitialState(pageVisible = true): GameState {
  return Object.freeze({ phase: 'home', executionId: 0, pageVisible });
}

export function getEventContext(state: GameState): EventContext {
  return Object.freeze({
    gameId: state.phase === 'home' ? null : state.session.definition.id,
    executionId: state.executionId,
  });
}

function transition(state: GameState, phase: GamePhase): GameState {
  return Object.freeze({
    ...phase,
    executionId: state.executionId + 1,
    pageVisible: state.pageVisible,
  });
}

export function getCurrentTarget(session: GameSession): number {
  const target =
    session.definition.rounds[session.roundIndex]?.references[
      session.attemptIndex
    ];
  if (target === undefined)
    throw new RangeError('Índice de tentativa inválido.');
  return target;
}

function validInitial(session: GameSession, initialHz: number): boolean {
  return isValidInitialFrequency(
    initialHz,
    getCurrentTarget(session),
    session.definition.rules,
  );
}

function prepare(
  state: GameState,
  session: GameSession,
  preparation: Preparation,
): GameState {
  return transition(state, {
    phase: 'preparing-audio',
    session,
    preparation: Object.freeze(preparation),
  });
}

function interrupt(
  state: GameState,
  reason: InterruptionReason,
  referenceStarted: boolean,
): GameState {
  switch (state.phase) {
    case 'references':
    case 'attempt':
      return transition(state, {
        phase: 'interrupted',
        session: state.session,
        reason,
      });
    case 'preparing-audio':
    case 'awaiting-resume':
    case 'countdown': {
      const preparation: Preparation =
        state.phase === 'countdown'
          ? Object.freeze({ destination: 'countdown' })
          : state.preparation;
      if (referenceStarted && preparation.destination === 'countdown') {
        return transition(state, {
          phase: 'interrupted',
          session: state.session,
          reason,
        });
      }
      if (state.phase === 'awaiting-resume') return state;
      return transition(state, {
        phase: 'awaiting-resume',
        session: state.session,
        preparation,
      });
    }
    default:
      return state;
  }
}

export function gameReducer(state: GameState, event: GameEvent): GameState {
  const context = getEventContext(state);
  if (
    event.executionId !== context.executionId ||
    event.gameId !== context.gameId
  )
    return state;

  if (event.type === 'VISIBILITY_CHANGED') {
    const visibleState =
      state.pageVisible === event.visible
        ? state
        : Object.freeze({ ...state, pageVisible: event.visible });
    return event.visible
      ? visibleState
      : interrupt(visibleState, 'page-hidden', event.referenceStarted);
  }
  if (event.type === 'AUDIO_INTERRUPTED') {
    return interrupt(state, event.reason, event.referenceStarted);
  }
  if (event.type === 'RETURN_HOME') {
    return state.phase === 'home'
      ? state
      : transition(state, { phase: 'home' });
  }
  if (!state.pageVisible) return state;

  switch (event.type) {
    case 'START_GAME': {
      if (
        state.phase !== 'home' &&
        state.phase !== 'final-result' &&
        state.phase !== 'interrupted'
      ) {
        return state;
      }
      const definition = snapshotGameDefinition(event.definition);
      const session: GameSession = Object.freeze({
        definition,
        roundIndex: 0,
        attemptIndex: 0,
        attempts: Object.freeze([]),
        completedRounds: Object.freeze([]),
      });
      return prepare(state, session, { destination: 'countdown' });
    }
    case 'AUDIO_READY':
      if (state.phase !== 'preparing-audio') return state;
      return state.preparation.destination === 'countdown'
        ? transition(state, { phase: 'countdown', session: state.session })
        : transition(state, {
            phase: 'attempt',
            session: state.session,
            initialHz: state.preparation.initialHz,
            frequencyHz: state.preparation.initialHz,
          });
    case 'COUNTDOWN_FINISHED':
      return state.phase === 'countdown'
        ? transition(state, { phase: 'references', session: state.session })
        : state;
    case 'REFERENCES_FINISHED':
      return state.phase === 'references' &&
        validInitial(state.session, event.initialHz)
        ? transition(state, {
            phase: 'attempt',
            session: state.session,
            initialHz: event.initialHz,
            frequencyHz: event.initialHz,
          })
        : state;
    case 'SET_FREQUENCY':
      if (
        state.phase !== 'attempt' ||
        !isFrequencyInRange(
          event.frequencyHz,
          state.session.definition.rules.range,
        ) ||
        event.frequencyHz === state.frequencyHz
      )
        return state;
      return Object.freeze({ ...state, frequencyHz: event.frequencyHz });
    case 'CONFIRM_ATTEMPT': {
      if (state.phase !== 'attempt') return state;
      const attempt = Object.freeze({
        ...evaluateAttempt(
          getCurrentTarget(state.session),
          state.frequencyHz,
          state.session.definition.rules.zeroScoreDistanceCents,
        ),
        attemptIndex: state.session.attemptIndex,
      });
      const session: GameSession = Object.freeze({
        ...state.session,
        attempts: Object.freeze([...state.session.attempts, attempt]),
      });
      return transition(state, { phase: 'attempt-result', session });
    }
    case 'NEXT_ATTEMPT': {
      if (state.phase !== 'attempt-result') return state;
      const settings = getModeSettings(
        state.session.definition.selection,
        state.session.definition.rules,
      );
      if (state.session.attemptIndex + 1 >= settings.referencesPerRound)
        return state;
      const session = Object.freeze({
        ...state.session,
        attemptIndex: state.session.attemptIndex + 1,
      });
      return validInitial(session, event.initialHz)
        ? prepare(state, session, {
            destination: 'attempt',
            initialHz: event.initialHz,
          })
        : state;
    }
    case 'COMPLETE_ROUND': {
      if (state.phase !== 'attempt-result') return state;
      const settings = getModeSettings(
        state.session.definition.selection,
        state.session.definition.rules,
      );
      if (state.session.attempts.length !== settings.referencesPerRound)
        return state;
      const round = Object.freeze({
        roundIndex: state.session.roundIndex,
        attempts: state.session.attempts,
        score: meanScore(
          state.session.attempts.map((attempt) => attempt.score),
        ),
      });
      const session = Object.freeze({
        ...state.session,
        completedRounds: Object.freeze([
          ...state.session.completedRounds,
          round,
        ]),
      });
      return transition(state, { phase: 'round-result', session });
    }
    case 'NEXT_ROUND':
      if (
        state.phase !== 'round-result' ||
        state.session.roundIndex + 1 >= ROUND_COUNT
      )
        return state;
      return prepare(
        state,
        Object.freeze({
          ...state.session,
          roundIndex: state.session.roundIndex + 1,
          attemptIndex: 0,
          attempts: Object.freeze([]),
        }),
        { destination: 'countdown' },
      );
    case 'FINISH_GAME': {
      if (
        state.phase !== 'round-result' ||
        state.session.completedRounds.length !== ROUND_COUNT
      )
        return state;
      const result = Object.freeze({
        gameId: state.session.definition.id,
        modality: getModeSettings(
          state.session.definition.selection,
          state.session.definition.rules,
        ).modality,
        rules: state.session.definition.rules,
        rounds: state.session.completedRounds,
        score: totalScore(
          state.session.completedRounds.map((round) => round.score),
        ),
      });
      return transition(state, {
        phase: 'final-result',
        session: state.session,
        result,
      });
    }
    case 'RESUME':
      return state.phase === 'awaiting-resume'
        ? prepare(state, state.session, state.preparation)
        : state;
  }
}
