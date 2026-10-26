import { useEffect, useRef, useState } from 'react';
import type { GameController } from '../application/GameController';
import { useGameController } from '../application/useGameController';
import { ROUND_COUNT } from '../domain/config';
import { AudioControls } from '../ui/components/AudioControls';
import { AttemptResult } from '../ui/components/AttemptResult';
import { ToneControl } from '../ui/components/ToneControl';
import { formatNumber } from '../ui/format';
import { createBrowserGameController } from './createGameController';

export function App({
  createController = createBrowserGameController,
}: {
  readonly createController?: () => GameController;
}) {
  const [controller] = useState(() => createController());
  const snapshot = useGameController(controller);
  const { game, busy } = snapshot;
  const home = game.phase === 'home';
  const start = useRef<HTMLButtonElement>(null);
  const exit = useRef<HTMLButtonElement>(null);
  const next = useRef<HTMLButtonElement>(null);
  const resume = useRef<HTMLButtonElement>(null);
  const finalTitle = useRef<HTMLHeadingElement>(null);
  const lastFocusedPhase = useRef<string | null>(null);

  useEffect(() => {
    if (busy || !game.pageVisible || game.phase === lastFocusedPhase.current)
      return;
    const previous = lastFocusedPhase.current;
    lastFocusedPhase.current = game.phase;
    if (home && previous !== null) start.current?.focus();
    else if (game.phase === 'countdown') exit.current?.focus();
    else if (game.phase === 'round-result' || game.phase === 'attempt-result')
      next.current?.focus();
    else if (game.phase === 'awaiting-resume') resume.current?.focus();
    else if (game.phase === 'interrupted') start.current?.focus();
    else if (game.phase === 'final-result') finalTitle.current?.focus();
    // Nenhuma movimentação automática de foco durante referência ou tom contínuo.
  }, [busy, game.phase, game.pageVisible, home]);

  const result = !home
    ? game.session.attempts[game.session.attemptIndex]
    : undefined;
  const showingResult =
    (game.phase === 'attempt-result' || game.phase === 'round-result') && !busy;
  const frequencyHz =
    game.phase === 'attempt'
      ? game.frequencyHz
      : showingResult && result
        ? result.playerHz
        : null;
  const phaseText = busy
    ? 'Preparando…'
    : game.phase === 'countdown'
      ? 'Prepare-se para ouvir'
      : game.phase === 'references'
        ? 'Ouça e memorize'
        : game.phase === 'attempt'
          ? 'Encontre o tom que você memorizou'
          : 'Sua resposta';

  return (
    <>
      <a className="skip-link" href="#conteudo">
        Ir para o conteúdo
      </a>
      <header className="site-header">
        <span className="wordmark">Memofreq</span>
        <span className="project-stage">Memória auditiva</span>
      </header>
      <main id="conteudo" tabIndex={-1}>
        <div className="page-title">
          <p className="eyebrow">Percepção e memória auditiva</p>
          <h1 id="titulo">Memofreq</h1>
          {home && (
            <p className="introduction">
              Ouça um tom, guarde na memória e tente encontrá-lo novamente.
            </p>
          )}
        </div>
        <AudioControls
          volume={snapshot.volume}
          home={home}
          busy={busy}
          sample={snapshot.sample}
          onVolume={controller.setVolume}
          onTest={controller.testAudio}
          onStop={controller.stopSample}
        />
        {snapshot.error && <p className="error-message">{snapshot.error}</p>}
        <p
          className="sr-only"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {snapshot.announcement}
        </p>

        {home ? (
          <>
            <section className="panel home-panel" aria-labelledby="como-jogar">
              <h2 id="como-jogar">Escute uma vez. Encontre de memória.</h2>
              <p>
                A referência toca uma única vez. Depois, outro tom começa
                automaticamente: ajuste-o pelo slider ou pelos botões e confirme
                quando estiver satisfeito.
              </p>
              <fieldset className="mode-selection">
                <legend>Modo de jogo</legend>
                <label>
                  <input
                    type="radio"
                    name="mode"
                    checked
                    readOnly
                    value="normal"
                  />{' '}
                  <span>
                    <strong>Normal</strong>
                    <small>
                      5 rounds · uma frequência por round · até 50 pontos
                    </small>
                  </span>
                </label>
              </fieldset>
              <button
                ref={start}
                type="button"
                className="primary"
                disabled={busy}
                onClick={controller.startNormal}
              >
                Iniciar partida
              </button>
              <p className="muted future-modes">
                Hard e Extreme serão disponibilizados na próxima etapa.
              </p>
            </section>
            <aside className="listening-note" aria-labelledby="fones">
              <h2 id="fones">Coloque seus fones de ouvido!</h2>
              <p>
                Recomendamos fones e um ambiente silencioso. Ajuste o volume
                para um nível confortável antes de começar.
              </p>
              <p>
                Para ajustar sem ouvir anúncios do controle deslizante, use os
                botões Diminuir tom e Aumentar tom durante a tentativa.
              </p>
            </aside>
          </>
        ) : game.phase === 'final-result' ? (
          <section className="panel final-result" aria-labelledby="final-title">
            <p className="eyebrow">Modo Normal · 5 rounds concluídos</p>
            <h2 ref={finalTitle} tabIndex={-1} id="final-title">
              Resultado da partida
            </h2>
            <p className="total-score">
              <span>Pontuação final</span>
              <strong>
                {formatNumber(game.result.score)} <small>/ 50</small>
              </strong>
            </p>
            <table>
              <caption>Pontuação dos rounds</caption>
              <thead>
                <tr>
                  <th scope="col">Round</th>
                  <th scope="col">Pontos de 10</th>
                </tr>
              </thead>
              <tbody>
                {game.result.rounds.map((round) => (
                  <tr key={round.roundIndex}>
                    <th scope="row">{round.roundIndex + 1}</th>
                    <td>{formatNumber(round.score)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="button-row">
              <button
                type="button"
                className="primary"
                disabled={busy}
                onClick={controller.startNormal}
              >
                Jogar novamente
              </button>
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={controller.leave}
              >
                Voltar ao início
              </button>
            </div>
          </section>
        ) : game.phase === 'interrupted' ? (
          <section className="panel" aria-labelledby="interrupted-title">
            <h2 id="interrupted-title">Partida interrompida</h2>
            <p>
              A referência ou o tom da tentativa foi interrompido. Comece uma
              nova partida para ouvir novos sons, sem repetir a referência
              anterior.
            </p>
            <div className="button-row">
              <button
                ref={start}
                className="primary"
                type="button"
                disabled={busy}
                onClick={controller.startNormal}
              >
                Nova partida
              </button>
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={controller.leave}
              >
                Voltar ao início
              </button>
            </div>
          </section>
        ) : (
          <section className="panel game-panel" aria-labelledby="game-title">
            <div className="round-header">
              <div>
                <h2 id="game-title">Modo Normal</h2>
                <p className="round-label">
                  Round {game.session.roundIndex + 1} de {ROUND_COUNT}
                </p>
              </div>
              <button
                ref={exit}
                type="button"
                className="quiet-button"
                onClick={controller.leave}
              >
                Encerrar partida
              </button>
            </div>
            {game.phase === 'awaiting-resume' ? (
              <section className="paused-card">
                <h3>Contagem pausada</h3>
                <p>
                  Volte quando estiver pronto. A contagem recomeça do início
                  antes de qualquer som de referência.
                </p>
                <button
                  ref={resume}
                  className="primary"
                  type="button"
                  disabled={busy || !game.pageVisible}
                  onClick={controller.resume}
                >
                  Retomar contagem
                </button>
              </section>
            ) : (
              <>
                {!showingResult && (
                  <div className="stage-message">
                    <h3>{phaseText}</h3>
                    {game.phase === 'countdown' && (
                      <p className="countdown" aria-hidden="true">
                        {snapshot.countdown ?? 3}
                      </p>
                    )}
                    {game.phase === 'references' && (
                      <p>Guarde este som na memória. Ele não será repetido.</p>
                    )}
                    {game.phase === 'attempt' && (
                      <p>
                        O tom está tocando continuamente. Ajuste e confirme sua
                        tentativa.
                      </p>
                    )}
                  </div>
                )}
                {showingResult && result ? (
                  <AttemptResult result={result} />
                ) : (
                  <ToneControl
                    enabled={game.phase === 'attempt' && !busy}
                    frequencyHz={frequencyHz}
                    range={game.session.definition.rules.range}
                    onPosition={controller.setPosition}
                    onAdjust={controller.adjustPosition}
                  />
                )}
                {showingResult ? (
                  <button
                    ref={next}
                    type="button"
                    className="primary"
                    onClick={controller.advance}
                  >
                    {game.session.roundIndex === ROUND_COUNT - 1
                      ? 'Ver resultado final'
                      : 'Próximo round'}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="primary confirm-button"
                    disabled={game.phase !== 'attempt' || busy}
                    onClick={controller.confirm}
                  >
                    Confirmar tentativa
                  </button>
                )}
              </>
            )}
          </section>
        )}
      </main>
      <footer>Um desafio para os seus ouvidos.</footer>
    </>
  );
}
