import type { ReactNode } from 'react';
import type { GameState } from '../../domain/models';
import { GameProgress } from '../components/GameProgress';
import { Icon } from '../components/Icon';
import { WaveArt } from '../components/WaveArt';
export function PlayingScreen({
  phase,
  countdown,
  roundIndex,
  attemptIndex,
  count,
  busy,
  controls,
  paused,
}: {
  readonly phase: GameState['phase'];
  readonly countdown: number | null;
  readonly roundIndex: number;
  readonly attemptIndex: number;
  readonly count: number;
  readonly busy: boolean;
  readonly controls: ReactNode;
  readonly paused: ReactNode;
}) {
  const title = busy
    ? 'Preparando…'
    : phase === 'countdown'
      ? 'Prepare-se para ouvir'
      : phase === 'references'
        ? 'Ouça e memorize'
        : 'Ouça o tom na memória';
  const description =
    phase === 'references'
      ? count > 1
        ? 'Memorize a sequência inteira. Ela não será repetida.'
        : 'Guarde este som na memória. Ele não será repetido.'
      : phase === 'attempt'
        ? 'O tom está tocando continuamente.'
        : 'A referência será apresentada uma única vez.';
  return (
    <section
      className="playing-screen screen-enter"
      aria-labelledby="game-title"
    >
      <div className="playing-status">
        <GameProgress
          roundIndex={roundIndex}
          attemptIndex={attemptIndex}
          count={count}
          showAttempts={phase === 'attempt' || phase === 'attempt-result'}
        />
        <div className="stage-message">
          <Icon name="target" />
          <div>
            <h3>{title}</h3>
            <p>{description}</p>
          </div>
        </div>
      </div>
      {phase === 'awaiting-resume' ? (
        paused
      ) : (
        <>
          <div className="playing-wave" aria-hidden="true">
            <WaveArt variant="mesh" className="playing-mesh" />
            <WaveArt
              variant="signal"
              active={phase === 'attempt' || phase === 'references'}
            />
            {phase === 'countdown' && (
              <div className="countdown-orb">{countdown ?? 3}</div>
            )}
          </div>
          {controls}
        </>
      )}
    </section>
  );
}
