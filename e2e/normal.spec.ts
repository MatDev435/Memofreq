import AxeBuilder from '@axe-core/playwright';
import { expectFinalScores, expectReflow } from './results-checks';
import { expect, test } from '@playwright/test';

declare global {
  interface Window {
    gameAudioMetrics: {
      contexts: number;
      sources: number;
      liveSources: number;
    };
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.gameAudioMetrics = { contexts: 0, sources: 0, liveSources: 0 };
    const Native = window.AudioContext;
    window.AudioContext = class extends Native {
      constructor(...args: ConstructorParameters<typeof AudioContext>) {
        super(...args);
        window.gameAudioMetrics.contexts += 1;
      }
      override createOscillator(): OscillatorNode {
        const node = super.createOscillator();
        window.gameAudioMetrics.sources += 1;
        window.gameAudioMetrics.liveSources += 1;
        let released = false;
        const disconnect = node.disconnect.bind(node);
        node.disconnect = () => {
          if (!released) {
            released = true;
            window.gameAudioMetrics.liveSources -= 1;
          }
          Reflect.apply(disconnect, node, []);
        };
        return node;
      }
    };
  });
  await page.goto('/');
});

test('joga cinco rounds reais, revela resultados e retorna sem áudio restante', async ({
  page,
}, testInfo) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.screenshot({
    path: testInfo.outputPath('home.png'),
    fullPage: true,
    animations: 'disabled',
  });
  const volume = page.getByRole('slider', { name: 'Volume', exact: true });
  await volume.focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  await page.getByRole('button', { name: 'Testar áudio', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Testar áudio', exact: true }),
  ).toBeEnabled();
  await page
    .getByRole('button', { name: 'Iniciar partida', exact: true })
    .click();
  for (let round = 0; round < 5; round += 1) {
    await expect(
      page.getByText(`Round ${String(round + 1)} de 5`, { exact: true }),
    ).toBeVisible();
    const tone = page.getByRole('slider', { name: 'Ajustar tom', exact: true });
    await expect(tone).toBeEnabled({ timeout: 12000 });
    await expect(
      page.getByText('Frequência alvo', { exact: true }),
    ).toHaveCount(0);
    await expect(page.getByRole('status')).toBeEmpty();
    await expect(tone).toHaveAttribute('aria-valuetext', 'Ajuste pelo som');
    await tone.focus();
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowRight');
    expect(await tone.inputValue().then(Number)).toBeCloseTo(0.001, 9);
    await page
      .getByRole('button', { name: 'Aumentar tom', exact: true })
      .click();
    await expect(page.getByRole('status')).toBeEmpty();
    await expect(tone).toHaveAccessibleName('Ajustar tom');
    if (round === 0) {
      await page.screenshot({
        path: testInfo.outputPath('attempt.png'),
        fullPage: true,
        animations: 'disabled',
      });
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(results.violations).toEqual([]);
    }
    await page
      .getByRole('button', { name: 'Confirmar tentativa', exact: true })
      .click();
    await expect(
      page.getByRole('heading', { name: 'Resultado do round', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('status')).toHaveText('Resposta confirmada.');
    await expect
      .poll(() => page.evaluate(() => window.gameAudioMetrics.liveSources))
      .toBe(0);
    await expect(
      page.getByRole('button', { name: /repetir|replay|ouvir referência/i }),
    ).toHaveCount(0);
    await page
      .getByRole('button', {
        name: round === 4 ? 'Ver resultado final' : 'Próximo round',
        exact: true,
      })
      .click();
  }
  await expect(
    page.getByRole('heading', { name: 'Resultado da partida', exact: true }),
  ).toBeFocused();
  await expect(page.locator('table tbody tr')).toHaveCount(5);
  await expectFinalScores(page);
  expect(await page.evaluate(() => window.gameAudioMetrics.contexts)).toBe(1);
  expect(await page.evaluate(() => window.gameAudioMetrics.sources)).toBe(55);
  const violations = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(violations.violations).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath('results.png'),
    fullPage: true,
    animations: 'disabled',
  });
  const viewport = page.viewportSize();
  if (!viewport) throw new Error('Viewport ausente.');
  await page.setViewportSize({ width: 320, height: 740 });
  const textSize = await page.addStyleTag({
    content: 'html { font-size: 200%; }',
  });
  await page.screenshot({
    path: testInfo.outputPath('results-320-text-200.png'),
    fullPage: true,
    animations: 'disabled',
  });
  await expectReflow(page);
  await textSize.evaluate((element) => {
    element.parentNode?.removeChild(element);
  });
  await page.setViewportSize(viewport);
  await page
    .getByRole('button', { name: 'Jogar novamente', exact: true })
    .click();
  await expect(
    page.getByText('Prepare-se para ouvir', { exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Encerrar partida', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Iniciar partida', exact: true }),
  ).toBeEnabled();
  await expect
    .poll(() => page.evaluate(() => window.gameAudioMetrics.liveSources))
    .toBe(0);
  expect(errors).toEqual([]);
});

test('eventos de visibilidade pausam contagem, interrompem referência e preservam resultado', async ({
  page,
}) => {
  test.setTimeout(60000);
  async function visible(value: boolean) {
    await page.evaluate((isVisible) => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => (isVisible ? 'visible' : 'hidden'),
      });
      document.dispatchEvent(new Event('visibilitychange'));
    }, value);
  }
  await page
    .getByRole('button', { name: 'Iniciar partida', exact: true })
    .click();
  await expect(
    page.getByText('Prepare-se para ouvir', { exact: true }),
  ).toBeVisible();
  await visible(false);
  await visible(true);
  await expect(
    page.getByRole('heading', { name: 'Contagem pausada' }),
  ).toBeVisible();
  expect(await page.evaluate(() => window.gameAudioMetrics.sources)).toBe(0);
  await page
    .getByRole('button', { name: 'Retomar contagem', exact: true })
    .click();
  await expect(page.getByText('Ouça e memorize', { exact: true })).toBeVisible({
    timeout: 5000,
  });
  await visible(false);
  await visible(true);
  await expect(
    page.getByRole('heading', { name: 'Partida interrompida', exact: true }),
  ).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.gameAudioMetrics.liveSources))
    .toBe(0);
  await page.getByRole('button', { name: 'Nova partida', exact: true }).click();
  await expect(
    page.getByRole('slider', { name: 'Ajustar tom', exact: true }),
  ).toBeEnabled({ timeout: 12000 });
  await page
    .getByRole('button', { name: 'Confirmar tentativa', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Resultado do round', exact: true }),
  ).toBeVisible();
  const result = await page.locator('.result-details').innerText();
  await visible(false);
  await visible(true);
  await expect(
    page.getByRole('heading', { name: 'Resultado do round', exact: true }),
  ).toBeVisible();
  expect(await page.locator('.result-details').innerText()).toBe(result);
  await expect(page.getByText('Round 1 de 5', { exact: true })).toBeVisible();
  await page
    .getByRole('button', { name: 'Próximo round', exact: true })
    .click();
  await expect(page.getByText('Round 2 de 5', { exact: true })).toBeVisible();
  await page
    .getByRole('button', { name: 'Encerrar partida', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Iniciar partida', exact: true }),
  ).toBeEnabled();
});
