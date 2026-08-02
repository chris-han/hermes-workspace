import { describe, expect, it } from 'vitest'

import { normalizeBranchTitle } from './branching'

describe('normalizeBranchTitle', () => {
  it('adds exactly one branch prefix', () => {
    expect(normalizeBranchTitle('Original')).toBe('⎇ Original')
    expect(normalizeBranchTitle('⎇ Original')).toBe('⎇ Original')
  })

  it('uses the deterministic fallback title', () => {
    expect(normalizeBranchTitle('')).toBe('⎇ New Session')
    expect(normalizeBranchTitle(undefined)).toBe('⎇ New Session')
  })
})
