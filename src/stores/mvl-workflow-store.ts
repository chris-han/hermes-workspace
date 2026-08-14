import { create } from 'zustand'

import {
  MvlWorkflowContextSchema,
  type MvlWorkflowContext,
} from '@/contracts/mvl-workflow'

type MvlWorkflowState = {
  context: MvlWorkflowContext | null
  dismissedCode: string | null
  setServerContext: (raw: unknown) => boolean
  dismissGuidance: (code: string) => void
}

export const useMvlWorkflowStore = create<MvlWorkflowState>((set) => ({
  context: null,
  dismissedCode: null,
  setServerContext: (raw) => {
    const parsed = MvlWorkflowContextSchema.safeParse(raw)
    if (!parsed.success) return false
    set({ context: parsed.data, dismissedCode: null })
    return true
  },
  // Dismissal changes presentation only; it cannot change workflow truth.
  dismissGuidance: (code) => set({ dismissedCode: code }),
}))
