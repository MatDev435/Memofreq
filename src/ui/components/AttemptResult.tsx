import type { AttemptResult as AttemptData } from '../../domain/models';
import { formatHz, formatNumber } from '../format';
import { ScoreRing } from './ScoreRing';
import type { FrequencyRange } from '../../domain/config';
import { FrequencyRuler } from './FrequencyRuler';
import { ComparisonButton } from './ComparisonButton';
import { useComparisonPart } from './useComparisonPart';
import type { ComparisonControl } from './useComparisonPart';

export function AttemptDetails({
  result,
  multiple = false,
}: {
  readonly result: AttemptData;
  readonly multiple?: boolean;
}) {
  return (
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
        <dd>
          {formatHz(result.differenceHz)}
          <small>({formatNumber(result.distanceCents)} cents)</small>
        </dd>
      </div>
      <div className="score-row">
        <dt>{multiple ? 'Pontuação da tentativa' : 'Pontuação do round'}</dt>
        <dd>
          <ScoreRing value={result.score} />
        </dd>
      </div>
    </dl>
  );
}

export function AttemptResult({
  result,
  count = 1,
  range,
  comparison,
}: {
  readonly result: AttemptData;
  readonly count?: number;
  readonly range?: FrequencyRange | undefined;
  readonly comparison?: ComparisonControl | undefined;
}) {
  const part = useComparisonPart(comparison?.playing ?? null);
  return (
    <section
      className={`round-attempt attempt-color-${String(result.attemptIndex)}`}
      aria-labelledby={`attempt-result-${String(result.attemptIndex)}`}
    >
      <h3 id={`attempt-result-${String(result.attemptIndex)}`}>
        <span className="attempt-badge" aria-hidden="true">
          {result.attemptIndex + 1}
        </span>
        Frequência {result.attemptIndex + 1} de {count}
      </h3>
      <AttemptDetails result={result} multiple={count > 1} />
      <FrequencyRuler
        targetHz={result.targetHz}
        playerHz={result.playerHz}
        range={range}
        playing={part}
      />
      {comparison && (
        <ComparisonButton
          control={comparison}
          part={part}
          label={
            count > 1 ? ` da frequência ${String(result.attemptIndex + 1)}` : ''
          }
        />
      )}
    </section>
  );
}
