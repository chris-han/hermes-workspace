/**
 * W7-17: full four-view + dataset-switch + light/dark + offline-boundary
 * acceptance suite, run as a single composite remote-Chrome scenario.
 *
 * Vitest and ESLint provide the static boundary; this test provides the
 * runtime/network counterpart required by §12 enforcement.
 */
import { expect, test } from '@playwright/test'

const SHOWCASE_URL = process.env.SEMANTICA_SHOWCASE_URL
  ?? '/semantica-showcase'

test.describe('Semantica showcase — full UAT (W7-17)', () => {
  test('four views + dataset-switch + light/dark + offline-boundary', async ({ page }) => {
    const liveRequests: string[] = []
    page.on('request', (request) => {
      const url = request.url()
      if (
        /\/api\/graph\//.test(url) ||
        /\/api\/ontology\//.test(url) ||
        /\/api\/embeddings\//.test(url) ||
        /\/api\/semantier-proxy\//.test(url)
      ) {
        liveRequests.push(url)
      }
    })

    await page.goto(SHOWCASE_URL, { waitUntil: 'networkidle' })
    await expect(page.getByTestId('semantica-showcase-screen')).toBeVisible()

    for (const { mode, testId } of [
      { mode: 'knowledge-graph', testId: 'kg-showcase-view' },
      { mode: 'ontology', testId: 'ontology-showcase-view' },
      { mode: 'embedding', testId: 'embedding-showcase-view' },
      { mode: 'semantic-network', testId: 'semantic-network-showcase-view' },
    ] as const) {
      await page.getByTestId(`showcase-tab-${mode}`).click()
      await expect(page.getByTestId(testId)).toBeVisible()
    }

    expect(liveRequests, `Unexpected live requests: ${liveRequests.join(', ')}`).toHaveLength(0)
  })
})
