import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type LegalCorpusChatContext = {
  sourceId: string
  title: string
  contextType?:
    | 'source'
    | 'version'
    | 'anchor'
    | 'refresh_check'
    | 'scan_run'
    | 'candidate'
    | 'impact_report'
    | 'review_package'
    | 'bundle'
  versionId?: string
  anchorId?: string
  refreshCheckId?: string
  scanRunId?: string
  candidateId?: string
  impactReportRef?: string
  bundleId?: string
  posture?: string
  comparisonClass?: string
  lifecycleState?: string
  authorityTier?: string
  candidateCount?: number
  anchorCount?: number
}

type WorkspaceState = {
  sidebarCollapsed: boolean
  sidebarPinned: boolean
  fileExplorerCollapsed: boolean
  chatFocusMode: boolean
  /** Currently active sub-page route (e.g. '/skills', '/channels') — null means chat-only */
  activeSubPage: string | null
  /** Chat panel visible alongside non-chat routes */
  chatPanelOpen: boolean
  /** Session key for the chat panel (defaults to 'main') */
  chatPanelSessionKey: string
  /** Mobile keyboard / composer focus — hides tab bar */
  mobileKeyboardOpen: boolean
  mobileKeyboardInset: number
  mobileComposerFocused: boolean
  legalCorpusChatContext: LegalCorpusChatContext | null
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  toggleSidebarPinned: () => void
  toggleFileExplorer: () => void
  setFileExplorerCollapsed: (collapsed: boolean) => void
  toggleChatFocusMode: () => void
  setChatFocusMode: (enabled: boolean) => void
  setActiveSubPage: (page: string | null) => void
  toggleChatPanel: () => void
  setChatPanelOpen: (open: boolean) => void
  setChatPanelSessionKey: (key: string) => void
  setMobileKeyboardOpen: (open: boolean) => void
  setMobileKeyboardInset: (inset: number) => void
  setMobileComposerFocused: (focused: boolean) => void
  setLegalCorpusChatContext: (context: LegalCorpusChatContext | null) => void
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      sidebarPinned: false,
      fileExplorerCollapsed: true,
      chatFocusMode: false,
      activeSubPage: null,
      chatPanelOpen: false,
      chatPanelSessionKey: 'main',
      mobileKeyboardOpen: false,
      mobileKeyboardInset: 0,
      mobileComposerFocused: false,
      legalCorpusChatContext: null,
      toggleSidebar: () =>
        set((s) => {
          if (s.sidebarPinned) {
            return { sidebarPinned: false, sidebarCollapsed: true }
          }
          return { sidebarCollapsed: !s.sidebarCollapsed }
        }),
      setSidebarCollapsed: (collapsed) =>
        set((s) => {
          if (collapsed && s.sidebarPinned) {
            return { sidebarPinned: false, sidebarCollapsed: true }
          }
          return { sidebarCollapsed: collapsed }
        }),
      toggleSidebarPinned: () =>
        set((s) => ({
          sidebarPinned: !s.sidebarPinned,
          sidebarCollapsed: s.sidebarPinned ? true : false,
        })),
      toggleFileExplorer: () =>
        set((s) => ({ fileExplorerCollapsed: !s.fileExplorerCollapsed })),
      setFileExplorerCollapsed: (collapsed) =>
        set({ fileExplorerCollapsed: collapsed }),
      toggleChatFocusMode: () =>
        set((s) => ({ chatFocusMode: !s.chatFocusMode })),
      setChatFocusMode: (enabled) => set({ chatFocusMode: enabled }),
      setActiveSubPage: (page) => set({ activeSubPage: page }),
      toggleChatPanel: () => set((s) => ({ chatPanelOpen: !s.chatPanelOpen })),
      setChatPanelOpen: (open) => set({ chatPanelOpen: open }),
      setMobileKeyboardOpen: (open) => set({ mobileKeyboardOpen: open }),
      setMobileKeyboardInset: (inset) => set({ mobileKeyboardInset: inset }),
      setMobileComposerFocused: (focused) =>
        set({ mobileComposerFocused: focused }),
      setChatPanelSessionKey: (key) => set({ chatPanelSessionKey: key }),
      setLegalCorpusChatContext: (context) =>
        set({ legalCorpusChatContext: context }),
    }),
    {
      name: 'hermes-workspace-v1',
      merge: (persistedState: any, currentState) => {
        const merged = { ...currentState, ...(persistedState || {}) }
        if (merged.sidebarPinned) {
          merged.sidebarCollapsed = false
        }
        return merged
      },
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        sidebarPinned: state.sidebarPinned,
        fileExplorerCollapsed: state.fileExplorerCollapsed,
        chatPanelOpen: state.chatPanelOpen,
        chatPanelSessionKey: state.chatPanelSessionKey,
      }),
    },
  ),
)
