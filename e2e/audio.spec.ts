import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { build } from 'vite';

interface NativeVerification {
  readonly sequenceStatus: string;
  readonly stoppedStatus: string;
  readonly interruptedStatus: string;
  readonly contextState: string;
  readonly createdOscillators: number;
  readonly interruptions: number;
  readonly durationSeconds: number;
}

declare global {
  interface Window {
    MemofreqAudio: typeof import('../src/audio/WebAudioEngine');
    audioVerification: Promise<NativeVerification> | undefined;
  }
}

let bundle = '';

test.beforeAll(async () => {
  const result = await build({
    configFile: false,
    logLevel: 'silent',
    build: {
      write: false,
      minify: false,
      lib: {
        entry: resolve(import.meta.dirname, '../src/audio/WebAudioEngine.ts'),
        name: 'MemofreqAudio',
        formats: ['iife'],
      },
    },
  });
  const output = Array.isArray(result) ? result[0] : result;
  if (!output || !('output' in output))
    throw new Error('Bundle de teste indisponível.');
  const chunk = output.output.find((item) => item.type === 'chunk');
  if (chunk?.type !== 'chunk')
    throw new Error('Código da engine indisponível.');
  bundle = chunk.code;
});

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.addScriptTag({ content: bundle });
});

test('Web Audio nativa habilita por gesto, reproduz, ajusta, interrompe e descarta', async ({
  page,
}) => {
  await page.evaluate(() => {
    document.addEventListener(
      'click',
      () => {
        window.audioVerification = (async () => {
          const context = new AudioContext();
          let createdOscillators = 0;
          let interruptions = 0;
          const createOscillator = context.createOscillator.bind(context);
          context.createOscillator = () => {
            createdOscillators += 1;
            return createOscillator();
          };
          const engine = new window.MemofreqAudio.WebAudioEngine({
            range: { minHz: 50, maxHz: 700 },
            createContext: () => context,
            onInterruption: () => {
              interruptions += 1;
            },
          });
          try {
            await engine.enable();
            const sequence = engine.playSequence(
              [
                { frequencyHz: 200, durationSeconds: 0.05 },
                { frequencyHz: 300, durationSeconds: 0.05 },
              ],
              0.03,
            );
            const sequenceResult = await sequence.finished;
            const continuous = engine.startContinuous(200);
            engine.setFrequency(250);
            engine.setFrequency(400);
            engine.setVolume(0.5);
            await new Promise<void>((accept) => {
              setTimeout(accept, 40);
            });
            const stopped = await continuous.stop();
            const next = engine.startContinuous(300);
            await new Promise<void>((accept) => {
              setTimeout(accept, 30);
            });
            await context.suspend();
            const interrupted = await next.finished;
            await engine.enable();
            await engine.dispose();
            return {
              sequenceStatus: sequenceResult.status,
              stoppedStatus: stopped.status,
              interruptedStatus: interrupted.status,
              contextState: context.state,
              createdOscillators,
              interruptions,
              durationSeconds: (sequence.endsAt ?? 0) - sequence.startsAt,
            };
          } finally {
            await engine.dispose();
          }
        })();
      },
      { once: true },
    );
  });
  await page.keyboard.press('Tab');
  await page.getByRole('link', { name: 'Ir para o conteúdo' }).click();
  const result = await page.evaluate(async () => {
    if (!window.audioVerification)
      throw new Error('Gesto de áudio não recebido.');
    return window.audioVerification;
  });
  expect(result).toMatchObject({
    sequenceStatus: 'completed',
    stoppedStatus: 'stopped',
    interruptedStatus: 'interrupted',
    contextState: 'closed',
    createdOscillators: 4,
    interruptions: 1,
  });
  expect(result.durationSeconds).toBeCloseTo(0.13, 8);
});

test('OfflineAudioContext verifica senoides, ganho, silêncio entre tons e cancelamento futuro', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    async function render(cancelled: boolean) {
      const sampleRate = 48000;
      const offline = new OfflineAudioContext(1, sampleRate * 0.4, sampleRate);
      // O renderizador offline não tem autoplay/close. Apenas seu estado de controle é adaptado;
      // os nós, automações, relógio e amostras renderizadas são da Web Audio API nativa.
      const engine = new window.MemofreqAudio.WebAudioEngine({
        range: { minHz: 50, maxHz: 700 },
        createContext: () => ({
          get currentTime() {
            return offline.currentTime;
          },
          get sampleRate() {
            return offline.sampleRate;
          },
          get state() {
            return 'running';
          },
          destination: offline.destination,
          createGain: () => offline.createGain(),
          createOscillator: () => offline.createOscillator(),
          resume: () => Promise.resolve(),
          close: () => Promise.resolve(),
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
        }),
      });
      await engine.enable();
      const sequence = engine.playSequence(
        [
          { frequencyHz: 200, durationSeconds: 0.1 },
          { frequencyHz: 400, durationSeconds: 0.1 },
        ],
        0.05,
      );
      if (cancelled) await sequence.cancel();
      const audio = await offline.startRendering();
      const outcome = await sequence.finished;
      const data = audio.getChannelData(0);
      function rms(start: number, end: number): number {
        const samples = data.subarray(
          Math.round(start * sampleRate),
          Math.round(end * sampleRate),
        );
        return Math.sqrt(
          samples.reduce((sum, value) => sum + value * value, 0) /
            samples.length,
        );
      }
      function pitch(start: number, end: number): number {
        const crossings: number[] = [];
        for (
          let index = Math.round(start * sampleRate) + 1;
          index < end * sampleRate;
          index += 1
        ) {
          if ((data[index - 1] ?? 0) <= 0 && (data[index] ?? 0) > 0)
            crossings.push(index);
        }
        const first = crossings[0];
        const last = crossings.at(-1);
        if (first === undefined || last === undefined || first === last)
          return 0;
        return (sampleRate * (crossings.length - 1)) / (last - first);
      }
      let peak = 0;
      let largestStep = 0;
      for (let index = 0; index < data.length; index += 1) {
        const value = data[index] ?? 0;
        peak = Math.max(peak, Math.abs(value));
        largestStep = Math.max(
          largestStep,
          Math.abs(value - (data[index - 1] ?? 0)),
        );
      }
      await engine.dispose();
      return {
        status: outcome.status,
        firstPitch: pitch(0.04, 0.08),
        secondPitch: pitch(0.19, 0.23),
        firstRms: rms(0.04, 0.08),
        secondRms: rms(0.19, 0.23),
        leadingRms: rms(0, 0.009),
        gapRms: rms(0.12, 0.15),
        trailingRms: rms(0.28, 0.39),
        allRms: rms(0, 0.4),
        peak,
        largestStep,
      };
    }
    return { rendered: await render(false), cancelled: await render(true) };
  });
  expect(result.rendered.status).toBe('completed');
  expect(result.rendered.firstPitch).toBeCloseTo(200, 0);
  expect(result.rendered.secondPitch).toBeCloseTo(400, 0);
  expect(result.rendered.firstRms).toBeCloseTo(0.08 / Math.sqrt(2), 3);
  expect(result.rendered.secondRms).toBeCloseTo(result.rendered.firstRms, 3);
  expect(result.rendered.leadingRms).toBe(0);
  expect(result.rendered.gapRms).toBe(0);
  expect(result.rendered.trailingRms).toBe(0);
  expect(result.rendered.peak).toBeLessThanOrEqual(0.081);
  expect(result.rendered.largestStep).toBeLessThan(0.005);
  expect(result.cancelled.status).toBe('cancelled');
  expect(result.cancelled.allRms).toBe(0);
});
