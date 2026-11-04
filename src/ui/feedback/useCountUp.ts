import { useEffect, useState } from 'react';

/** Valor animado de 0 até `target`; sem animação, devolve o alvo direto. */
export function useCountUp(
  target: number,
  enabled: boolean,
  durationMs = 900,
): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let frame = 0;
    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      setValue(progress === 1 ? target : target * (1 - (1 - progress) ** 3));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [target, enabled, durationMs]);
  return enabled ? value : target;
}
