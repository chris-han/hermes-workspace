/**
 * W7-11: Remote-Chrome Playwright (CDP :9222) — semantic-network edge/type rendering.
 */
import { expect, test } from '@playwright/test'

const SHOWCASE_URL = process.env.SEMANTICA_SHOWCASE_URL
  ?? '/semantica-showcase'

test.describe('Semantica showcase — semantic-network rendering (W7-11)', () => {
  test('semantic network shows node types Language/Concept and edge type writes', async ({ page }) => {
    await page.goto(SHOWCASE_URL, { waitUntil: 'networkidle' })
    await page.getByTestId('showcase-tab-semantic-network').click()
    await expect(page.getByTestId('semantic-network-showcase-view')).toBeVisible()
    await expect(page.getByTestId('sn-node-types')).toContainText(/Language/)
    await expect(page.getByTestId('sn-node-types')).toContainText(/Concept/)
    await expect(page.getByTestId('sn-edge-types')).toContainText(/writes/)
  })
})
