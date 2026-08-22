/**
 * W7-03: computed-style / DOM-geometry assertions for the Asimov
 * visualization lattice (plan
 * `2026-08-22-asimov-visualization-layout-system-theme-refactor-v1`).
 *
 * No screenshots (brittle under software WebGL): these tests assert the
 * resolved geometry contract directly —
 *   - dot-grid background-size equals the 24px lattice unit;
 *   - visualization viewport background resolves transparent (grid shows
 *     through; A6);
 *   - the shell border resolves to the canonical 1px Asimov border token;
 *   - the per-canvas footer boundary/height is lattice-aligned;
 *   - timeline lane baselines are lattice-aligned while event mark X stays
 *     data-driven (A1).
 */
import { expect, test } from '@playwright/test'

import { stubShowcaseAuth } from './semantica-showcase-auth-stub'

const SHOWCASE_URL = process.env.SEMANTICA_SHOWCASE_URL
  ?? '/semantica-showcase'

const LATTICE = 24

async function selectDataset(page: import('@playwright/test').Page, displayName: string | RegExp) {
  await page.getByTestId('dataset-selector').click()
  await page.getByRole('menuitemradio', { name: displayName }).click()
  await page.keyboard.press('Escape')
}

test.describe('Semantica showcase — Asimov visualization lattice (W7-03)', () => {
  test('dot grid resolves to the 24px lattice and the chart viewport is transparent with the canonical border', async ({ page }) => {
    await stubShowcaseAuth(page)
    await page.goto(SHOWCASE_URL, { waitUntil: 'networkidle' })
    await expect(page.getByTestId('semantica-showcase-screen')).toBeVisible()
    await selectDataset(page, '03 Complete Visualization Suite')
    await page.getByTestId('showcase-tab-temporal').click()
    await expect(page.getByTestId('temporal-timeline-visualization')).toBeVisible()

    // Dot grid: background-size equals the resolved lattice unit.
    const gridSize = await page.locator('.showcase-ref-grid-canvas').first().evaluate(
      (el) => getComputedStyle(el).backgroundSize,
    )
    expect(gridSize).toBe('24px 24px')

    // Transparent viewport + structural border from the canonical token.
    const shell = page.getByTestId('temporal-timeline-visualization')
    const shellStyle = await shell.evaluate((el) => {
      const style = getComputedStyle(el)
      return {
        background: style.backgroundColor,
        borderWidth: style.borderTopWidth,
        borderStyle: style.borderTopStyle,
        borderColor: style.borderTopColor,
        boxShadow: style.boxShadow,
      }
    })
    expect(shellStyle.background).toBe('rgba(0, 0, 0, 0)')
    expect(shellStyle.borderWidth).toBe('1px')
    expect(shellStyle.borderStyle).toBe('solid')
    // Canonical border token: --asimov-border = 1px solid var(--asimov-outline-variant).
    const expectedRgb = await page.locator('.semantica-showcase-reference').evaluate((el) => {
      const probe = document.createElement('div')
      probe.style.color = getComputedStyle(el).getPropertyValue('--asimov-outline-variant').trim()
      el.appendChild(probe)
      const resolved = getComputedStyle(probe).color
      probe.remove()
      return resolved
    })
    expect(expectedRgb).not.toBe('')
    expect(shellStyle.borderColor).toBe(expectedRgb)
    // A7 flat depth: no shadow.
    expect(shellStyle.boxShadow).toBe('none')

    const viewport = shell.locator('.showcase-viz-viewport')
    await expect(viewport).toHaveCount(1)
    const viewportBackground = await viewport.evaluate((el) => getComputedStyle(el).backgroundColor)
    expect(viewportBackground).toBe('rgba(0, 0, 0, 0)')

    // Footer boundary lattice-aligned: snapped min-height 2 × 24px and a
    // border-top from the canonical token.
    const footer = shell.getByTestId('visualization-footer')
    await expect(footer).toBeVisible()
    const footerBox = await footer.boundingBox()
    expect(footerBox).not.toBeNull()
    expect(Math.round(footerBox!.height) % LATTICE).toBe(0)
    const footerBorder = await footer.evaluate((el) => getComputedStyle(el).borderTopColor)
    expect(footerBorder).toBe(expectedRgb)

    // Lane baselines snap to the lattice…
    const laneCy = await page
      .locator('[data-testid^="temporal-timeline-lane-"] circle')
      .first()
      .getAttribute('cy')
    expect(Number(laneCy) % LATTICE).toBe(0)
    // …while event mark X positions stay data-driven (not quantized).
    const cxValues = await page
      .locator('[data-testid^="temporal-timeline-item-"]')
      .evaluateAll((nodes) => nodes.map((node) => Number(node.getAttribute('cx'))))
    expect(cxValues.length).toBeGreaterThan(0)
    expect(cxValues.some((cx) => cx % LATTICE !== 0)).toBe(true)
  })

  test('sigma submodes mount the shared shell/footer and keep the grid visible', async ({ page }) => {
    await stubShowcaseAuth(page)
    await page.goto(SHOWCASE_URL, { waitUntil: 'networkidle' })
    await expect(page.getByTestId('semantica-showcase-screen')).toBeVisible()
    await selectDataset(page, '03 Complete Visualization Suite')
    await page.getByTestId('showcase-tab-analytics').click()
    await page.getByRole('button', { name: 'Communities' }).click()
    const shell = page.getByTestId('analytics-communities-visualization')
    await expect(shell).toBeVisible()
    await expect(shell.getByTestId('visualization-footer')).toBeVisible()
    const background = await shell.evaluate((el) => getComputedStyle(el).backgroundColor)
    expect(background).toBe('rgba(0, 0, 0, 0)')
    await expect(
      page.getByTestId('analytics-communities-visualization').getByRole('application'),
    ).toBeVisible()
  })
})
