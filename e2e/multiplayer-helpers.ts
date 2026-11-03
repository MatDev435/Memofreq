import AxeBuilder from '@axe-core/playwright';
import { devices, expect } from '@playwright/test';
import type { Browser, Page, TestInfo } from '@playwright/test';

const PROJECT_DEVICES: Record<string, (typeof devices)[string]> = {
  chromium: devices['Desktop Chrome'],
  'mobile-chromium': devices['Pixel 7'],
  firefox: devices['Desktop Firefox'],
  webkit: devices['Desktop Safari'],
};

/** Outro jogador, com o mesmo perfil de navegador do projeto atual. */
export async function openPlayer(
  browser: Browser,
  testInfo: TestInfo,
): Promise<Page> {
  const device = PROJECT_DEVICES[testInfo.project.name] ?? {};
  const context = await browser.newContext({
    ...device,
    baseURL: 'http://127.0.0.1:4173',
  });
  const page = await context.newPage();
  await page.goto('/');
  return page;
}

export function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

/** Cria a sala pela interface e devolve o link de convite. */
export async function createRoom(page: Page, name: string): Promise<string> {
  await page.getByRole('button', { name: 'Jogar com amigos' }).click();
  await page.getByLabel('Seu apelido').fill(name);
  await page.getByRole('button', { name: 'Criar sala', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Lobby' })).toBeFocused();
  return page.getByLabel('Link de convite').inputValue();
}

export async function joinByInvite(
  page: Page,
  link: string,
  name: string,
): Promise<void> {
  await page.goto(link);
  await expect(
    page.getByRole('heading', { name: 'Convite para uma sala' }),
  ).toBeVisible();
  await page.getByLabel('Seu apelido').fill(name);
  await page.getByRole('button', { name: 'Entrar na sala' }).click();
  await expect(page.getByRole('heading', { name: 'Lobby' })).toBeVisible();
}

export async function joinByCode(
  page: Page,
  code: string,
  name: string,
): Promise<void> {
  await page.getByRole('button', { name: 'Jogar com amigos' }).click();
  await page.getByLabel('Seu apelido').fill(name);
  await page.getByLabel('Código da sala').fill(code);
  await page.getByRole('button', { name: 'Entrar na sala' }).click();
}

export function participants(page: Page, label = 'Participantes da sala') {
  return page.getByRole('list', { name: label });
}

export function liveRegion(page: Page) {
  return page.locator('[role="status"][aria-live="polite"]');
}

export async function waitForAttempt(page: Page): Promise<void> {
  await expect(page.getByRole('slider', { name: 'Ajustar tom' })).toBeEnabled({
    timeout: 20_000,
  });
}

/** Ajusta levemente e confirma todas as tentativas do round. */
export async function answerRound(page: Page, attempts: number) {
  await waitForAttempt(page);
  for (let index = 0; index < attempts; index += 1) {
    await page.getByRole('button', { name: 'Aumentar tom' }).click();
    await page.getByRole('button', { name: 'Confirmar tentativa' }).click();
  }
}

export async function setVisible(page: Page, visible: boolean) {
  await page.evaluate((isVisible) => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => (isVisible ? 'visible' : 'hidden'),
    });
    document.dispatchEvent(new Event('visibilitychange'));
  }, visible);
}

export async function capture(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({
    path: testInfo.outputPath(`${name}.png`),
    fullPage: true,
    animations: 'disabled',
  });
}

export async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.map((violation) => ({
      id: violation.id,
      nodes: violation.nodes.map((node) => node.target.join(' ')),
    })),
  ).toEqual([]);
}
