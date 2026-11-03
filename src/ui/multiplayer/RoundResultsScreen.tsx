import type { Ref } from 'react';
import type { RoomView, RoundResultsView } from '../../multiplayer/protocol';
import { formatHz, formatNumber } from '../format';
import { AttemptResult } from '../components/AttemptResult';
import { GameProgress } from '../components/GameProgress';
import { Icon } from '../components/Icon';
import { WaveArt } from '../components/WaveArt';
import { ReadyPanel } from './ReadyPanel';

/** Tabela comparativa de um round, com valores consolidados pelo servidor. */
export function RoundTable({
  results,
  me,
  captionId,
}: {
  readonly results: RoundResultsView;
  readonly me: string | null;
  readonly captionId: string;
}) {
  const count = results.references.length;
  const multiple = count > 1;
  return (
    <div
      className="mp-table-scroll"
      role="region"
      aria-labelledby={captionId}
      tabIndex={0}
    >
      <table className="mp-table">
        <caption id={captionId}>
          Palpites do round {results.roundIndex + 1}
        </caption>
        <thead>
          <tr>
            <th scope="col">Participante</th>
            {results.references.map((targetHz, index) => (
              <th scope="col" key={index}>
                {multiple ? `Frequência ${String(index + 1)}` : 'Palpite'}
                <small>Alvo {formatHz(targetHz)}</small>
              </th>
            ))}
            <th scope="col">{multiple ? 'Média do round' : 'Nota do round'}</th>
          </tr>
        </thead>
        <tbody>
          {results.players.map((player) => (
            <tr key={player.playerId} data-self={player.playerId === me}>
              <th scope="row">
                {player.name}
                {player.playerId === me && (
                  <span className="participant-tag">Você</span>
                )}
              </th>
              {player.status === 'forfeited' ? (
                <td colSpan={count} className="mp-forfeit-cell">
                  Round perdido
                </td>
              ) : (
                player.attempts.map((attempt) => (
                  <td key={attempt.attemptIndex}>
                    <span>{formatHz(attempt.playerHz)}</span>
                    <small>
                      {formatNumber(attempt.score)} pts ·{' '}
                      {formatNumber(attempt.distanceCents)} cents
                    </small>
                  </td>
                ))
              )}
              <td className="mp-score-cell">
                <strong>{formatNumber(player.score)}</strong>
                <small> / 10</small>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RoundResultsScreen({
  room,
  me,
  pending,
  headingRef,
  onReady,
  onKick,
}: {
  readonly room: RoomView;
  readonly me: string | null;
  readonly pending: boolean;
  readonly headingRef: Ref<HTMLHeadingElement>;
  readonly onReady: () => void;
  readonly onKick: (id: string) => void;
}) {
  const results = room.match?.lastRound;
  if (!results) return null;
  const count = results.references.length;
  const mine = results.players.find((player) => player.playerId === me);
  const multiple = count > 1;
  return (
    <section
      className="round-result-screen mp-results screen-enter"
      aria-labelledby="round-result-title"
    >
      <div className="round-intro">
        <GameProgress
          roundIndex={results.roundIndex}
          attemptIndex={0}
          count={count}
        />
        <div className="round-intro-copy">
          <h2
            id="round-result-title"
            className="eyebrow"
            ref={headingRef}
            tabIndex={-1}
          >
            Resultado do round {results.roundIndex + 1}
          </h2>
          <p className="result-question">Como todos se saíram?</p>
          <p className="result-subtitle">
            Compare {multiple ? 'as frequências' : 'a frequência'} e os palpites
            de cada participante.
          </p>
        </div>
        <div className="round-average">
          <span className="average-icon">
            <Icon name="bars" />
          </span>
          <h3>
            {mine?.status === 'forfeited'
              ? 'Você perdeu este round'
              : multiple
                ? 'Sua média no round:'
                : 'Sua nota no round:'}{' '}
            <strong>
              {formatNumber(mine?.score ?? 0)} <small>/ 10</small>
            </strong>
          </h3>
          <WaveArt variant="mini" />
        </div>
      </div>
      {mine?.status === 'completed' && (
        <div className={`attempt-cards count-${String(count)}`}>
          {mine.attempts.map((attempt) => (
            <AttemptResult
              key={attempt.attemptIndex}
              result={attempt}
              count={count}
            />
          ))}
        </div>
      )}
      <section
        className="mp-panel mp-round-table"
        aria-labelledby="mp-round-table-title"
      >
        <div className="mp-panel-heading">
          <h3 id="mp-round-table-title">
            <Icon name="users" />
            Todos os participantes
          </h3>
          <p>Notas de 0 a 10 calculadas pelo servidor</p>
        </div>
        <RoundTable results={results} me={me} captionId="mp-round-caption" />
      </section>
      <ReadyPanel
        room={room}
        me={me}
        pending={pending}
        label={`Pronto para o round ${String(results.roundIndex + 2)}`}
        onReady={onReady}
        onKick={onKick}
      />
    </section>
  );
}
