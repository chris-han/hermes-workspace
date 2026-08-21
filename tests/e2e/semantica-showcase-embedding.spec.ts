/**
 * W7-10: Remote-Chrome Playwright (CDP :9222) — embedding label/hover.
 */
import { expect, test } from '@playwright/test'

const SHOWCASE_URL = process.env.SEMANTICA_SHOWCASE_URL
  ?? '/semantica-showcase'

test.describe('Semantica showcase — embedding hover (W7-10)', () => {
  test('selecting an embedding point reveals its label, source text, and coordinates', async ({ page }) => {
    await page.goto(SHOWCASE_URL, { waitUntil: 'networkidle' })
    await page.getByTestId('showcase-tab-embedding').click()
    await expect(page.getByTestId('embedding-showcase-view')).toBeVisible()
    await page.getByTestId('embedding-point-Apple').click()
    await expect(page.getByTestId('inspector-fields')).toContainText('Apple')
    await expect(page.getByTestId('inspector-fields')).toContainText('Apple Inc.')
    await expect(page.getByTestId('inspector-fields')).toContainText(/\d+\.\d+/)
  })

  test('embedding view shows the offline provenance disclosure', async ({ page }) => {
    await page.goto(SHOWCASE_URL, { waitUntil: 'networkidle' })
    await page.getByTestId('showcase-tab-embedding').click()
    await expect(page.getByTestId('embedding-offline-disclosure')).toContainText(/frozen/i)
  })
})
