import { describe, expect, it } from 'vitest'

import {
  resolvePasswordLoginEndpoint,
  shouldPollWeixinLoginStatus,
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
