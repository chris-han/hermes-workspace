/**
 * Shared react-vega test double (plan
 * `2026-08-22-semantica-vega-lite-chart-engine-v1`, T6).
 *
 * Vega view tests must not render the real Vega runtime under jsdom; they
 * assert the DETERMINISTIC compiled spec instead (A12). Test files install
 * the double via:
 *
 *   vi.mock('react-vega', async () => {
 *     const React = await import('react')
 *     const capture = await import('./vega-capture')
 *     return {
 *       VegaEmbed: (props: Record<string, unknown>) => {
 *         capture.captureVega(props)
 *         return React.createElement('div', { 'data-testid': 'vega-embed-stub' })
 *       },
 *     }
 *   })
 */

export interface CapturedVegaRender {
  spec: Record<string, unknown>
  onEmbed?: (result: unknown) => void
}

/** Fake vega-embed result: runs the captured `pick` listener synchronously. */
export function fakeVegaEmbedResult(pickValue: unknown): { view: { addSignalListener: (n: string, fn: (n: string, v: unknown) => void) => void } } {
  return {
    view: {
      addSignalListener: (name, fn) => {
        if (name === 'pick') fn('pick', pickValue)
      },
    },
  }
}

export const capturedVegaRenders: CapturedVegaRender[] = []

export function captureVega(props: Record<string, unknown>): void {
  capturedVegaRenders.push({
    spec: props.spec as Record<string, unknown>,
    onEmbed: props.onEmbed as CapturedVegaRender['onEmbed'],
  })
}

export function resetCapturedVega(): void {
  capturedVegaRenders.length = 0
}

export function latestVegaSpec(): Record<string, unknown> {
  const latest = capturedVegaRenders[capturedVegaRenders.length - 1]
  if (!latest) throw new Error('no Vega render captured')
  return latest.spec
}

export function latestVegaRender(): CapturedVegaRender {
  const latest = capturedVegaRenders[capturedVegaRenders.length - 1]
  if (!latest) throw new Error('no Vega render captured')
  return latest
}

/** Recursively collect Vega-Lite `params` arrays from a spec (layers/vconcat). */
export function collectVegaParams(spec: Record<string, unknown>): Array<Record<string, unknown>> {
  const found: Array<Record<string, unknown>> = []
  const visit = (node: unknown): void => {
    if (typeof node !== 'object' || node === null) return
    if (Array.isArray(node)) {
      node.forEach(visit)
      return
    }
    const record = node as Record<string, unknown>
    if (Array.isArray(record.params)) {
      for (const param of record.params) found.push(param as Record<string, unknown>)
    }
    for (const key of ['layer', 'vconcat', 'hconcat', 'concat', 'spec']) {
      if (record[key]) visit(record[key])
    }
  }
  visit(spec)
  return found
}
