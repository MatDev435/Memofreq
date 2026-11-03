import { useRef, useState } from 'react';
import type { Ref } from 'react';
import type { ModeSelection } from '../../domain/config';
import { MAX_PLAYERS } from '../../multiplayer/protocol';
import type { RoomView } from '../../multiplayer/protocol';
import { Icon } from '../components/Icon';
import { ModeSelector } from '../components/ModeSelector';
import { ParticipantList } from './ParticipantList';

export function LobbyScreen({
  room,
  me,
  inviteLink,
  headingRef,
  onSetMode,
  onStart,
  onKick,
}: {
  readonly room: RoomView;
  readonly me: string | null;
  readonly inviteLink: string;
  readonly headingRef: Ref<HTMLHeadingElement>;
  readonly onSetMode: (selection: ModeSelection) => void;
  readonly onStart: () => void;
  readonly onKick: (id: string) => void;
}) {
  const isHost = me !== null && room.hostId === me;
  const selection = room.selection;
  // Preferência local do host para quando o Extreme for escolhido.
  const [count, setCount] = useState<2 | 3>(2);
  const [copyStatus, setCopyStatus] = useState('');
  const linkRef = useRef<HTMLInputElement>(null);
  const frequencyCount =
    selection.mode === 'extreme' ? selection.frequencyCount : count;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopyStatus('Link de convite copiado.');
    } catch {
      linkRef.current?.select();
      setCopyStatus(
        'Não foi possível copiar automaticamente. O link foi selecionado para você copiar.',
      );
    }
  };

  return (
    <section
      className="mp-screen mp-lobby screen-enter"
      aria-labelledby="mp-lobby-title"
    >
      <div className="mp-intro">
        <div>
          <p className="eyebrow">Sala multiplayer</p>
          <h2 id="mp-lobby-title" ref={headingRef} tabIndex={-1}>
            Lobby
          </h2>
          <p>
            {isHost
              ? 'Convide seus amigos, escolha o modo e inicie quando todos estiverem aqui.'
              : 'Aguarde o host escolher o modo e iniciar a partida.'}
          </p>
        </div>
      </div>
      <div className="mp-lobby-grid">
        <section
          className="mp-panel mp-invite"
          aria-labelledby="mp-invite-title"
        >
          <div className="mp-panel-heading">
            <h3 id="mp-invite-title">
              <Icon name="link" />
              Convite
            </h3>
          </div>
          <p className="mp-code-label">Código da sala</p>
          <p className="mp-code">{room.code}</p>
          <label htmlFor="mp-invite-link">Link de convite</label>
          <div className="mp-invite-row">
            <input
              ref={linkRef}
              id="mp-invite-link"
              type="text"
              readOnly
              value={inviteLink}
              onFocus={(event) => {
                event.currentTarget.select();
              }}
            />
            <button
              type="button"
              className="secondary"
              onClick={() => {
                void copy();
              }}
            >
              <Icon name="copy" />
              Copiar convite
            </button>
          </div>
          <p className="mp-copy-status" role="status">
            {copyStatus}
          </p>
        </section>
        <section
          className="mp-panel mp-players"
          aria-labelledby="mp-players-title"
        >
          <div className="mp-panel-heading">
            <h3 id="mp-players-title">
              <Icon name="users" />
              Participantes
            </h3>
            <p>
              {room.players.length} de {MAX_PLAYERS}
            </p>
          </div>
          <ParticipantList
            players={room.players}
            hostId={room.hostId}
            me={me}
            label="Participantes da sala"
            canKick={isHost}
            onKick={onKick}
          />
        </section>
      </div>
      <ModeSelector
        mode={selection.mode}
        frequencyCount={frequencyCount}
        disabled={!isHost}
        description={
          isHost
            ? 'Escolha o modo da partida. Todos jogarão com as mesmas frequências.'
            : 'Somente o host pode alterar o modo. Você verá aqui a escolha atual.'
        }
        onMode={(mode) => {
          onSetMode(
            mode === 'extreme' ? { mode, frequencyCount: count } : { mode },
          );
        }}
        onFrequencyCount={(value) => {
          setCount(value);
          if (selection.mode === 'extreme')
            onSetMode({ mode: 'extreme', frequencyCount: value });
        }}
      />
      <div className="home-start-row mp-start-row">
        {isHost ? (
          <button type="button" className="primary" onClick={onStart}>
            <Icon name="play" />
            Iniciar partida
            <Icon name="arrow" className="button-arrow" />
          </button>
        ) : (
          <div className="mp-waiting-host">
            <Icon name="clock" />
            <span>
              <strong>Aguardando o host</strong>
              <span>A partida começa quando o host iniciar.</span>
            </span>
          </div>
        )}
        <p>
          <Icon name="trophy" />
          <span>
            <strong>5 rounds por partida</strong>
            <span>ranking de 0 a 50 pontos</span>
          </span>
        </p>
      </div>
    </section>
  );
}
