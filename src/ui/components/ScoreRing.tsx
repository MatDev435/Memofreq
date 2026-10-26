import type { CSSProperties, ReactNode } from 'react';
import { formatNumber } from '../format';

export function ScoreRing({
  value,
  max = 10,
  children,
}: {
  readonly value: number;
  readonly max?: number;
  readonly children?: ReactNode;
}) {
  return (
    <div
      className="score-ring"
      style={{ '--ring-offset': 100 - (value / max) * 100 } as CSSProperties}
    >
      <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">
        <circle className="ring-track" cx="60" cy="60" r="51" />
        <circle className="ring-fill" cx="60" cy="60" r="51" pathLength="100" />
      </svg>
      <div className="ring-content">
        {children}
        <strong>{formatNumber(value)}</strong>
        <span>/ {max}</span>
      </div>
    </div>
  );
}
