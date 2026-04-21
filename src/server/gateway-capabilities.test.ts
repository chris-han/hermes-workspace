import { describe, expect, it } from 'vitest'

import {
  deriveGatewayModeFromCapabilities,
  getGatewayModeLabel,
} from './gateway-capabilities'

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