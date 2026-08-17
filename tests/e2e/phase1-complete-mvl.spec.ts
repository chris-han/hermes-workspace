import { chromium, test, expect, type Browser, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const CDP_URL = process.env.HERMES_CDP_URL ?? 'http://127.0.0.1:9222'
let browser: Browser | undefined

async function cdpReachable(): Promise<boolean> {
  try {
    const response = await fetch(`${CDP_URL}/json/version`)
    return response.ok
  } catch {
    return false
  }
}

test.beforeAll(async () => {
  if (!(await cdpReachable())) {
    test.skip(true, `Remote Chrome is unavailable at ${CDP_URL}`)
    return
  }
  browser = await chromium.connectOverCDP(CDP_URL)
})

test.afterAll(async () => {
  await browser?.close()
})

test('complete MVL ContextGraph Studio smoke and screenshot evidence', async ({}, testInfo) => {
  expect(browser).toBeDefined()
  const context = browser!.contexts()[0] ?? await browser!.newContext()
  const page: Page = await context.newPage()
  await page.setViewportSize({ width: 1440, height: 900 })
  const baseUrl = process.env.HERMES_EVAL_BASE_URL ?? 'http://127.0.0.1:3300'
  await page.goto(`${baseUrl}/contextgraph-studio`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  const shell = page.locator('[data-testid="contextgraph-studio"], [aria-label*="Graph"], main').first()
  await expect(shell).toBeVisible({ timeout: 10000 })
  fs.mkdirSync(testInfo.outputDir, { recursive: true })
  await page.screenshot({ path: path.join(testInfo.outputDir, 'connected-graph-legend.png'), fullPage: true })
  await page.close()
})
