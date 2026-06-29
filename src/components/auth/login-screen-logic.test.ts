import { describe, expect, it } from 'vitest'

import {
  getLoginScreenCopy,
  resolveDefaultLoginMethod,
  resolvePasswordLoginEndpoint,
  resolveAuthLocale,
  shouldAutoRefreshWeixinLoginQr,
  shouldPollWeixinLoginStatus,
  WEIXIN_LOGIN_POLL_INTERVAL_MS,
} from './login-screen'

describe('shouldPollWeixinLoginStatus', () => {
  it('polls while the QR login is pending', () => {
    expect(shouldPollWeixinLoginStatus('wait')).toBe(true)
    expect(shouldPollWeixinLoginStatus('scaned')).toBe(true)
    expect(shouldPollWeixinLoginStatus('scaned_but_redirect')).toBe(true)
  })

  it('stops polling after confirmation or expiry', () => {
    expect(shouldPollWeixinLoginStatus('confirmed')).toBe(false)
    expect(shouldPollWeixinLoginStatus('expired')).toBe(false)
    expect(shouldPollWeixinLoginStatus('failed')).toBe(false)
  })

  it('marks expired QR sessions for automatic refresh', () => {
    expect(shouldAutoRefreshWeixinLoginQr('expired')).toBe(true)
    expect(shouldAutoRefreshWeixinLoginQr('wait')).toBe(false)
    expect(shouldAutoRefreshWeixinLoginQr('confirmed')).toBe(false)
  })

  it('uses a repeating poll cadence instead of relying on status transitions', () => {
    expect(WEIXIN_LOGIN_POLL_INTERVAL_MS).toBe(1500)
  })
})

describe('resolvePasswordLoginEndpoint', () => {
  it('uses the Semantier-owned route for Semantier auth fallback', () => {
    expect(resolvePasswordLoginEndpoint('semantier')).toBe(
      '/auth/password/login',
    )
  })

  it('keeps the local route only for local workspace auth mode', () => {
    expect(resolvePasswordLoginEndpoint('local')).toBe('/api/auth')
  })
})

describe('resolveDefaultLoginMethod', () => {
  it('prefers Weixin when both login methods are available', () => {
    expect(resolveDefaultLoginMethod(true, true)).toBe('weixin')
  })

  it('falls back to password when Weixin is unavailable', () => {
    expect(resolveDefaultLoginMethod(false, true)).toBe('password')
  })
})

describe('auth locale defaults', () => {
  it('defaults to Chinese when locale is missing or unsupported', () => {
    expect(resolveAuthLocale()).toBe('zh')
    expect(resolveAuthLocale('fr')).toBe('zh')
    expect(getLoginScreenCopy().weixinSignIn).toBe('使用微信登录')
  })

  it('uses English copy only when explicitly selected', () => {
    expect(resolveAuthLocale('en')).toBe('en')
    expect(getLoginScreenCopy('en').weixinSignIn).toBe('Sign In With Weixin')
  })
})
