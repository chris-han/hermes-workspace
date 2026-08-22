// scripts/playwright-remote-cdp-screenshot.mjs
//
// Like playwright-remote-cdp.mjs but captures a screenshot of the page.
//
// Usage:
//   node scripts/playwright-remote-cdp-screenshot.mjs <url> <output.png>
//   PLAYWRIGHT_WAIT_MS=10000 node scripts/playwright-remote-cdp-screenshot.mjs <url> <out>

import { chromium } from '@playwright/test'

const wsEndpoint = process.env.PLAYWRIGHT_REMOTE_CDP_URL
  ?? 'ws://127.0.0.1:9222/devtools/browser/374b9b52-d739-4aa4-8220-f56d7c6df1fd'
const targetUrl = process.argv[2] ?? 'about:blank'
const outputPath = process.argv[3] ?? '/tmp/remote-chrome-screenshot.png'
const viewportWidth = Number(process.env.PLAYWRIGHT_VIEWPORT_WIDTH ?? 1440)
const viewportHeight = Number(process.env.PLAYWRIGHT_VIEWPORT_HEIGHT ?? 900)
const waitMs = Number(process.env.PLAYWRIGHT_WAIT_MS ?? 5000)
const waitSelector = process.env.PLAYWRIGHT_WAIT_SELECTOR

console.log('[playwright-remote-cdp-screenshot] connecting to', wsEndpoint)

const browser = await chromium.connectOverCDP(wsEndpoint)
const context = browser.contexts()[0] ?? (await browser.newContext())
if (context.pages().length === 0) {
  await context.newPage()
}
const page = context.pages()[0]
await page.setViewportSize({ width: viewportWidth, height: viewportHeight })

console.log('[playwright-remote-cdp-screenshot] navigating to', targetUrl)
await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 })

// Wait for either a specific selector or a fixed duration
if (waitSelector) {
  try {
    await page.waitForSelector(waitSelector, { timeout: 15_000 })
    console.log('[playwright-remote-cdp-screenshot] selector found:', waitSelector)
  } catch (err) {
    console.log('[playwright-remote-cdp-screenshot] selector timeout, continuing')
  }
} else {
  try {
    await page.waitForLoadState('networkidle', { timeout: 15_000 })
  } catch {
    console.log('[playwright-remote-cdp-screenshot] networkidle timed out, continuing')
  }
}

await page.waitForTimeout(waitMs)

const title = await page.title()
const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 500))
const screenshotElements = await page.evaluate(() => {
  const els = document.querySelectorAll('[data-testid]')
  return Array.from(els).slice(0, 10).map((el) => ({
    testid: el.getAttribute('data-testid'),
    tag: el.tagName.toLowerCase(),
  }))
})
console.log('[playwright-remote-cdp-screenshot] title:', title)
console.log('[playwright-remote-cdp-screenshot] body text:', bodyText.replace(/\s+/g, ' ').trim().slice(0, 200))
console.log('[playwright-remote-cdp-screenshot] data-testid elements:', JSON.stringify(screenshotElements, null, 2))

await page.screenshot({ path: outputPath, fullPage: false })
console.log('[playwright-remote-cdp-screenshot] saved screenshot to', outputPath)

await browser.close()
