import { useEffect, useRef, useState } from 'react';
import type { GameController } from '../application/GameController';
import { useGameController } from '../application/useGameController';
import { getModeSettings, ROUND_COUNT } from '../domain/config';
import type { ModeSelection } from '../domain/config';
import { AudioControls } from '../ui/components/AudioControls';
import { ToneControl } from '../ui/components/ToneControl';
import { HomeScreen } from '../ui/screens/HomeScreen';
import { Brand } from '../ui/components/Brand';
import { Icon } from '../ui/components/Icon';
import { WaveArt } from '../ui/components/WaveArt';
import { RoundSummary } from '../ui/components/RoundSummary';
import { FinalScreen } from '../ui/screens/FinalScreen';
import { SessionHeader } from '../ui/components/SessionHeader';
import { PlayingScreen } from '../ui/screens/PlayingScreen';
import { MultiplayerCard } from '../ui/multiplayer/MultiplayerCard';
import type { MultiplayerController } from '../application/MultiplayerController';
import { MULTIPLAYER_URL } from '../multiplayer/config';
import { readInviteCode } from '../multiplayer/invite';
import {
  createBrowserGameController,
  createBrowserMultiplayerController,
} from './createGameController';
import { MultiplayerApp } from './MultiplayerApp';
import { SoundToggle } from '../ui/components/SoundToggle';
import { QuietUi, UiFeedbackProvider } from '../ui/feedback/UiFeedback';

function clearInviteHash(): void {
  if (window.location.hash === '') return;
  window.history.replaceState(
    null,
    '',
    `${window.location.pathname}${window.location.search}`,
  );
}

export function App({
  createController = createBrowserGameController,
  createMultiplayerController = createBrowserMultiplayerController,
  multiplayerAvailable = MULTIPLAYER_URL !== null,
}: {
  readonly createController?: () => GameController;
  readonly createMultiplayerController?: (
    volume: number,
  ) => MultiplayerController;
  readonly multiplayerAvailable?: boolean;
}) {
  const [controller] = useState(() => createController());
  const [motionPaused, setMotionPaused] = useState(false);
  // Um link de convite (#sala=…) abre diretamente a entrada multiplayer.
  const [inviteCode, setInviteCode] = useState(() =>
    readInviteCode(window.location.hash),
  );
  const [multiplayer, setMultiplayer] = useState(() => inviteCode !== null);
  const multiplayerButton = useRef<HTMLButtonElement>(null);
  const returnedFromMultiplayer = useRef(false);
  const [mode, setMode] = useState<ModeSelection['mode']>('normal');
  const [frequencyCount, setFrequencyCount] = useState<2 | 3>(2);
  const snapshot = useGameController(controller);
  const { game, busy } = snapshot;
  const home = game.phase === 'home';
  const settings = home
    ? null
    : getModeSettings(
        game.session.definition.selection,
        game.session.definition.rules,
      );
  const modeLabel = home
    ? ''
    : game.session.definition.selection.mode === 'extreme'
      ? `Extreme · ${String(settings?.referencesPerRound)} frequências`
      : game.session.definition.selection.mode === 'hard'
        ? 'Hard'
        : 'Normal';
  const start = useRef<HTMLButtonElement>(null);
  const exit = useRef<HTMLButtonElement>(null);
  const next = useRef<HTMLButtonElement>(null);
  const resume = useRef<HTMLButtonElement>(null);
  const finalTitle = useRef<HTMLHeadingElement>(null);
  const lastFocusedPhase = useRef<string | null>(null);

  useEffect(() => {
    if (multiplayer) return;
    if (returnedFromMultiplayer.current) {
      returnedFromMultiplayer.current = false;
      multiplayerButton.current?.focus();
    }
  }, [multiplayer]);

  useEffect(() => {
    // Um convite aberto com o jogo inicial na tela leva à entrada multiplayer.
    const onHash = () => {
      const code = readInviteCode(window.location.hash);
      if (code === null || multiplayer || game.phase !== 'home') return;
      setInviteCode(code);
      setMultiplayer(true);
    };
    window.addEventListener('hashchange', onHash);
    return () => {
      window.removeEventListener('hashchange', onHash);
    };
  }, [multiplayer, game.phase]);

  useEffect(() => {
    if (busy || !game.pageVisible || game.phase === lastFocusedPhase.current)
      return;
    const previous = lastFocusedPhase.current;
    lastFocusedPhase.current = game.phase;
    if (home && previous !== null) start.current?.focus();
    else if (game.phase === 'countdown') exit.current?.focus();
    else if (game.phase === 'round-result') next.current?.focus();
    else if (game.phase === 'awaiting-resume') resume.current?.focus();
    else if (game.phase === 'interrupted') start.current?.focus();
    else if (game.phase === 'final-result') finalTitle.current?.focus();
    // Nenhuma movimentação automática de foco durante referência ou tom contínuo.
  }, [busy, game.phase, game.pageVisible, home]);

  const result = !home
    ? game.session.attempts[game.session.attemptIndex]
    : undefined;
  const showingResult = game.phase === 'round-result' && !busy;
  const completedRound =
    game.phase === 'round-result'
      ? game.session.completedRounds[game.session.roundIndex]
      : undefined;
  const frequencyHz =
    game.phase === 'attempt'
      ? game.frequencyHz
      : showingResult && result
        ? result.playerHz
        : null;
  const audio = (
    <AudioControls
      volume={snapshot.volume}
      home={home}
      busy={busy}
      sample={snapshot.sample}
      onVolume={controller.setVolume}
      onTest={controller.testAudio}
      onStop={controller.stopSample}
    />
  );
  const confirm = (
    <button
      type="button"
      className="primary confirm-button"
      disabled={game.phase !== 'attempt' || busy}
      onClick={(event) => {
        if (event.detail <= 1) controller.confirm(game.executionId);
      }}
      onKeyDown={(event) => {
        if (event.repeat && (event.key === 'Enter' || event.key === ' '))
          event.preventDefault();
      }}
    >
      <Icon name="ear" />
      Confirmar tentativa
      <Icon name="arrow" className="button-arrow" />
    </button>
  );
  if (multiplayer)
    return (
      <UiFeedbackProvider motionPaused={motionPaused}>
        <div
          className="app-shell is-game is-multiplayer"
          data-motion={motionPaused ? 'paused' : 'full'}
        >
          <div className="ambient-background" aria-hidden="true">
            <WaveArt variant="mesh" />
          </div>
          <a className="skip-link" href="#conteudo">
            Ir para o conteúdo
          </a>
          <main id="conteudo" tabIndex={-1} className="session-main mp-main">
            <MultiplayerApp
              createController={createMultiplayerController}
              initialVolume={snapshot.volume}
              inviteCode={inviteCode}
              motionPaused={motionPaused}
              onMotion={() => {
                setMotionPaused(!motionPaused);
              }}
              onExit={() => {
                clearInviteHash();
                setInviteCode(null);
                returnedFromMultiplayer.current = true;
                setMultiplayer(false);
              }}
            />
          </main>
          <footer>Um desafio para os seus ouvidos.</footer>
        </div>
      </UiFeedbackProvider>
    );

  const quietUi =
    !busy &&
    (game.phase === 'countdown' ||
      game.phase === 'references' ||
      game.phase === 'attempt' ||
      game.phase === 'attempt-result');
  return (
    <UiFeedbackProvider motionPaused={motionPaused}>
      <QuietUi quiet={quietUi} />
      <div
        className={`app-shell ${home ? 'is-home' : 'is-game'}`}
        data-motion={motionPaused ? 'paused' : 'full'}
      >
        <div className="ambient-background" aria-hidden="true">
          <WaveArt variant="mesh" />
        </div>
        <a className="skip-link" href="#conteudo">
          Ir para o conteúdo
        </a>
        {home && (
          <header className="site-header">
            <Brand />
            <div className="header-end">
              <span className="project-stage">
                Um desafio para os seus ouvidos.
              </span>
              <SoundToggle />
              <button
                type="button"
                className="motion-toggle"
                aria-label="Animações visuais"
                aria-pressed={!motionPaused}
                title={motionPaused ? 'Ativar animações' : 'Pausar animações'}
                onClick={() => {
                  setMotionPaused(!motionPaused);
                }}
              >
                <Icon name="motion" />
              </button>
            </div>
          </header>
        )}
        <main
          id="conteudo"
          tabIndex={-1}
          className={home ? 'home-main' : 'session-main'}
        >
          {!home && (
            <SessionHeader
              modeLabel={modeLabel}
              audio={audio}
              final={game.phase === 'final-result'}
              onLeave={controller.leave}
              exitRef={exit}
              motionPaused={motionPaused}
              onMotion={() => {
                setMotionPaused(!motionPaused);
              }}
            />
          )}
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
            <HomeScreen
              audio={audio}
              mode={mode}
              frequencyCount={frequencyCount}
              onMode={setMode}
              onFrequencyCount={setFrequencyCount}
              busy={busy}
              startRef={start}
              onStart={() => {
                controller.start(
                  mode === 'extreme' ? { mode, frequencyCount } : { mode },
                );
              }}
              multiplayer={
                <MultiplayerCard
                  available={multiplayerAvailable}
                  buttonRef={multiplayerButton}
                  onOpen={() => {
                    setInviteCode(null);
                    setMultiplayer(true);
                  }}
                />
              }
            />
          ) : game.phase === 'final-result' ? (
            <FinalScreen
              result={game.result}
              titleRef={finalTitle}
              busy={busy}
              onRestart={controller.restart}
              onLeave={controller.leave}
            />
          ) : game.phase === 'interrupted' ? (
            <section
              className="interrupted-panel screen-enter"
              aria-labelledby="interrupted-title"
            >
              <span className="icon-tile">
                <Icon name="volume" />
              </span>
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
                  onClick={controller.restart}
                >
                  <Icon name="restart" />
                  Nova partida
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={busy}
                  onClick={controller.leave}
                >
                  <Icon name="home" />
                  Voltar ao início
                </button>
              </div>
            </section>
          ) : showingResult && completedRound ? (
            <RoundSummary
              round={completedRound}
              range={game.session.definition.rules.range}
              comparison={(attemptIndex) => ({
                playing:
                  snapshot.comparison?.attemptIndex === attemptIndex &&
                  snapshot.comparison.roundIndex === completedRound.roundIndex
                    ? snapshot.comparison.token
                    : null,
                onPlay: () => {
                  controller.playComparison(attemptIndex);
                },
                onStop: controller.stopComparison,
              })}
              next={
                <button
                  ref={next}
                  type="button"
                  className="primary next-round-button"
                  onClick={() => {
                    exit.current?.focus();
                    controller.advance();
                  }}
                >
                  {game.session.roundIndex === ROUND_COUNT - 1
                    ? 'Ver resultado final'
                    : 'Próximo round'}
                  <Icon name="arrow" />
                </button>
              }
            />
          ) : (
            <PlayingScreen
              phase={game.phase}
              countdown={snapshot.countdown}
              roundIndex={game.session.roundIndex}
              attemptIndex={game.session.attemptIndex}
              count={settings?.referencesPerRound ?? 1}
              busy={busy}
              controls={
                <ToneControl
                  enabled={game.phase === 'attempt' && !busy}
                  frequencyHz={frequencyHz}
                  showFrequency={settings?.showFrequencyVisually ?? false}
                  range={game.session.definition.rules.range}
                  onPosition={controller.setPosition}
                  onAdjust={controller.adjustPosition}
                  confirm={confirm}
                />
              }
              paused={
                <section className="paused-card screen-enter">
                  <span className="icon-tile">
                    <Icon name="clock" />
                  </span>
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
                    <Icon name="play" />
                    Retomar contagem
                  </button>
                </section>
              }
            />
          )}
        </main>
        <footer>Um desafio para os seus ouvidos.</footer>
      </div>
    </UiFeedbackProvider>
  );
}
