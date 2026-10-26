import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES } from '../../domain/config';
import type { GameResult, RoundResult } from '../../domain/models';
import { RoundSummary } from './RoundSummary';
import { FinalScreen } from '../screens/FinalScreen';
import { ScoreRing } from './ScoreRing';

function round(count: number, roundIndex = 0): RoundResult {
  return {
    roundIndex,
    score: count === 1 ? 3 : count === 2 ? 4.5 : 6,
    attempts: Array.from({ length: count }, (_, attemptIndex) => ({
      attemptIndex,
      targetHz: 100.123456 + attemptIndex * 100,
      playerHz: 120.987654 + attemptIndex * 100,
      differenceHz: 20.864198,
      distanceCents: 321.234567,
      score: 3 * (attemptIndex + 1),
    })),
  };
}

const noop = () => undefined;

describe('Apresentação dos resultados por modalidade', () => {
  it.each([1, 2, 3])(
    'revela %i frequências juntas e preserva a nota consolidada do round',
    (count) => {
      const data = round(count);
      const { container } = render(<RoundSummary round={data} />);
      expect(container.querySelectorAll('.round-attempt')).toHaveLength(count);
      expect(
        screen.getByRole('heading', {
          name: count > 1 ? /Média do round: / : /Pontuação do round: /,
        }),
      ).toHaveTextContent(count === 3 ? '6,00' : count === 2 ? '4,50' : '3,00');
      for (let i = 0; i < count; i += 1) {
        const card = screen.getByRole('region', {
          name: `Frequência ${String(i + 1)} de ${String(count)}`,
        });
        expect(within(card).getByText('Diferença')).toBeVisible();
        expect(within(card).getByText('(321,23 cents)')).toBeVisible();
        expect(card.closest('[aria-live]')).toBeNull();
      }
      expect(container.querySelector('[role="status"]')).toBeNull();
      expect(data.attempts[0]?.targetHz).toBe(100.123456);
    },
  );

  it.each([1, 2, 3])(
    'apresenta tabela final de %i frequências sem somar palpites no lugar da média',
    (count) => {
      const rounds = Array.from({ length: 5 }, (_, i) => round(count, i));
      const data: GameResult = {
        gameId: 'presentation',
        modality:
          count === 1 ? 'normal' : count === 2 ? 'extreme-2' : 'extreme-3',
        rules: DEFAULT_RULES,
        rounds,
        score: count === 1 ? 15 : count === 2 ? 22.5 : 30,
      };
      const { container } = render(
        <FinalScreen
          result={data}
          titleRef={null}
          busy={false}
          onRestart={noop}
          onLeave={noop}
        />,
      );
      const table = screen.getByRole('table', { name: 'Pontuação dos rounds' });
      expect(within(table).getAllByRole('columnheader')).toHaveLength(
        count === 1 ? 2 : count + 2,
      );
      expect(container.querySelectorAll('.round-score-value')).toHaveLength(5);
      expect(container.querySelector('.round-score-value')).toHaveTextContent(
        count === 3 ? '6,00' : count === 2 ? '4,50' : '3,00',
      );
      expect(container.querySelector('.total-score')).toHaveTextContent(
        count === 3 ? '30,00 / 50' : count === 2 ? '22,50 / 50' : '15,00 / 50',
      );
      expect(
        container.querySelector('.final-frequency-details'),
      ).not.toHaveAttribute('open');
      expect(
        screen.getByRole('heading', { name: 'Resultado da partida' }),
      ).not.toHaveAccessibleName(/\d|Hz/);
      expect(table.closest('[aria-live]')).toBeNull();
    },
  );

  it('representa o total na escala de 50 e mantém os dados precisos', () => {
    const { container } = render(<ScoreRing value={12.3456789} max={50} />);
    expect(screen.getByText('12,35')).toBeVisible();
    expect(screen.getByText('/ 50')).toBeVisible();
    expect(
      Number(
        container
          .querySelector('.score-ring')
          ?.getAttribute('style')
          ?.match(/[\d.]+/)?.[0],
      ),
    ).toBeCloseTo(75.3086422);
    expect(container.querySelector('svg')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    expect(container.querySelector('[aria-live]')).toBeNull();
  });
});
