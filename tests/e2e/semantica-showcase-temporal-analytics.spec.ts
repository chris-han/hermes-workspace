/**
 * §10.5: Temporal/Analytics notebook-parity E2E — six tabs, submode segmented
 * controls, capability disabling, §4.1.3 dataset-switch fallback, §9.6
 * provenance disclosure, and the static offline boundary (no Semantica
 * backend / LLM / embedding-provider calls during these flows).
 *
 * Follows the remote-Chrome conventions of
 * `semantica-showcase-network-boundary.spec.ts` and the selector conventions
 * of `semantica-showcase-dataset-switch.spec.ts`.
 */
import { expect, test, type Page } from '@playwright/test'

const SHOWCASE_URL = process.env.SEMANTICA_SHOWCASE_URL
  ?? '/semantica-showcase'

/**
 * The workspace shell gates on `/auth/context`. When the suite runs against a
 * remote authenticated Chrome (CDP), that session answers for real; against a
 * bare dev server we stub the auth context so the showcase route renders.
 * The stub is test harness only — the offline-boundary assertions below still
 * fail on any /api/graph|ontology|embeddings|semantier-proxy call.
 */
async function stubAuthContext(page: Page) {
  await page.route('**/auth/context', (route) => {
    void route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        authenticated: true,
        feishu_oauth_enabled: false,
        password_login_enabled: true,
        profile_completed: true,
        membership_status: 'active',
        user: {
          user_id: 'e2e-showcase',
          name: 'E2E Showcase',
          feishu_open_id: 'e2e-showcase',
          workspace_slug: 'e2e',
          profile_completed: true,
        },
      }),
    })
  })
}

async function selectDataset(page: Page, displayName: string | RegExp) {
  await page.getByTestId('dataset-selector').click()
  await page.getByRole('menuitemradio', { name: displayName }).click()
  // Dismiss the Base UI menu portal if it lingers; an inert overlay would
  // otherwise intercept subsequent pointer events on the tabs.
  await page.keyboard.press('Escape')
}

function watchLiveRequests(page: Page): string[] {
  const liveRequests: string[] = []
  page.on('request', (request) => {
    const url = request.url()
    if (
      /\/api\/graph\//.test(url) ||
      /\/api\/ontology\//.test(url) ||
      /\/api\/embeddings\//.test(url) ||
      /\/api\/semantier-proxy\//.test(url) ||
      /\/api\/llm\//.test(url) ||
      /falkordb/i.test(url)
    ) {
      liveRequests.push(url)
    }
  })
  return liveRequests
}

test.describe('Semantica showcase — temporal/analytics notebook parity (§10.5)', () => {
  test('six tabs visible and Temporal/Analytics submodes switch on the notebook suite', async ({ page }) => {
    const liveRequests = watchLiveRequests(page)
    await stubAuthContext(page)
    await page.goto(SHOWCASE_URL, { waitUntil: 'networkidle' })
    await expect(page.getByTestId('semantica-showcase-screen')).toBeVisible()

    // 1. six tabs visible in canonical §4.1.3 order.
    for (const mode of ['knowledge-graph', 'ontology', 'embedding', 'semantic-network', 'temporal', 'analytics'] as const) {
      await expect(page.getByTestId(`showcase-tab-${mode}`)).toBeVisible()
    }

    await selectDataset(page, '03 Complete Visualization Suite')

    // 3. Temporal segmented control: Timeline / Versions / Dashboard / Evolution.
    await page.getByTestId('showcase-tab-temporal').click()
    await expect(page.getByTestId('temporal-showcase-view')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Timeline' })).toHaveAttribute('aria-pressed', 'true')
    // Versions is not declared by the 03 dataset: disabled.
    await expect(page.getByRole('button', { name: 'Versions' })).toBeDisabled()

    await page.getByRole('button', { name: 'Dashboard' }).click()
    await expect(page.getByRole('button', { name: 'Dashboard' })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('temporal-showcase-view')).toContainText('Dashboard')

    await page.getByRole('button', { name: 'Evolution' }).click()
    await expect(page.getByRole('button', { name: 'Evolution' })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('temporal-showcase-view')).toContainText('Network Evolution')

    // 3. Analytics segmented control: Centrality / Communities.
    await page.getByTestId('showcase-tab-analytics').click()
    await expect(page.getByTestId('analytics-showcase-view')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Centrality' })).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('button', { name: 'Communities' }).click()
    await expect(page.getByRole('button', { name: 'Communities' })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('analytics-showcase-view')).toContainText('Communities')

    // 8. §9.6 provenance disclosure: notebook parity, source-only excluded.
    const disclosure = page.getByTestId('analytics-coverage-disclosure')
    await expect(disclosure).toContainText('Pinned Semantica notebook visualization cases')
    await expect(disclosure).toContainText(
      'Source-only Semantica visualization methods are not included in this showcase.',
    )

    expect(liveRequests, `Unexpected live requests: ${liveRequests.join(', ')}`).toHaveLength(0)
  })

  test('capability disabling on 10 Temporal Knowledge Graphs and §4.1.3 fallback', async ({ page }) => {
    const liveRequests = watchLiveRequests(page)
    await stubAuthContext(page)
    await page.goto(SHOWCASE_URL, { waitUntil: 'networkidle' })
    await expect(page.getByTestId('semantica-showcase-screen')).toBeVisible()

    // 2. Dataset capability disabling: Dashboard/Evolution unsupported on 10.
    await selectDataset(page, '10 Temporal Knowledge Graphs')
    await page.getByTestId('showcase-tab-temporal').click()
    await expect(page.getByTestId('temporal-showcase-view')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Timeline' })).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Versions' })).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Dashboard' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Evolution' })).toBeDisabled()

    // 4. Dataset switch losing the selected lens falls back per §4.1.3:
    // Analytics on 03 -> KG-only dataset lands on Knowledge Graph with no
    // stale analytics content.
    await selectDataset(page, '03 Complete Visualization Suite')
    await page.getByTestId('showcase-tab-analytics').click()
    await expect(page.getByTestId('analytics-showcase-view')).toBeVisible()
    await selectDataset(page, '10 Graph Analytics')
    await expect(page.getByTestId('kg-showcase-view')).toBeVisible()
    await expect(page.getByTestId('showcase-status-bar')).toContainText('10-Graph-Analytics')
    await expect(page.getByTestId('analytics-showcase-view')).toHaveCount(0)

    expect(liveRequests, `Unexpected live requests: ${liveRequests.join(', ')}`).toHaveLength(0)
  })
})
