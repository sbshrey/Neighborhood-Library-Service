import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const visualMode = process.env.PW_VISUAL === '1';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],
  outputDir: 'test-results',
  expect: {
    timeout: 5_000
  },
  use: {
    baseURL,
    trace: visualMode ? 'on' : 'retain-on-failure',
    screenshot: visualMode ? 'on' : 'only-on-failure',
    video: visualMode ? 'on' : 'retain-on-failure',
    actionTimeout: 10_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
});
