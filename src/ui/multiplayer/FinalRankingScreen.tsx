import type { Ref } from 'react';
import { MAX_GAME_SCORE } from '../../domain/config';
import type { RoomView } from '../../multiplayer/protocol';
import { formatHz, formatNumber } from '../format';
import { Icon } from '../components/Icon';
import { ScoreRing } from '../components/ScoreRing';
import { WaveArt } from '../components/WaveArt';

/** Ranking calculado pelo servidor; a interface só apresenta. */
export function FinalRankingScreen({
  room,
  me,
  modeName,
  headingRef,
  onPlayAgain,
  onLeave,
}: {
  readonly room: RoomView;
  readonly me: string | null;
  readonly modeName: string;
  readonly headingRef: Ref<HTMLHeadingElement>;
  readonly onPlayAgain: () => void;
  readonly onLeave: () => void;
}) {
  const ranking = room.match?.ranking ?? [];
  const rounds = room.match?.rounds ?? [];
  const mine = ranking.find((entry) => entry.playerId === me);
  const isHost = me !== null && room.hostId === me;
  const tied = (position: number) =>
    ranking.filter((entry) => entry.position === position).length > 1;

  return (
    <section
      className="final-result mp-final screen-enter"
      aria-labelledby="final-title"
    >
      <div className="final-intro">
        <div>
          <p className="eyebrow">Partida concluída · {modeName}</p>
          <h2 ref={headingRef} tabIndex={-1} id="final-title">
            Ranking <span>final</span>
          </h2>
          <p>
            {ranking.length === 1
              ? 'Você completou os 5 rounds.'
              : `${String(ranking.length)} participantes completaram os 5 rounds.`}
          </p>
        </div>
        <WaveArt variant="hero" />
      </div>
      <div className="final-overview">
        <div className="final-total-card">
          <ScoreRing
            value={mine?.totalScore ?? 0}
            max={MAX_GAME_SCORE}
            showValue={false}
          >
            <Icon name="trophy" />
          </ScoreRing>
          <p className="total-score">
            <span>Sua pontuação</span>
            <strong>
              {formatNumber(mine?.totalScore ?? 0)}{' '}
              <small>/ {MAX_GAME_SCORE}</small>
            </strong>
          </p>
          {mine && (
            <div className="final-feedback">
              <span className="average-icon">
                <Icon name="crown" />
              </span>
              <div>
                <strong>
                  {mine.position}º lugar{tied(mine.position) ? ' (empate)' : ''}
                </strong>
                <p>
                  de {ranking.length}{' '}
                  {ranking.length === 1 ? 'participante' : 'participantes'}
                </p>
              </div>
            </div>
          )}
        </div>
        <section
          className="final-chart-card mp-ranking-card"
          aria-labelledby="mp-ranking-title"
        >
          <h3 id="mp-ranking-title">Classificação</h3>
          <p>Soma dos cinco rounds. Empates exatos dividem a posição.</p>
          <ol className="mp-ranking" aria-labelledby="mp-ranking-title">
            {ranking.map((entry) => (
              <li
                key={entry.playerId}
                data-self={entry.playerId === me}
                data-podium={entry.position <= 3 ? entry.position : undefined}
              >
                <span className="mp-rank-position" aria-hidden="true">
                  {entry.position}º
                </span>
                <span className="mp-rank-name">
                  <span className="sr-only">{entry.position}º lugar: </span>
                  <strong>{entry.name}</strong>
                  {entry.playerId === me && (
                    <span className="participant-tag">Você</span>
                  )}
                  {tied(entry.position) && (
                    <span className="participant-tag is-tie">Empate</span>
                  )}
                </span>
                <span className="mp-rank-bar" aria-hidden="true">
                  <span
                    style={{
                      width: `${String((entry.totalScore / MAX_GAME_SCORE) * 100)}%`,
                    }}
                  />
                </span>
                <span className="mp-rank-score">
                  <strong>{formatNumber(entry.totalScore)}</strong>
                  <small> / {MAX_GAME_SCORE}</small>
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>
      <div className="final-bottom">
        <div className="final-table-card mp-final-table">
          <div
            className="mp-table-scroll"
            role="region"
            aria-labelledby="mp-final-caption"
            tabIndex={0}
          >
            <table className="mp-table">
              <caption id="mp-final-caption">
                Pontuação dos rounds
                <small>Notas de 0 a 10 por round e total de 0 a 50.</small>
              </caption>
              <thead>
                <tr>
                  <th scope="col">Participante</th>
                  {[1, 2, 3, 4, 5].map((round) => (
                    <th scope="col" key={round}>
                      Round {round}
                    </th>
                  ))}
                  <th scope="col">Total</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((entry) => (
                  <tr key={entry.playerId} data-self={entry.playerId === me}>
                    <th scope="row">{entry.name}</th>
                    {entry.roundScores.map((score, index) => (
                      <td key={index}>{formatNumber(score)}</td>
                    ))}
                    <td className="mp-score-cell">
                      <strong>{formatNumber(entry.totalScore)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <details className="final-frequency-details">
            <summary>
              Consultar frequências dos rounds <Icon name="chevron" />
            </summary>
            {rounds.map((round) => (
              <section
                key={round.roundIndex}
                aria-labelledby={`mp-final-round-${String(round.roundIndex)}`}
              >
                <h3 id={`mp-final-round-${String(round.roundIndex)}`}>
                  Round {round.roundIndex + 1}
                </h3>
                <p className="mp-targets">
                  {round.references
                    .map(
                      (hz, index) =>
                        `${round.references.length > 1 ? `Frequência ${String(index + 1)}` : 'Alvo'}: ${formatHz(hz)}`,
                    )
                    .join(' · ')}
                </p>
                {round.players.map((player) => (
                  <dl key={player.playerId}>
                    <div>
                      <dt>{player.name}</dt>
                      <dd>
                        {player.status === 'forfeited'
                          ? 'Round perdido'
                          : player.attempts
                              .map((attempt) => formatHz(attempt.playerHz))
                              .join(' · ')}
                      </dd>
                    </div>
                    <div>
                      <dt>Nota</dt>
                      <dd>{formatNumber(player.score)}</dd>
                    </div>
                  </dl>
                ))}
              </section>
            ))}
          </details>
        </div>
        <div className="final-actions">
          {isHost ? (
            <button type="button" className="primary" onClick={onPlayAgain}>
              <Icon name="restart" />
              Jogar novamente
              <Icon name="arrow" />
            </button>
          ) : (
            <div className="mp-waiting-host">
              <Icon name="clock" />
              <span>
                <strong>Aguardando o host</strong>
                <span>Ele pode iniciar outra partida nesta sala.</span>
              </span>
            </div>
          )}
          <button type="button" className="final-home" onClick={onLeave}>
            <Icon name="home" />
            Sair e voltar ao menu
          </button>
          <div className="listening-note">
            <span className="headphone-orbit">
              <Icon name="users" />
            </span>
            <div>
              <strong>Mesma sala, mesmo convite</strong>
              <p>
                Ao jogar novamente, todos voltam ao lobby e novos amigos podem
                entrar pelo mesmo link.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
