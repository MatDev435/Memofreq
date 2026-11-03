import type { Ref } from 'react';
import type { RoomView } from '../../multiplayer/protocol';
import { Icon } from '../components/Icon';
import { ParticipantList } from './ParticipantList';

/** Confirmação de prontidão antes de cada round, com a lista de todos. */
export function ReadyPanel({
  room,
  me,
  pending,
  label,
  onReady,
  onKick,
  buttonRef,
}: {
  readonly room: RoomView;
  readonly me: string | null;
  readonly pending: boolean;
  readonly label: string;
  readonly onReady: () => void;
  readonly onKick: (id: string) => void;
  readonly buttonRef?: Ref<HTMLButtonElement>;
}) {
  const readyIds = room.match?.readyIds ?? [];
  const ready = pending || (me !== null && readyIds.includes(me));
  const isHost = me !== null && room.hostId === me;
  return (
    <section className="mp-panel mp-ready" aria-labelledby="mp-ready-title">
      <div className="mp-panel-heading">
        <h3 id="mp-ready-title">
          <Icon name="users" />
          Prontidão
        </h3>
        <p>
          {readyIds.length} de {room.players.length} prontos
        </p>
      </div>
      <ParticipantList
        players={room.players}
        hostId={room.hostId}
        me={me}
        label="Prontidão dos participantes"
        statusOf={(id) =>
          readyIds.includes(id)
            ? { label: 'Pronto', tone: 'ready' }
            : { label: 'Aguardando', tone: 'waiting' }
        }
        canKick={isHost}
        onKick={onKick}
      />
      <button
        ref={buttonRef}
        type="button"
        className="primary mp-ready-button"
        aria-disabled={ready}
        aria-describedby="mp-ready-note"
        onClick={() => {
          if (!ready) onReady();
        }}
      >
        <Icon name={ready ? 'check' : 'play'} />
        {ready ? 'Você está pronto' : label}
      </button>
      <p id="mp-ready-note" className="mp-note">
        {ready
          ? 'Aguardando os demais participantes. O round começa quando todos confirmarem.'
          : 'Confirmar também habilita o áudio. O round começa quando todos estiverem prontos.'}
      </p>
    </section>
  );
}
