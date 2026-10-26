import type { AttemptResult as AttemptData } from '../../domain/models';
import { formatHz, formatNumber } from '../format';

export function AttemptResult({
  result,
  multiple,
  roundComplete,
}: {
  readonly result: AttemptData;
  readonly multiple: boolean;
  readonly roundComplete: boolean;
}) {
  return (
    <section className="result-card" aria-labelledby="result-title">
      <h2 id="result-title">
        {roundComplete ? 'Resultado do round' : 'Resultado da tentativa'}
      </h2>
      <dl className="result-details">
        <div>
          <dt>Frequência alvo</dt>
          <dd>{formatHz(result.targetHz)}</dd>
        </div>
        <div>
          <dt>Sua frequência</dt>
          <dd>{formatHz(result.playerHz)}</dd>
        </div>
        <div>
          <dt>Diferença</dt>
          <dd>{formatHz(result.differenceHz)}</dd>
        </div>
        <div className="score-row">
          <dt>{multiple ? 'Pontuação da tentativa' : 'Pontuação do round'}</dt>
          <dd>
            {formatNumber(result.score)} <span>/ 10</span>
          </dd>
        </div>
      </dl>
      <p className="muted">
        Tentativa registrada. A resposta não pode ser alterada.
      </p>
    </section>
  );
}
