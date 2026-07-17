import { describe, expect, it } from 'vitest'

import {
  artifactMatchesHighlight,
  persistedArtifactDisplayTitle,
} from './inspector-panel'

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

describe('artifactMatchesHighlight', () => {
  const artifact = {
    artifactId: 'report:abc123',
    filename: 'REIM-20260717-001.md',
    kind: 'governed_report',
    mediaType: 'text/markdown',
    path: '/workspace/sessions/session_abc/artifacts/reimbursement/REIM-20260717-001.md',
    rawUrl:
      '/sessions/session_abc/artifacts/reimbursement/REIM-20260717-001.md/raw',
    relativePath: 'reimbursement/REIM-20260717-001.md',
    sha256: 'abc123',
    sizeBytes: 128,
    timestamp: 1784301954839,
  }

  it('matches an encoded artifact selector hash to the persisted card', () => {
    expect(
      artifactMatchesHighlight(
        artifact,
        'reimbursement%2FREIM-20260717-001.md',
      ),
    ).toBe(true)
  })

  it('matches a raw session artifact URL to the same persisted card', () => {
    expect(
      artifactMatchesHighlight(
        artifact,
        '/sessions/session_abc/artifacts/reimbursement/REIM-20260717-001.md/raw',
      ),
    ).toBe(true)
  })
})
