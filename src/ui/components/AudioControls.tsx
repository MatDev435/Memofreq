interface AudioControlsProps {
  readonly volume: number;
  readonly home: boolean;
  readonly busy: boolean;
  readonly sample: 'idle' | 'preparing' | 'playing';
  readonly onVolume: (volume: number) => void;
  readonly onTest: () => void;
  readonly onStop: () => void;
}

export function AudioControls({
  volume,
  home,
  busy,
  sample,
  onVolume,
  onTest,
  onStop,
}: AudioControlsProps) {
  return (
    <fieldset className="audio-controls">
      <legend>Áudio</legend>
      <div className="volume-row">
        <label htmlFor="volume">Volume</label>
        <input
          id="volume"
          type="range"
          min="0"
          max="100"
          step="1"
          value={volume * 100}
          aria-valuetext={`${String(Math.round(volume * 100))}%`}
          onChange={(event) => {
            onVolume(event.currentTarget.valueAsNumber / 100);
          }}
        />
        <span aria-hidden="true">{Math.round(volume * 100)}%</span>
      </div>
      {home && (
        <>
          <div className="button-row">
            <button
              type="button"
              className="secondary"
              disabled={busy || sample !== 'idle'}
              onClick={onTest}
            >
              Testar áudio
            </button>
            <button
              type="button"
              className="quiet-button"
              disabled={busy || sample !== 'playing'}
              onClick={onStop}
            >
              Parar teste
            </button>
          </div>
          <p className="muted sample-note" aria-hidden="true">
            {sample === 'preparing'
              ? 'Habilitando o áudio…'
              : sample === 'playing'
                ? 'Reproduzindo som de exemplo…'
                : 'Teste o som e ajuste o volume antes de jogar.'}
          </p>
        </>
      )}
    </fieldset>
  );
}
