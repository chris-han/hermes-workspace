import { describe, expect, it } from 'vitest'

import {
  buildVibeAgentProxyHeaders,
  buildVibeAgentProxyResponseHeaders,
} from './vibe-agent-api'

describe('buildVibeAgentProxyHeaders', () => {
  it('strips browser cookies by default so guest traffic stays on the public workspace', () => {
    const headers = buildVibeAgentProxyHeaders(
      new Headers({
        cookie: 'hermes-auth=workspace-session; vt_session=vibe-user-session',
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
    const headers = buildVibeAgentProxyHeaders(
      { cookie: 'vt_session=vibe-user-session' },
      {
        authHeaders: {},
        forwardBrowserCookies: true,
      },
    )

    expect(headers.get('cookie')).toBe('vt_session=vibe-user-session')
  })

  it('injects server-side auth headers without overwriting an existing authorization header', () => {
    const injected = buildVibeAgentProxyHeaders(
      {},
      {
        authHeaders: { Authorization: 'Bearer server-key' },
      },
    )
    const preserved = buildVibeAgentProxyHeaders(
      { Authorization: 'Bearer caller-token' },
      {
        authHeaders: { Authorization: 'Bearer server-key' },
      },
    )

    expect(injected.get('authorization')).toBe('Bearer server-key')
    expect(preserved.get('authorization')).toBe('Bearer caller-token')
  })

  it('filters forwarded browser cookies down to the auth session cookie when requested', () => {
    const headers = buildVibeAgentProxyHeaders(
      {
        cookie:
          'hermes-auth=workspace-session; vt_session=vibe-user-session; csrftoken=abc123',
      },
      {
        authHeaders: {},
        forwardBrowserCookies: true,
        allowedCookieNames: ['vt_session'],
      },
    )

    expect(headers.get('cookie')).toBe('vt_session=vibe-user-session')
  })
})

describe('buildVibeAgentProxyResponseHeaders', () => {
  it('preserves redirect and set-cookie headers for auth flows', () => {
    const upstreamHeaders = new Headers({
      'content-type': 'application/json',
      location: '/chat/main',
      'set-cookie': 'vt_session=session123; Path=/; HttpOnly',
    })

    const headers = buildVibeAgentProxyResponseHeaders(upstreamHeaders)

    expect(headers.get('content-type')).toBe('application/json')
    expect(headers.get('location')).toBe('/chat/main')
    expect(headers.get('set-cookie')).toContain('vt_session=session123')
  })
})