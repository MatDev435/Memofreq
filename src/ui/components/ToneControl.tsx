import type { KeyboardEvent, ReactNode } from 'react';
import { frequencyToPosition } from '../../domain/frequencies';
import type { FrequencyRange } from '../../domain/config';
import { formatHz } from '../format';
import { Icon } from './Icon';
import { KeyboardHints } from './KeyboardHints';

interface ToneControlProps {
  readonly enabled: boolean;
  readonly confirm?: ReactNode;
  readonly frequencyHz: number | null;
  readonly showFrequency: boolean;
  readonly range: FrequencyRange;
  readonly onPosition: (position: number) => void;
  readonly onAdjust: (delta: number) => void;
}

export function ToneControl({
  enabled,
  confirm,
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
      <h3>Ajuste o tom</h3>
      <p className="tone-instruction">
        Use sua audição para encontrar o tom que você memorizou.
      </p>
      <label className="sr-only" id="tone-title" htmlFor="tone">
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
        style={{
          backgroundImage: `linear-gradient(90deg, #983cff 0%, #25e6f8 ${String((frequencyHz === null ? 0.5 : frequencyToPosition(frequencyHz, range)) * 100)}%, #071624 ${String((frequencyHz === null ? 0.5 : frequencyToPosition(frequencyHz, range)) * 100)}%, #071624 100%)`,
        }}
        disabled={!enabled}
        aria-valuetext="Ajuste pelo som"
        onChange={(event) => {
          onPosition(event.currentTarget.valueAsNumber);
        }}
        onKeyDown={onKey}
      />
      <div className="slider-ruler" aria-hidden="true">
        {Array.from({ length: 21 }, (_, i) => (
          <span key={i} />
        ))}
      </div>
      <div className="slider-extents" aria-hidden="true">
        <span>
          <Icon name="back" />
          Mais grave
        </span>
        <span>
          Mais agudo
          <Icon name="arrow" />
        </span>
      </div>
      <div className="button-row tone-buttons">
        <button
          type="button"
          className="secondary"
          disabled={!enabled}
          onClick={() => {
            onAdjust(-0.001);
          }}
        >
          <span className="adjust-symbol">
            <Icon name="minus" />
          </span>
          <span>
            <strong>Diminuir tom</strong>
            <small aria-hidden="true">Seta para a esquerda</small>
          </span>
        </button>
        <button
          type="button"
          className="secondary"
          disabled={!enabled}
          onClick={() => {
            onAdjust(0.001);
          }}
        >
          <span className="adjust-symbol">
            <Icon name="plus" />
          </span>
          <span>
            <strong>Aumentar tom</strong>
            <small aria-hidden="true">Seta para a direita</small>
          </span>
        </button>
      </div>
      <KeyboardHints compact />
      {confirm}
    </section>
  );
}
