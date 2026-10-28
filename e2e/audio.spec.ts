import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { build } from 'vite';

interface NativeVerification {
  readonly sequenceStatus: string;
  readonly stoppedStatus: string;
  readonly interruptedStatus: string;
  readonly contextState: string;
  readonly createdOscillators: number;
  readonly retunedFrequencies: readonly number[];
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
          const oscillators: OscillatorNode[] = [];
          let interruptions = 0;
          const createOscillator = context.createOscillator.bind(context);
          context.createOscillator = () => {
            createdOscillators += 1;
            const oscillator = createOscillator();
            oscillators.push(oscillator);
            return oscillator;
          };
          const engine = new window.MemofreqAudio.WebAudioEngine({
            range: { minHz: 80, maxHz: 700 },
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
            const retunedFrequencies = oscillators
              .slice(-5)
              .map((node) => node.frequency.value);
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
              retunedFrequencies,
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
    createdOscillators: 20,
    retunedFrequencies: [200, 800, 1200, 1600, 2000],
    interruptions: 1,
  });
  expect(result.durationSeconds).toBeCloseTo(0.13, 8);
});

test('OfflineAudioContext verifica timbre aditivo, faixa, envelopes, silêncio e cancelamento', async ({
  page,
}) => {
  const results = await page.evaluate(async () => {
    async function render(sampleRate: number, cancelled: boolean) {
      const offline = new OfflineAudioContext(1, sampleRate * 2.1, sampleRate);
      // Apenas o estado de controle é adaptado; nós, DSP e amostras são nativos.
      const engine = new window.MemofreqAudio.WebAudioEngine({
        range: { minHz: 80, maxHz: 700 },
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
          createBiquadFilter: () => offline.createBiquadFilter(),
          createWaveShaper: () => offline.createWaveShaper(),
          createDynamicsCompressor: () => offline.createDynamicsCompressor(),
          resume: () => Promise.resolve(),
          close: () => Promise.resolve(),
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
        }),
      });
      await engine.enable();
      const bases = [80, 200, 400, 700];
      const sequence = engine.playSequence(
        bases.map((frequencyHz) => ({ frequencyHz, durationSeconds: 0.4 })),
        0.1,
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
      function amplitude(frequency: number, start: number): number {
        // Janela de 100 ms: todos os componentes medidos têm um número inteiro de ciclos.
        const first = Math.round(start * sampleRate);
        const length = Math.round(0.1 * sampleRate);
        let real = 0;
        let imaginary = 0;
        for (let i = 0; i < length; i += 1) {
          const angle = (2 * Math.PI * frequency * i) / sampleRate;
          const value = data[first + i] ?? 0;
          real += value * Math.cos(angle);
          imaginary += value * Math.sin(angle);
        }
        return (2 * Math.hypot(real, imaginary)) / length;
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
        tones: bases.map((base, i) => ({
          base,
          rms: rms(i * 0.5 + 0.09, i * 0.5 + 0.19),
          attackRms: rms(i * 0.5 + 0.01, i * 0.5 + 0.025),
          releaseRms: rms(i * 0.5 + 0.39, i * 0.5 + 0.41),
          sub: amplitude(base * 0.5, i * 0.5 + 0.09),
          second: amplitude(base * 2, i * 0.5 + 0.09),
          third: amplitude(base * 3, i * 0.5 + 0.09),
          fourth: amplitude(base * 4, i * 0.5 + 0.09),
          fifth: amplitude(base * 5, i * 0.5 + 0.09),
          offPitch: amplitude(base * 0.5 + 20, i * 0.5 + 0.09),
          gap: rms(i * 0.5 + 0.42, i * 0.5 + 0.49),
        })),
        leadingRms: rms(0, 0.009),
        trailingRms: rms(1.92, 2.1),
        allRms: rms(0, 2.1),
        peak,
        largestStep,
      };
    }
    return {
      rendered: [await render(44100, false), await render(48000, false)],
      cancelled: await render(48000, true),
    };
  });
  for (const rendered of results.rendered) {
    expect(rendered.status).toBe('completed');
    for (const tone of rendered.tones) {
      expect(tone.rms).toBeGreaterThan(0.001);
      expect(tone.attackRms).toBeLessThan(tone.rms);
      expect(tone.releaseRms).toBeLessThan(tone.rms);
      expect(tone.sub).toBeGreaterThan(0.001);
      expect(tone.second).toBeGreaterThan(0.0001);
      expect(tone.sub).toBeGreaterThan(tone.offPitch * 10);
      expect(tone.gap).toBe(0);
    }
    const low = rendered.tones[0];
    if (!low) throw new Error('Tom grave ausente.');
    expect(low.third).toBeGreaterThan(0.0001);
    expect(low.fourth).toBeGreaterThan(0.0001);
    expect(low.fifth).toBeGreaterThan(0.0001);
    expect(rendered.leadingRms).toBe(0);
    expect(rendered.trailingRms).toBe(0);
    expect(rendered.peak).toBeLessThanOrEqual(0.15);
    expect(rendered.largestStep).toBeLessThan(0.01);
  }
  expect(results.cancelled.status).toBe('cancelled');
  expect(results.cancelled.allRms).toBe(0);
});
