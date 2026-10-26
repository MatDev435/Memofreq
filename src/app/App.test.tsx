import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('Fundação do Memofreq', () => {
  it('apresenta a proposta do jogo dentro do conteúdo principal', () => {
    render(<App />);

    expect(screen.getByRole('main')).toContainElement(
      screen.getByRole('heading', { level: 1, name: 'Memofreq' }),
    );
    expect(screen.getByText(/Normal, Hard e Extreme/)).toBeVisible();
    expect(screen.getByText(/O jogo está em construção/)).toBeVisible();
  });

  it('oferece acesso ao conteúdo pelo primeiro foco de teclado', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.tab();

    expect(
      screen.getByRole('link', { name: 'Ir para o conteúdo' }),
    ).toHaveFocus();
    expect(screen.getByRole('main')).toHaveAttribute('id', 'conteudo');
  });
});
