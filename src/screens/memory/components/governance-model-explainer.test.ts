import { describe, expect, it } from 'vitest'

import {
  AUTHORITY_LEVELS,
  GOVERNED_PROMOTION_STEPS,
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

  it('explains curation-only material and the governed promotion path', () => {
    expect(AUTHORITY_LEVELS.map((level) => level.label)).toContain(
      'curation_only',
    )
    expect(
      AUTHORITY_LEVELS.find((level) => level.label === 'curation_only')
        ?.description,
    ).toContain('cannot be cited as law')
    expect(GOVERNED_PROMOTION_STEPS.join(' ')).toContain('Register the source')
    expect(GOVERNED_PROMOTION_STEPS.join(' ')).toContain('Approve and activate')
  })
})
