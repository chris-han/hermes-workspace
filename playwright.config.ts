import { defineConfig, devices } from '@playwright/test'

const BASE_URL = process.env.HERMES_EVAL_BASE_URL ?? 'http://127.0.0.1:4300'
const CHROMIUM_EX_PATH = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  ?? '/usr/bin/google-chrome'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [
    ['list'],
    ['json', { outputFile: '.playwright-cli/results.json' }],
    ['html', { outputFolder: '.playwright-cli/html', open: 'never' }],
  ],
  outputDir: '.playwright-cli/artifacts',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          executablePath: CHROMIUM_EX_PATH,
          args: ['--disable-crash-reporter', '--disable-gpu'],
        },
        locale: 'en-US',
      },
    },
  ],
})
