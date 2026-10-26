import type { CSSProperties } from 'react';

const paths = {
  volume: 'M11 5 6 9H3v6h3l5 4V5Zm4 3a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14',
  play: 'm8 4 13 8-13 8V4Z',
  stop: 'M5 5h14v14H5z',
  gamepad:
    'M7 7h10c3 0 5 10 3 12-2 1-4-3-5-3H9c-1 0-3 4-5 3C2 17 4 7 7 7Zm0 3v6m-3-3h6m6-2h.01m3 3h.01',
  clock: 'M12 8v5l3 2m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  hidden:
    'm3 3 18 18M10 5c7-1 12 7 12 7a22 22 0 0 1-4 5M7 7a23 23 0 0 0-5 5s4 7 10 7c1 0 3 0 4-1m-6-8a3 3 0 0 0 4 4',
  target: 'M21 12a9 9 0 1 1-9-9m6-1 1 4 4 1-4 1-7 7m4-3a4 4 0 1 1-4-4',
  trophy:
    'M8 3h8v7a4 4 0 0 1-8 0V3Zm0 2H4v3c0 3 2 5 5 5m7-8h4v3c0 3-2 5-5 5m-3 1v6m-4 1h8',
  headphones: 'M4 14v-3a8 8 0 0 1 16 0v3M4 12H3v8h4v-8H4Zm16 0h1v8h-4v-8h3Z',
  keyboard:
    'M3 5h18v14H3V5Zm3 4h.01M10 9h.01M14 9h.01M18 9h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M7 16h10',
  arrow: 'M4 12h16m-6-6 6 6-6 6',
  back: 'M20 12H4m6-6-6 6 6 6',
  exit: 'M9 5H4v14h5m5-15 7 8-7 8m-7-8h14',
  home: 'm3 11 9-8 9 8m-15-2v12h4v-7h4v7h4V9',
  restart: 'M20 8a8 8 0 1 0 0 8m0-13v5h-5',
  minus: 'M5 12h14',
  plus: 'M5 12h14m-7-7v14',
  check: 'm5 12 4 4L19 6',
  ear: 'M7 9a5 5 0 0 1 10 0c0 5-5 4-5 9a3 3 0 0 1-6 0m4-8a2 2 0 0 1 4 0c0 2-3 2-3 5',
  motion: 'M5 5v14m5-10v6m5-12v18m5-13v8',
  bars: 'M5 14v7m7-14v14m7-20v20',
  chevron: 'm9 5 7 7-7 7',
} as const;
export type IconName = keyof typeof paths;

export function Icon({
  name,
  className = '',
  style,
}: {
  readonly name: IconName;
  readonly className?: string;
  readonly style?: CSSProperties;
}) {
  return (
    <svg
      className={`icon ${className}`}
      style={style}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={paths[name]} />
    </svg>
  );
}
