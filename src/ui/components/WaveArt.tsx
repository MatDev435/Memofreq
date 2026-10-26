import { memo, useId } from 'react';

function wave(y: number, phase: number, amplitude: number) {
  return Array.from({ length: 161 }, (_, i) => {
    const x = i * 6.25;
    const envelope = Math.exp(-((x - 510) ** 2) / 110000);
    const value =
      y +
      Math.sin(x / 55 + phase) * amplitude * envelope +
      Math.sin(x / 120 + phase) * 12;
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${value.toFixed(1)}`;
  }).join(' ');
}
const mainWaves = [wave(120, 0, 83), wave(120, 1.4, 32), wave(120, 2.3, 18)];
const meshWaves = Array.from({ length: 13 }, (_, i) =>
  wave(90 + i * 5, i * 0.12, 65),
);
const bars = Array.from({ length: 100 }, (_, i) => {
  const x = i * 10 + 5;
  const envelope =
    Math.exp(-((x - 400) ** 2) / 9500) + Math.exp(-((x - 585) ** 2) / 15000);
  return {
    x,
    height: Math.max(2, envelope * (32 + Math.sin(i * 1.7) ** 2 * 75)),
  };
});

export const WaveArt = memo(function WaveArt({
  variant = 'hero',
  active = false,
  className = '',
}: {
  readonly variant?: 'hero' | 'signal' | 'mini' | 'mesh';
  readonly active?: boolean;
  readonly className?: string;
}) {
  const id = useId();
  return (
    <svg
      className={`wave-art wave-${variant}${active ? ' is-active' : ''} ${className}`}
      viewBox="0 0 1000 240"
      aria-hidden="true"
      focusable="false"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient
          id={`${id}-ink`}
          gradientUnits="userSpaceOnUse"
          x1="0"
          x2="1000"
          y1="0"
          y2="0"
        >
          <stop stopColor="#7b35fa" />
          <stop offset=".42" stopColor="#ad68ff" />
          <stop offset=".65" stopColor="#36baff" />
          <stop offset="1" stopColor="#09e9fb" />
        </linearGradient>
        <filter id={`${id}-glow`} x="-20%" y="-80%" width="140%" height="260%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
        <linearGradient id={`${id}-fade`}>
          <stop stopColor="#fff" stopOpacity="0" />
          <stop offset=".18" stopColor="#fff" />
          <stop offset=".82" stopColor="#fff" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id={`${id}-mask`}>
          <rect width="1000" height="240" fill={`url(#${id}-fade)`} />
        </mask>
      </defs>
      <g
        mask={`url(#${id}-mask)`}
        className="wave-motion"
        fill="none"
        stroke={`url(#${id}-ink)`}
      >
        {variant === 'mesh' ? (
          meshWaves.map((d, i) => (
            <path
              key={i}
              d={d}
              strokeWidth="1.3"
              strokeDasharray="1 7"
              opacity={0.28 + i * 0.035}
            />
          ))
        ) : (
          <>
            <path
              d={mainWaves[0]}
              strokeWidth="8"
              opacity=".45"
              filter={`url(#${id}-glow)`}
            />
            {bars.map(({ x, height }) => (
              <path
                key={x}
                d={`M${String(x)} ${String(120 - height / 2)}v${String(height)}`}
                strokeWidth={variant === 'signal' ? 2.5 : 1}
                opacity={variant === 'signal' ? 0.95 : 0.44}
              />
            ))}
            {mainWaves.map((d, i) => (
              <path
                key={i}
                d={d}
                strokeWidth={i === 0 ? 2 : 1.1}
                opacity={1 - i * 0.26}
              />
            ))}
          </>
        )}
      </g>
    </svg>
  );
});
