import { describe, expect, it } from 'vitest'

import { shouldShowProfileCompletion } from './profile-completion-screen'

describe('shouldShowProfileCompletion', () => {
  it('shows the completion flow only for authenticated incomplete profiles', () => {
    expect(shouldShowProfileCompletion(true, false)).toBe(true)
    expect(shouldShowProfileCompletion(true, true)).toBe(false)
    expect(shouldShowProfileCompletion(false, false)).toBe(false)
    expect(shouldShowProfileCompletion(undefined, false)).toBe(false)
  })
})
