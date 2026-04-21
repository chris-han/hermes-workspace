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
  it('prefers semantier-unicell when the Vibe backend is available', () => {
    expect(
      deriveGatewayModeFromCapabilities({
        vibe: { available: true, url: 'http://127.0.0.1:8899' },
        dashboard: { available: true, url: 'http://127.0.0.1:9119' },
        chatCompletions: true,
        sessions: true,
        enhancedChat: true,
        health: true,
      }),
    ).toBe('semantier-unicell')
  })

  it('keeps zero-fork detection when Vibe is unavailable', () => {
    expect(
      deriveGatewayModeFromCapabilities({
        vibe: { available: false, url: 'http://127.0.0.1:8899' },
        dashboard: { available: true, url: 'http://127.0.0.1:9119' },
        chatCompletions: true,
        sessions: true,
        enhancedChat: false,
        health: true,
      }),
    ).toBe('zero-fork')
  })

  it('falls back to enhanced-fork, portable, and disconnected in order', () => {
    expect(
      deriveGatewayModeFromCapabilities({
        vibe: { available: false, url: 'http://127.0.0.1:8899' },
        dashboard: { available: false, url: 'http://127.0.0.1:9119' },
        chatCompletions: false,
        sessions: true,
        enhancedChat: true,
        health: true,
      }),
    ).toBe('enhanced-fork')

    expect(
      deriveGatewayModeFromCapabilities({
        vibe: { available: false, url: 'http://127.0.0.1:8899' },
        dashboard: { available: false, url: 'http://127.0.0.1:9119' },
        chatCompletions: true,
        sessions: false,
        enhancedChat: false,
        health: true,
      }),
    ).toBe('portable')

    expect(
      deriveGatewayModeFromCapabilities({
        vibe: { available: false, url: 'http://127.0.0.1:8899' },
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
  it('forwards the active workspace hermes home on dashboard requests', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          authenticated: true,
          currentWorkspaceId: 'tenant-123',
          currentWorkspaceSlug: 'alice',
          currentWorkspaceRoot: '/repo/workspaces/tenant-123',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => '',
      })
    globalThis.fetch = fetchMock as typeof fetch

    await dashboardFetch(
      '/api/sessions',
      { headers: { Authorization: 'Bearer test-dashboard-token' } },
      {
        requestHeaders: { cookie: 'vt_session=session-123' },
      },
    )

    const [, dashboardInit] = fetchMock.mock.calls[1]
    const headers = new Headers(dashboardInit?.headers)
    expect(headers.get('X-Hermes-Home')).toBe(
      '/repo/workspaces/tenant-123/.hermes',
    )
  })
})