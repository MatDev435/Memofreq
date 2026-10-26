import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

export async function expectFinalScores(page: Page) {
  const chart = page.getByRole('img', {
    name: 'Gráfico de pontuação dos rounds',
  });
  await expect(chart).toBeVisible();
  await expect(chart.locator('rect')).toHaveCount(5);
  const table = page.getByRole('table', { name: 'Pontuação dos rounds' });
  const values = await table
    .locator('tbody .round-score-value')
    .allTextContents();
  expect(values).toHaveLength(5);
  expect(await chart.locator('.chart-score').allTextContents()).toEqual(values);
  const displayedTotal = Number(
    (await page.locator('.total-score strong').innerText())
      .split('/')[0]
      ?.trim()
      .replace(',', '.'),
  );
  const displayedSum = values.reduce(
    (sum, value) => sum + Number(value.replace(',', '.')),
    0,
  );
  expect(Math.abs(displayedTotal - displayedSum)).toBeLessThanOrEqual(0.031);
  await expect(page.getByRole('status')).toHaveText('Partida concluída.');
  await expect(
    page.getByRole('heading', { name: 'Resultado da partida', exact: true }),
  ).toBeFocused();
  await expect(chart).not.toBeFocused();
  await page.evaluate(() => {
    for (const state of ['hidden', 'visible']) {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => state,
      });
      document.dispatchEvent(new Event('visibilitychange'));
    }
  });
  expect(
    await table.locator('tbody .round-score-value').allTextContents(),
  ).toEqual(values);
  await expect(chart).toBeVisible();
}

export async function expectReflow(page: Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth));
  for (const button of await page.getByRole('button').all()) {
    const box = await button.boundingBox();
    if (!box) continue;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(
      await page.evaluate(() => window.innerWidth),
    );
  }
}
