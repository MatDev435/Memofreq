import type { Ref } from 'react';
import { Icon } from '../components/Icon';

/** Entrada do multiplayer na tela inicial, abaixo do início individual. */
export function MultiplayerCard({
  available,
  onOpen,
  buttonRef,
}: {
  readonly available: boolean;
  readonly onOpen: () => void;
  readonly buttonRef?: Ref<HTMLButtonElement>;
}) {
  return (
    <section className="multiplayer-card" aria-labelledby="multiplayer-heading">
      <span className="icon-tile">
        <Icon name="users" />
      </span>
      <div className="multiplayer-copy">
        <h2 id="multiplayer-heading">Multiplayer</h2>
        <p>
          Crie uma sala privada, envie o convite e disputem as mesmas
          frequências. Até 8 participantes, 5 rounds e ranking final.
        </p>
        {!available && (
          <p className="multiplayer-unavailable">
            Indisponível nesta instalação.
          </p>
        )}
      </div>
      <button
        ref={buttonRef}
        type="button"
        className="secondary"
        disabled={!available}
        onClick={onOpen}
      >
        <Icon name="users" />
        Jogar com amigos
        <Icon name="arrow" className="button-arrow" />
      </button>
    </section>
  );
}
