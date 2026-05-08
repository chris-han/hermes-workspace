import { describe, expect, it } from 'vitest'

import { shouldPollWeixinLoginStatus } from './login-screen'

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
