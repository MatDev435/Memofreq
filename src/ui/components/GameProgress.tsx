import { Icon } from './Icon';
export function GameProgress({
  roundIndex,
  attemptIndex,
  count,
  showAttempts = false,
}: {
  readonly roundIndex: number;
  readonly attemptIndex: number;
  readonly count: number;
  readonly showAttempts?: boolean;
}) {
  return (
    <div
      className={`game-progress${showAttempts && count > 1 ? ' has-attempts' : ''}`}
    >
      <div className="round-progress">
        <p>Round {roundIndex + 1} de 5</p>
        <ol className="progress-dots" aria-hidden="true">
          {Array.from({ length: 5 }, (_, i) => (
            <li
              key={i}
              className={
                i < roundIndex
                  ? 'is-done'
                  : i === roundIndex
                    ? 'is-current'
                    : ''
              }
            >
              <span />
            </li>
          ))}
        </ol>
      </div>
      {showAttempts && count > 1 && (
        <div className="attempt-progress">
          <p>
            Frequência {attemptIndex + 1} de {count}
          </p>
          <ol className="progress-dots" aria-hidden="true">
            {Array.from({ length: count }, (_, i) => (
              <li
                key={i}
                className={
                  i < attemptIndex
                    ? 'is-done'
                    : i === attemptIndex
                      ? 'is-current'
                      : ''
                }
              >
                <span>{i < attemptIndex ? <Icon name="check" /> : i + 1}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
