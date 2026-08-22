/**
 * W7-09: Remote-Chrome Playwright (CDP :9222) — ontology class inspection.
 */
import { expect, test } from '@playwright/test'

const SHOWCASE_URL = process.env.SEMANTICA_SHOWCASE_URL
  ?? '/semantica-showcase'

test.describe('Semantica showcase — ontology inspection (W7-09)', () => {
  test('selecting an ontology class updates the inspector with the class details', async ({ page }) => {
    await page.goto(SHOWCASE_URL, { waitUntil: 'networkidle' })
    await page.getByTestId('showcase-tab-ontology').click()
    await expect(page.getByTestId('ontology-showcase-view')).toBeVisible()
    await page.getByTestId('ontology-class-Organization').dispatchEvent('click')
    await expect(page.getByTestId('inspector-fields')).toContainText('Organization')
    await expect(page.getByTestId('inspector-fields')).toContainText('entity-type')
  })

  test('selecting the CEO_of relationship class surfaces the domain/range properties', async ({ page }) => {
    await page.goto(SHOWCASE_URL, { waitUntil: 'networkidle' })
    await page.getByTestId('showcase-tab-ontology').click()
    await page.getByTestId('ontology-class-CEO_of').dispatchEvent('click')
    await expect(page.getByTestId('inspector-fields')).toContainText('relationship-type')
  })
})
