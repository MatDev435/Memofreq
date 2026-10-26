import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { expectReflow } from './results-checks';

test('redesign preserva controles e resultados com texto ampliado e movimento reduzido', async ({
  page,
}) => {
  test.setTimeout(45000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/');
  await page.addStyleTag({ content: 'html { font-size: 200%; }' });
  await page.getByRole('radio', { name: /^Hard/ }).check();
  const motion = page.getByRole('button', { name: 'Animações visuais' });
  await motion.click();
  await expect(motion).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Iniciar partida' }).click();
  await expect(page.getByRole('radio')).toHaveCount(0);
  const slider = page.getByRole('slider', { name: 'Ajustar tom' });
  await expect(slider).toBeEnabled({ timeout: 12000 });
  await expectReflow(page);
  await expect(page.getByRole('slider', { name: 'Volume' })).toBeVisible();
  await slider.focus();
  await page.keyboard.press('ArrowRight');
  await expect(slider).toHaveAttribute('aria-valuetext', 'Ajuste pelo som');
  await expect(page.getByRole('status')).toBeEmpty();
  await expect(page.getByText(/Hz/)).toHaveCount(0);
  expect(
    await page.evaluate(
      () =>
        document
          .getAnimations()
          .filter((animation) => animation.playState === 'running').length,
    ),
  ).toBe(0);
  await page.getByRole('button', { name: 'Confirmar tentativa' }).click();
  await expect(
    page.getByRole('heading', { name: 'Resultado do round', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.round-attempt')).toHaveCount(1);
  await expectReflow(page);
  const ring = page.locator('.round-attempt .score-ring');
  const number = ring.locator('strong');
  const circleBox = await ring.boundingBox();
  const numberBox = await number.boundingBox();
  if (!circleBox || !numberBox) throw new Error('Indicador ausente.');
  expect(numberBox.x).toBeGreaterThanOrEqual(circleBox.x);
  expect(numberBox.x + numberBox.width).toBeLessThanOrEqual(
    circleBox.x + circleBox.width,
  );
  expect(numberBox.y).toBeGreaterThanOrEqual(circleBox.y);
  expect(numberBox.y + numberBox.height).toBeLessThanOrEqual(
    circleBox.y + circleBox.height,
  );
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.getByText('Ver detalhes técnicos', { exact: true }).click();
  await expect(page.locator('.technical-details')).toHaveAttribute('open', '');
  await page.getByRole('button', { name: 'Encerrar partida' }).click();
  await expect(
    page.getByRole('button', { name: 'Iniciar partida' }),
  ).toBeFocused();
});
