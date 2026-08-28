import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30 * 1000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'Mobile Chrome (375px)',
      use: { ...devices['iPhone SE'] },
    },
    {
      name: 'Mobile Chrome (390px)',
      use: { ...devices['iPhone 12'] },
    },
    {
      name: 'Mobile Chrome (430px)',
      use: { ...devices['iPhone 14 Pro Max'] },
    },
    {
      name: 'Tablet (768px)',
      use: { ...devices['iPad Mini'] },
    },
    {
      name: 'Desktop Chrome (1440px)',
      use: {
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
  webServer: {
    command: 'npx next start -p 3001',
    url: 'http://localhost:3001',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
