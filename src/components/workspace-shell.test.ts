import { describe, expect, it } from 'vitest'
import {
  DESKTOP_SIDEBAR_BACKDROP_CLASS,
  shouldShowSemantierLogin,
} from './workspace-shell'

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
