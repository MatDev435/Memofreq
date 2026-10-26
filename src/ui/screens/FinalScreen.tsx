import type { Ref } from 'react';
import type { GameResult } from '../../domain/models';
import { MAX_GAME_SCORE } from '../../domain/config';
import { formatHz, formatNumber } from '../format';
import { Icon } from '../components/Icon';
import { ScoreRing } from '../components/ScoreRing';
import { RoundChart, RoundScoreTable } from '../components/RoundScores';
import { WaveArt } from '../components/WaveArt';

export function FinalScreen({
  result,
  titleRef,
  busy,
  onRestart,
  onLeave,
}: {
  readonly result: GameResult;
  readonly titleRef: Ref<HTMLHeadingElement>;
  readonly busy: boolean;
  readonly onRestart: () => void;
  readonly onLeave: () => void;
}) {
  return (
    <section
      className="final-result screen-enter"
      aria-labelledby="final-title"
    >
      <div className="final-intro">
        <div>
          <p className="eyebrow">Partida concluída</p>
          <h2
            ref={titleRef}
            tabIndex={-1}
            id="final-title"
            aria-label="Resultado da partida"
          >
            Resultado <span>final</span>
          </h2>
          <p>Você completou os 5 rounds. Veja seu desempenho:</p>
        </div>
        <WaveArt variant="hero" />
      </div>
      <div className="final-overview">
        <div className="final-total-card">
          <ScoreRing
            value={result.score}
            max={MAX_GAME_SCORE}
            showValue={false}
          >
            <Icon name="trophy" />
          </ScoreRing>
          <p className="total-score">
            <span>Pontuação final</span>
            <strong>
              {formatNumber(result.score)} <small>/ {MAX_GAME_SCORE}</small>
            </strong>
          </p>
          <div className="final-feedback">
            <span className="average-icon">
              <Icon name="bars" />
            </span>
            <div>
              <strong>
                {result.score >= 40
                  ? 'Excelente escuta!'
                  : 'Continue evoluindo!'}
              </strong>
              <p>Continue praticando para melhorar sua percepção dos tons.</p>
            </div>
          </div>
        </div>
        <div className="final-chart-card">
          <RoundChart rounds={result.rounds} />
        </div>
      </div>
      <div className="final-bottom">
        <div className="final-table-card">
          <RoundScoreTable rounds={result.rounds} detailed />
          <details className="final-frequency-details">
            <summary>
              Consultar frequências dos rounds <Icon name="chevron" />
            </summary>
            {result.rounds.map((round) => (
              <section
                key={round.roundIndex}
                aria-labelledby={`final-round-${String(round.roundIndex)}`}
              >
                <h3 id={`final-round-${String(round.roundIndex)}`}>
                  Round {round.roundIndex + 1}
                </h3>
                {round.attempts.map((attempt) => (
                  <dl key={attempt.attemptIndex}>
                    <div>
                      <dt>Frequência {attempt.attemptIndex + 1} · alvo</dt>
                      <dd>{formatHz(attempt.targetHz)}</dd>
                    </div>
                    <div>
                      <dt>Seu palpite</dt>
                      <dd>{formatHz(attempt.playerHz)}</dd>
                    </div>
                    <div>
                      <dt>Diferença</dt>
                      <dd>
                        {formatHz(attempt.differenceHz)} (
                        {formatNumber(attempt.distanceCents)} cents)
                      </dd>
                    </div>
                  </dl>
                ))}
              </section>
            ))}
          </details>
        </div>
        <div className="final-actions">
          <button
            type="button"
            className="primary"
            disabled={busy}
            onClick={onRestart}
          >
            <Icon name="restart" />
            Jogar novamente
            <Icon name="arrow" />
          </button>
          <button
            type="button"
            className="final-home"
            disabled={busy}
            onClick={onLeave}
          >
            <Icon name="home" />
            Voltar ao início
          </button>
          <div className="listening-note">
            <span className="headphone-orbit">
              <Icon name="headphones" />
            </span>
            <div>
              <strong>Continue evoluindo!</strong>
              <p>
                Use fones de ouvido e um ambiente silencioso para obter melhores
                resultados.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
