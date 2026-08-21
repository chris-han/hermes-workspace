/**
 * W7-08: Remote-Chrome Playwright (CDP :9222) — KG node selection.
 */
import { expect, test } from '@playwright/test'

const SHOWCASE_URL = process.env.SEMANTICA_SHOWCASE_URL
  ?? '/semantica-showcase'

test.describe('Semantica showcase — KG selection (W7-08)', () => {
  test('KG view renders the metric cards and the Sigma container', async ({ page }) => {
    await page.goto(SHOWCASE_URL, { waitUntil: 'networkidle' })
    await expect(page.getByTestId('kg-showcase-view')).toBeVisible()
    // Confirm the Sigma canvas is mounted under the KG view data-testid.
    const canvas = page.locator('[data-testid="kg-showcase-view"] canvas').first()
    await expect(canvas).toBeVisible()
    // Metric cards must be present in the right rail.
    await expect(page.getByTestId('metric-cards')).toBeVisible()
  })
})
