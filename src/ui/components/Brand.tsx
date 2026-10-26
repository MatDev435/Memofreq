import { useId } from 'react';

export function Brand({ hero = false }: { readonly hero?: boolean }) {
  const id = useId();
  return (
    <span className={`brand${hero ? ' brand-hero' : ''}`}>
      <svg viewBox="0 0 62 64" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={id}>
            <stop stopColor="#bd67ff" />
            <stop offset=".45" stopColor="#8b60ff" />
            <stop offset="1" stopColor="#21dff6" />
          </linearGradient>
        </defs>
        {[12, 28, 46, 62, 44, 26, 10].map((height, i) => (
          <rect
            key={i}
            x={i * 9}
            y={(64 - height) / 2}
            width="5.5"
            height={height}
            rx="3"
            fill={`url(#${id})`}
          />
        ))}
      </svg>
      <span>
        Memo<span className="brand-accent">freq</span>
      </span>
    </span>
  );
}
