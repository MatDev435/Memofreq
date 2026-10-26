import { Icon } from './Icon';
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
    <fieldset
      className={`audio-controls ${home ? 'home-audio' : 'compact-audio'}`}
    >
      <legend className="sr-only">Áudio</legend>
      {home && (
        <div className="audio-intro">
          <span className="icon-tile">
            <Icon name="volume" />
          </span>
          <div>
            <h2>Áudio</h2>
            <p>Ajuste o volume e teste o som antes de jogar.</p>
          </div>
        </div>
      )}
      <div className="volume-row">
        <label htmlFor="volume" className={home ? 'sr-only' : ''}>
          {!home && <Icon name="volume" />}
          <span>Volume</span>
        </label>
        <input
          id="volume"
          type="range"
          min="0"
          max="100"
          step="1"
          value={volume * 100}
          aria-valuetext={`${String(Math.round(volume * 100))}%`}
          style={{
            backgroundImage: `linear-gradient(90deg, #8950fa 0%, #8a61ff ${String(volume * 100)}%, #111a2b ${String(volume * 100)}%, #111a2b 100%)`,
          }}
          onChange={(event) => {
            onVolume(event.currentTarget.valueAsNumber / 100);
          }}
        />
        <span aria-hidden="true">{Math.round(volume * 100)}%</span>
      </div>
      {home && (
        <div className="audio-actions">
          <button
            type="button"
            className="secondary test-audio"
            disabled={busy || sample !== 'idle'}
            onClick={onTest}
          >
            <Icon name="play" />
            Testar áudio
          </button>
          <button
            type="button"
            className="quiet-button"
            disabled={busy || sample !== 'playing'}
            onClick={onStop}
          >
            <Icon name="stop" />
            Parar teste
          </button>
          <p className="sr-only" aria-hidden="true">
            {sample === 'preparing'
              ? 'Habilitando o áudio…'
              : sample === 'playing'
                ? 'Reproduzindo som de exemplo…'
                : 'Teste o som e ajuste o volume antes de jogar.'}
          </p>
        </div>
      )}
    </fieldset>
  );
}
