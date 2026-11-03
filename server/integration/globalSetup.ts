import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HTTP_URL, INACTIVE_AFTER_MS, PORT, SWEEP_INTERVAL_MS } from './config';

const root = fileURLToPath(new URL('../..', import.meta.url));
const wrangler = join(root, 'node_modules/wrangler/bin/wrangler.js');

async function waitForHealth(output: () => string): Promise<void> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${HTTP_URL}/health`);
      if (response.ok) return;
    } catch {
      // Servidor ainda iniciando.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`wrangler dev não respondeu a tempo.\n${output()}`);
}

/** Inicia o Worker local com storage temporário e encerra ao final. */
export default async function setup(): Promise<() => Promise<void>> {
  const state = await mkdtemp(join(tmpdir(), 'memofreq-server-'));
  let output = '';
  const child = spawn(
    process.execPath,
    [
      wrangler,
      'dev',
      '--config',
      'server/wrangler.jsonc',
      '--ip',
      '127.0.0.1',
      '--port',
      String(PORT),
      '--persist-to',
      state,
      '--show-interactive-dev-session=false',
      '--var',
      `SWEEP_INTERVAL_MS:${String(SWEEP_INTERVAL_MS)}`,
      '--var',
      `INACTIVE_AFTER_MS:${String(INACTIVE_AFTER_MS)}`,
    ],
    {
      cwd: root,
      detached: true,
      env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  const collect = (chunk: Buffer) => {
    output = (output + chunk.toString()).slice(-8000);
  };
  child.stdout.on('data', collect);
  child.stderr.on('data', collect);
  const exited = new Promise<void>((resolve) =>
    child.once('exit', () => {
      resolve();
    }),
  );

  const stop = async () => {
    if (child.pid !== undefined && child.exitCode === null) {
      // O grupo inclui o processo workerd iniciado pelo wrangler.
      process.kill(-child.pid, 'SIGTERM');
      await Promise.race([
        exited,
        new Promise((resolve) => setTimeout(resolve, 5000)),
      ]);
    }
    await rm(state, { recursive: true, force: true });
  };

  try {
    await waitForHealth(() => output);
  } catch (error) {
    await stop();
    throw error;
  }
  return stop;
}
