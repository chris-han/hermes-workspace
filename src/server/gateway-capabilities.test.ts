import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  dashboardFetch,
  deriveGatewayModeFromCapabilities,
  getGatewayModeLabel,
} from './gateway-capabilities'

const originalFetch = globalThis.fetch

afterEach(() => {
  vi.restoreAllMocks()
  globalThis.fetch = originalFetch
})

describe('deriveGatewayModeFromCapabilities', () => {
  it('prefers semantier-unicell when the Semantier backend is available', () => {
    expect(
      deriveGatewayModeFromCapabilities({
        semantier: { available: true, url: 'http://127.0.0.1:8899' },
        dashboard: { available: true, url: 'http://127.0.0.1:9119' },
        chatCompletions: true,
        sessions: true,
        enhancedChat: true,
        health: true,
      }),
    ).toBe('semantier-unicell')
  })

  it('treats non-Semantier capability sets as disconnected in single-surface mode', () => {
    expect(
      deriveGatewayModeFromCapabilities({
        semantier: { available: false, url: 'http://127.0.0.1:8899' },
        dashboard: { available: true, url: 'http://127.0.0.1:9119' },
        chatCompletions: true,
        sessions: true,
        enhancedChat: false,
        health: true,
      }),
    ).toBe('disconnected')
  })

  it('keeps disconnected fallback for legacy non-Semantier capability combinations', () => {
    expect(
      deriveGatewayModeFromCapabilities({
        semantier: { available: false, url: 'http://127.0.0.1:8899' },
        dashboard: { available: false, url: 'http://127.0.0.1:9119' },
        chatCompletions: false,
        sessions: true,
        enhancedChat: true,
        health: true,
      }),
    ).toBe('disconnected')

    expect(
      deriveGatewayModeFromCapabilities({
        semantier: { available: false, url: 'http://127.0.0.1:8899' },
        dashboard: { available: false, url: 'http://127.0.0.1:9119' },
        chatCompletions: true,
        sessions: false,
        enhancedChat: false,
        health: true,
      }),
    ).toBe('disconnected')

    expect(
      deriveGatewayModeFromCapabilities({
        semantier: { available: false, url: 'http://127.0.0.1:8899' },
        dashboard: { available: false, url: 'http://127.0.0.1:9119' },
        chatCompletions: false,
        sessions: false,
        enhancedChat: false,
        health: false,
      }),
    ).toBe('disconnected')
  })

  it('maps semantier-unicell to a human-readable label', () => {
    expect(getGatewayModeLabel('semantier-unicell')).toBe('Semantier Unicell')
  })
})

describe('dashboardFetch', () => {
  it('routes dashboard API requests through the single backend surface', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => '',
      })
    globalThis.fetch = fetchMock as typeof fetch

    await dashboardFetch('/api/sessions', {}, {
      requestHeaders: { cookie: 'vt_session=session-123; ignored=value' },
    })

    const [dashboardUrl, dashboardInit] = fetchMock.mock.calls[0]
    const headers = new Headers(dashboardInit?.headers)
    expect(dashboardUrl).toBe('http://127.0.0.1:8899/api/sessions')
    expect(headers.get('cookie')).toBe('vt_session=session-123')
  })
})
