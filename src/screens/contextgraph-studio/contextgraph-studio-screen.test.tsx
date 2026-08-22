// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'

import { MultiSelectDropdown } from '@/components/ui/selection-surfaces'
import { useContextGraphStudioStore } from '@/stores/contextgraph-studio-store'
import { useKnowledgeWorkbenchStore } from '@/stores/knowledge-workbench-store'
import { useWorkspaceStore } from '@/stores/workspace-store'

import { ContextGraphStudioScreen } from './contextgraph-studio-screen'
import {
  CompareMode,
  EvaluateMode,
  ExtractMode,
  GroundMode,
  InspectMode,
  SourcesMode,
} from './studio-shell'

vi.mock('@/hooks/use-settings', () => ({
  useSettingsStore: (selector: any) =>
    selector({ settings: { locale: 'en', theme: 'light' } }),
}))

vi.mock('@/components/chat-panel', () => ({
  ChatPanel: ({ embedded }: { embedded?: boolean }) => (
    <div
      data-testid="studio-chat-panel"
      data-embedded={embedded || undefined}
    />
  ),
}))

vi.mock('mammoth', () => ({
  extractRawText: vi.fn(async () => ({ value: 'Original DOCX content' })),
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
    const nav = screen.getAllByRole('tab', { name: /Graph/i })
    expect(nav.length).toBeGreaterThan(0)
    expect(screen.getByTestId('contextgraph-studio')).toBeTruthy()
    const modeNavigation = screen.getByRole('navigation', {
      name: 'ContextGraph Studio modes',
    })
    expect(
      modeNavigation.querySelector('[data-slot="tabs-list"][data-variant="underline"]'),
    ).toBeTruthy()
    fireEvent.keyDown(
      within(modeNavigation).getByRole('tab', { name: 'Graph' }),
      {
        key: 'ArrowRight',
      },
    )
    expect(useContextGraphStudioStore.getState().mode).toBe('inspect')
    expect(
      within(modeNavigation)
        .getByRole('tab', { name: 'Inspect' })
        .getAttribute('aria-current'),
    ).toBe('page')
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

  it('lets the Studio content own all available responsive width', () => {
    render(<ContextGraphStudioScreen />)
    const section = screen.getByTestId('contextgraph-studio').querySelector('section')
    const content = section?.firstElementChild
    expect(content?.className).toContain('flex-1')
    expect(content?.className).toContain('min-w-0')
  })

  it('switches the shared right sidebar between inspector and chat', () => {
    render(<ContextGraphStudioScreen />)
    expect(
      screen.queryByTestId('contextgraph-studio-right-sidebar'),
    ).toBeNull()
    fireEvent.click(
      screen.getByRole('button', { name: 'Open right sidebar' }),
    )
    const switcher = screen.getByRole('navigation', {
      name: 'ContextGraph side panel',
    })
    const sidebar = screen.getByTestId('contextgraph-studio-right-sidebar')
    expect(sidebar.className).toContain('fixed')
    expect(sidebar.className).toContain('top-[var(--titlebar-h,0px)]')
    expect(sidebar.className).toContain('max-w-[100vw]')
    expect(screen.getByTestId('contextgraph-studio').className).toContain(
      'min-[1200px]:pr-[420px]',
    )
    expect(
      screen.getByTestId('contextgraph-studio-right-sidebar-backdrop')
        .className,
    ).toContain('min-[1200px]:hidden')
    expect(
      within(sidebar).getByTestId('contextgraph-studio-inspector'),
    ).toBeTruthy()

    expect(
      switcher.querySelector('[data-slot="tabs-list"][data-variant="underline"]'),
    ).toBeTruthy()
    fireEvent.click(within(switcher).getByRole('tab', { name: 'Chat' }))

    expect(screen.getByTestId('contextgraph-studio-right-sidebar')).toBe(
      sidebar,
    )
    expect(within(sidebar).getByTestId('studio-chat-panel')).toBeTruthy()
    expect(
      within(switcher)
        .getByRole('tab', { name: 'Chat' })
        .getAttribute('aria-current'),
    ).toBe('page')

    fireEvent.click(
      within(sidebar).getByRole('button', { name: 'Close right sidebar' }),
    )
    expect(
      screen.queryByTestId('contextgraph-studio-right-sidebar'),
    ).toBeNull()
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
      expect(
        screen.getByRole('button', { name: 'Open Graph tab' }),
      ).toBeTruthy()
    })

    act(() => {
      screen.getByRole('button', { name: 'Open Graph tab' }).click()
    })

    expect(useContextGraphStudioStore.getState().mode).toBe('graph')
  })

  it('loads and uploads sources through the governed Knowledge Base APIs', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          pages: [{ title: 'Tender brief', path: 'uploads/tender.pdf' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            ok: true,
            kind: 'staged_for_ingest',
            originalName: 'new-tender.docx',
            storedName: 'new-tender.docx',
            ingestKind: 'document_extraction',
            stagedUploadRef: 'upload_ref_1',
          },
        ],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          storedMarkdownPath: 'uploads/new-tender.md',
        }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ pages: [] }) })
    vi.stubGlobal('fetch', fetchMock)

    render(<SourcesMode zh={false} onNext={vi.fn()} />)
    await waitFor(() =>
      expect(screen.getAllByText('tender.pdf').length).toBeGreaterThan(0),
    )

    const file = new File(['%PDF-1.7'], 'tender.pdf', {
      type: 'application/pdf',
    })
    fireEvent.change(screen.getByTestId('source-file-input'), {
      target: { files: [file] },
    })

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4))
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/knowledge/list')
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/knowledge/upload')
    const uploadRequest = fetchMock.mock.calls[1]?.[1] as RequestInit
    expect(uploadRequest.method).toBe('POST')
    expect(uploadRequest.body).toBeInstanceOf(FormData)
    expect((uploadRequest.body as FormData).get('files')).toBe(file)
    expect((uploadRequest.body as FormData).get('path')).toBe('uploads')
    expect((uploadRequest.body as FormData).get('ingestMode')).toBe('extract')
    expect((uploadRequest.body as FormData).get('session_id')).toBe(
      'knowledge-builder',
    )
    expect(fetchMock.mock.calls[2]?.[0]).toBe('/api/knowledge/ingest')
    expect(
      JSON.parse(String((fetchMock.mock.calls[2]?.[1] as RequestInit).body)),
    ).toMatchObject({
      uploadRef: 'upload_ref_1',
      confirmed: true,
      targetDir: 'uploads',
      sessionId: 'knowledge-builder',
    })
    await waitFor(() =>
      expect(screen.getAllByText('new-tender.docx').length).toBeGreaterThan(0),
    )
  })

  it('uses the canonical listbox dropdown for source status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          pages: [{ title: 'Tender brief', path: 'uploads/tender.pdf' }],
        }),
      })),
    )

    const { container } = render(<SourcesMode zh={false} onNext={vi.fn()} />)
    await screen.findAllByText('tender.pdf')
    expect(container.querySelector('select')).toBeNull()

    const trigger = screen.getByRole('button', { name: 'Source status' })
    fireEvent.click(trigger)
    const listbox = screen.getByRole('listbox', { name: 'Source status' })
    expect(
      within(listbox).getByRole('option', { name: /All status/ }),
    ).toBeTruthy()
    expect(within(listbox).getByRole('option', { name: 'Ready' })).toBeTruthy()
    expect(
      within(listbox).getByRole('option', { name: 'Waiting for ingest' }),
    ).toBeTruthy()
  })

  it('surfaces file-level upload failures returned with HTTP 200', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ pages: [] }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            ok: false,
            kind: 'file_failure',
            originalName: 'broken.docx',
            message: 'Parser-backed files require review and import',
          },
        ],
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ pages: [] }) })
    vi.stubGlobal('fetch', fetchMock)

    render(<SourcesMode zh={false} onNext={vi.fn()} />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    const file = new File(['not-a-docx'], 'broken.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })
    fireEvent.change(screen.getByTestId('source-file-input'), {
      target: { files: [file] },
    })

    await waitFor(() =>
      expect(
        screen.getByText('Parser-backed files require review and import'),
      ).toBeTruthy(),
    )
  })

  it('opens the original DOCX through the shared read-only viewer and extracts only from its normalized representation', async () => {
    const onNext = vi.fn()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          pages: [
            { title: 'Different internal title', path: 'uploads/tender.md' },
          ],
          sourceFiles: [
            {
              name: 'Tender brief.docx',
              path: 'uploads/tender.docx',
              kind: 'file',
            },
          ],
        }),
      })
      // W6 - W6 lazy-loads the viewer config when a PDF/DOCX preview opens.
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          configured: true,
          provider: 'open-source-unified',
          state: 'pending-installation',
          engine: 'placeholder-pending-flyfish-installation',
          plannedRenderer: 'flyfish-preset-office',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: '# Tender brief' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          run: { discovery_run_id: 'discovery-1', source_id: 'source-1' },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tenderPackage: { package_id: 'package-1' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ extractionRun: { extraction_run_id: 'run-1' } }),
      })
    vi.stubGlobal('fetch', fetchMock)

    render(<SourcesMode zh={false} onNext={onNext} />)
    const openButton = await screen.findByRole('button', {
      name: 'View Tender brief.docx',
    })
    await waitFor(() =>
      expect((openButton as HTMLButtonElement).disabled).toBe(false),
    )

    expect(screen.getByText('tender.md')).toBeTruthy()
    expect(screen.getByText('Internal normalized representation')).toBeTruthy()
    fireEvent.click(
      screen.getByRole('button', { name: 'View Tender brief.docx' }),
    )
    // W6 - DOCX originals now mount the shared read-only viewer (no
    // mammoth call). The lineage header carries distinct Original vs
    // Normalized labels so the original-vs-normalized distinction is
    // auditable at runtime.
    await expect(
      screen.findByRole('dialog', { name: 'Source preview' }),
    ).resolves.toBeTruthy()
    expect(screen.getByTestId('sources-preview-binary-viewer')).toBeTruthy()
    expect(
      screen.getByTestId('sources-preview-original-lineage'),
    ).toBeTruthy()
    expect(
      screen.getByTestId('sources-preview-normalized-lineage'),
    ).toBeTruthy()
    expect(screen.queryByText('Original DOCX content')).toBeNull()
    expect(
      fetchMock.mock.calls.find(
        ([url, init]) =>
          String(url).startsWith(
            '/api/files?action=download&path=wiki%2Fuploads%2Ftender.docx',
          ) && ((init as RequestInit | undefined)?.method ?? 'GET') !== 'HEAD',
      ),
    ).toBeUndefined()

    fireEvent.click(screen.getByRole('button', { name: 'Extract tender.md' }))
    await waitFor(() =>
      expect(fetchMock.mock.calls[5]?.[0]).toBe(
        '/api/semantier-proxy/api/knowledge/builder/extraction-runs',
      ),
    )
    expect(JSON.parse(String((fetchMock.mock.calls[5]?.[1] as RequestInit).body))).toMatchObject({
      schemaVersion: 'knowledge_builder_extraction_run_request.v2',
      sourceId: 'source-1',
      sourceRole: 'reference_sensitive_word_list',
      workflowKind: 'reference_graph_build',
    })
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it('projects normalized-document metadata and process lineage into the inspector context', async () => {
    const onInspectSource = vi.fn()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          pages: [{ title: 'Internal title', path: 'uploads/tender.md' }],
          sourceFiles: [
            {
              name: 'tender.docx',
              path: 'uploads/tender.docx',
              kind: 'file',
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [
            '# tender.docx',
            '> Authority level: curation_only',
            '> Authority use: prohibited_until_governed_promotion',
            '> Source file: wiki/uploads/tender.docx',
            '> Source upload ref: knowledge-upload:v1:test',
            '> Normalized artifact ref: artifacts/document_extraction/tender.json',
            '> Parser method: docx_ooxml',
          ].join('\n'),
        }),
      })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <SourcesMode
        zh={false}
        onNext={vi.fn()}
        onInspectSource={onInspectSource}
        extractionRunId="extract_1"
        candidateGraphId="candidate_graph_1"
      />,
    )
    fireEvent.click(await screen.findByRole('button', { name: 'tender.md' }))

    await waitFor(() => expect(onInspectSource).toHaveBeenCalledTimes(1))
    expect(onInspectSource.mock.calls[0]?.[0]).toMatchObject({
      name: 'tender.md',
      kind: 'normalized',
      metadata: expect.arrayContaining([
        { label: 'Parser method', value: 'docx_ooxml' },
      ]),
      lineage: expect.arrayContaining([
        expect.objectContaining({ id: 'upload' }),
        expect.objectContaining({ id: 'normalize' }),
        expect.objectContaining({ id: 'governance-context' }),
        expect.objectContaining({ id: 'semantic-extraction' }),
        expect.objectContaining({ id: 'candidate-graph' }),
      ]),
    })
  })

  it('requires a checked source before enabling Batch extract', async () => {
    const onNext = vi.fn()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          pages: [{ title: 'Tender brief', path: 'uploads/tender.md' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: '# Tender brief' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          run: { discovery_run_id: 'discovery-1', source_id: 'source-1' },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tenderPackage: { package_id: 'package-1' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ extractionRun: { extraction_run_id: 'run-1' } }),
      })
    vi.stubGlobal('fetch', fetchMock)

    render(<SourcesMode zh={false} onNext={onNext} />)
    await screen.findByRole('button', { name: 'Batch extract' })
    const batchButton = screen.getByRole('button', {
      name: 'Batch extract',
    }) as HTMLButtonElement
    expect(batchButton.disabled).toBe(true)

    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Select tender.md' }),
    )
    expect(batchButton.disabled).toBe(false)
    fireEvent.click(batchButton)

    await waitFor(() => expect(onNext).toHaveBeenCalledTimes(1))
    expect(fetchMock.mock.calls[3]?.[0]).toBe(
      '/api/semantier-proxy/api/knowledge/builder/extraction-runs',
    )
    expect(JSON.parse(String((fetchMock.mock.calls[3]?.[1] as RequestInit).body))).toMatchObject({
      schemaVersion: 'knowledge_builder_extraction_run_request.v2',
      sourceId: 'source-1',
      sourceRole: 'reference_sensitive_word_list',
      workflowKind: 'reference_graph_build',
    })
  })

  it('keeps inference inputs out of reference graph extraction', async () => {
    const onInspectSource = vi.fn()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          pages: [{ title: 'Tender input', path: 'uploads/tender.md' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [
            '# Tender input',
            '> Source file: wiki/uploads/tender.docx',
            '> Parser method: docx_ooxml',
          ].join('\n'),
        }),
      })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <SourcesMode
        zh={false}
        onNext={vi.fn()}
        onInspectSource={onInspectSource}
      />,
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Source use' }))
    fireEvent.click(screen.getByRole('option', { name: 'Inference input' }))
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Select tender.md' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Use in Inspect' }))

    await waitFor(() => expect(onInspectSource).toHaveBeenCalledTimes(1))
    expect(onInspectSource.mock.calls[0]?.[0]).toMatchObject({
      name: 'tender.md',
      kind: 'normalized',
    })
    expect(
      fetchMock.mock.calls.some(([url]) =>
        String(url).includes('/extraction-runs'),
      ),
    ).toBe(false)
    expect(
      screen.getByText(
        'Inference input is available in Inspect and was not written to the governed reference graph.',
      ),
    ).toBeTruthy()
  })

  it('navigates to every Studio screen', () => {
    render(<ContextGraphStudioScreen />)
    const nav = screen.getByRole('navigation', {
      name: 'ContextGraph Studio modes',
    })

    for (const mode of [
      'Sources',
      'Extract',
      'Ground',
      'Graph',
      'Inspect',
      'Compare',
      'Evaluate',
    ]) {
      fireEvent.click(within(nav).getByRole('tab', { name: mode }))
      expect(within(nav).getByRole('tab', { name: mode })).toBeTruthy()
    }
  })

  it('keeps View and Delete enabled after the normalized representation is deleted', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          pages: [],
          sourceFiles: [
            {
              name: 'Tender brief.docx',
              path: 'uploads/tender.docx',
              kind: 'file',
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, path: 'uploads/tender.docx' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ pages: [], sourceFiles: [] }),
      })
    vi.stubGlobal('fetch', fetchMock)
    render(<SourcesMode zh={false} onNext={vi.fn()} />)
    const viewButton = await screen.findByRole('button', {
      name: 'View Tender brief.docx',
    })
    const extractButton = screen.getByRole('button', {
      name: 'Extract Tender brief.docx',
    }) as HTMLButtonElement
    const deleteButton = screen.getByRole('button', {
      name: 'Delete Tender brief.docx',
    }) as HTMLButtonElement
    expect((viewButton as HTMLButtonElement).disabled).toBe(false)
    expect(extractButton.disabled).toBe(true)
    expect(deleteButton.disabled).toBe(false)
    fireEvent.click(
      screen.getByRole('button', { name: 'Delete Tender brief.docx' }),
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(
      screen.getByRole('alertdialog', { name: 'Delete source?' }),
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/knowledge/files')
    expect((fetchMock.mock.calls[1]?.[1] as RequestInit).method).toBe('DELETE')
    expect(
      JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body)),
    ).toEqual({ path: 'uploads/tender.docx' })
  })

  it('enables Extract navigation when a completed extraction run is loaded', async () => {
    const onNext = vi.fn()
    const onCandidates = vi.fn()
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
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ extractionRuns: [run] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          assertionCandidates: [{
            assertion_id: 'assertion-1', candidate_graph_id: 'graph-1',
            confidence: 0.9, grounding_state: 'unresolved', evidence_refs: [],
            normalized_assertion: { subject: { text: 'Candidate' } },
          }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          authorityState: 'candidate_only',
          assessmentSource: 'llm_structured',
          suggestions: [{
            assertion_id: 'assertion-1', status: 'supported',
            confidence: 0.9, evidence_anchor_refs: ['anchor-1'], provider: 'fixture',
            model: 'fixture-model', rationale: 'supported', issues: [],
          }],
        }),
      })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <ExtractMode
        zh={false}
        extractionRunId="run-1"
        onRun={vi.fn()}
        onNext={onNext}
        onCandidates={onCandidates}
      />,
    )
    const button = await screen.findByRole('button', {
      name: 'AI Ground',
    })
    expect((button as HTMLButtonElement).disabled).toBe(false)
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      '/api/semantier-proxy/api/knowledge/builder/extraction-runs?limit=20',
    )
    fireEvent.click(button)
    await waitFor(() => expect(onNext).toHaveBeenCalledTimes(1))
    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      '/api/semantier-proxy/api/knowledge/builder/extraction-runs/run-1/ai-grounding-suggestions',
    )
    expect(onCandidates.mock.calls.at(-1)?.[0]?.[0]).toMatchObject({
      ai_grounding_suggestion: { suggestion_status: 'supported', assessment_source: 'llm_structured' },
    })
    expect(JSON.parse(String((fetchMock.mock.calls[2]?.[1] as RequestInit).body))).toEqual({
      schemaVersion: 'knowledge_builder_ai_grounding_request.v2',
      extractionRunId: 'run-1',
      candidateIds: ['assertion-1'],
    })
  })

  it('records an accepted grounding decision and releases the candidate', async () => {
    const candidate = {
      assertion_id: 'assertion-1',
      candidate_graph_id: 'graph-1',
      confidence: 0.9,
      grounding_state: 'pending',
      evidence_refs: [{ evidence_ref: 'ev-1', selector_hash: 'selector-1' }],
      normalized_assertion: {
        subject: { text: 'Bidder' },
        predicate: 'must provide',
        object: { text: 'insurance' },
      },
      extraction_run_id: 'run-1',
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          assertionCandidate: {
            ...candidate,
            source_anchors: [
              { anchor_id: 'anchor-1', exact_text: 'insurance' },
            ],
          },
          learningEvents: [],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          available: true,
          previewHash: 'preview-hash-1',
          evidenceAnchorRefs: ['anchor-1'],
          graphDelta: {
            graph_delta_id: 'preview-delta',
            candidate_graph_id: 'graph-1',
            operations: [],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ learningEvent: { event_id: 'event-1' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ release: { release_id: 'release-1' } }),
      })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <GroundMode
        zh={false}
        extractionRunId="run-1"
        candidateGraphId="graph-1"
        assertionCandidates={[candidate]}
      />,
    )
    const accept = await screen.findByRole('button', { name: 'Accept' })
    fireEvent.click(accept)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4))
    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      '/api/semantier-proxy/api/knowledge/builder/reference-concepts/assertion-1/grounding-events',
    )
    expect(fetchMock.mock.calls[3]?.[0]).toBe(
      '/api/semantier-proxy/api/knowledge/builder/reference-concepts/assertion-1/release',
    )
    const groundingBody = JSON.parse(
      String((fetchMock.mock.calls[2]?.[1] as RequestInit).body),
    )
    expect(groundingBody.decision).toBe('accept')
    expect(groundingBody.evidenceAnchorRefs).toEqual(['anchor-1'])
    expect(groundingBody).not.toHaveProperty('graphDelta')
    expect(screen.queryByRole('button', { name: 'Previous' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull()
    expect(
      screen.getByRole('region', {
        name: 'Grounding candidate list',
      }),
    ).toBeTruthy()
    expect(screen.getByText('grounded').getAttribute('data-slot')).toBe('badge')
  })

  it('persists an edited reference concept with GraphDelta and materializes its release', async () => {
    const candidate = {
      assertion_id: 'assertion-edit-1',
      candidate_graph_id: 'graph-1',
      confidence: 0.9,
      grounding_state: 'unresolved',
      evidence_refs: [{ evidence_ref: 'ev-1', selector_hash: 'selector-1' }],
      normalized_assertion: {
        subject: { text: 'Original subject' },
        predicate: 'requires',
        object: { text: 'Original object' },
      },
      extraction_run_id: 'run-1',
    }
    const graphDelta = {
      graph_delta_id: 'preview-delta',
      candidate_graph_id: 'graph-1',
      operations: [{ action: 'node_edit' }],
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          assertionCandidate: {
            ...candidate,
            source_anchors: [{ anchor_id: 'anchor-1' }],
          },
          learningEvents: [],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          available: true,
          previewHash: 'preview-hash-edit',
          evidenceAnchorRefs: ['anchor-1'],
          graphDelta,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ learningEvent: { event_id: 'event-edit-1' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ graphRelease: { graph_version: 'KG_v2' } }),
      })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <GroundMode
        zh={false}
        extractionRunId="run-1"
        candidateGraphId="graph-1"
        assertionCandidates={[candidate]}
      />,
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByLabelText('Subject'), {
      target: { value: 'Edited subject' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save edit' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4))
    const groundingBody = JSON.parse(
      String((fetchMock.mock.calls[2]?.[1] as RequestInit).body),
    )
    expect(groundingBody).toMatchObject({
      decision: 'edit',
      editedAssertion: { subject_text: 'Edited subject' },
      graphDelta,
      graphDeltaPreviewHash: 'preview-hash-edit',
    })
    expect(fetchMock.mock.calls[3]?.[0]).toBe(
      '/api/semantier-proxy/api/knowledge/builder/reference-concepts/assertion-edit-1/release',
    )
    expect(screen.getByText('grounded')).toBeTruthy()
  })

  it('batch AI-grounds candidates for sortable focused human review', async () => {
    const candidates = [
      {
        assertion_id: 'assertion-ready',
        candidate_graph_id: 'graph-1',
        confidence: 0.91,
        grounding_state: 'unresolved',
        evidence_refs: [{ evidence_ref: 'ev-ready', selector_hash: 'sel-ready' }],
        normalized_assertion: { subject: { text: 'Ready candidate' } },
        ai_grounding_suggestion: {
          assertion_id: 'assertion-ready', suggestion_status: 'ready_for_review' as const,
          confidence: 0.91, evidence_anchor_count: 1, provider: 'semantica',
          provider_version: 'test', threshold: 0.75, rationale: 'ready',
          suggested_at: '2026-08-18T00:00:00+00:00',
        },
      },
      {
        assertion_id: 'assertion-low',
        candidate_graph_id: 'graph-1',
        confidence: 0.42,
        grounding_state: 'unresolved',
        evidence_refs: [{ evidence_ref: 'ev-low', selector_hash: 'sel-low' }],
        normalized_assertion: { subject: { text: 'Low candidate' } },
        ai_grounding_suggestion: {
          assertion_id: 'assertion-low', suggestion_status: 'low_confidence' as const,
          confidence: 0.42, evidence_anchor_count: 1, provider: 'semantica',
          provider_version: 'test', threshold: 0.75, rationale: 'review',
          suggested_at: '2026-08-18T00:00:00+00:00',
        },
      },
    ]
    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/graph-delta-preview')) {
        return { ok: true, json: async () => ({ available: false }) }
      }
      return {
        ok: true,
        json: async () => ({ assertionCandidate: candidates[0], learningEvents: [] }),
      }
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <GroundMode
        zh={false}
        extractionRunId="run-ai"
        candidateGraphId="graph-1"
        assertionCandidates={candidates}
      />,
    )
    await screen.findByText('low confidence')
    expect(screen.getByText('ready for review').getAttribute('data-slot')).toBe('badge')

    fireEvent.click(screen.getByRole('button', { name: 'AI grounding filter' }))
    fireEvent.click(screen.getByRole('option', { name: 'Low confidence' }))
    expect(screen.queryByText('Ready candidate')).toBeNull()
    expect(screen.getAllByText('Low candidate').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy()
  })

  it('selects table rows and batch accepts into a graph release without activating', async () => {
    const candidate = {
      assertion_id: 'assertion-batch', candidate_graph_id: 'graph-1', confidence: 0.8,
      grounding_state: 'unresolved',
      evidence_refs: [{ evidence_ref: 'ev-1', selector_hash: 'sel-1' }],
      source_anchors: [{ anchor_id: 'anchor-1', exact_text: 'source' }],
      normalized_assertion: { subject: { text: 'Batch candidate' } },
      ai_grounding_suggestion: {
        assertion_id: 'assertion-batch', assessment_source: 'llm_structured' as const,
        suggestion_status: 'supported' as const, confidence: 0.95,
        provider: 'fixture', model: 'fixture-model', rationale: 'supported',
      },
    }
    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/batch-grounding-events')) {
        return {
          ok: true,
          json: async () => ({
            acceptedCount: 1,
            authorityState: 'accepted_graph_released',
            graphRelease: {
              graph_version: 'KG_v9',
              candidate_graph_id: 'graph-1',
              human_label_event_ids: ['human-event-1'],
              nodes: [],
              edges: [],
              rules: [],
            },
          }),
        }
      }
      if (url.endsWith('/graph-delta-preview')) {
        return { ok: true, json: async () => ({ available: false }) }
      }
      return { ok: true, json: async () => ({ assertionCandidate: candidate, learningEvents: [] }) }
    })
    vi.stubGlobal('fetch', fetchMock)
    const onAcceptedRelease = vi.fn()
    render(
      <GroundMode
        zh={false}
        extractionRunId="run-batch"
        candidateGraphId="graph-1"
        assertionCandidates={[candidate]}
        onAcceptedRelease={onAcceptedRelease}
      />,
    )

    fireEvent.click(await screen.findByRole('checkbox', { name: 'Select Batch candidate' }))
    fireEvent.click(screen.getByRole('button', { name: 'Batch Accept' }))
    expect(screen.getAllByText(/creates one accepted graph release/i).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Accept' }))

    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/batch-grounding-events'))).toBe(true))
    const batchCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/batch-grounding-events'))
    const body = JSON.parse(String((batchCall?.[1] as RequestInit).body))
    expect(body.items).toEqual([{ assertionId: 'assertion-batch', evidenceAnchorRefs: ['anchor-1'] }])
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/release'))).toBe(false)
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('project-activate'))).toBe(false)
    await waitFor(() => expect(onAcceptedRelease).toHaveBeenCalledWith(expect.objectContaining({ graph_version: 'KG_v9' })))
    await waitFor(() => expect(screen.getByTestId('ground-accepted-release').textContent).toContain('KG_v9'))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Batch Accept' })).toBeNull())
  })

  it('loads boundary review data and submits a split action', async () => {
    const candidate = {
      assertion_id: 'assertion-split',
      candidate_graph_id: 'graph-1',
      confidence: 0.74,
      grounding_state: 'unresolved',
      evidence_refs: [{ evidence_ref: 'ev-1', selector_hash: 'sel-1' }],
      source_anchors: [{ anchor_id: 'anchor-1', exact_text: '大型企业、央企' }],
      normalized_assertion: { subject: { text: 'Boundary candidate' } },
    }
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/candidate-spans')) {
        return {
          ok: true,
          json: async () => ({
            candidateSpans: [{
              candidate_span_id: 'assertion-split',
              exact_text: '大型企业、央企',
              semantic_role: 'term',
              source_anchor_refs: ['anchor-1'],
              grounding_state: 'candidate',
              needs_boundary_review: true,
            }],
          }),
        }
      }
      if (url.endsWith('/learning-events')) {
        return { ok: true, json: async () => ({ learningEvents: [{ event_id: 'event-1', event_type: 'human_accept', actor_ref: 'user-1' }] }) }
      }
      if (url.endsWith('/graph-delta-preview')) {
        return { ok: true, json: async () => ({ available: false }) }
      }
      if (url.endsWith('/boundary-actions')) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            actionId: 'boundary_split_1',
            storedEvent: { event_id: 'event-split-1' },
            replacementSpanIds: ['ccs_v1_a', 'ccs_v1_b'],
            newGraphVersion: 4,
            refreshedDiagnostics: [],
          }),
        }
      }
      return {
        ok: true,
        json: async () => ({
          assertionCandidate: candidate,
          learningEvents: [],
        }),
      }
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <GroundMode
        zh={false}
        extractionRunId="run-split"
        candidateGraphId="graph-1"
        runtimeGraphVersion="KG_v3"
        enableBoundaryReview
        assertionCandidates={[candidate]}
      />,
    )

    await screen.findByText('Boundary review')
    expect(screen.getByText(/1 spans · 1 events/)).toBeTruthy()
    fireEvent.change(screen.getByPlaceholderText('12,24'), {
      target: { value: '5, 12' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Split current' }))

    await waitFor(() => {
      const boundaryCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/boundary-actions'))
      expect(boundaryCall).toBeTruthy()
      const body = JSON.parse(String((boundaryCall?.[1] as RequestInit).body))
      expect(body).toMatchObject({
        actionType: 'split',
        sourceSpanIds: ['assertion-split'],
        splitOffsetsAbsolute: [5, 12],
        expectedGraphVersion: 3,
      })
    })
  })

  it('filters the Ground candidate table by the Status filter dropdown', async () => {
    const candidates = [
      {
        assertion_id: 'assertion-grounded',
        candidate_graph_id: 'graph-1',
        confidence: 0.9,
        grounding_state: 'grounded',
        evidence_refs: [{ evidence_ref: 'ev-g', selector_hash: 'sel-g' }],
        normalized_assertion: { subject: { text: 'Grounded candidate' } },
      },
      {
        assertion_id: 'assertion-unresolved',
        candidate_graph_id: 'graph-1',
        confidence: 0.7,
        grounding_state: 'unresolved',
        evidence_refs: [{ evidence_ref: 'ev-u', selector_hash: 'sel-u' }],
        normalized_assertion: { subject: { text: 'Unresolved candidate' } },
      },
    ]
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/graph-delta-preview')) {
        return { ok: true, json: async () => ({ available: false }) }
      }
      return {
        ok: true,
        json: async () => ({
          assertionCandidate: candidates[0],
          learningEvents: [],
        }),
      }
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <GroundMode
        zh={false}
        extractionRunId="run-status"
        candidateGraphId="graph-1"
        assertionCandidates={candidates}
      />,
    )

    // Both rows visible at first (the candidate label appears in the table row
    // and the right-side detail header).
    expect(screen.getAllByText('Grounded candidate').length).toBeGreaterThan(0)
    expect(
      screen.getAllByText('Unresolved candidate').length,
    ).toBeGreaterThan(0)

    // Open the Status filter and narrow to "unresolved".
    fireEvent.click(screen.getByRole('button', { name: 'Status filter' }))
    fireEvent.click(
      screen.getByRole('menuitemcheckbox', { name: /^unresolved1$/ }),
    )

    const candidateTable = screen.getByRole('table')
    await waitFor(() =>
      expect(within(candidateTable).queryByText('Grounded candidate')).toBeNull(),
    )
    expect(
      within(candidateTable).getAllByText('Unresolved candidate').length,
    ).toBeGreaterThan(0)
  })

  it('runs Inspect against the tender review API', async () => {
    const onRun = vi.fn()
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ run: { run_id: 'tender-run-1', findings: [] } }),
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <InspectMode
        zh={false}
        run={null}
        onRun={onRun}
        onFindingContext={vi.fn()}
        onOpenGraph={vi.fn()}
      />,
    )
    fireEvent.change(
      screen.getByPlaceholderText('artifacts/document_extraction/target.json'),
      { target: { value: 'target.json' } },
    )
    fireEvent.click(screen.getByRole('button', { name: 'Run inspection' }))

    await waitFor(() =>
      expect(onRun).toHaveBeenCalledWith({
        run_id: 'tender-run-1',
        findings: [],
      }),
    )
    const inspectCall = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith('/api/tender-document-review/detections'),
    )
    expect(inspectCall?.[0]).toBe('/api/tender-document-review/detections')
    expect(JSON.parse(String((inspectCall?.[1] as RequestInit).body))).toMatchObject({
      fileRef: 'target.json',
      requestedRuleFamilies: ['tender_compliance'],
    })
  })

  it('keeps Compare guarded until two distinct released versions are selected', () => {
    render(
      <CompareMode
        zh={false}
        runtimeIdentity={{ graphVersion: 'v1' } as any}
        onGraph={vi.fn()}
        onGround={vi.fn()}
      />,
    )
    expect(
      (screen.getByRole('button', { name: 'Compare' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true)
    expect(
      screen.getByText('Select two released versions and click Compare.'),
    ).toBeTruthy()
  })

  it('renders Evaluate with its canonical evaluation link and decision disclaimer', () => {
    render(
      <EvaluateMode
        zh={false}
        runtimeIdentity={{ graphVersion: 'v1' } as any}
      />,
    )
    expect(screen.getByTestId('evaluate-open-evaluation')).toBeTruthy()
    expect(screen.getByTestId('evaluate-decision-disclaimer')).toBeTruthy()
    expect(screen.getByTestId('evaluate-loop-decision')).toBeTruthy()
  })
})

describe('MultiSelectDropdown', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders trigger label as "All" when every option is selected', () => {
    render(
      <MultiSelectDropdown
        label="Status filter"
        options={[
          { value: 'grounded', label: 'grounded' },
          { value: 'unresolved', label: 'unresolved' },
        ]}
        value={new Set(['grounded', 'unresolved'])}
        onValueChange={() => {}}
      />,
    )
    expect(
      screen.getByRole('button', { name: 'Status filter' }).textContent,
    ).toBe('All')
  })

  it('renders "N / M selected" label when not every option is selected', () => {
    render(
      <MultiSelectDropdown
        label="Status filter"
        options={[
          { value: 'grounded', label: 'grounded' },
          { value: 'unresolved', label: 'unresolved' },
        ]}
        value={new Set(['grounded'])}
        onValueChange={() => {}}
      />,
    )
    expect(
      screen.getByRole('button', { name: 'Status filter' }).textContent,
    ).toBe('1 / 2 selected')
  })

  it('toggles a value when its row is clicked and reports the new Set', () => {
    const onValueChange = vi.fn()
    render(
      <MultiSelectDropdown
        label="Status filter"
        options={[
          { value: 'grounded', label: 'grounded' },
          { value: 'rejected', label: 'rejected' },
        ]}
        value={new Set(['grounded'])}
        onValueChange={onValueChange}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Status filter' }))
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: /rejected/ }))
    expect(onValueChange).toHaveBeenCalledWith(new Set(['grounded', 'rejected']))
  })

  it('Clear button emits an empty Set', () => {
    const onValueChange = vi.fn()
    render(
      <MultiSelectDropdown
        label="Status filter"
        options={[
          { value: 'grounded', label: 'grounded' },
          { value: 'rejected', label: 'rejected' },
        ]}
        value={new Set(['grounded'])}
        onValueChange={onValueChange}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Status filter' }))
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(onValueChange).toHaveBeenCalledWith(new Set())
  })

  it('All button emits a Set containing every option value', () => {
    const onValueChange = vi.fn()
    render(
      <MultiSelectDropdown
        label="Status filter"
        options={[
          { value: 'grounded', label: 'grounded' },
          { value: 'rejected', label: 'rejected' },
        ]}
        value={new Set(['grounded'])}
        onValueChange={onValueChange}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Status filter' }))
    fireEvent.click(screen.getByRole('button', { name: 'All' }))
    expect(onValueChange).toHaveBeenCalledWith(
      new Set(['grounded', 'rejected']),
    )
  })
})
