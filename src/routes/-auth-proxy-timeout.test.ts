import { describe, expect, it } from 'vitest'

import { getAuthProxyTimeoutMs } from './auth/$'

describe('getAuthProxyTimeoutMs', () => {
  it('extends the proxy timeout for Weixin QR auth routes', () => {
    expect(getAuthProxyTimeoutMs('/auth/weixin/login/start')).toBe(20_000)
    expect(getAuthProxyTimeoutMs('/auth/weixin/login/status')).toBe(20_000)
  })

  it('extends the proxy timeout for Feishu login routes', () => {
    expect(getAuthProxyTimeoutMs('/auth/feishu/login')).toBe(20_000)
    expect(getAuthProxyTimeoutMs('/auth/feishu/login/callback')).toBe(20_000)
  })

  it('keeps the default timeout for other auth routes', () => {
    expect(getAuthProxyTimeoutMs('/auth/password/login')).toBe(5_000)
    expect(getAuthProxyTimeoutMs('/auth/context')).toBe(5_000)
  })
})
