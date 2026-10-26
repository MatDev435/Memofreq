import type { KeyboardEvent } from 'react';
import { frequencyToPosition } from '../../domain/frequencies';
import type { FrequencyRange } from '../../domain/config';
import { formatHz } from '../format';

interface ToneControlProps {
  readonly enabled: boolean;
  readonly frequencyHz: number | null;
  readonly showFrequency: boolean;
  readonly range: FrequencyRange;
  readonly onPosition: (position: number) => void;
  readonly onAdjust: (delta: number) => void;
}

export function ToneControl({
  enabled,
  frequencyHz,
  showFrequency,
  range,
  onPosition,
  onAdjust,
}: ToneControlProps) {
  function onKey(event: KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        event.preventDefault();
        onAdjust(-0.001);
        break;
      case 'ArrowRight':
      case 'ArrowUp':
        event.preventDefault();
        onAdjust(0.001);
        break;
      case 'PageDown':
        event.preventDefault();
        onAdjust(-0.01);
        break;
      case 'PageUp':
        event.preventDefault();
        onAdjust(0.01);
        break;
      case 'Home':
        event.preventDefault();
        onPosition(0);
        break;
      case 'End':
        event.preventDefault();
        onPosition(1);
        break;
    }
  }

  return (
    <section className="tone-control" aria-labelledby="tone-title">
      <label className="control-label" id="tone-title" htmlFor="tone">
        Ajustar tom
      </label>
      {showFrequency && (
        <p className="frequency-readout" aria-live="off">
          <span>Tom atual</span>
          <strong>{frequencyHz === null ? '—' : formatHz(frequencyHz)}</strong>
        </p>
      )}
      <input
        id="tone"
        type="range"
        min="0"
        max="1"
        step="any"
        value={
          frequencyHz === null ? 0.5 : frequencyToPosition(frequencyHz, range)
        }
        disabled={!enabled}
        aria-valuetext="Ajuste pelo som"
        onChange={(event) => {
          onPosition(event.currentTarget.valueAsNumber);
        }}
        onKeyDown={onKey}
      />
      <div className="button-row tone-buttons">
        <button
          type="button"
          className="secondary"
          disabled={!enabled}
          onClick={() => {
            onAdjust(-0.001);
          }}
        >
          Diminuir tom
        </button>
        <button
          type="button"
          className="secondary"
          disabled={!enabled}
          onClick={() => {
            onAdjust(0.001);
          }}
        >
          Aumentar tom
        </button>
      </div>
      <p className="muted control-help">
        Use as setas ou os botões para ajustar. Page Up e Page Down fazem
        ajustes maiores; Home e End vão aos extremos.
      </p>
    </section>
  );
}
