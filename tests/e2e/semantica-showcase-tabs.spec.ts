/**
 * W7-07: Remote-Chrome Playwright (CDP :9222) — open each of the six tabs and
 * verify expected labels.
 */
import { chromium, expect, test as base } from '@playwright/test'

import { stubShowcaseAuth } from './semantica-showcase-auth-stub'

const SHOWCASE_URL = process.env.SEMANTICA_SHOWCASE_URL
  ?? '/semantica-showcase'
const CDP_ENDPOINT = process.env.F10_REMOTE_CHROME_URL
  ?? process.env.HERMES_CDP_WS_ENDPOINT
  ?? 'http://127.0.0.1:9222'

const test = base.extend({
  // eslint-disable-next-line no-empty-pattern -- Playwright requires the object destructuring pattern even when no fixtures are used.
  browser: async ({}, use) => {
    const browser = await chromium.connectOverCDP(CDP_ENDPOINT)
    await use(browser)
    await browser.close()
  },
})
test.describe('Semantica showcase — six-tab navigation (W7-07)', () => {
  test('each of the six visualization tabs is present with the expected label', async ({ page }) => {
    await stubShowcaseAuth(page)
    await page.goto(SHOWCASE_URL, { waitUntil: 'networkidle' })
    await expect(page.getByTestId('semantica-showcase-screen')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('showcase-tab-knowledge-graph')).toHaveText('Knowledge Graph')
    await expect(page.getByTestId('showcase-tab-ontology')).toHaveText('Ontology')
    await expect(page.getByTestId('showcase-tab-embedding')).toHaveText('Embedding')
    await expect(page.getByTestId('showcase-tab-semantic-network')).toHaveText('Semantic Network')
    await expect(page.getByTestId('showcase-tab-temporal')).toHaveText('Temporal')
    await expect(page.getByTestId('showcase-tab-analytics')).toHaveText('Analytics')
  })

  test('default tab is Knowledge Graph and renders the metric cards', async ({ page }) => {
    await stubShowcaseAuth(page)
    await page.goto(SHOWCASE_URL, { waitUntil: 'networkidle' })
    await expect(page.getByTestId('kg-showcase-view')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('metric-cards')).toContainText('Nodes')
    await expect(page.getByTestId('metric-cards')).toContainText('Edges')
    await expect(page.getByTestId('metric-cards')).toContainText('Entity types')
  })
})
