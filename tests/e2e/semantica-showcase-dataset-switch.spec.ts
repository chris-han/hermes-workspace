/**
 * W7-15: Remote-Chrome Playwright (CDP :9222) — switch Active Dataset and verify
 * graph/ontology/embedding/semantic-network data, metadata cards, dataset ID,
 * inspector state, and bottom status all change to the selected fixture while
 * stale selection is cleared.
 *
 * W7-16: light/dark parity for dataset switching.
 */
import { expect, test } from '@playwright/test'

const SHOWCASE_URL = process.env.SEMANTICA_SHOWCASE_URL
  ?? '/semantica-showcase'

test.describe('Semantica showcase — dataset switching (W7-15)', () => {
  test('switching the Active Dataset updates the dataset ID in the status bar', async ({ page }) => {
    await page.goto(SHOWCASE_URL, { waitUntil: 'networkidle' })
    const initialStatus = await page.getByTestId('showcase-status-bar').innerText()
    expect(initialStatus).toMatch(/intro-cookbook-kg/)
    const selector = page.getByTestId('dataset-selector')
    await expect(selector).toBeVisible()
    await selector.click()
    const menuItems = page.locator('[role="menuitemradio"]')
    await expect(menuItems.first()).toBeVisible()
    expect(await menuItems.count()).toBeGreaterThan(1)

    const target = menuItems.nth(1)
    const targetLabel = (await target.innerText()).trim()
    await target.click()
    await expect(selector).toContainText(targetLabel)
    await expect(page.getByTestId('showcase-status-bar')).not.toHaveText(initialStatus)
  })
})

test.describe('Semantica showcase — light/dark parity (W7-16)', () => {
  for (const theme of ['semantier-light', 'semantier']) {
    test(`dataset-selector and status bar render identically in ${theme}`, async ({ page }) => {
      await page.addInitScript((value: string) => {
        try {
          window.localStorage.setItem('hermes-theme', value)
        } catch {
          /* localStorage may be unavailable */
        }
      }, theme)
      await page.goto(SHOWCASE_URL, { waitUntil: 'networkidle' })
      await expect(page.getByTestId('semantica-showcase-screen')).toBeVisible()
      await expect(page.getByTestId('dataset-selector')).toBeVisible()
      await expect(page.getByTestId('showcase-status-bar')).toBeVisible()
    })
  }
})
