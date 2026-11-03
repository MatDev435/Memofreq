import type { Ref } from 'react';
import { reasonMessage } from '../../multiplayer/messages';
import type { MultiplayerReason } from '../../multiplayer/messages';
import { Icon } from '../components/Icon';

function title(reason: MultiplayerReason): string {
  switch (reason) {
    case 'kicked':
      return 'Você foi removido da sala';
    case 'inactive':
      return 'Conexão inativa';
    case 'connection-lost':
      return 'Conexão perdida';
    case 'room-closed':
      return 'Sala encerrada';
    default:
      return 'Você saiu da sala';
  }
}

/** Participação perdida: sem reconexão, com caminhos claros de saída. */
export function ExitScreen({
  reason,
  headingRef,
  onEntry,
  onMenu,
}: {
  readonly reason: MultiplayerReason;
  readonly headingRef: Ref<HTMLHeadingElement>;
  readonly onEntry: () => void;
  readonly onMenu: () => void;
}) {
  return (
    <section
      className="interrupted-panel mp-exit screen-enter"
      aria-labelledby="mp-exit-title"
    >
      <span className="icon-tile">
        <Icon name="exit" />
      </span>
      <h2 id="mp-exit-title" ref={headingRef} tabIndex={-1}>
        {title(reason)}
      </h2>
      <p>
        {reasonMessage(reason)} Durante uma partida, só é possível voltar quando
        a sala retornar ao lobby.
      </p>
      <div className="button-row">
        <button type="button" className="primary" onClick={onEntry}>
          <Icon name="users" />
          Entrar em outra sala
        </button>
        <button type="button" className="secondary" onClick={onMenu}>
          <Icon name="home" />
          Voltar ao menu
        </button>
      </div>
    </section>
  );
}
