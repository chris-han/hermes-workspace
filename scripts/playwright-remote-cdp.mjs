// scripts/playwright-remote-cdp.mjs
//
// Connects Playwright to a remote Chrome instance via CDP.
//
// Usage:
//   PLAYWRIGHT_REMOTE_CDP_URL=ws://127.0.0.1:9222/devtools/browser/<id> \
//     node scripts/playwright-remote-cdp.mjs <url>
//
// If no <url> is provided, the script navigates to about:blank.
//
// This script is used by the W7 real-backend Playwright gate. It enables
// running the Playwright tests against a remote Chrome (e.g., one
// launched with `--remote-debugging-port=9222` on the host) instead of
// the bundled Playwright browser, so we can exercise the real Flyfish
// renderer on the same Chrome the user has installed.

import { chromium } from '@playwright/test'

const wsEndpoint = process.env.PLAYWRIGHT_REMOTE_CDP_URL
  ?? 'ws://127.0.0.1:9222/devtools/browser/374b9b52-d739-4aa4-8220-f56d7c6df1fd'
const targetUrl = process.argv[2] ?? 'about:blank'

console.log('[playwright-remote-cdp] connecting to', wsEndpoint)

const browser = await chromium.connectOverCDP(wsEndpoint)
console.log('[playwright-remote-cdp] connected. contexts=', browser.contexts().length)

const context = browser.contexts()[0] ?? (await browser.newContext())
const page = context.pages()[0] ?? (await context.newPage())

if (targetUrl !== 'about:blank') {
  console.log('[playwright-remote-cdp] navigating to', targetUrl)
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 })
} else {
  await page.goto('about:blank')
}

const userAgent = await page.evaluate(() => navigator.userAgent)
const title = await page.title()
const documentKind = await page.evaluate(() => document.contentType)

console.log('[playwright-remote-cdp] user agent:', userAgent)
console.log('[playwright-remote-cdp] title:', title)
console.log('[playwright-remote-cdp] document kind:', documentKind)

await browser.close()
console.log('[playwright-remote-cdp] done')
