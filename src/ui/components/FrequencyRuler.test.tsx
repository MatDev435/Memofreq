import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FrequencyRuler } from './FrequencyRuler';

function left(container: HTMLElement, selector: string): number {
  const element = container.querySelector<HTMLElement>(selector);
  return Number.parseFloat(element?.style.left ?? 'NaN');
}

describe('Régua alvo × palpite', () => {
  it('posiciona os marcadores na escala logarítmica da faixa', () => {
    const { container } = render(
      <FrequencyRuler
        targetHz={80}
        playerHz={Math.sqrt(80 * 700)}
        range={{ minHz: 80, maxHz: 700 }}
      />,
    );
    expect(left(container, '.ruler-target')).toBeCloseTo(0);
    // A média geométrica fica no centro de uma escala logarítmica.
    expect(left(container, '.ruler-player')).toBeCloseTo(50);
    expect(left(container, '.ruler-gap')).toBeCloseTo(0);
  });

  it('é decorativa e não duplica os valores para a tecnologia assistiva', () => {
    const { container } = render(
      <FrequencyRuler targetHz={300} playerHz={310} />,
    );
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });
});
