import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RoundScores } from './RoundScores';

function results(scores: readonly number[]) {
  return scores.map((score, roundIndex) => ({
    roundIndex,
    score,
    attempts: [],
  }));
}

describe('Resultados visuais e textuais dos rounds', () => {
  it('compara cinco notas na mesma escala de zero a dez, incluindo uma barra zero', () => {
    render(<RoundScores rounds={results([0, 2.5, 5, 7.5, 10])} />);
    const chart = screen.getByRole('img', {
      name: 'Gráfico de pontuação dos rounds',
    });
    expect(chart).toHaveAccessibleDescription(/escala fixa de zero a dez/);
    const bars = [...chart.querySelectorAll('rect')];
    expect(bars).toHaveLength(5);
    const heights = bars.map((bar) => Number(bar.getAttribute('height')));
    expect(heights).toEqual([0, 41, 82, 123, 164]);
    expect(bars.map((bar) => Number(bar.getAttribute('y')))).toEqual([
      200, 159, 118, 77, 36,
    ]);
    const table = screen.getByRole('table', { name: 'Pontuação dos rounds' });
    expect(within(table).getAllByRole('row')).toHaveLength(6);
    expect(
      within(table)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual(['0,00', '2,50', '5,00', '7,50', '10,00']);
    expect(chart.closest('[aria-live]')).toBeNull();
    expect(table.closest('[aria-live]')).toBeNull();
    expect(chart).not.toHaveAttribute('tabindex');
  });

  it('mantém a escala em notas baixas e arredonda somente rótulos e tabela', () => {
    const rounds = results([1.23456789, 1, 0, 0.25, 0.5]);
    render(<RoundScores rounds={rounds} />);
    const chart = screen.getByRole('img');
    const height = Number(chart.querySelector('rect')?.getAttribute('height'));
    expect(height).toBeCloseTo(20.246913396, 10);
    expect(chart.querySelector('.chart-score')).toHaveTextContent('1,23');
    expect(screen.getAllByRole('cell')[0]).toHaveTextContent('1,23');
    expect(rounds[0]?.score).toBe(1.23456789);
    expect(
      [...chart.querySelectorAll('.chart-tick text')].map(
        (node) => node.textContent,
      ),
    ).toEqual(['0', '2', '4', '6', '8', '10']);
  });
});
