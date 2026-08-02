import { beforeEach, describe, expect, it } from 'vitest'

import {
  hydrateSessionActivity,
  pushActivity,
  setActivitySessionKey,
  useActivityStore,
} from './activity-store'

describe('activity store session isolation', () => {
  beforeEach(() => {
    useActivityStore.getState().clear()
  })

  it('clears parent activity when the active session changes', () => {
    setActivitySessionKey('source')
    pushActivity({ type: 'tool', time: '2026-08-02T00:00:00Z', text: 'source' })
    setActivitySessionKey('child')

    expect(useActivityStore.getState().events).toEqual([])
    expect(useActivityStore.getState().resolvedSessionKey).toBe('child')
  })

  it('hydrates only the requested child projection', () => {
    hydrateSessionActivity('child', [
      { type: 'tool', time: '2026-08-02T00:00:00Z', text: 'child' },
    ])

    expect(useActivityStore.getState().events).toHaveLength(1)
    expect(useActivityStore.getState().events[0]?.text).toBe('child')
  })
})
