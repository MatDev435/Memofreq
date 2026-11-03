import type { Ref } from 'react';
import { Icon } from '../components/Icon';

/** Round aguardando início ou tentativa suspensa; nunca repete a referência. */
export function RoundPausedCard({
  kind,
  visible,
  resumeRef,
  onResume,
  onForfeit,
}: {
  readonly kind: 'blocked' | 'paused';
  readonly visible: boolean;
  readonly resumeRef: Ref<HTMLButtonElement>;
  readonly onResume: () => void;
  readonly onForfeit: () => void;
}) {
  const blocked = kind === 'blocked';
  return (
    <section className="paused-card mp-paused screen-enter">
      <span className="icon-tile">
        <Icon name={blocked ? 'clock' : 'headphones'} />
      </span>
      <h3>{blocked ? 'Pronto para ouvir?' : 'Tentativa suspensa'}</h3>
      <p>
        {blocked
          ? 'A contagem começa quando você confirmar. A referência será apresentada uma única vez.'
          : 'O tom foi interrompido. Seus palpites confirmados estão guardados. Retome para continuar ajustando; a referência não será repetida.'}
      </p>
      <div className="button-row">
        <button
          ref={resumeRef}
          className="primary"
          type="button"
          disabled={!visible}
          onClick={onResume}
        >
          <Icon name="play" />
          {blocked ? 'Começar round' : 'Retomar tentativa'}
        </button>
        <button type="button" className="secondary" onClick={onForfeit}>
          <Icon name="exit" />
          Desistir deste round
        </button>
      </div>
      <p className="mp-note">
        Desistir conta este round como zero e mantém você na partida.
      </p>
    </section>
  );
}
