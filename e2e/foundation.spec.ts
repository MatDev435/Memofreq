import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('carrega o build sem erros e permite pular para o conteúdo', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/');

  await expect(page).toHaveTitle('Memofreq — Memória auditiva');
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Memofreq' }),
  ).toBeVisible();

  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('link', { name: 'Ir para o conteúdo' }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();

  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test('não apresenta violações detectáveis pelo axe na tela inicial', async ({
  page,
}) => {
  await page.goto('/');

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();

  expect(results.violations).toEqual([]);
});
