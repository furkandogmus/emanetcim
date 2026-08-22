import { config as loadEnv } from 'dotenv';
import { defineConfig, devices } from '@playwright/test';

loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

/**
 * Playwright Configuration
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    // PWA service worker'ı production build'de kayıt olur ve eski sayfa/RSC yanıtlarını
    // önbellekten verebilir; testler her zaman sunucuyu görmeli.
    serviceWorkers: 'block',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    // CI: build zaten yapılmış, `next start` hem hızlı hem deterministik; yerelde dev.
    command: process.env.CI ? 'npm run start' : 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
    timeout: 120 * 1000,
    env: {
      ...process.env,
      // Testler aynı IP'den onlarca istek üretir; gerçek limitler production dışında kapatılır.
      E2E_DISABLE_RATE_LIMIT: 'true',
      // docker-compose.yml postgres (host 5433); .env yoksa veya yanlışsa E2E yine DB’ye bağlansın
      DATABASE_URL:
        process.env.DATABASE_URL ||
        'postgresql://emanetci:emanetci@localhost:5433/emanetci?schema=public',
    },
  },
});
