import type { Ref } from 'react';
import type { RoomView } from '../../multiplayer/protocol';
import { GameProgress } from '../components/GameProgress';
import { Icon } from '../components/Icon';
import { ParticipantList } from './ParticipantList';
import type { ParticipantStatus } from './ParticipantList';

/** Espera pelos demais, sem revelar palpites ou notas. */
export function WaitingScreen({
  room,
  me,
  forfeited,
  headingRef,
  onKick,
}: {
  readonly room: RoomView;
  readonly me: string | null;
  readonly forfeited: boolean;
  readonly headingRef: Ref<HTMLHeadingElement>;
  readonly onKick: (id: string) => void;
}) {
  const match = room.match;
  const total = match?.settings.referencesPerRound ?? 1;
  const progress = match?.progress ?? [];
  const finished = progress.filter((item) => item.status !== 'playing').length;
  const statusOf = (id: string): ParticipantStatus | null => {
    const item = progress.find((entry) => entry.playerId === id);
    if (!item) return null;
    if (item.status === 'completed') return { label: 'Concluiu', tone: 'done' };
    if (item.status === 'forfeited')
      return { label: 'Perdeu o round', tone: 'lost' };
    return {
      label:
        total > 1
          ? `Jogando · ${String(item.attemptsSubmitted)} de ${String(total)}`
          : 'Jogando',
      tone: 'playing',
    };
  };
  return (
    <section
      className="mp-screen mp-waiting screen-enter"
      aria-labelledby="mp-waiting-title"
    >
      <GameProgress
        roundIndex={match?.roundIndex ?? 0}
        attemptIndex={0}
        count={1}
      />
      <div className="mp-status-card" data-forfeited={forfeited}>
        <span className="icon-tile">
          <Icon name={forfeited ? 'remove' : 'check'} />
        </span>
        <div>
          <h2 id="mp-waiting-title" ref={headingRef} tabIndex={-1}>
            {forfeited ? 'Round perdido' : 'Palpites registrados'}
          </h2>
          <p>
            {forfeited
              ? 'Este round vale zero ponto para você. Aguarde os demais para seguir na partida.'
              : 'Aguardando os outros participantes. Os resultados aparecem quando todos terminarem.'}
          </p>
        </div>
      </div>
      <section
        className="mp-panel mp-progress"
        aria-labelledby="mp-progress-title"
      >
        <div className="mp-panel-heading">
          <h3 id="mp-progress-title">
            <Icon name="users" />
            Progresso do round
          </h3>
          <p>
            {finished} de {room.players.length} terminaram
          </p>
        </div>
        <ParticipantList
          players={room.players}
          hostId={room.hostId}
          me={me}
          label="Progresso dos participantes"
          statusOf={statusOf}
          canKick={me !== null && room.hostId === me}
          onKick={onKick}
        />
        {me !== null && room.hostId === me && (
          <p className="mp-note">
            Não há limite de tempo. Como host, você pode remover quem estiver
            parado.
          </p>
        )}
      </section>
    </section>
  );
}
