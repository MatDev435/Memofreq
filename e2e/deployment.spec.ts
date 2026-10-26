import { expect, test } from '@playwright/test';

test('build estático funciona em subpasta sem Vite, incluindo áudio e recarga', async ({
  page,
  request,
}) => {
  test.setTimeout(30000);
  const errors: string[] = [];
  const assets: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (['script', 'stylesheet'].includes(response.request().resourceType())) {
      assets.push(response.url());
      expect(response.status()).toBe(200);
    }
  });
  await page.goto('http://127.0.0.1:4174/memofreq/');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Memofreq' }),
  ).toBeVisible();
  await page.getByRole('radio', { name: /^Hard/ }).check();
  await page
    .getByRole('button', { name: 'Iniciar partida', exact: true })
    .click();
  await expect(
    page.getByRole('slider', { name: 'Ajustar tom', exact: true }),
  ).toBeEnabled({ timeout: 12000 });
  await page
    .getByRole('button', { name: 'Confirmar tentativa', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Resultado do round', exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Iniciar partida', exact: true }),
  ).toBeEnabled();
  expect(assets.length).toBeGreaterThanOrEqual(2);
  expect(
    assets.every((url) =>
      url.startsWith('http://127.0.0.1:4174/memofreq/assets/'),
    ),
  ).toBe(true);
  expect(
    (
      await request.get('http://127.0.0.1:4174/memofreq/assets/missing.js')
    ).status(),
  ).toBe(404);
  expect(errors).toEqual([]);
});
