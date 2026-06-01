import { describe, expect, it } from 'vitest'

import {
  allowedSemantierAuthCookieNamesForPath,
  buildSemantierAgentProbeHeaders,
  buildSemantierAgentProxyHeaders,
  buildSemantierAgentProxyResponseHeaders,
} from './semantier-agent-api'

describe('buildSemantierAgentProxyHeaders', () => {
  it('strips browser cookies by default so guest traffic stays on the public workspace', () => {
    const headers = buildSemantierAgentProxyHeaders(
      new Headers({
        cookie:
          'hermes-auth=workspace-session; vt_session=semantier-user-session',
        host: 'localhost:3000',
        'content-length': '42',
        'x-trace-id': 'trace-123',
      }),
      {
        authHeaders: {},
      },
    )

    expect(headers.get('cookie')).toBeNull()
    expect(headers.get('host')).toBeNull()
    expect(headers.get('content-length')).toBeNull()
    expect(headers.get('x-trace-id')).toBe('trace-123')
  })

  it('preserves browser cookies only when explicitly enabled', () => {
    const headers = buildSemantierAgentProxyHeaders(
      { cookie: 'vt_session=semantier-user-session' },
      {
        authHeaders: {},
        forwardBrowserCookies: true,
      },
    )

    expect(headers.get('cookie')).toBe('vt_session=semantier-user-session')
  })

  it('injects server-side auth headers without overwriting an existing authorization header', () => {
    const injected = buildSemantierAgentProxyHeaders(
      {},
      {
        authHeaders: { Authorization: 'Bearer server-key' },
      },
    )
    const preserved = buildSemantierAgentProxyHeaders(
      { Authorization: 'Bearer caller-token' },
      {
        authHeaders: { Authorization: 'Bearer server-key' },
      },
    )

    expect(injected.get('authorization')).toBe('Bearer server-key')
    expect(preserved.get('authorization')).toBe('Bearer caller-token')
  })

  it('filters forwarded browser cookies down to the auth session cookie when requested', () => {
    const headers = buildSemantierAgentProxyHeaders(
      {
        cookie:
          'hermes-auth=workspace-session; vt_session=semantier-user-session; csrftoken=abc123',
      },
      {
        authHeaders: {},
        forwardBrowserCookies: true,
        allowedCookieNames: ['vt_session'],
      },
    )

    expect(headers.get('cookie')).toBe('vt_session=semantier-user-session')
  })

  it('preserves the Weixin browser binding cookie on Weixin auth routes', () => {
    const headers = buildSemantierAgentProxyHeaders(
      {
        cookie:
          'hermes-auth=workspace-session; vt_session=semantier-user-session; vt_browser_session=browser-nonce; csrftoken=abc123',
      },
      {
        authHeaders: {},
        forwardBrowserCookies: true,
        allowedCookieNames: allowedSemantierAuthCookieNamesForPath(
          '/auth/weixin/login/status',
        ),
      },
    )

    expect(headers.get('cookie')).toBe(
      'vt_session=semantier-user-session; vt_browser_session=browser-nonce',
    )
  })

  it('builds authenticated probe headers from the incoming browser cookie header', () => {
    const headers = buildSemantierAgentProbeHeaders(
      '/api/sessions',
      'hermes-auth=workspace-session; vt_session=semantier-user-session; csrftoken=abc123',
    )

    expect(headers.get('cookie')).toBe('vt_session=semantier-user-session')
  })
})

describe('buildSemantierAgentProxyResponseHeaders', () => {
  it('preserves redirect and set-cookie headers for auth flows', () => {
    const upstreamHeaders = new Headers({
      'content-type': 'application/json',
      location: '/chat/main',
      'set-cookie': 'vt_session=session123; Path=/; HttpOnly',
    })

    const headers = buildSemantierAgentProxyResponseHeaders(upstreamHeaders)

    expect(headers.get('content-type')).toBe('application/json')
    expect(headers.get('location')).toBe('/chat/main')
    expect(headers.get('set-cookie')).toContain('vt_session=session123')
  })

  it('splits combined set-cookie headers so both logout cookies survive proxying', () => {
    const upstreamHeaders = new Headers({
      'content-type': 'application/json',
      'set-cookie':
        'vt_session=\"\"; expires=Sun, 17 May 2026 11:40:06 GMT; Max-Age=0; Path=/; SameSite=lax, vt_browser_session=\"\"; expires=Sun, 17 May 2026 11:40:06 GMT; Max-Age=0; Path=/; SameSite=lax',
    })

    const headers = buildSemantierAgentProxyResponseHeaders(upstreamHeaders)
    const serialized = headers.get('set-cookie') || ''

    expect(serialized).toContain('vt_session=""')
    expect(serialized).toContain('vt_browser_session=""')
  })
})
