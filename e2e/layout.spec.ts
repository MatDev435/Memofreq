import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { expectReflow } from './results-checks';

test('inicial continua utilizável a 320 px com texto a 200%', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/');
  await page.addStyleTag({ content: 'html { font-size: 200%; }' });
  await page.getByRole('radio', { name: /^Extreme/ }).check();
  await page.screenshot({
    path: testInfo.outputPath('home-320-text-200.png'),
    fullPage: true,
  });
  await expectReflow(page);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
});
