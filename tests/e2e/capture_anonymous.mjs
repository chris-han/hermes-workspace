import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const OUT_DIR = '/home/chris/repo/semantier-runtime/docs/operational/screenshots'
mkdirSync(OUT_DIR, { recursive: true })

const browser = await chromium.launch({
  executablePath: '/home/chris/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome',
})
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })

await ctx.route('**/auth/context', async (route) => {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ authenticated: false, feishu_oauth_enabled: true, password_login_enabled: false, profile_completed: false, user: null }),
  })
})

const page = await ctx.newPage()
await page.goto('http://127.0.0.1:4307/evaluation')
await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
await page.waitForTimeout(500)
await page.screenshot({ path: `${OUT_DIR}/evaluation-anonymous-login.png`, fullPage: true })
await ctx.close()
await browser.close()
console.log('Anonymous screenshot written')
