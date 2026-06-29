import { create } from 'zustand'

export type ActivityEvent = {
  type: string
  time: string
  text: string
  /** Actual filesystem path for file_read / file_write events */
  path?: string
  /** Optional payload rendered in Inspector Activity expanded view */
  details?: Record<string, unknown>
}

type ActivityState = {
  events: Array<ActivityEvent>
  /** The most recently resolved session key from the streaming hook */
  resolvedSessionKey: string | null
  push: (event: ActivityEvent) => void
  setResolvedSessionKey: (key: string) => void
  clear: () => void
}

const ACTIVITY_STORAGE_KEY = 'hermes-inspector-activity'

function loadPersistedActivityState(): {
  events: Array<ActivityEvent>
  resolvedSessionKey: string | null
} {
  if (typeof window === 'undefined') {
    return { events: [], resolvedSessionKey: null }
  }

  try {
    const raw = window.sessionStorage.getItem(ACTIVITY_STORAGE_KEY)
    if (!raw) return { events: [], resolvedSessionKey: null }
    const parsed = JSON.parse(raw) as {
      events?: Array<ActivityEvent>
      resolvedSessionKey?: string | null
    }
    return {
      events: Array.isArray(parsed.events) ? parsed.events : [],
      resolvedSessionKey:
        typeof parsed.resolvedSessionKey === 'string'
          ? parsed.resolvedSessionKey
          : null,
    }
  } catch {
    return { events: [], resolvedSessionKey: null }
  }
}

function persistActivityState(state: {
  events: Array<ActivityEvent>
  resolvedSessionKey: string | null
}) {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Ignore persistence failures to avoid breaking chat UI.
  }
}

const initialState = loadPersistedActivityState()

export const useActivityStore = create<ActivityState>((set, get) => ({
  events: initialState.events,
  resolvedSessionKey: initialState.resolvedSessionKey,
  push: (event) =>
    set((state) => {
      const nextState = {
        events: [...state.events, event].slice(-500),
        resolvedSessionKey: state.resolvedSessionKey,
      }
      persistActivityState(nextState)
      return nextState
    }),
  setResolvedSessionKey: (key) =>
    set((state) => {
      const nextState = {
        events: state.events,
        resolvedSessionKey: key,
      }
      persistActivityState(nextState)
      return nextState
    }),
  clear: () => {
    const nextState = { events: [], resolvedSessionKey: null }
    persistActivityState(nextState)
    set(nextState)
  },
}))

export function pushActivity(event: ActivityEvent) {
  useActivityStore.getState().push(event)
}

export function setActivitySessionKey(key: string) {
  if (key && key !== 'main' && key !== 'new') {
    useActivityStore.getState().setResolvedSessionKey(key)
  }
}
