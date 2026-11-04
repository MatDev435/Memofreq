import type { CSSProperties } from 'react';
import { DEFAULT_RULES } from '../../domain/config';
import type { FrequencyRange } from '../../domain/config';
import { frequencyToPosition } from '../../domain/frequencies';

function percent(frequencyHz: number, range: FrequencyRange): number {
  const clamped = Math.min(range.maxHz, Math.max(range.minHz, frequencyHz));
  return frequencyToPosition(clamped, range) * 100;
}

function position(value: number): CSSProperties {
  return { left: `${String(value)}%` };
}

/**
 * Régua da faixa em escala logarítmica com o alvo e o palpite. É apenas
 * visual: os mesmos valores estão na lista de detalhes do resultado.
 */
export function FrequencyRuler({
  targetHz,
  playerHz,
  range = DEFAULT_RULES.range,
  playing = null,
}: {
  readonly targetHz: number;
  readonly playerHz: number;
  readonly range?: FrequencyRange | undefined;
  /** Marcador destacado durante a escuta comparativa. */
  readonly playing?: 'target' | 'player' | null;
}) {
  const target = percent(targetHz, range);
  const player = percent(playerHz, range);
  const start = Math.min(target, player);
  return (
    <div className="frequency-ruler" aria-hidden="true">
      <div className="ruler-track">
        <span
          className="ruler-gap"
          style={{
            left: `${String(start)}%`,
            width: `${String(Math.abs(target - player))}%`,
          }}
        />
        <span
          className="ruler-marker ruler-target"
          data-playing={playing === 'target'}
          style={position(target)}
        >
          <span className="ruler-label">Alvo</span>
        </span>
        <span
          className="ruler-marker ruler-player"
          data-playing={playing === 'player'}
          style={position(player)}
        >
          <span className="ruler-label">Você</span>
        </span>
      </div>
      <div className="ruler-scale">
        <span>{String(Math.round(range.minHz))} Hz</span>
        <span>{String(Math.round(range.maxHz))} Hz</span>
      </div>
    </div>
  );
}
