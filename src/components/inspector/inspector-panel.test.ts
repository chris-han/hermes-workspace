import { describe, expect, it } from 'vitest'

import { persistedArtifactDisplayTitle } from './inspector-panel'

describe('persistedArtifactDisplayTitle', () => {
  it('uses the relative path for nested session artifacts', () => {
    expect(
      persistedArtifactDisplayTitle({
        relativePath: 'reimbursement/REIM-20260717-001.md',
        filename: 'REIM-20260717-001.md',
        path: '/workspace/session/artifacts/reimbursement/REIM-20260717-001.md',
      }),
    ).toBe('reimbursement/REIM-20260717-001.md')
  })
})
