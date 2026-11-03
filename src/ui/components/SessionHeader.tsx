import type { ReactNode, Ref } from 'react';
import { Brand } from './Brand';
import { Icon } from './Icon';
import type { IconName } from './Icon';

/** Ação de saída personalizada, usada pelas telas multiplayer. */
export interface HeaderExit {
  readonly label: string;
  readonly shortLabel: string;
  readonly icon: IconName;
  readonly className: string;
}

export function SessionHeader({
  modeLabel,
  title,
  audio,
  final = false,
  exitAction,
  onLeave,
  exitRef,
  motionPaused,
  onMotion,
}: {
  readonly modeLabel: string;
  /** Substitui "Modo …" no subtítulo do cabeçalho. */
  readonly title?: string;
  readonly audio: ReactNode;
  readonly final?: boolean;
  readonly exitAction?: HeaderExit;
  readonly onLeave: () => void;
  readonly exitRef: Ref<HTMLButtonElement>;
  readonly motionPaused: boolean;
  readonly onMotion: () => void;
}) {
  return (
    <header className={`session-header${final ? ' final-header' : ''}`}>
      <h1>
        <Brand />
      </h1>
      <h2 id="game-title" className="session-mode">
        {title ?? (
          <>
            Modo {modeLabel}
            {final && ' · 5 rounds'}
          </>
        )}
      </h2>
      <div className="session-header-controls">
        {audio}
        <button
          type="button"
          className="motion-toggle"
          aria-label="Animações visuais"
          aria-pressed={!motionPaused}
          title={motionPaused ? 'Ativar animações' : 'Pausar animações'}
          onClick={onMotion}
        >
          <Icon name="motion" />
        </button>
        {exitAction ? (
          <button
            ref={exitRef}
            type="button"
            className={exitAction.className}
            aria-label={exitAction.label}
            onClick={onLeave}
          >
            <Icon name={exitAction.icon} />
            <span>
              <span className="desktop-only">{exitAction.label}</span>
              <span className="mobile-only">{exitAction.shortLabel}</span>
            </span>
          </button>
        ) : (
          <button
            ref={exitRef}
            type="button"
            className={final ? 'header-home' : 'exit-button'}
            aria-label={
              final ? 'Início: voltar à tela inicial' : 'Encerrar partida'
            }
            onClick={onLeave}
          >
            <Icon name={final ? 'home' : 'exit'} />
            <span>
              {final ? (
                'Início'
              ) : (
                <>
                  <span className="desktop-only">Encerrar partida</span>
                  <span className="mobile-only">Encerrar</span>
                </>
              )}
            </span>
          </button>
        )}
      </div>
    </header>
  );
}
