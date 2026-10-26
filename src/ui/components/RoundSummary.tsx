import type { ReactNode } from 'react';
import type { RoundResult } from '../../domain/models';
import { formatNumber } from '../format';
import { AttemptResult } from './AttemptResult';
import { GameProgress } from './GameProgress';
import { Icon } from './Icon';
import { WaveArt } from './WaveArt';

export function RoundSummary({
  round,
  next,
}: {
  readonly round: RoundResult;
  readonly next?: ReactNode;
}) {
  const multiple = round.attempts.length > 1;
  const scoreLabel = multiple ? 'Média do round' : 'Pontuação do round';
  return (
    <section
      className="round-result-screen screen-enter"
      aria-labelledby="round-result-title"
    >
      <div className="round-intro">
        <GameProgress
          roundIndex={round.roundIndex}
          attemptIndex={0}
          count={round.attempts.length}
        />
        <div className="round-intro-copy">
          <h2 id="round-result-title" className="eyebrow">
            Resultado do round
          </h2>
          <p className="result-question">
            Você conseguiu encontrar {multiple ? 'os tons' : 'o tom'}?
          </p>
          <p className="result-subtitle">
            Veja abaixo o resultado{' '}
            {multiple ? 'das frequências' : 'da frequência'} deste round.
          </p>
        </div>
        <div className="round-average">
          <span className="average-icon">
            <Icon name="bars" />
          </span>
          <h3>
            {scoreLabel}:{' '}
            <strong>
              {formatNumber(round.score)} <small>/ 10</small>
            </strong>
          </h3>
          <WaveArt variant="mini" />
        </div>
      </div>
      <div className={`attempt-cards count-${String(round.attempts.length)}`}>
        {round.attempts.map((attempt) => (
          <AttemptResult
            key={attempt.attemptIndex}
            result={attempt}
            count={round.attempts.length}
          />
        ))}
      </div>
      <div className="round-feedback">
        <span className="feedback-icon">
          <Icon name="trophy" />
        </span>
        <div>
          <p>
            <strong>
              {scoreLabel}: {formatNumber(round.score)} / 10
            </strong>
          </p>
          <p>
            {round.score >= 8
              ? 'Ótima escuta! Você chegou bem perto dos sons que memorizou.'
              : round.score >= 5
                ? 'Bom trabalho! Continue treinando sua memória auditiva.'
                : 'Algumas diferenças foram grandes. Continue treinando sua atenção aos tons.'}
          </p>
        </div>
      </div>
      <div className="round-actions">
        <details className="technical-details">
          <summary>
            <Icon name="back" />
            Ver detalhes técnicos
          </summary>
          <p>
            A diferença em Hz é absoluta. A distância em cents compara as
            frequências na escala perceptual; quanto menor, maior a nota.{' '}
            {multiple
              ? 'A pontuação do round é a média das tentativas.'
              : 'A pontuação do round corresponde à única tentativa.'}{' '}
            Os cálculos preservam a precisão; apenas os textos são arredondados.
            Respostas registradas não podem ser alteradas.
          </p>
        </details>
        {next}
      </div>
    </section>
  );
}
