import type { GameRules, ModeSelection, Modality } from './config';
import type { FrequencyScore } from './scoring';

export interface RoundDefinition {
  readonly references: readonly number[];
}

export interface GameDefinition {
  readonly id: string;
  readonly selection: ModeSelection;
  readonly rules: GameRules;
  readonly rounds: readonly RoundDefinition[];
}

export interface AttemptResult extends FrequencyScore {
  readonly attemptIndex: number;
}

export interface RoundResult {
  readonly roundIndex: number;
  readonly attempts: readonly AttemptResult[];
  readonly score: number;
}

export interface GameResult {
  readonly gameId: string;
  readonly modality: Modality;
  readonly rules: GameRules;
  readonly rounds: readonly RoundResult[];
  readonly score: number;
}

export interface GameSession {
  readonly definition: GameDefinition;
  readonly roundIndex: number;
  readonly attemptIndex: number;
  readonly attempts: readonly AttemptResult[];
  readonly completedRounds: readonly RoundResult[];
}

export type Preparation =
  | { readonly destination: 'countdown' }
  | { readonly destination: 'attempt'; readonly initialHz: number };

export type InterruptionReason =
  'page-hidden' | 'audio-suspended' | 'audio-failed';

export type GamePhase =
  | { readonly phase: 'home' }
  | {
      readonly phase: 'preparing-audio';
      readonly session: GameSession;
      readonly preparation: Preparation;
    }
  | {
      readonly phase: 'awaiting-resume';
      readonly session: GameSession;
      readonly preparation: Preparation;
    }
  | { readonly phase: 'countdown'; readonly session: GameSession }
  | { readonly phase: 'references'; readonly session: GameSession }
  | { readonly phase: 'attempt-result'; readonly session: GameSession }
  | { readonly phase: 'round-result'; readonly session: GameSession }
  | {
      readonly phase: 'attempt';
      readonly session: GameSession;
      readonly initialHz: number;
      readonly frequencyHz: number;
    }
  | {
      readonly phase: 'final-result';
      readonly session: GameSession;
      readonly result: GameResult;
    }
  | {
      readonly phase: 'interrupted';
      readonly session: GameSession;
      readonly reason: InterruptionReason;
    };

export type GameState = GamePhase & {
  readonly executionId: number;
  readonly pageVisible: boolean;
};

export interface EventContext {
  readonly gameId: string | null;
  readonly executionId: number;
}

export type GameAction =
  | { readonly type: 'START_GAME'; readonly definition: GameDefinition }
  | {
      readonly type:
        | 'AUDIO_READY'
        | 'COUNTDOWN_FINISHED'
        | 'CONFIRM_ATTEMPT'
        | 'COMPLETE_ROUND'
        | 'NEXT_ROUND'
        | 'FINISH_GAME'
        | 'RESUME'
        | 'RETURN_HOME';
    }
  | {
      readonly type: 'REFERENCES_FINISHED' | 'NEXT_ATTEMPT';
      readonly initialHz: number;
    }
  | { readonly type: 'SET_FREQUENCY'; readonly frequencyHz: number }
  | {
      readonly type: 'VISIBILITY_CHANGED';
      readonly visible: boolean;
      readonly referenceStarted: boolean;
    }
  | {
      readonly type: 'AUDIO_INTERRUPTED';
      readonly reason: 'audio-suspended' | 'audio-failed';
      readonly referenceStarted: boolean;
    };

export type GameEvent = EventContext & GameAction;
