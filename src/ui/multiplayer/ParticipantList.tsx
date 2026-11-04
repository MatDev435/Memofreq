import { useEffect, useRef, useState } from 'react';
import type { PlayerView } from '../../multiplayer/protocol';
import { Icon } from '../components/Icon';
import { useUiFeedback } from '../feedback/uiFeedbackContext';

export interface ParticipantStatus {
  readonly label: string;
  readonly tone: 'ready' | 'waiting' | 'playing' | 'done' | 'lost';
}

const GRAPHEMES = new Intl.Segmenter('pt-BR', { granularity: 'grapheme' });

function initial(name: string): string {
  const [first] = GRAPHEMES.segment(name);
  return first?.segment.toLocaleUpperCase('pt-BR') ?? '?';
}

/** Remoção em duas etapas para evitar cliques acidentais do host. */
function KickControl({
  name,
  onKick,
}: {
  readonly name: string;
  readonly onKick: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const startRef = useRef<HTMLButtonElement>(null);
  const restore = useRef(false);

  useEffect(() => {
    if (confirming) confirmRef.current?.focus();
    else if (restore.current) startRef.current?.focus();
    restore.current = false;
  }, [confirming]);

  if (!confirming)
    return (
      <button
        ref={startRef}
        type="button"
        className="quiet-button participant-kick"
        aria-label={`Remover ${name}`}
        onClick={() => {
          setConfirming(true);
        }}
      >
        <Icon name="remove" />
        <span aria-hidden="true">Remover</span>
      </button>
    );
  return (
    <span className="participant-confirm">
      <button
        ref={confirmRef}
        type="button"
        className="participant-kick is-danger"
        aria-label={`Confirmar remoção de ${name}`}
        onClick={onKick}
      >
        <Icon name="remove" />
        <span aria-hidden="true">Confirmar</span>
      </button>
      <button
        type="button"
        className="quiet-button"
        aria-label={`Cancelar remoção de ${name}`}
        onClick={() => {
          restore.current = true;
          setConfirming(false);
        }}
      >
        <span aria-hidden="true">Cancelar</span>
      </button>
    </span>
  );
}

export function ParticipantList({
  players,
  hostId,
  me,
  label,
  statusOf,
  canKick = false,
  onKick,
}: {
  readonly players: readonly PlayerView[];
  readonly hostId: string;
  readonly me: string | null;
  readonly label: string;
  readonly statusOf?: (id: string) => ParticipantStatus | null;
  readonly canKick?: boolean;
  readonly onKick?: (id: string) => void;
}) {
  const { cue } = useUiFeedback();
  const previous = useRef(players.length);
  useEffect(() => {
    if (players.length > previous.current) cue('join');
    else if (players.length < previous.current) cue('leave');
    previous.current = players.length;
  }, [players.length, cue]);
  return (
    <ul className="participant-list" aria-label={label}>
      {players.map((player) => {
        const status = statusOf?.(player.id) ?? null;
        const self = player.id === me;
        return (
          <li
            key={player.id}
            className="participant"
            data-self={self}
            data-status={status?.tone}
          >
            <span className="participant-avatar" aria-hidden="true">
              {initial(player.name)}
            </span>
            <span className="participant-name">
              <strong>{player.name}</strong>
              {self && <span className="participant-tag">Você</span>}
              {player.id === hostId && (
                <span className="participant-tag is-host">
                  <Icon name="crown" />
                  Host
                </span>
              )}
            </span>
            {status && (
              <span className={`participant-status is-${status.tone}`}>
                {status.tone === 'ready' || status.tone === 'done' ? (
                  <Icon name="check" />
                ) : status.tone === 'lost' ? (
                  <Icon name="remove" />
                ) : (
                  <Icon name="clock" />
                )}
                {status.label}
              </span>
            )}
            {canKick && !self && onKick && (
              <KickControl
                name={player.name}
                onKick={() => {
                  onKick(player.id);
                }}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}
