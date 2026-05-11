import { describe, expect, it } from 'vitest'

import { shouldRecoverMissingSessionRoute } from './chat-route-recovery'

describe('shouldRecoverMissingSessionRoute', () => {
  it('recovers when a stale route resolves to new in the current workspace', () => {
    expect(
      shouldRecoverMissingSessionRoute({
        activeFriendlyId: 'session_9267770bd3be',
        activeExists: false,
        sessionsReady: true,
        historyFetching: false,
        resolvedSessionKey: 'new',
        isNewChat: false,
        recentSession: false,
      }),
    ).toBe(true)
  })

  it('does not recover when the session still exists', () => {
    expect(
      shouldRecoverMissingSessionRoute({
        activeFriendlyId: 'session_9267770bd3be',
        activeExists: true,
        sessionsReady: true,
        historyFetching: false,
        resolvedSessionKey: 'session_9267770bd3be',
        isNewChat: false,
        recentSession: false,
      }),
    ).toBe(false)
  })

  it('does not recover before history resolution finishes', () => {
    expect(
      shouldRecoverMissingSessionRoute({
        activeFriendlyId: 'session_9267770bd3be',
        activeExists: false,
        sessionsReady: true,
        historyFetching: true,
        resolvedSessionKey: 'new',
        isNewChat: false,
        recentSession: false,
      }),
    ).toBe(false)
  })

  it('does not recover for embedded chat surfaces', () => {
    expect(
      shouldRecoverMissingSessionRoute({
        activeFriendlyId: 'session_9267770bd3be',
        activeExists: false,
        sessionsReady: true,
        historyFetching: false,
        resolvedSessionKey: 'new',
        isNewChat: false,
        recentSession: false,
        embedded: true,
      }),
    ).toBe(false)
  })
})
