import { describe, expect, it } from 'vitest'

import {
  GOVERNANCE_EXPLAINER_POINTS,
  GOVERNANCE_EXPLAINER_TITLE,
} from './governance-model-explainer'

describe('governance model explainer copy', () => {
  it('frames governance as explanatory rather than live activation controls', () => {
    expect(GOVERNANCE_EXPLAINER_TITLE).toBe('Governance Model')
    expect(GOVERNANCE_EXPLAINER_POINTS.join(' ')).toContain('non-authoritative')
    expect(GOVERNANCE_EXPLAINER_POINTS.join(' ')).toContain(
      'cannot weaken T4, T3, or T2 obligations',
    )
  })
})
