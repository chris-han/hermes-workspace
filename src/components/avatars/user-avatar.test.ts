import { describe, expect, it } from 'vitest'

import { deriveAvatarInitials } from './user-avatar'

describe('deriveAvatarInitials', () => {
  it('builds a single uppercase initial from a multi-word name', () => {
    expect(deriveAvatarInitials('Alice Zhang')).toBe('A')
  })

  it('builds a single-letter initial from a single token', () => {
    expect(deriveAvatarInitials('chris-han')).toBe('C')
  })

  it('falls back safely for empty labels', () => {
    expect(deriveAvatarInitials('   ')).toBe('?')
  })
})
