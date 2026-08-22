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
 *   - the shell is canvas-native like the Sigma center canvas: no inner card
 *     border, no shadow, no back-fill (the outer center panel card owns the
 *     chrome);
 *   - the per-canvas footer matches the Sigma canvas footer geometry:
 *     border-top from the canonical token, opaque panel back-fill, shared
 *     8px/12px padding;
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
  test('dot grid resolves to the 24px lattice and the chart shell is canvas-native with Sigma footer parity', async ({ page }) => {
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

    // Canvas-native shell (Sigma parity): transparent, NO inner card border,
    // no shadow — the outer center panel card owns the chrome.
    const shell = page.getByTestId('temporal-timeline-visualization')
    const shellStyle = await shell.evaluate((el) => {
      const style = getComputedStyle(el)
      return {
        background: style.backgroundColor,
        borderWidth: style.borderTopWidth,
        boxShadow: style.boxShadow,
      }
    })
    expect(shellStyle.background).toBe('rgba(0, 0, 0, 0)')
    expect(shellStyle.borderWidth).toBe('0px')
    // A7 flat depth: no shadow.
    expect(shellStyle.boxShadow).toBe('none')

    const viewport = shell.locator('.showcase-viz-viewport')
    await expect(viewport).toHaveCount(1)
    const viewportBackground = await viewport.evaluate((el) => getComputedStyle(el).backgroundColor)
    expect(viewportBackground).toBe('rgba(0, 0, 0, 0)')

    // Footer parity with the Sigma canvas footer: border-top from the
    // canonical token, opaque panel back-fill, shared 8px/12px padding.
    const expectedRgb = await page.locator('.semantica-showcase-reference').evaluate((el) => {
      const probe = document.createElement('div')
      probe.style.color = getComputedStyle(el).getPropertyValue('--asimov-outline-variant').trim()
      el.appendChild(probe)
      const resolved = getComputedStyle(probe).color
      probe.remove()
      return resolved
    })
    expect(expectedRgb).not.toBe('')
    const panelRgb = await page.locator('.semantica-showcase-reference').evaluate((el) => {
      const probe = document.createElement('div')
      probe.style.backgroundColor = getComputedStyle(el).getPropertyValue('--asimov-panel').trim()
      el.appendChild(probe)
      const resolved = getComputedStyle(probe).backgroundColor
      probe.remove()
      return resolved
    })
    expect(panelRgb).not.toBe('')
    const footer = page.getByTestId('visualization-footer')
    await expect(footer).toBeVisible()
    const footerStyle = await footer.evaluate((el) => {
      const style = getComputedStyle(el)
      return {
        borderTopColor: style.borderTopColor,
        background: style.backgroundColor,
        paddingTop: style.paddingTop,
        paddingLeft: style.paddingLeft,
      }
    })
    expect(footerStyle.borderTopColor).toBe(expectedRgb)
    expect(footerStyle.background).toBe(panelRgb)
    expect(footerStyle.paddingTop).toBe('8px')
    expect(footerStyle.paddingLeft).toBe('12px')

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
    // Footer is portaled to the outer center panel card (Sigma parity), not
    // nested inside the shell.
    await expect(page.getByTestId('visualization-footer')).toBeVisible()
    const background = await shell.evaluate((el) => getComputedStyle(el).backgroundColor)
    expect(background).toBe('rgba(0, 0, 0, 0)')
    await expect(
      page.getByTestId('analytics-communities-visualization').getByRole('application'),
    ).toBeVisible()
  })
})
