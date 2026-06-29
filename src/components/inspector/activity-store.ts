import { create } from 'zustand'

export type ActivityEvent = {
  type: string
  time: string
  text: string
  /** Actual filesystem path for file_read / file_write events */
  path?: string
}

type ActivityState = {
  events: Array<ActivityEvent>
  /** The most recently resolved session key from the streaming hook */
  resolvedSessionKey: string | null
  push: (event: ActivityEvent) => void
  setResolvedSessionKey: (key: string) => void
  clear: () => void
}

export const useActivityStore = create<ActivityState>((set) => ({
  events: [],
  resolvedSessionKey: null,
  push: (event) =>
    set((state) => ({
      events: [...state.events, event],
    })),
  setResolvedSessionKey: (key) => set({ resolvedSessionKey: key }),
  clear: () => set({ events: [], resolvedSessionKey: null }),
}))

export function pushActivity(event: ActivityEvent) {
  useActivityStore.getState().push(event)
}

export function setActivitySessionKey(key: string) {
  if (key && key !== 'main' && key !== 'new') {
    useActivityStore.getState().setResolvedSessionKey(key)
  }
}
