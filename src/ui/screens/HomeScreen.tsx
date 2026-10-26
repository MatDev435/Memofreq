import type { ReactNode, Ref } from 'react';
import type { ModeSelection } from '../../domain/config';
import { Brand } from '../components/Brand';
import { Icon } from '../components/Icon';
import { WaveArt } from '../components/WaveArt';
import { ModeSelector } from '../components/ModeSelector';
import { KeyboardHints } from '../components/KeyboardHints';

export function HomeScreen({
  audio,
  mode,
  frequencyCount,
  onMode,
  onFrequencyCount,
  onStart,
  startRef,
  busy,
}: {
  readonly audio: ReactNode;
  readonly mode: ModeSelection['mode'];
  readonly frequencyCount: 2 | 3;
  readonly onMode: (mode: ModeSelection['mode']) => void;
  readonly onFrequencyCount: (count: 2 | 3) => void;
  readonly onStart: () => void;
  readonly startRef: Ref<HTMLButtonElement>;
  readonly busy: boolean;
}) {
  return (
    <div className="home-screen screen-enter">
      <section className="home-hero" aria-labelledby="titulo">
        <div className="hero-copy">
          <p className="eyebrow">Percepção e memória auditiva</p>
          <h1 id="titulo">
            <Brand hero />
          </h1>
          <p className="introduction">
            Ouça um tom, guarde na memória e tente encontrá-lo novamente. Treine
            sua percepção auditiva e desafie seus limites em diferentes níveis
            de dificuldade.
          </p>
        </div>
        <div className="hero-wave">
          <WaveArt active />
        </div>
      </section>
      {audio}
      <ModeSelector
        mode={mode}
        frequencyCount={frequencyCount}
        onMode={onMode}
        onFrequencyCount={onFrequencyCount}
      />
      <div className="home-start-row">
        <button
          ref={startRef}
          type="button"
          className="primary"
          disabled={busy}
          onClick={onStart}
        >
          <Icon name="play" />
          Iniciar partida
          <Icon name="arrow" className="button-arrow" />
        </button>
        <p>
          <Icon name="trophy" />
          <span>
            <strong>5 rounds por partida</strong>
            <span>até 50 pontos</span>
          </span>
        </p>
      </div>
      <aside className="listening-note" aria-labelledby="fones">
        <div className="listening-copy">
          <span className="headphone-art">
            <Icon name="headphones" />
          </span>
          <div>
            <h2 id="fones">Coloque seus fones de ouvido!</h2>
            <p>
              Recomendamos o uso de fones e um ambiente silencioso para uma
              melhor experiência. Ajuste o volume para um nível confortável
              antes de começar.
            </p>
          </div>
        </div>
        <KeyboardHints />
      </aside>
      <details className="home-rules">
        <summary>Como jogar e usar os controles acessíveis</summary>
        <p>
          A referência toca uma única vez. O tom da tentativa começa
          automaticamente. Ajuste-o e confirme quando estiver satisfeito. No
          Extreme, memorize toda a sequência e responda na mesma ordem: cada
          confirmação passa ao próximo palpite, sem resultado intermediário. Os
          dados são revelados juntos no fim do round.
        </p>
        <p>
          Para ajustar sem ouvir anúncios do controle deslizante, use os botões
          Diminuir tom e Aumentar tom. Seus nomes e foco permanecem estáveis
          durante o ajuste.
        </p>
      </details>
    </div>
  );
}
