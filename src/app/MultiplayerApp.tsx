import { useEffect, useRef, useState } from 'react';
import type { MultiplayerController } from '../application/MultiplayerController';
import type { RoundPlay } from '../application/MultiplayerController';
import { useMultiplayerController } from '../application/useMultiplayerController';
import type { GameState } from '../domain/models';
import { inviteHash, inviteUrl } from '../multiplayer/invite';
import { modeLabel } from '../multiplayer/labels';
import { reasonMessage } from '../multiplayer/messages';
import type { MultiplayerReason } from '../multiplayer/messages';
import { AudioControls } from '../ui/components/AudioControls';
import { Icon } from '../ui/components/Icon';
import { SessionHeader } from '../ui/components/SessionHeader';
import { ToneControl } from '../ui/components/ToneControl';
import { EntryScreen } from '../ui/multiplayer/EntryScreen';
import type { EntryErrorField } from '../ui/multiplayer/EntryScreen';
import { ExitScreen } from '../ui/multiplayer/ExitScreen';
import { FinalRankingScreen } from '../ui/multiplayer/FinalRankingScreen';
import { LobbyScreen } from '../ui/multiplayer/LobbyScreen';
import { ReadyScreen } from '../ui/multiplayer/ReadyScreen';
import { RoundPausedCard } from '../ui/multiplayer/RoundPausedCard';
import { RoundResultsScreen } from '../ui/multiplayer/RoundResultsScreen';
import { WaitingScreen } from '../ui/multiplayer/WaitingScreen';
import { PlayingScreen } from '../ui/screens/PlayingScreen';

/** Etapa equivalente da tela de jogo individual, reaproveitada aqui. */
function playingPhase(stage: RoundPlay['stage']): GameState['phase'] {
  switch (stage) {
    case 'countdown':
      return 'countdown';
    case 'references':
      return 'references';
    case 'attempt':
      return 'attempt';
    case 'sending':
      return 'attempt-result';
    case 'blocked':
    case 'paused':
      return 'awaiting-resume';
    default:
      return 'preparing-audio';
  }
}

function errorField(reason: MultiplayerReason | null): EntryErrorField {
  if (reason === null) return null;
  if (reason === 'invalid-name' || reason === 'name-taken') return 'name';
  if (
    reason === 'invalid-code' ||
    reason === 'room-not-found' ||
    reason === 'room-full' ||
    reason === 'room-in-match'
  )
    return 'code';
  return null;
}

export function MultiplayerApp({
  createController,
  initialVolume,
  inviteCode,
  motionPaused,
  onMotion,
  onExit,
}: {
  readonly createController: (volume: number) => MultiplayerController;
  readonly initialVolume: number;
  readonly inviteCode: string | null;
  readonly motionPaused: boolean;
  readonly onMotion: () => void;
  readonly onExit: () => void;
}) {
  const [controller] = useState(() => createController(initialVolume));
  const snapshot = useMultiplayerController(controller);
  const { room, play, playerId: me, status } = snapshot;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const exitRef = useRef<HTMLButtonElement>(null);
  const resumeRef = useRef<HTMLButtonElement>(null);
  const match = room?.match ?? null;
  const pendingReady =
    snapshot.readyKey !== null &&
    room !== null &&
    snapshot.readyKey === `${room.phase}:${String(match?.roundIndex ?? -1)}`;

  const group: string =
    status === 'ended'
      ? 'ended'
      : room === null
        ? 'entry'
        : room.phase !== 'playing'
          ? room.phase
          : play.stage === 'blocked' || play.stage === 'paused'
            ? 'paused'
            : play.stage === 'submitted' || play.stage === 'forfeited'
              ? 'waiting'
              : 'sound';
  const focusKey = `${group}:${String(match?.roundIndex ?? -1)}`;

  useEffect(() => {
    // Nenhum foco durante os tons, exceto a saída antes da contagem.
    if (group === 'sound') exitRef.current?.focus();
    else if (group === 'paused') resumeRef.current?.focus();
    else headingRef.current?.focus();
  }, [focusKey, group]);

  useEffect(() => {
    if (room?.code)
      window.history.replaceState(null, '', inviteHash(room.code));
  }, [room?.code]);

  const leaveRoom = () => {
    controller.leave();
    onExit();
  };
  const modeName = room ? modeLabel(room.selection) : '';

  const audio = (
    <AudioControls
      volume={snapshot.volume}
      home={false}
      busy={false}
      sample="idle"
      onVolume={controller.setVolume}
      onTest={() => undefined}
      onStop={() => undefined}
    />
  );

  const confirm = (
    <button
      type="button"
      className="primary confirm-button"
      disabled={play.stage !== 'attempt'}
      onClick={(event) => {
        if (event.detail <= 1) controller.confirm(snapshot.execution);
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

  let content;
  if (status === 'ended' && snapshot.endReason) {
    content = (
      <ExitScreen
        reason={snapshot.endReason}
        headingRef={headingRef}
        onEntry={controller.backToEntry}
        onMenu={onExit}
      />
    );
  } else if (room === null) {
    content = (
      <EntryScreen
        inviteCode={inviteCode}
        error={snapshot.formError ? reasonMessage(snapshot.formError) : null}
        errorField={errorField(snapshot.formError)}
        connecting={status === 'connecting'}
        headingRef={headingRef}
        onCreate={controller.create}
        onJoin={controller.join}
      />
    );
  } else if (room.phase === 'lobby') {
    content = (
      <LobbyScreen
        room={room}
        me={me}
        inviteLink={inviteUrl(window.location, room.code)}
        headingRef={headingRef}
        onSetMode={controller.setMode}
        onStart={controller.startMatch}
        onKick={controller.kick}
      />
    );
  } else if (room.phase === 'ready') {
    content = (
      <ReadyScreen
        room={room}
        me={me}
        pending={pendingReady}
        modeName={modeName}
        headingRef={headingRef}
        onReady={controller.ready}
        onKick={controller.kick}
      />
    );
  } else if (room.phase === 'round-results') {
    content = (
      <RoundResultsScreen
        room={room}
        me={me}
        pending={pendingReady}
        headingRef={headingRef}
        onReady={controller.ready}
        onKick={controller.kick}
      />
    );
  } else if (room.phase === 'final') {
    content = (
      <FinalRankingScreen
        room={room}
        me={me}
        modeName={modeName}
        headingRef={headingRef}
        onPlayAgain={controller.playAgain}
        onLeave={leaveRoom}
      />
    );
  } else if (group === 'waiting') {
    content = (
      <WaitingScreen
        room={room}
        me={me}
        forfeited={play.stage === 'forfeited'}
        headingRef={headingRef}
        onKick={controller.kick}
      />
    );
  } else if (match) {
    const tonePlay = play.stage === 'attempt' || play.stage === 'paused';
    content = (
      <PlayingScreen
        phase={playingPhase(play.stage)}
        countdown={play.stage === 'countdown' ? play.remaining : null}
        roundIndex={match.roundIndex}
        attemptIndex={tonePlay ? play.attemptIndex : 0}
        count={match.settings.referencesPerRound}
        busy={play.stage === 'preparing' || play.stage === 'sending'}
        controls={
          <ToneControl
            enabled={play.stage === 'attempt'}
            frequencyHz={tonePlay ? play.frequencyHz : null}
            showFrequency={match.settings.showFrequencyVisually}
            range={match.rules.range}
            onPosition={controller.setPosition}
            onAdjust={controller.adjustPosition}
            confirm={confirm}
          />
        }
        paused={
          <RoundPausedCard
            kind={play.stage === 'paused' ? 'paused' : 'blocked'}
            visible={snapshot.pageVisible}
            resumeRef={resumeRef}
            onResume={controller.resumeRound}
            onForfeit={controller.forfeitRound}
          />
        }
      />
    );
  }

  return (
    <>
      <SessionHeader
        modeLabel={modeName}
        title={room ? `Multiplayer · ${modeName}` : 'Multiplayer'}
        audio={audio}
        exitAction={
          room
            ? {
                label: 'Sair da sala',
                shortLabel: 'Sair',
                icon: 'exit',
                className: 'exit-button',
              }
            : {
                label: 'Voltar ao menu',
                shortLabel: 'Menu',
                icon: 'home',
                className: 'header-home',
              }
        }
        onLeave={room ? leaveRoom : onExit}
        exitRef={exitRef}
        motionPaused={motionPaused}
        onMotion={onMotion}
      />
      {snapshot.notice && <p className="error-message">{snapshot.notice}</p>}
      <p
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {snapshot.announcement}
      </p>
      {content}
    </>
  );
}
