// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'

import { useContextGraphStudioStore } from '@/stores/contextgraph-studio-store'
import { useKnowledgeWorkbenchStore } from '@/stores/knowledge-workbench-store'
import { useWorkspaceStore } from '@/stores/workspace-store'

import { ContextGraphStudioScreen } from './contextgraph-studio-screen'
import { CompareMode, EvaluateMode, ExtractMode, GroundMode, InspectMode, SourcesMode } from './studio-shell'

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
    vi.unstubAllGlobals()
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
    expect(ctx.activeFunction).toEqual({
      surface: 'contextgraph-studio',
      function: 'candidate_extraction',
      tab: 'extract',
    })
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

  it('opens the Graph tab from the runtime error footer', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({}),
      })),
    )
    render(<ContextGraphStudioScreen />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Open Graph tab' })).toBeTruthy()
    })

    act(() => {
      screen.getByRole('button', { name: 'Open Graph tab' }).click()
    })

    expect(useContextGraphStudioStore.getState().mode).toBe('graph')
  })

  it('loads and uploads sources through the governed Knowledge Base APIs', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ pages: [{ title: 'Tender brief', path: 'uploads/tender.pdf' }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{
          ok: true,
          kind: 'staged_for_ingest',
          originalName: 'new-tender.docx',
          storedName: 'new-tender.docx',
          ingestKind: 'document_extraction',
          stagedUploadRef: 'upload_ref_1',
        }],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, storedMarkdownPath: 'uploads/new-tender.md' }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ pages: [] }) })
    vi.stubGlobal('fetch', fetchMock)

    render(<SourcesMode zh={false} onNext={vi.fn()} />)
    await waitFor(() => expect(screen.getAllByText('Tender brief').length).toBeGreaterThan(0))

    const file = new File(['%PDF-1.7'], 'tender.pdf', { type: 'application/pdf' })
    fireEvent.change(screen.getByTestId('source-file-input'), { target: { files: [file] } })

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4))
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/knowledge/list')
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/knowledge/upload')
    const uploadRequest = fetchMock.mock.calls[1]?.[1] as RequestInit
    expect(uploadRequest.method).toBe('POST')
    expect(uploadRequest.body).toBeInstanceOf(FormData)
    expect((uploadRequest.body as FormData).get('files')).toBe(file)
    expect((uploadRequest.body as FormData).get('path')).toBe('uploads')
    expect((uploadRequest.body as FormData).get('ingestMode')).toBe('extract')
    expect((uploadRequest.body as FormData).get('session_id')).toBe('knowledge-builder')
    expect(fetchMock.mock.calls[2]?.[0]).toBe('/api/knowledge/ingest')
    expect(JSON.parse(String((fetchMock.mock.calls[2]?.[1] as RequestInit).body))).toMatchObject({
      uploadRef: 'upload_ref_1',
      confirmed: true,
      targetDir: 'uploads',
      sessionId: 'knowledge-builder',
    })
    await waitFor(() => expect(screen.getAllByText('new-tender.docx').length).toBeGreaterThan(0))
  })

  it('surfaces file-level upload failures returned with HTTP 200', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ pages: [] }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{
          ok: false,
          kind: 'file_failure',
          originalName: 'broken.docx',
          message: 'Parser-backed files require review and import',
        }],
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ pages: [] }) })
    vi.stubGlobal('fetch', fetchMock)

    render(<SourcesMode zh={false} onNext={vi.fn()} />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    const file = new File(['not-a-docx'], 'broken.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
    fireEvent.change(screen.getByTestId('source-file-input'), { target: { files: [file] } })

    await waitFor(() => expect(screen.getByText('Parser-backed files require review and import')).toBeTruthy())
  })

  it('opens a persisted source and enables Extract for staged sources', async () => {
    const onNext = vi.fn()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ pages: [{ title: 'Tender brief', path: 'uploads/tender.md' }] }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ content: '# Tender brief' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ content: '# Tender brief' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ run: { discovery_run_id: 'discovery-1', source_id: 'source-1' } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ tenderPackage: { package_id: 'package-1' } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ extractionRun: { extraction_run_id: 'run-1' } }) })
    vi.stubGlobal('fetch', fetchMock)

    render(<SourcesMode zh={false} onNext={onNext} />)
    const openButton = await screen.findByRole('button', { name: 'View Tender brief' })
    await waitFor(() => expect((openButton as HTMLButtonElement).disabled).toBe(false))

    fireEvent.click(screen.getByRole('button', { name: 'View Tender brief' }))
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Source preview' })).toBeTruthy())
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/knowledge/read?path=uploads%2Ftender.md')
    expect(screen.getByText('# Tender brief')).toBeTruthy()

    fireEvent.click(screen.getByTitle('Extract source'))
    await waitFor(() => expect(fetchMock.mock.calls[5]?.[0]).toBe('/api/semantier-proxy/api/knowledge/builder/extraction-runs'))
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it('requires a checked source before enabling Batch extract', async () => {
    const onNext = vi.fn()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ pages: [{ title: 'Tender brief', path: 'uploads/tender.md' }] }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ content: '# Tender brief' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ run: { discovery_run_id: 'discovery-1', source_id: 'source-1' } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ tenderPackage: { package_id: 'package-1' } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ extractionRun: { extraction_run_id: 'run-1' } }) })
    vi.stubGlobal('fetch', fetchMock)

    render(<SourcesMode zh={false} onNext={onNext} />)
    await screen.findByRole('button', { name: 'Batch extract' })
    const batchButton = screen.getByRole('button', { name: 'Batch extract' }) as HTMLButtonElement
    expect(batchButton.disabled).toBe(true)

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Tender brief' }))
    expect(batchButton.disabled).toBe(false)
    fireEvent.click(batchButton)

    await waitFor(() => expect(onNext).toHaveBeenCalledTimes(1))
    expect(fetchMock.mock.calls[4]?.[0]).toBe('/api/semantier-proxy/api/knowledge/builder/extraction-runs')
  })

  it('navigates to every Studio screen', () => {
    render(<ContextGraphStudioScreen />)
    const nav = screen.getByRole('navigation')

    for (const mode of ['Sources', 'Extract', 'Ground', 'Graph', 'Inspect', 'Compare', 'Evaluate']) {
      fireEvent.click(within(nav).getByRole('button', { name: mode }))
      expect(within(nav).getByRole('button', { name: mode })).toBeTruthy()
    }
  })

  it('deletes a source through the governed knowledge files API', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ pages: [{ title: 'Tender brief', path: 'uploads/tender.md' }] }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, path: 'uploads/tender.md' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ pages: [] }) })
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('confirm', vi.fn(() => true))

    render(<SourcesMode zh={false} onNext={vi.fn()} />)
    await screen.findByRole('button', { name: 'Delete Tender brief' })
    fireEvent.click(screen.getByRole('button', { name: 'Delete Tender brief' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/knowledge/files')
    expect((fetchMock.mock.calls[1]?.[1] as RequestInit).method).toBe('DELETE')
    expect(JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body))).toEqual({ path: 'uploads/tender.md' })
  })

  it('enables Extract navigation when a completed extraction run is loaded', async () => {
    const onNext = vi.fn()
    const run = {
      extraction_run_id: 'run-1',
      source_id: 'source-1',
      document_id: 'document-1',
      provider_ref: 'semantica',
      provider_commit: 'commit-1',
      profile_ref: 'tender_sensitive_v1',
      run_status: 'completed',
      failure_reason: null,
      warnings: [],
      started_at: '2026-08-17T00:00:00Z',
      candidate_graph_id: 'graph-1',
    }
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ extractionRuns: [run] }),
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ assertionCandidates: [] }),
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<ExtractMode zh={false} extractionRunId="run-1" onRun={vi.fn()} onNext={onNext} />)
    const button = await screen.findByRole('button', { name: 'Ground candidates' })
    expect((button as HTMLButtonElement).disabled).toBe(false)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/semantier-proxy/api/knowledge/builder/extraction-runs?limit=20')
    fireEvent.click(button)
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it('records an accepted grounding decision and releases the candidate', async () => {
    const candidate = {
      assertion_id: 'assertion-1',
      candidate_graph_id: 'graph-1',
      confidence: 0.9,
      grounding_state: 'pending',
      evidence_refs: [{ evidence_ref: 'ev-1', selector_hash: 'selector-1' }],
      normalized_assertion: { subject: { text: 'Bidder' }, predicate: 'must provide', object: { text: 'insurance' } },
      extraction_run_id: 'run-1',
    }
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ assertionCandidate: { ...candidate, source_anchors: [{ anchor_id: 'anchor-1', exact_text: 'insurance' }] }, learningEvents: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ available: false, reason: 'preview unavailable' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ extractionRun: {} }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ learningEvent: { event_id: 'event-1' } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ release: { release_id: 'release-1' } }) })
    vi.stubGlobal('fetch', fetchMock)

    render(<GroundMode zh={false} extractionRunId="run-1" candidateGraphId="graph-1" assertionCandidates={[candidate]} />)
    const accept = await screen.findByRole('button', { name: 'Accept' })
    fireEvent.click(accept)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(5))
    expect(fetchMock.mock.calls[3]?.[0]).toBe('/api/semantier-proxy/api/knowledge/builder/assertion-candidates/assertion-1/grounding-events')
    expect(fetchMock.mock.calls[4]?.[0]).toBe('/api/semantier-proxy/api/knowledge/builder/assertion-candidates/assertion-1/release')
  })

  it('runs Inspect against the tender review API', async () => {
    const onRun = vi.fn()
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ run: { run_id: 'tender-run-1', findings: [] } }),
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<InspectMode zh={false} run={null} onRun={onRun} onFindingContext={vi.fn()} onOpenGraph={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText('artifacts/document_extraction/target.json'), { target: { value: 'target.json' } })
    fireEvent.click(screen.getByRole('button', { name: 'Run inspection' }))

    await waitFor(() => expect(onRun).toHaveBeenCalledWith({ run_id: 'tender-run-1', findings: [] }))
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/tender-document-review')
  })

  it('keeps Compare guarded until two distinct released versions are selected', () => {
    render(<CompareMode zh={false} runtimeIdentity={{ graphVersion: 'v1' } as any} onGraph={vi.fn()} onGround={vi.fn()} />)
    expect((screen.getByRole('button', { name: 'Compare' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('Select two released versions and click Compare.')).toBeTruthy()
  })

  it('renders Evaluate with its canonical evaluation link and decision disclaimer', () => {
    render(<EvaluateMode zh={false} runtimeIdentity={{ graphVersion: 'v1' } as any} />)
    expect(screen.getByTestId('evaluate-open-evaluation')).toBeTruthy()
    expect(screen.getByTestId('evaluate-decision-disclaimer')).toBeTruthy()
    expect(screen.getByTestId('evaluate-loop-decision')).toBeTruthy()
  })
})
