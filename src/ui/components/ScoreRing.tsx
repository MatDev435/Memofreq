import { useId } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { formatNumber } from '../format';

export function ScoreRing({
  value,
  max = 10,
  children,
  showValue = true,
}: {
  readonly value: number;
  readonly max?: number;
  readonly children?: ReactNode;
  readonly showValue?: boolean;
}) {
  const id = useId();
  return (
    <div
      className="score-ring"
      aria-hidden={showValue ? undefined : true}
      style={{ '--ring-offset': 100 - (value / max) * 100 } as CSSProperties}
    >
      <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={`${id}-ring`} x1="0" x2="1" y1="0" y2="1">
            <stop stopColor="#bb3eff" />
            <stop offset=".5" stopColor="#703fff" />
            <stop offset="1" stopColor="#00ddf3" />
          </linearGradient>
        </defs>
        <circle className="ring-track" cx="60" cy="60" r="51" />
        <circle
          className="ring-fill"
          cx="60"
          cy="60"
          r="51"
          pathLength="100"
          style={showValue ? undefined : { stroke: `url(#${id}-ring)` }}
        />
      </svg>
      <div className="ring-content">
        {children}
        {showValue && (
          <>
            <strong>{formatNumber(value)}</strong>
            <span>/ {max}</span>
          </>
        )}
      </div>
    </div>
  );
}
