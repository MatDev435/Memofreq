import type { RoundResult } from '../../domain/models';
import { formatNumber } from '../format';

export function RoundSummary({ round }: { readonly round: RoundResult }) {
  return (
    <section aria-labelledby="round-summary-title">
      <h3 id="round-summary-title">
        Média do round: {formatNumber(round.score)} / 10
      </h3>
      <table>
        <caption>Tentativas do round</caption>
        <thead>
          <tr>
            <th scope="col">Tentativa</th>
            <th scope="col">Pontos de 10</th>
          </tr>
        </thead>
        <tbody>
          {round.attempts.map((attempt) => (
            <tr key={attempt.attemptIndex}>
              <th scope="row">Frequência {attempt.attemptIndex + 1}</th>
              <td>{formatNumber(attempt.score)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
