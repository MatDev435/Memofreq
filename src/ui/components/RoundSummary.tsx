import type { RoundResult } from '../../domain/models';
import { formatNumber } from '../format';
import { AttemptDetails } from './AttemptResult';

export function RoundSummary({ round }: { readonly round: RoundResult }) {
  return (
    <section className="result-card" aria-labelledby="round-result-title">
      <h2 id="round-result-title">Resultado do round</h2>
      <h3>Média do round: {formatNumber(round.score)} / 10</h3>
      {round.attempts.map((attempt) => (
        <section
          className="round-attempt"
          key={attempt.attemptIndex}
          aria-labelledby={`attempt-result-${String(attempt.attemptIndex)}`}
        >
          <h3 id={`attempt-result-${String(attempt.attemptIndex)}`}>
            Frequência {attempt.attemptIndex + 1} de {round.attempts.length}
          </h3>
          <AttemptDetails result={attempt} multiple />
        </section>
      ))}
      <p className="muted">
        Palpites registrados. As respostas não podem ser alteradas.
      </p>
    </section>
  );
}
