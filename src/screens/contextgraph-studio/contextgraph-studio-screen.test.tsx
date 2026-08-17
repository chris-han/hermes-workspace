// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'

import {
  useContextGraphStudioStore,
} from '@/stores/contextgraph-studio-store'
import {
  useKnowledgeWorkbenchStore,
} from '@/stores/knowledge-workbench-store'
import { useWorkspaceStore } from '@/stores/workspace-store'

import { ContextGraphStudioScreen } from './contextgraph-studio-screen'

vi.mock('@/hooks/use-settings', () => ({
  useSettingsStore: (selector: any) =>
    selector({ settings: { locale: 'en', theme: 'light' } }),
}))

describe('ContextGraphStudioScreen', () => {
  beforeEach(() => {
    useContextGraphStudioStore.getState().reset()
    useKnowledgeWorkbenchStore.setState({
      context: {
        schemaVersion: 'knowledge_workbench_context.v2',
        graphRef: null,
        graphVersion: null,
        graphHash: null,
        authorityState: 'candidate',
        runMode: null,
        candidateGraphId: null,
        acceptedReleaseId: null,
        acceptedReleaseVersion: null,
        selectedNodeIds: [],
        selectedEdgeIds: [],
        selectedRuleIds: [],
        selectedCandidateId: null,
        selectedEvidenceRefs: [],
        activeSourceIdentityRef: null,
        sourceAnchors: [],
        governanceState: 'candidate',
        hasAcceptedRelease: false,
        extractionRunId: null,
        providerRef: null,
        providerCommit: null,
      },
      presentation: {
        highlightedNodeIds: [],
        highlightedEdgeIds: [],
        dimOthers: false,
        viewport: 'unchanged',
      },
      diagnostic: null,
      appliedCommandIds: new Set(),
    })
    useWorkspaceStore.setState({
      chatPanelOpen: false,
      chatPanelSessionKey: 'main',
    } as any)
  })

  afterEach(() => {
    cleanup()
  })

  it('renders all six studio modes with the graph mode as the default', () => {
    // Default mode is graph per existing screen (legacy fallback).
    render(<ContextGraphStudioScreen />)
    const nav = screen.getAllByRole('button', { name: /Graph/i })
    expect(nav.length).toBeGreaterThan(0)
    expect(screen.getByTestId('contextgraph-studio')).toBeTruthy()
  })

  it('updates KnowledgeWorkbenchContext when the mode changes', () => {
    render(<ContextGraphStudioScreen />)
    act(() => {
      useContextGraphStudioStore.getState().setMode('extract')
    })
    const ctx = useKnowledgeWorkbenchStore.getState().context
    expect(ctx.runMode).toBeNull() // runMode is restricted; only 'evaluation_baseline' or 'authoritative' in this contract
    expect(ctx.activeSourceIdentityRef).not.toBeNull()
  })

  it('writes evaluation_baseline runMode when in evaluate mode', () => {
    render(<ContextGraphStudioScreen />)
    act(() => {
      useContextGraphStudioStore.getState().setMode('evaluate')
    })
    const ctx = useKnowledgeWorkbenchStore.getState().context
    expect(ctx.runMode).toBe('evaluation_baseline')
  })

  it('reads chatPanelOpen from workspace store and toggles through it', () => {
    render(<ContextGraphStudioScreen />)
    expect(useWorkspaceStore.getState().chatPanelOpen).toBe(false)
    act(() => {
      useWorkspaceStore.getState().setChatPanelOpen(true)
    })
    expect(useWorkspaceStore.getState().chatPanelOpen).toBe(true)
  })
})