import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('GitHub opportunity radar UAT contract', () => {
  it('keeps the required stable test IDs in the operator surface', () => {
    const source = readFileSync(new URL('./github-radar-screen.tsx', import.meta.url), 'utf8')
    for (const testId of [
      'vc-radar-page', 'vc-radar-organization', 'vc-radar-workspace',
      'vc-radar-create-universe', 'vc-radar-run-scan', 'vc-radar-target-list',
      'vc-radar-candidate-inspector', 'vc-radar-observed-facts',
      'vc-radar-derived-metrics', 'vc-radar-inferences', 'vc-radar-missing-evidence',
      'vc-radar-governance', 'vc-radar-replay', 'vc-radar-submit-candidate',
      'vc-radar-action-qualify', 'vc-radar-action-reject', 'vc-radar-action-defer',
      'vc-radar-action-enrichment', 'vc-radar-action-diligence', 'vc-radar-action-monitor',
      'vc-radar-export-replay',
    ]) expect(source).toContain(`data-testid="${testId}"`)
  })
})
