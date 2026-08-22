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

import { stubShowcaseAuth } from './semantica-showcase-auth-stub'

const SHOWCASE_URL = process.env.SEMANTICA_SHOWCASE_URL
  ?? '/semantica-showcase'

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
    await stubShowcaseAuth(page)
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
    // Canvas-level visualization: lifelines + dual-series activity + metric series.
    await expect(page.getByTestId('temporal-dashboard-lifelines')).toBeVisible()
    await expect(page.getByTestId('temporal-dashboard-lifeline-Lab_Alpha')).toBeVisible()
    await expect(page.getByTestId('temporal-dashboard-activity')).toBeVisible()
    await expect(
      page.getByTestId('temporal-dashboard-activity').locator('.recharts-line-curve'),
    ).toHaveCount(2)
    await expect(page.getByTestId('temporal-dashboard-metrics')).toBeVisible()
    await expect(
      page.getByTestId('temporal-dashboard-metrics').locator('.recharts-line-curve').first(),
    ).toBeVisible()

    await page.getByRole('button', { name: 'Evolution' }).click()
    await expect(page.getByRole('button', { name: 'Evolution' })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('temporal-showcase-view')).toContainText('Network Evolution')
    // Canvas-level visualization: Sigma canvas + frame slider.
    await expect(page.getByTestId('temporal-evolution-visualization')).toBeVisible()
    await expect(
      page.getByTestId('temporal-evolution-visualization').getByRole('application'),
    ).toBeVisible()
    const slider = page.getByTestId('temporal-evolution-slider')
    await expect(slider).toBeVisible()
    const frameLabel = page.getByTestId('temporal-evolution-frame-label')
    const firstFrame = await frameLabel.textContent()
    await slider.fill('12')
    await expect(frameLabel).not.toHaveText(firstFrame ?? '')

    // Timeline: one lane per event type with time-positioned point items.
    await page.getByRole('button', { name: 'Timeline' }).click()
    await expect(page.getByTestId('temporal-timeline-visualization')).toBeVisible()
    await expect(page.getByTestId('temporal-timeline-lane-WORKS_AT')).toBeVisible()
    await expect(page.getByTestId('temporal-timeline-lane-AUTHORED')).toBeVisible()
    await expect(page.getByTestId('temporal-timeline-item-event-rel-0')).toBeVisible()
    // The center canvas shows no duplicated left-rail inventory lists.
    const temporalCenter = page.locator('.showcase-ref-center')
    await expect(temporalCenter.locator('[data-testid="temporal-showcase-view"] ul')).toHaveCount(0)

    // Footer control parity: the chart footer speaks the Sigma footer
    // language — MODE / ZOOM / FIT / gear — with working zoom.
    const timelineFooter = page.getByTestId('visualization-footer')
    await expect(timelineFooter.getByTestId('chart-mode-view')).toHaveAttribute('aria-pressed', 'true')
    await expect(timelineFooter.getByTestId('chart-mode-select')).toBeVisible()
    await expect(timelineFooter.getByTestId('chart-zoom-value')).toHaveText('1.0x')
    await expect(timelineFooter.getByTestId('visualization-controls-toggle')).toBeVisible()
    // Graph-only controls are absent from chart footers.
    await expect(timelineFooter.getByText('LAYOUT')).toHaveCount(0)
    await expect(timelineFooter.getByText('NUDGE')).toHaveCount(0)
    await expect(timelineFooter.getByText('EDGES')).toHaveCount(0)
    await timelineFooter.getByTestId('chart-zoom-in').click()
    await expect(timelineFooter.getByTestId('chart-zoom-value')).toHaveText('1.3x')
    await timelineFooter.getByTestId('chart-fit').click()
    await expect(timelineFooter.getByTestId('chart-zoom-value')).toHaveText('1.0x')
    // MODE Select enables mark click-to-inspect; View ignores mark clicks.
    await timelineFooter.getByTestId('chart-mode-select').click()
    await expect(timelineFooter.getByTestId('chart-mode-select')).toHaveAttribute('aria-pressed', 'true')
    await page.getByTestId('temporal-timeline-item-event-rel-0').click()
    await expect(page.getByTestId('inspector-fields').locator('dt', { hasText: /^id$/ })).toBeVisible()

    // 3. Analytics segmented control: Centrality / Communities.
    await page.getByTestId('showcase-tab-analytics').click()
    await expect(page.getByTestId('analytics-showcase-view')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Centrality' })).toHaveAttribute('aria-pressed', 'true')
    // Canvas-level visualization: ranked bar marks exist (score descending).
    await expect(page.getByTestId('analytics-centrality-visualization')).toBeVisible()
    await expect(page.getByTestId('analytics-centrality-bar-e1')).toBeVisible()
    const barOrder = await page
      .locator('[data-testid^="analytics-centrality-bar-"]')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-testid')))
    expect(barOrder).toEqual([
      'analytics-centrality-bar-e1',
      'analytics-centrality-bar-e3',
      'analytics-centrality-bar-e2',
      'analytics-centrality-bar-e4',
    ])
    // Centrality footer parity: MODE / ZOOM / FIT / gear with a working zoom.
    const centralityFooter = page.getByTestId('analytics-centrality-visualization').getByTestId('visualization-footer')
    await expect(centralityFooter.getByTestId('chart-mode-view')).toHaveAttribute('aria-pressed', 'true')
    await expect(centralityFooter.getByTestId('chart-zoom-value')).toHaveText('1.0x')
    await centralityFooter.getByTestId('chart-zoom-in').click()
    await expect(centralityFooter.getByTestId('chart-zoom-value')).toHaveText('1.3x')
    await centralityFooter.getByTestId('chart-fit').click()
    await expect(centralityFooter.getByTestId('chart-zoom-value')).toHaveText('1.0x')
    await expect(centralityFooter.getByTestId('visualization-controls-toggle')).toBeVisible()
    await page.getByRole('button', { name: 'Communities' }).click()
    await expect(page.getByRole('button', { name: 'Communities' })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('analytics-showcase-view')).toContainText('Communities')
    // Canvas-level visualization: community-colored KG on the Sigma canvas;
    // partition summary stays in the side rail, not the canvas.
    await expect(page.getByTestId('analytics-communities-visualization')).toBeVisible()
    await expect(
      page.getByTestId('analytics-communities-visualization').getByRole('application'),
    ).toBeVisible()
    const analyticsCenter = page.locator('.showcase-ref-center')
    await expect(analyticsCenter).not.toContainText('Partition')
    await expect(analyticsCenter).not.toContainText('Assignments')
    await expect(analyticsCenter.locator('[data-testid="analytics-showcase-view"] ul')).toHaveCount(0)

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
    await stubShowcaseAuth(page)
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
