import { defineConfig, devices } from '@playwright/test'

const BASE_URL = process.env.HERMES_EVAL_BASE_URL ?? 'http://127.0.0.1:4300'
const CHROMIUM_EX_PATH = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  ?? '/usr/bin/google-chrome'
const PLAYWRIGHT_CDP_WS_ENDPOINT = process.env.PLAYWRIGHT_CDP_WS_ENDPOINT
  ?? process.env.HERMES_CDP_WS_ENDPOINT
  ?? ''
const USE_REMOTE_CDP = PLAYWRIGHT_CDP_WS_ENDPOINT.trim().length > 0

const CHROMIUM_USE = USE_REMOTE_CDP
  ? {
      ...devices['Desktop Chrome'],
    }
  : {
      ...devices['Desktop Chrome'],
      launchOptions: {
        executablePath: CHROMIUM_EX_PATH,
        args: ['--disable-crash-reporter', '--disable-crashpad', '--disable-gpu'],
      },
    }

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
        ...CHROMIUM_USE,
        ...(USE_REMOTE_CDP
          ? {
              connectOptions: {
                wsEndpoint: PLAYWRIGHT_CDP_WS_ENDPOINT,
              },
            }
          : {}),
        locale: 'en-US',
      },
    },
  ],
})
