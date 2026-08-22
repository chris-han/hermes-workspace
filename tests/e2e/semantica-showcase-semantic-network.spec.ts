/**
 * W7-11: Remote-Chrome Playwright (CDP :9222) — semantic-network edge/type rendering.
 *
 * Note: the legacy `sn-node-types`/`sn-edge-types` test ids were removed with
 * the readonly-canvas refactor (62fd52a5). Node types now render in the left
 * rail "Node types" inventory; edge types surface as a metric count.
 */
import { expect, test } from '@playwright/test'
import { stubShowcaseAuth } from './semantica-showcase-auth-stub'

const SHOWCASE_URL = process.env.SEMANTICA_SHOWCASE_URL
  ?? '/semantica-showcase'

test.describe('Semantica showcase — semantic-network rendering (W7-11)', () => {
  test('semantic network shows node types Language/Concept and edge type count', async ({ page }) => {
    await stubShowcaseAuth(page)
    await page.goto(SHOWCASE_URL, { waitUntil: 'networkidle' })
    await page.getByTestId('showcase-tab-semantic-network').click()
    await expect(page.getByTestId('semantic-network-showcase-view')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Node types' })).toBeVisible()
    await expect(page.getByText('Language', { exact: true })).toBeVisible()
    await expect(page.getByText('Concept', { exact: true })).toBeVisible()
    await expect(page.getByTestId('metric-cards')).toContainText('Edge types')
  })
})
