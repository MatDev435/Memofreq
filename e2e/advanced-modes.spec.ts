import AxeBuilder from '@axe-core/playwright';
import { expectFinalScores } from './results-checks';
import { formatHz } from '../src/ui/format';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

declare global {
  interface Window {
    phaseFiveAudio: {
      contexts: AudioContext[];
      voices: {
        frequencyHz: number;
        startsAt: number;
        endsAt: number | null;
        disconnected: boolean;
      }[];
    };
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.phaseFiveAudio = { contexts: [], voices: [] };
    const Native = window.AudioContext;
    window.AudioContext = class extends Native {
      constructor(...args: ConstructorParameters<typeof AudioContext>) {
        super(...args);
        window.phaseFiveAudio.contexts.push(this);
      }
      override createOscillator(): OscillatorNode {
        const node = super.createOscillator();
        const record = {
          frequencyHz: 0,
          startsAt: 0,
          endsAt: null as number | null,
          disconnected: false,
        };
        window.phaseFiveAudio.voices.push(record);
        const setFrequency = node.frequency.setValueAtTime.bind(node.frequency);
        node.frequency.setValueAtTime = (value, when) => {
          record.frequencyHz = value;
          return setFrequency(value, when);
        };
        const rampFrequency = node.frequency.linearRampToValueAtTime.bind(
          node.frequency,
        );
        node.frequency.linearRampToValueAtTime = (value, when) => {
          record.frequencyHz = value;
          return rampFrequency(value, when);
        };
        const start = node.start.bind(node);
        node.start = (when = 0) => {
          record.startsAt = when;
          start(when);
        };
        const stop = node.stop.bind(node);
        node.stop = (when = 0) => {
          record.endsAt = when;
          stop(when);
        };
        const disconnect = node.disconnect.bind(node);
        node.disconnect = () => {
          record.disconnected = true;
          Reflect.apply(disconnect, node, []);
        };
        return node;
      }
    };
  });
  await page.goto('/');
});

async function visible(page: Page, value: boolean) {
  await page.evaluate((isVisible) => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => (isVisible ? 'visible' : 'hidden'),
    });
    document.dispatchEvent(new Event('visibilitychange'));
  }, value);
}

for (const { mode, count } of [
  { mode: 'Hard', count: 1 },
  { mode: 'Extreme', count: 2 },
  { mode: 'Extreme', count: 3 },
]) {
  test(`${mode} ${String(count)}: cinco rounds reais, frequências ocultas e reinício`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(150000);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const volume = page.getByRole('slider', { name: 'Volume', exact: true });
    await volume.focus();
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowRight');
    await page.getByRole('radio', { name: new RegExp(`^${mode}`) }).check();
    if (count > 1)
      await page
        .getByRole('radio', {
          name: `${String(count)} frequências`,
          exact: true,
        })
        .check();
    if (count === 3)
      await page.screenshot({
        path: testInfo.outputPath('selection.png'),
        fullPage: true,
        animations: 'disabled',
      });
    await page
      .getByRole('button', { name: 'Iniciar partida', exact: true })
      .click();
    for (let round = 0; round < 5; round += 1) {
      const tone = page.getByRole('slider', {
        name: 'Ajustar tom',
        exact: true,
      });
      await expect(tone).toBeEnabled({ timeout: 14000 });
      const references = await page.evaluate(
        ({ roundIndex, referenceCount }) => {
          const offset = roundIndex * (referenceCount + 1);
          return window.phaseFiveAudio.voices.slice(
            offset,
            offset + referenceCount,
          );
        },
        { roundIndex: round, referenceCount: count },
      );
      expect(references).toHaveLength(count);
      expect(new Set(references.map((voice) => voice.frequencyHz)).size).toBe(
        count,
      );
      for (let i = 0; i < references.length; i += 1) {
        const voice = references[i];
        if (!voice || voice.endsAt === null)
          throw new Error('Referência ausente.');
        expect(voice.endsAt - voice.startsAt).toBeCloseTo(1.5, 6);
        const previous = references[i - 1];
        if (previous?.endsAt !== null && previous?.endsAt !== undefined) {
          expect(voice.startsAt - previous.endsAt).toBeCloseTo(0.3, 6);
        }
      }
      for (let attempt = 0; attempt < count; attempt += 1) {
        await expect(tone).toBeEnabled();
        await expect(page.getByRole('radio')).toHaveCount(0);
        await expect(page.getByText(/\bHz\b/)).toHaveCount(0);
        await expect(page.locator('.frequency-readout')).toHaveCount(0);
        await expect(page.getByRole('status')).toBeEmpty();
        await expect(tone).toHaveAttribute('aria-valuetext', 'Ajuste pelo som');
        expect(await tone.ariaSnapshot()).not.toMatch(/Hz/);
        if (count > 1)
          await expect(
            page.getByText(
              `Frequência ${String(attempt + 1)} de ${String(count)}`,
              { exact: true },
            ),
          ).toBeVisible();
        const initial = await page.evaluate(
          () => window.phaseFiveAudio.voices.at(-1)?.frequencyHz,
        );
        const target = references[attempt]?.frequencyHz;
        if (initial === undefined || target === undefined)
          throw new Error('Frequências ausentes.');
        expect(
          1200 * Math.abs(Math.log2(initial / target)),
        ).toBeGreaterThanOrEqual(300 - 1e-8);
        await tone.focus();
        await page.keyboard.press('Home');
        await page.keyboard.press('PageUp');
        await page.keyboard.press('ArrowRight');
        expect(Number(await tone.inputValue())).toBeCloseTo(0.011, 9);
        await page
          .getByRole('button', { name: 'Aumentar tom', exact: true })
          .click();
        if (round === 0 && attempt === 0) {
          await page.screenshot({
            path: testInfo.outputPath('attempt.png'),
            fullPage: true,
            animations: 'disabled',
          });
          expect(
            (
              await new AxeBuilder({ page })
                .withTags([
                  'wcag2a',
                  'wcag2aa',
                  'wcag21a',
                  'wcag21aa',
                  'wcag22aa',
                ])
                .analyze()
            ).violations,
          ).toEqual([]);
        }
        const confirm = page.getByRole('button', {
          name: 'Confirmar tentativa',
          exact: true,
        });
        const before = await page.evaluate(
          () => window.phaseFiveAudio.voices.length,
        );
        if (count > 1 && round === 0 && attempt === 0) await confirm.dblclick();
        else {
          await confirm.focus();
          await page.keyboard.press('Enter');
        }
        if (attempt < count - 1) {
          await expect(
            page.getByText(
              `Frequência ${String(attempt + 2)} de ${String(count)}`,
              { exact: true },
            ),
          ).toBeVisible();
          await expect(confirm).toBeFocused();
          await expect(tone).toBeEnabled();
          await expect(page.getByRole('status')).toBeEmpty();
          await expect(page.getByText(/\bHz\b/)).toHaveCount(0);
          await expect(
            page.getByRole('button', {
              name: 'Próxima tentativa',
              exact: true,
            }),
          ).toHaveCount(0);
          const voices = await page.evaluate(
            () => window.phaseFiveAudio.voices,
          );
          expect(voices).toHaveLength(before);
          expect(voices.at(-1)?.endsAt).toBeNull();
          expect(voices.at(-1)?.disconnected).toBe(false);
          if (round === 0 && attempt === 0)
            await page.screenshot({
              path: testInfo.outputPath('next-attempt.png'),
              fullPage: true,
              animations: 'disabled',
            });
        } else {
          await expect(
            page.getByRole('heading', {
              name: 'Resultado do round',
              exact: true,
            }),
          ).toBeVisible();
          await expect(page.getByRole('status')).toHaveText(
            'Resposta confirmada.',
          );
          await expect(
            page.getByText('Frequência alvo', { exact: true }),
          ).toHaveCount(count);
          await expect
            .poll(() =>
              page.evaluate(
                () =>
                  window.phaseFiveAudio.voices.filter(
                    (voice) => !voice.disconnected,
                  ).length,
              ),
            )
            .toBe(0);
        }
      }
      if (count > 1) {
        await expect(
          page.getByRole('heading', { name: /Média do round:/ }),
        ).toBeVisible();
        await expect(page.locator('.round-attempt')).toHaveCount(count);
        for (let i = 0; i < count; i += 1) {
          const card = page.getByRole('region', {
            name: `Frequência ${String(i + 1)} de ${String(count)}`,
            exact: true,
          });
          const target = references[i]?.frequencyHz;
          if (target === undefined) throw new Error('Alvo ausente.');
          await expect(
            card.getByText(formatHz(target), { exact: true }),
          ).toBeVisible();
          await expect(
            card.getByText('Sua frequência', { exact: true }),
          ).toBeVisible();
          await expect(
            card.getByText('Pontuação da tentativa', { exact: true }),
          ).toBeVisible();
        }
        if (round === 0) {
          expect(
            (
              await new AxeBuilder({ page })
                .withTags([
                  'wcag2a',
                  'wcag2aa',
                  'wcag21a',
                  'wcag21aa',
                  'wcag22aa',
                ])
                .analyze()
            ).violations,
          ).toEqual([]);
          await page.screenshot({
            path: testInfo.outputPath('round-result.png'),
            fullPage: true,
            animations: 'disabled',
          });
        }
      }
      if (round === 0) {
        const result = await page.locator('.result-details').allInnerTexts();
        await visible(page, false);
        await visible(page, true);
        expect(await page.locator('.result-details').allInnerTexts()).toEqual(
          result,
        );
      }
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
    await expect(page.getByText(new RegExp(`^Modo ${mode}`))).toBeVisible();
    expect(
      await page.evaluate(() => window.phaseFiveAudio.contexts.length),
    ).toBe(1);
    expect(await page.evaluate(() => window.phaseFiveAudio.voices.length)).toBe(
      (count + 1) * 5,
    );
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath('final-result.png'),
      fullPage: true,
      animations: 'disabled',
    });
    await page
      .getByRole('button', { name: 'Jogar novamente', exact: true })
      .click();
    await expect(
      page.getByRole('heading', { name: new RegExp(`^Modo ${mode}`) }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'Encerrar partida', exact: true })
      .click();
    await expect(
      page.getByRole('radio', { name: new RegExp(`^${mode}`) }),
    ).toBeChecked();
    if (count > 1)
      await expect(
        page.getByRole('radio', {
          name: `${String(count)} frequências`,
          exact: true,
        }),
      ).toBeChecked();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            window.phaseFiveAudio.voices.filter((voice) => !voice.disconnected)
              .length,
        ),
      )
      .toBe(0);
    expect(errors).toEqual([]);
  });
}

test('Extreme: ocultação na pausa da sequência cancela vozes futuras sem replay', async ({
  page,
}) => {
  test.setTimeout(30000);
  await page.getByRole('radio', { name: /^Extreme/ }).check();
  await page.getByRole('radio', { name: '3 frequências', exact: true }).check();
  await page
    .getByRole('button', { name: 'Iniciar partida', exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => window.phaseFiveAudio.voices.length), {
      timeout: 6000,
    })
    .toBe(3);
  // Aguardar o relógio do AudioContext alcançar a primeira pausa; nenhuma duração do produto é alterada.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const waitForGap = () => {
          const first = window.phaseFiveAudio.voices[0];
          const context = window.phaseFiveAudio.contexts[0];
          if (!first || first.endsAt === null || !context)
            throw new Error('Sequência ausente.');
          if (context.currentTime >= first.endsAt + 0.03) {
            Object.defineProperty(document, 'visibilityState', {
              configurable: true,
              get: () => 'hidden',
            });
            document.dispatchEvent(new Event('visibilitychange'));
            resolve();
          } else setTimeout(waitForGap, 10);
        };
        waitForGap();
      }),
  );
  await visible(page, true);
  await expect(
    page.getByRole('heading', { name: 'Partida interrompida', exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.phaseFiveAudio.voices.filter((voice) => !voice.disconnected)
            .length,
      ),
    )
    .toBe(0);
  const voices = await page.evaluate(() => window.phaseFiveAudio.voices);
  expect(voices).toHaveLength(3);
  const future = voices.slice(1);
  expect(
    future.every(
      (voice) => voice.endsAt !== null && voice.endsAt < voice.startsAt,
    ),
  ).toBe(true);
  await expect(
    page.getByRole('slider', { name: 'Ajustar tom', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Nova partida', exact: true }).click();
  await expect(
    page.getByRole('heading', {
      name: 'Modo Extreme · 3 frequências',
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Encerrar partida', exact: true })
    .click();
});

test('Extreme: ocultar após o primeiro palpite interrompe a tentativa em curso', async ({
  page,
}) => {
  test.setTimeout(30000);
  await page.getByRole('radio', { name: /^Extreme/ }).check();
  await page
    .getByRole('button', { name: 'Iniciar partida', exact: true })
    .click();
  const tone = page.getByRole('slider', { name: 'Ajustar tom', exact: true });
  await expect(tone).toBeEnabled({ timeout: 14000 });
  await page
    .getByRole('button', { name: 'Confirmar tentativa', exact: true })
    .click();
  await expect(
    page.getByText('Frequência 2 de 2', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Frequência alvo', { exact: true })).toHaveCount(
    0,
  );
  await visible(page, false);
  await visible(page, true);
  await expect(
    page.getByRole('heading', { name: 'Partida interrompida', exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.phaseFiveAudio.voices.filter((voice) => !voice.disconnected)
            .length,
      ),
    )
    .toBe(0);
  expect(await page.evaluate(() => window.phaseFiveAudio.voices.length)).toBe(
    3,
  );
  await expect(
    page.getByRole('button', { name: 'Retomar tentativa', exact: true }),
  ).toHaveCount(0);
});

test('Extreme: ocultar na última confirmação preserva todos os resultados do round', async ({
  page,
}) => {
  test.setTimeout(30000);
  await page.getByRole('radio', { name: /^Extreme/ }).check();
  await page
    .getByRole('button', { name: 'Iniciar partida', exact: true })
    .click();
  const tone = page.getByRole('slider', { name: 'Ajustar tom', exact: true });
  await expect(tone).toBeEnabled({ timeout: 14000 });
  await page
    .getByRole('button', { name: 'Confirmar tentativa', exact: true })
    .click();
  await expect(
    page.getByText('Frequência 2 de 2', { exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    const confirm =
      document.querySelector<HTMLButtonElement>('.confirm-button');
    if (!confirm) throw new Error('Confirmação ausente.');
    confirm.click();
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.phaseFiveAudio.voices.filter((voice) => !voice.disconnected)
            .length,
      ),
    )
    .toBe(0);
  await expect(page.getByRole('status')).toBeEmpty();
  await visible(page, true);
  await expect(
    page.getByRole('heading', { name: 'Resultado do round', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Frequência alvo', { exact: true })).toHaveCount(
    2,
  );
  await expect(
    page.getByRole('heading', { name: /Média do round:/ }),
  ).toBeVisible();
  await expect(page.getByText('Round 1 de 5', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Próximo round', exact: true }),
  ).toBeEnabled();
});
