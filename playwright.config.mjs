import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } },
    },
  ],
  use: { baseURL: 'http://localhost:8123' },
  webServer: {
    command: 'node scripts/serve.mjs',
    env: { PORT: '8123' },
    url: 'http://localhost:8123/presentation.html',
    reuseExistingServer: true,
  },
});
