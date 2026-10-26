import { useId } from 'react';
import type { RoundResult } from '../../domain/models';
import { MAX_ROUND_SCORE } from '../../domain/config';
import { formatNumber } from '../format';

const plot = { left: 36, top: 36, width: 356, height: 164 };

export function RoundScores({
  rounds,
}: {
  readonly rounds: readonly RoundResult[];
}) {
  const id = useId();
  const columnWidth = plot.width / rounds.length;
  const bottom = plot.top + plot.height;
  return (
    <div className="round-scores">
      <figure className="round-chart">
        <figcaption>Comparação dos rounds</figcaption>
        <svg
          viewBox="0 0 400 250"
          role="img"
          aria-labelledby={`${id}-title`}
          aria-describedby={`${id}-description`}
        >
          <title id={`${id}-title`}>Gráfico de pontuação dos rounds</title>
          <desc id={`${id}-description`}>
            Cinco barras, uma por round, com escala fixa de zero a dez pontos.
            Os valores também estão na tabela a seguir.
          </desc>
          {[0, 2, 4, 6, 8, MAX_ROUND_SCORE].map((tick) => {
            const y = bottom - (tick / MAX_ROUND_SCORE) * plot.height;
            return (
              <g className="chart-tick" key={tick}>
                <line
                  x1={plot.left}
                  x2={plot.left + plot.width}
                  y1={y}
                  y2={y}
                />
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
                  {round.roundIndex + 1}
                </text>
              </g>
            );
          })}
          <text
            className="chart-axis-label"
            x="214"
            y="246"
            textAnchor="middle"
          >
            Round
          </text>
        </svg>
      </figure>
      <table>
        <caption>Pontuação dos rounds</caption>
        <thead>
          <tr>
            <th scope="col">Round</th>
            <th scope="col">Pontos de 10</th>
          </tr>
        </thead>
        <tbody>
          {rounds.map((round) => (
            <tr key={round.roundIndex}>
              <th scope="row">{round.roundIndex + 1}</th>
              <td>{formatNumber(round.score)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
