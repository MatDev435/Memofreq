import type { Ref } from 'react';
import type { RoomView } from '../../multiplayer/protocol';
import { GameProgress } from '../components/GameProgress';
import { Icon } from '../components/Icon';
import { ReadyPanel } from './ReadyPanel';

/** Prontidão antes do primeiro round. */
export function ReadyScreen({
  room,
  me,
  pending,
  modeName,
  headingRef,
  onReady,
  onKick,
}: {
  readonly room: RoomView;
  readonly me: string | null;
  readonly pending: boolean;
  readonly modeName: string;
  readonly headingRef: Ref<HTMLHeadingElement>;
  readonly onReady: () => void;
  readonly onKick: (id: string) => void;
}) {
  const roundIndex = room.match?.roundIndex ?? 0;
  return (
    <section
      className="mp-screen mp-ready-screen screen-enter"
      aria-labelledby="mp-ready-screen-title"
    >
      <GameProgress roundIndex={roundIndex} attemptIndex={0} count={1} />
      <div className="mp-intro">
        <div>
          <p className="eyebrow">Partida iniciada · {modeName}</p>
          <h2 id="mp-ready-screen-title" ref={headingRef} tabIndex={-1}>
            Prepare-se para o round {roundIndex + 1}
          </h2>
          <p>
            Todos ouvirão as mesmas frequências. Cada um ajusta o próprio tom e
            os palpites só aparecem quando todos terminarem.
          </p>
        </div>
      </div>
      <div className="mp-split">
        <ReadyPanel
          room={room}
          me={me}
          pending={pending}
          label="Estou pronto"
          onReady={onReady}
          onKick={onKick}
        />
        <aside className="mp-panel mp-tips" aria-labelledby="mp-tips-title">
          <div className="mp-panel-heading">
            <h3 id="mp-tips-title">
              <Icon name="headphones" />
              Antes de começar
            </h3>
          </div>
          <ul>
            <li>Use fones e ajuste o volume no topo da tela.</li>
            <li>A referência toca uma única vez, sem repetição.</li>
            <li>
              Se trocar de aba durante a referência, você perde o round. Durante
              o ajuste, a tentativa fica suspensa até você retomar.
            </li>
          </ul>
        </aside>
      </div>
    </section>
  );
}
