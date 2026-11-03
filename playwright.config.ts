import { defineConfig, devices } from '@playwright/test';

const MULTIPLAYER_TEST_URL = 'ws://127.0.0.1:8797';

export default defineConfig({
  testDir: './e2e',
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: [
    {
      // Backend multiplayer local para os testes com vários navegadores.
      command:
        'npx wrangler dev --cwd server --ip 127.0.0.1 --port 8797 --show-interactive-dev-session=false',
      url: 'http://127.0.0.1:8797/health',
      env: { WRANGLER_SEND_METRICS: 'false' },
      timeout: 120_000,
      reuseExistingServer: false,
    },
    {
      // O build de teste aponta o multiplayer para o backend acima.
      command:
        'npx vite build --logLevel warn && npm run preview -- --port 4173 --strictPort',
      url: 'http://127.0.0.1:4173',
      env: { VITE_MULTIPLAYER_URL: MULTIPLAYER_TEST_URL },
      timeout: 120_000,
      reuseExistingServer: false,
    },
    {
      command: 'node e2e/static-server.ts',
      url: 'http://127.0.0.1:4174/memofreq/',
      reuseExistingServer: false,
    },
  ],
});
