import { describe, expect, it } from 'vitest'
import {
  DESKTOP_SIDEBAR_BACKDROP_CLASS,
  shouldShowSemantierLogin,
} from './workspace-shell'
import { shouldShowProfileCompletion } from './auth/profile-completion-screen'

describe('workspace shell sidebar backdrop', () => {
  it('only spans the desktop sidebar width, not the full viewport', () => {
    expect(DESKTOP_SIDEBAR_BACKDROP_CLASS).toContain('w-[300px]')
    expect(DESKTOP_SIDEBAR_BACKDROP_CLASS).not.toContain('inset-0')
  })
})

describe('shouldShowSemantierLogin', () => {
  it('requires Semantier login once auth resolves unauthenticated', () => {
    expect(shouldShowSemantierLogin(false, false)).toBe(true)
  })

  it('does not require Semantier login while auth is still loading or already authenticated', () => {
    expect(shouldShowSemantierLogin(true, false)).toBe(false)
    expect(shouldShowSemantierLogin(false, true)).toBe(false)
    expect(shouldShowSemantierLogin(false, undefined)).toBe(false)
  })
})

describe('shouldShowProfileCompletion', () => {
  it('requires profile completion after Semantier auth succeeds with an incomplete profile', () => {
    expect(shouldShowProfileCompletion(true, false)).toBe(true)
  })

  it('does not require profile completion when unauthenticated or already complete', () => {
    expect(shouldShowProfileCompletion(false, false)).toBe(false)
    expect(shouldShowProfileCompletion(true, true)).toBe(false)
    expect(shouldShowProfileCompletion(undefined, false)).toBe(false)
  })
})
