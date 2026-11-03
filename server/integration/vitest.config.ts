import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: fileURLToPath(new URL('../..', import.meta.url)),
  test: {
    environment: 'node',
    include: ['server/integration/**/*.test.ts'],
    globalSetup: ['server/integration/globalSetup.ts'],
    testTimeout: 20_000,
    hookTimeout: 90_000,
  },
});
