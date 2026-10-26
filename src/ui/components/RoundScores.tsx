import { useId } from 'react';
import type { RoundResult } from '../../domain/models';
import { MAX_ROUND_SCORE } from '../../domain/config';
import { formatNumber } from '../format';

const plot = { left: 36, top: 36, width: 556, height: 164 };

export function RoundChart({
  rounds,
}: {
  readonly rounds: readonly RoundResult[];
}) {
  const id = useId();
  const columnWidth = plot.width / rounds.length;
  const bottom = plot.top + plot.height;
  return (
    <figure className="round-chart">
      <figcaption>Desempenho por round</figcaption>
      <p>Veja como foi sua pontuação em cada um dos 5 rounds.</p>
      <svg
        viewBox="0 0 600 250"
        role="img"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-description`}
      >
        <title id={`${id}-title`}>Gráfico de pontuação dos rounds</title>
        <desc id={`${id}-description`}>
          Cinco barras, uma por round, com escala fixa de zero a dez pontos. Os
          valores também estão na tabela a seguir.
        </desc>
        <defs>
          {['#9d49ff', '#ac48ff', '#5f63ff', '#338dff', '#12d9f0'].map(
            (color, i) => (
              <linearGradient
                id={`${id}-bar-${String(i)}`}
                key={color}
                x1="0"
                x2="0"
                y1="0"
                y2="1"
              >
                <stop stopColor={color} />
                <stop offset="1" stopColor={color} stopOpacity=".22" />
              </linearGradient>
            ),
          )}
        </defs>
        {[0, 2, 4, 6, 8, MAX_ROUND_SCORE].map((tick) => {
          const y = bottom - (tick / MAX_ROUND_SCORE) * plot.height;
          return (
            <g className="chart-tick" key={tick}>
              <line x1={plot.left} x2={plot.left + plot.width} y1={y} y2={y} />
              <text x={plot.left - 8} y={y + 5} textAnchor="end">
                {tick}
              </text>
            </g>
          );
        })}
        {rounds.map((round, index) => {
          const height = (round.score / MAX_ROUND_SCORE) * plot.height;
          const center = plot.left + columnWidth * (index + 0.5);
          return (
            <g className="round-bar" key={round.roundIndex}>
              <rect
                rx="2"
                style={{
                  fill: `url(#${id}-bar-${String(index)})`,
                  stroke: [
                    '#b16aff',
                    '#bc6dff',
                    '#8388ff',
                    '#62adff',
                    '#2ae5f6',
                  ][index],
                }}
                x={center - columnWidth * 0.3}
                y={bottom - height}
                width={columnWidth * 0.6}
                height={height}
              />
              <text
                className="chart-score"
                x={center}
                y={bottom - height - 8}
                textAnchor="middle"
              >
                {formatNumber(round.score)}
              </text>
              <text x={center} y={bottom + 24} textAnchor="middle">
                Round {round.roundIndex + 1}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

export function RoundScoreTable({
  rounds,
  detailed = false,
}: {
  readonly rounds: readonly RoundResult[];
  readonly detailed?: boolean;
}) {
  const count = detailed ? (rounds[0]?.attempts.length ?? 1) : 1;
  return (
    <table>
      <caption>
        Pontuação dos rounds
        {detailed && (
          <small aria-hidden="true">
            Detalhe da sua pontuação em cada round.
          </small>
        )}
      </caption>
      <thead>
        <tr>
          <th scope="col">Round</th>
          {count > 1 &&
            Array.from({ length: count }, (_, i) => (
              <th
                scope="col"
                key={i}
                aria-label={`Frequência ${String(i + 1)} · pontos de 10`}
              >
                <span className="frequency-heading-full">
                  Frequência {i + 1}
                </span>
                <span className="frequency-heading-short" aria-hidden="true">
                  Freq. {i + 1}
                </span>
                <small>pontos de 10</small>
              </th>
            ))}
          <th scope="col">{count > 1 ? 'Média do round' : 'Pontos de 10'}</th>
        </tr>
      </thead>
      <tbody>
        {rounds.map((round) => (
          <tr key={round.roundIndex}>
            <th scope="row">{round.roundIndex + 1}</th>
            {count > 1 &&
              round.attempts.map((attempt) => (
                <td key={attempt.attemptIndex}>
                  {formatNumber(attempt.score)}
                </td>
              ))}
            <td className="round-score-value">{formatNumber(round.score)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function RoundScores({
  rounds,
}: {
  readonly rounds: readonly RoundResult[];
}) {
  return (
    <div className="round-scores">
      <RoundChart rounds={rounds} />
      <RoundScoreTable rounds={rounds} />
    </div>
  );
}
