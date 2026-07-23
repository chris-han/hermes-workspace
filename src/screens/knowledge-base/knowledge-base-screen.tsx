import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  CheckListIcon,
  Clock01Icon,
  Search01Icon,
  Add01Icon,
  Tick02Icon,
  Upload01Icon,
} from '@hugeicons/core-free-icons'
import {
  fetchLegalAcceptanceEvidence,
  fetchLegalAcceptanceEvidenceExports,
  fetchLegalCorpusDashboard,
  fetchLegalCorpusInventory,
  fetchLegalEvidenceContract,
  registerLegalSource,
  uploadLegalSourceArtifact,
  type LegalAcceptanceEvidenceExportRef,
  type LegalCorpusInventory,
  type RegisterLegalSourceInput,
  type LegalSemanticCandidate,
  type LegalSource,
  type LegalSourceArtifact,
  type LegalSourceSection,
  type LegalVersionEdge,
  type LegalSourceVersion,
} from '@/lib/legal-corpus'
import { cn } from '@/lib/utils'
import { useSettingsStore } from '@/hooks/use-settings'
import { useWorkspaceStore } from '@/stores/workspace-store'

const LEGAL_COPY = {
  en: {
    title: 'Knowledge Base',
    subtitle: 'Chinese tender authority substrate',
    exportEvidence: 'Export evidence',
    sourceInventory: 'Source inventory',
    sources: 'Sources',
    versions: 'Versions',
    claims: 'Claims',
    registerSource: 'Register law/source',
    canonicalTitle: 'Title',
    canonicalTitlePlaceholder: 'Regulation or policy title',
    issuer: 'Issuer',
    issuerPlaceholder: 'Issuing authority',
    authorityTier: 'Authority tier',
    jurisdiction: 'Jurisdiction',
    expectedStatus: 'Expected status',
    documentNumber: 'Document number',
    optional: 'optional',
    saveSource: 'Register',
    registering: 'Registering...',
    sourceRegistered: 'Source registered',
    sourceView: 'Source',
    compiledOntologyView: 'Compiled ontology',
    uploadSourceFile: 'Upload source file',
    choosePdf: 'Choose PDF/text',
    uploadFile: 'Upload',
    uploadingFile: 'Uploading...',
    uploadRequiresVersion: 'Select a source with a registered version first',
    uploadComplete: 'Source file preserved',
    metadataExtracted: 'Metadata extracted',
    legalApiUnavailable: 'Knowledge base API unavailable',
    noGovernedSources: 'No governed legal sources',
    tierPending: 'tier pending',
    unresolved: 'unresolved',
    versionCount: (count: number) => `${count} versions`,
    noSourceSelected: 'No source selected',
    issuerPending: 'issuer pending',
    jurisdictionPending: 'jurisdiction pending',
    authority: 'Authority',
    version: 'Version',
    effectivity: 'Effectivity',
    sourceHash: 'Source hash',
    pipelineState: 'Pipeline state',
    current: 'current',
    rawArtifacts: 'Raw artifacts',
    artifact: 'artifact',
    mimePending: 'mime pending',
    noRawArtifact: 'No raw artifact recorded',
    articleAnchors: 'Article anchors',
    headingPending: 'heading pending',
    noArticleAnchors: 'No article anchors recorded',
    versionLineage: 'Version lineage',
    lineage: 'lineage',
    lineageTo: 'to',
    noLineageEdge: 'No lineage edge recorded',
    extractedClaims: 'Extracted claims and source spans',
    candidate: 'candidate',
    noExtractedClaims: 'No extracted claims recorded',
    certifiedActivation: 'Certified activation',
    registrySnapshot: 'Registry snapshot',
    authorityBundle: 'Authority bundle',
    activation: 'Activation',
    notActive: 'not active',
    aiWorkflowActions: 'AI workflow actions',
    buildReviewPackage: 'Build review package',
    curateSource: 'Curate source',
    promoteCandidate: 'Promote candidate',
    certifySource: 'Certify source',
    activateBundle: 'Activate bundle',
    runRefreshCheck: 'Run refresh check',
    dashboardMetrics: 'Dashboard metrics',
    acceptanceEvidence: 'Acceptance evidence',
    noSignedExport: 'No signed export persisted',
    exportLabel: 'export',
    recordLabel: 'record',
    notRecorded: 'not recorded',
    notApplicable: 'n/a',
    spanNotRecorded: 'span not recorded',
    locatorPending: 'locator pending',
    spanPending: 'span pending',
    spanParseFailed: 'span parse failed',
  },
  zh: {
    title: '知识库',
    subtitle: '中国招投标权威知识底座',
    exportEvidence: '导出证据',
    sourceInventory: '来源清单',
    sources: '来源',
    versions: '版本',
    claims: '声明',
    registerSource: '登记法律/来源',
    canonicalTitle: '标题',
    canonicalTitlePlaceholder: '法规或政策标题',
    issuer: '发布机关',
    issuerPlaceholder: '发布机关',
    authorityTier: '权威层级',
    jurisdiction: '管辖区',
    expectedStatus: '预期状态',
    documentNumber: '文号',
    optional: '可选',
    saveSource: '登记',
    registering: '登记中...',
    sourceRegistered: '来源已登记',
    sourceView: '来源',
    compiledOntologyView: '已编译本体',
    uploadSourceFile: '上传来源文件',
    choosePdf: '选择 PDF/文本',
    uploadFile: '上传',
    uploadingFile: '上传中...',
    uploadRequiresVersion: '请先选择已有登记版本的来源',
    uploadComplete: '来源文件已保存',
    metadataExtracted: '已抽取元数据',
    legalApiUnavailable: '知识库 API 不可用',
    noGovernedSources: '暂无受治理法律来源',
    tierPending: '层级待定',
    unresolved: '未解析',
    versionCount: (count: number) => `${count} 个版本`,
    noSourceSelected: '未选择来源',
    issuerPending: '发布机关待定',
    jurisdictionPending: '管辖区待定',
    authority: '权威层级',
    version: '版本',
    effectivity: '生效时间',
    sourceHash: '来源哈希',
    pipelineState: '流水线状态',
    current: '当前',
    rawArtifacts: '原始制品',
    artifact: '制品',
    mimePending: 'MIME 待定',
    noRawArtifact: '暂无原始制品记录',
    articleAnchors: '条文锚点',
    headingPending: '标题待定',
    noArticleAnchors: '暂无条文锚点记录',
    versionLineage: '版本沿革',
    lineage: '沿革',
    lineageTo: '到',
    noLineageEdge: '暂无沿革边记录',
    extractedClaims: '已抽取声明与来源片段',
    candidate: '候选项',
    noExtractedClaims: '暂无已抽取声明记录',
    certifiedActivation: '已认证激活',
    registrySnapshot: '注册表快照',
    authorityBundle: '权威包',
    activation: '激活',
    notActive: '未激活',
    aiWorkflowActions: 'AI 工作流操作',
    buildReviewPackage: '生成评审包',
    curateSource: '治理来源',
    promoteCandidate: '提升候选项',
    certifySource: '认证来源',
    activateBundle: '激活权威包',
    runRefreshCheck: '运行刷新检查',
    dashboardMetrics: '仪表盘指标',
    acceptanceEvidence: '验收证据',
    noSignedExport: '暂无已持久化签署导出',
    exportLabel: '导出',
    recordLabel: '记录',
    notRecorded: '未记录',
    notApplicable: '不适用',
    spanNotRecorded: '片段未记录',
    locatorPending: '定位待定',
    spanPending: '片段待定',
    spanParseFailed: '片段解析失败',
  },
} as const

type LegalCopy = typeof LEGAL_COPY.en

const EMPTY_SOURCE_FORM: RegisterLegalSourceInput = {
  canonical_title: '',
  issuer: '',
  authority_tier: 'NATIONAL_LAW',
  jurisdiction: 'CN',
  expected_status: 'ACTIVE',
  document_number: '',
  governance_state: 'LISTED',
}

type LegalViewMode = 'source' | 'compiled'

const fieldClassName =
  'h-8 w-full min-w-0 rounded-md border border-border bg-background px-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary'

function shortRef(value?: string | null, fallback = 'not recorded'): string {
  if (!value) return fallback
  if (value.length <= 34) return value
  return `${value.slice(0, 16)}...${value.slice(-10)}`
}

function percent(value?: number | null, fallback = 'n/a'): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return `${Math.round(value * 100)}%`
}

function metricValue(value?: number | null, fallback = 'n/a'): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  if (value <= 1 && value >= 0) return percent(value, fallback)
  return String(value)
}

function parseSpan(candidate: LegalSemanticCandidate, copy: LegalCopy): string {
  if (!candidate.source_span_json) return copy.spanNotRecorded
  try {
    const span = JSON.parse(candidate.source_span_json) as Record<string, unknown>
    const locator = String(span.stable_locator ?? copy.locatorPending)
    const start = span.char_start
    const end = span.char_end
    return `${locator} ${start ?? '?'}-${end ?? '?'}`
  } catch {
    return copy.spanParseFailed
  }
}

function parseSectionSpan(section: LegalSourceSection, copy: LegalCopy): string {
  if (!section.anchor_json) return copy.spanPending
  try {
    const anchor = JSON.parse(section.anchor_json) as Record<string, unknown>
    const start = anchor.char_start
    const end = anchor.char_end
    return `${start ?? '?'}-${end ?? '?'}`
  } catch {
    return copy.spanParseFailed
  }
}

function sourceVersions(
  inventory: LegalCorpusInventory | undefined,
  sourceId: string | undefined,
): Array<LegalSourceVersion> {
  if (!inventory || !sourceId) return []
  return inventory.versions.filter((version) => version.source_id === sourceId)
}

function latestVersion(versions: Array<LegalSourceVersion>) {
  return versions.at(-1)
}

type SourceBundle = {
  source?: LegalSource
  version?: LegalSourceVersion
  artifacts: Array<LegalSourceArtifact>
  sections: Array<LegalSourceSection>
  candidates: Array<LegalSemanticCandidate>
  versionEdges: Array<LegalVersionEdge>
}

function buildBundle(
  inventory: LegalCorpusInventory | undefined,
  selectedSourceId: string | undefined,
): SourceBundle {
  const source = inventory?.sources.find(
    (item) => item.source_id === selectedSourceId,
  )
  const version = latestVersion(sourceVersions(inventory, selectedSourceId))
  if (!inventory || !version) {
    return {
      source,
      version,
      artifacts: [],
      sections: [],
      candidates: [],
      versionEdges: [],
    }
  }
  return {
    source,
    version,
    artifacts: inventory.artifacts.filter(
      (artifact) => artifact.version_id === version.version_id,
    ),
    sections: inventory.sections.filter(
      (section) => section.version_id === version.version_id,
    ),
    candidates: inventory.semantic_candidates.filter(
      (candidate) => candidate.version_id === version.version_id,
    ),
    versionEdges: inventory.version_edges.filter(
      (edge) =>
        edge.from_version_id === version.version_id ||
        edge.to_version_id === version.version_id,
    ),
  }
}

export function LegalCorpusScreen() {
  const queryClient = useQueryClient()
  const locale = useSettingsStore((state) => state.settings.locale)
  const copy = locale === 'zh' ? LEGAL_COPY.zh : LEGAL_COPY.en
  const [selectedSourceId, setSelectedSourceId] = useState<string | undefined>()
  const [selectedCandidateId, setSelectedCandidateId] = useState<
    string | undefined
  >()
  const [sourceForm, setSourceForm] =
    useState<RegisterLegalSourceInput>(EMPTY_SOURCE_FORM)
  const [registrationMessage, setRegistrationMessage] = useState<string | null>(
    null,
  )
  const [legalViewMode, setLegalViewMode] = useState<LegalViewMode>('source')
  const [queuedSourceFile, setQueuedSourceFile] = useState<File | null>(null)
  const [sourceUploadMessage, setSourceUploadMessage] = useState<string | null>(
    null,
  )
  const setChatPanelOpen = useWorkspaceStore((s) => s.setChatPanelOpen)
  const setLegalContext = useWorkspaceStore((s) => s.setLegalCorpusChatContext)

  const inventoryQuery = useQuery({
    queryKey: ['legal-corpus', 'inventory'],
    queryFn: fetchLegalCorpusInventory,
    staleTime: 10_000,
  })
  const dashboardQuery = useQuery({
    queryKey: ['legal-corpus', 'dashboard'],
    queryFn: fetchLegalCorpusDashboard,
    staleTime: 10_000,
  })
  const evidenceContractQuery = useQuery({
    queryKey: ['legal-corpus', 'pipeline2-evidence-contract'],
    queryFn: fetchLegalEvidenceContract,
    staleTime: 10_000,
  })
  const persistedExportsQuery = useQuery({
    queryKey: ['legal-corpus', 'acceptance-evidence-exports'],
    queryFn: fetchLegalAcceptanceEvidenceExports,
    staleTime: 10_000,
  })

  const inventory = inventoryQuery.data
  useEffect(() => {
    if (!selectedSourceId && inventory?.sources[0]) {
      setSelectedSourceId(inventory.sources[0].source_id)
    }
  }, [inventory, selectedSourceId])

  const bundle = useMemo(
    () => buildBundle(inventory, selectedSourceId),
    [inventory, selectedSourceId],
  )
  const selectedCandidate =
    bundle.candidates.find(
      (candidate) => candidate.candidate_id === selectedCandidateId,
    ) ?? bundle.candidates[0]

  const exportMutation = useMutation({
    mutationFn: () =>
      fetchLegalAcceptanceEvidence(`knowledge-base-${Date.now()}`),
    onSuccess: (payload) => {
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${payload.test_run_id || 'knowledge-base-evidence'}.json`
      link.click()
      URL.revokeObjectURL(url)
    },
  })

  const registerSourceMutation = useMutation({
    mutationFn: registerLegalSource,
    onSuccess: async (source) => {
      setSelectedSourceId(source.source_id)
      setSourceForm(EMPTY_SOURCE_FORM)
      setRegistrationMessage(copy.sourceRegistered)
      await queryClient.invalidateQueries({
        queryKey: ['legal-corpus', 'inventory'],
      })
      await queryClient.invalidateQueries({
        queryKey: ['legal-corpus', 'dashboard'],
      })
    },
    onError: (error) => {
      setRegistrationMessage(
        error instanceof Error ? error.message : copy.legalApiUnavailable,
      )
    },
  })

  const uploadSourceMutation = useMutation({
    mutationFn: async () => {
      if (!bundle.version?.version_id) {
        throw new Error(copy.uploadRequiresVersion)
      }
      if (!queuedSourceFile) {
        throw new Error(copy.choosePdf)
      }
      return uploadLegalSourceArtifact(bundle.version.version_id, queuedSourceFile)
    },
    onSuccess: async (result) => {
      setQueuedSourceFile(null)
      const suggestions = result.metadata_suggestions
      const extracted = [
        suggestions?.canonical_title,
        suggestions?.issuer,
        suggestions?.document_number,
        suggestions?.effective_from,
      ].filter(Boolean).length
      setSourceUploadMessage(
        extracted > 0
          ? `${copy.uploadComplete}. ${copy.metadataExtracted}: ${extracted}`
          : copy.uploadComplete,
      )
      await queryClient.invalidateQueries({
        queryKey: ['legal-corpus', 'inventory'],
      })
      await queryClient.invalidateQueries({
        queryKey: ['legal-corpus', 'dashboard'],
      })
    },
    onError: (error) => {
      setSourceUploadMessage(
        error instanceof Error ? error.message : copy.legalApiUnavailable,
      )
    },
  })

  function updateSourceForm<K extends keyof RegisterLegalSourceInput>(
    field: K,
    value: RegisterLegalSourceInput[K],
  ) {
    setRegistrationMessage(null)
    setSourceForm((current) => ({ ...current, [field]: value }))
  }

  function handleRegisterSource() {
    const canonicalTitle = sourceForm.canonical_title.trim()
    const issuer = sourceForm.issuer.trim()
    const authorityTier = sourceForm.authority_tier.trim()
    const jurisdiction = sourceForm.jurisdiction.trim()
    const expectedStatus = sourceForm.expected_status.trim()
    if (!canonicalTitle || !issuer || !authorityTier || !jurisdiction) return
    registerSourceMutation.mutate({
      canonical_title: canonicalTitle,
      issuer,
      authority_tier: authorityTier,
      jurisdiction,
      expected_status: expectedStatus || 'ACTIVE',
      document_number: sourceForm.document_number?.trim() || null,
      governance_state: sourceForm.governance_state || 'LISTED',
    })
  }

  function bindChatContext(actionType: string) {
    if (!bundle.source) return
    setLegalContext({
      sourceId: bundle.source.source_id,
      title: bundle.source.canonical_title || bundle.source.source_id,
      versionId: bundle.version?.version_id,
      lifecycleState: bundle.version?.lifecycle_state,
      authorityTier: bundle.source.authority_tier,
      candidateCount: bundle.candidates.length,
      anchorCount: bundle.sections.length,
    })
    setChatPanelOpen(true)
    return actionType
  }

  const metrics = dashboardQuery.data?.metrics ?? {}
  const lifecycleStates = [
    'DRAFT',
    'CONSULTATION',
    'REGISTERED',
    'CHANGE_DETECTED',
    'CERTIFIED',
    'ACTIVE',
    'SUPERSEDED',
    'REPEALED',
    'UNRESOLVED',
  ]

  return (
    <div
      lang={locale === 'zh' ? 'zh-CN' : 'en'}
      className="flex h-full min-h-0 flex-col bg-background text-foreground"
    >
      <header className="border-b border-border px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">{copy.title}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {copy.subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={() => exportMutation.mutate()}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm font-semibold text-foreground transition-colors hover:border-primary hover:bg-primary/10"
          >
            <HugeiconsIcon icon={Tick02Icon} size={15} strokeWidth={1.6} />
            {copy.exportEvidence}
          </button>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[320px_minmax(0,1fr)_300px]">
        <aside className="min-h-0 border-b border-border lg:border-b-0 lg:border-r">
          <div className="border-b border-border px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <HugeiconsIcon icon={Search01Icon} size={15} strokeWidth={1.6} />
              {copy.sourceInventory}
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
              <Metric
                label={copy.sources}
                value={inventory?.metrics.source_count}
                fallback={copy.notApplicable}
              />
              <Metric
                label={copy.versions}
                value={inventory?.metrics.version_count}
                fallback={copy.notApplicable}
              />
              <Metric
                label={copy.claims}
                value={inventory?.metrics.semantic_candidate_count}
                fallback={copy.notApplicable}
              />
            </div>
          </div>
          <div className="border-b border-border px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <HugeiconsIcon icon={Add01Icon} size={15} strokeWidth={1.6} />
              {copy.registerSource}
            </div>
            <div className="mt-3 grid gap-2">
              <FormField label={copy.canonicalTitle}>
                <input
                  type="text"
                  value={sourceForm.canonical_title}
                  onChange={(event) =>
                    updateSourceForm('canonical_title', event.target.value)
                  }
                  placeholder={copy.canonicalTitlePlaceholder}
                  className={fieldClassName}
                />
              </FormField>
              <FormField label={copy.issuer}>
                <input
                  type="text"
                  value={sourceForm.issuer}
                  onChange={(event) =>
                    updateSourceForm('issuer', event.target.value)
                  }
                  placeholder={copy.issuerPlaceholder}
                  className={fieldClassName}
                />
              </FormField>
              <div className="grid grid-cols-2 gap-2">
                <FormField label={copy.authorityTier}>
                  <select
                    value={sourceForm.authority_tier}
                    onChange={(event) =>
                      updateSourceForm('authority_tier', event.target.value)
                    }
                    className={fieldClassName}
                  >
                    <option value="NATIONAL_LAW">NATIONAL_LAW</option>
                    <option value="ADMIN_REGULATION">ADMIN_REGULATION</option>
                    <option value="DEPARTMENT_RULE">DEPARTMENT_RULE</option>
                    <option value="LOCAL_RULE">LOCAL_RULE</option>
                    <option value="POLICY">POLICY</option>
                  </select>
                </FormField>
                <FormField label={copy.jurisdiction}>
                  <input
                    type="text"
                    value={sourceForm.jurisdiction}
                    onChange={(event) =>
                      updateSourceForm('jurisdiction', event.target.value)
                    }
                    className={fieldClassName}
                  />
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <FormField label={copy.expectedStatus}>
                  <select
                    value={sourceForm.expected_status}
                    onChange={(event) =>
                      updateSourceForm('expected_status', event.target.value)
                    }
                    className={fieldClassName}
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="DRAFT">DRAFT</option>
                    <option value="CONSULTATION">CONSULTATION</option>
                    <option value="SUPERSEDED">SUPERSEDED</option>
                    <option value="REPEALED">REPEALED</option>
                  </select>
                </FormField>
                <FormField label={`${copy.documentNumber} (${copy.optional})`}>
                  <input
                    type="text"
                    value={sourceForm.document_number ?? ''}
                    onChange={(event) =>
                      updateSourceForm('document_number', event.target.value)
                    }
                    className={fieldClassName}
                  />
                </FormField>
              </div>
              <button
                type="button"
                disabled={
                  registerSourceMutation.isPending ||
                  !sourceForm.canonical_title.trim() ||
                  !sourceForm.issuer.trim() ||
                  !sourceForm.authority_tier.trim() ||
                  !sourceForm.jurisdiction.trim()
                }
                onClick={handleRegisterSource}
                className="inline-flex h-8 items-center justify-center rounded-md border border-border px-3 text-sm font-semibold text-foreground transition-colors hover:border-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {registerSourceMutation.isPending
                  ? copy.registering
                  : copy.saveSource}
              </button>
              {registrationMessage ? (
                <div className="rounded border border-border bg-muted px-2 py-1.5 text-xs text-muted-foreground">
                  {registrationMessage}
                </div>
              ) : null}
            </div>
          </div>
          <div className="max-h-[34vh] overflow-y-auto p-2 lg:max-h-none">
            {inventoryQuery.isError ? (
              <EmptyState label={copy.legalApiUnavailable} />
            ) : inventory?.sources.length ? (
              inventory.sources.map((source) => {
                const versions = sourceVersions(inventory, source.source_id)
                const current = latestVersion(versions)
                return (
                  <button
                    key={source.source_id}
                    type="button"
                    onClick={() => {
                      setSelectedSourceId(source.source_id)
                      setSelectedCandidateId(undefined)
                    }}
                    className={cn(
                      'mb-2 w-full rounded-md border p-3 text-left transition-colors',
                      selectedSourceId === source.source_id
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/60 hover:bg-muted',
                    )}
                  >
                    <div className="line-clamp-2 text-sm font-semibold">
                      {source.canonical_title || source.source_id}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                      <Badge>{source.authority_tier || copy.tierPending}</Badge>
                      <Badge>{current?.lifecycle_state || copy.unresolved}</Badge>
                      <Badge>{copy.versionCount(versions.length)}</Badge>
                    </div>
                  </button>
                )
              })
            ) : (
              <EmptyState label={copy.noGovernedSources} />
            )}
          </div>
        </aside>

        <section className="min-h-0 overflow-y-auto p-4 sm:p-6">
          <div className="mb-4 flex flex-wrap gap-2">
            {[
              ['source', copy.sourceView],
              ['compiled', copy.compiledOntologyView],
            ].map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setLegalViewMode(mode as LegalViewMode)}
                className={cn(
                  'inline-flex h-8 items-center rounded-md border px-3 text-sm font-semibold transition-colors',
                  legalViewMode === mode
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border text-muted-foreground hover:border-primary hover:bg-primary/10 hover:text-foreground',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
            <div className="rounded-md border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">
                    {bundle.source?.canonical_title || copy.noSourceSelected}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {bundle.source?.issuer || copy.issuerPending} /{' '}
                    {bundle.source?.jurisdiction || copy.jurisdictionPending}
                  </p>
                </div>
                <Badge>{bundle.version?.lifecycle_state || copy.unresolved}</Badge>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Fact
                  label={copy.authority}
                  value={bundle.source?.authority_tier}
                  fallback={copy.notRecorded}
                />
                <Fact
                  label={copy.version}
                  value={bundle.version?.version_identity}
                  fallback={copy.notRecorded}
                />
                <Fact
                  label={copy.effectivity}
                  value={bundle.version?.effective_from}
                  fallback={copy.notRecorded}
                />
                <Fact
                  label={copy.sourceHash}
                  value={shortRef(bundle.version?.source_hash, copy.notRecorded)}
                  fallback={copy.notRecorded}
                />
              </div>
            </div>

            <div className="rounded-md border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <HugeiconsIcon icon={Clock01Icon} size={15} strokeWidth={1.6} />
                {copy.pipelineState}
              </div>
              <div className="mt-3 space-y-2">
                {lifecycleStates.map((state) => (
                  <div
                    key={state}
                    className={cn(
                      'flex items-center justify-between rounded border px-2 py-1.5 text-xs',
                      bundle.version?.lifecycle_state === state
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'border-border text-muted-foreground',
                    )}
                  >
                    <span>{state}</span>
                    <span>
                      {bundle.version?.lifecycle_state === state
                        ? copy.current
                        : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {legalViewMode === 'source' ? (
            <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
              <InspectorPanel title={copy.rawArtifacts}>
                {bundle.artifacts.length ? (
                  bundle.artifacts.map((artifact) => (
                    <Row key={artifact.artifact_id}>
                      <div>
                        <div className="font-medium">
                          {artifact.artifact_kind || copy.artifact}
                        </div>
                        <div className="text-muted-foreground">
                          {artifact.mime_type || copy.mimePending} /{' '}
                          {shortRef(artifact.uri, copy.notRecorded)}
                        </div>
                      </div>
                      <code>{shortRef(artifact.content_hash, copy.notRecorded)}</code>
                    </Row>
                  ))
                ) : (
                  <EmptyState label={copy.noRawArtifact} />
                )}
              </InspectorPanel>

              <div className="rounded-md border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <HugeiconsIcon icon={Upload01Icon} size={15} strokeWidth={1.6} />
                  {copy.uploadSourceFile}
                </div>
                <div className="mt-3 grid gap-3">
                  <label className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border border-border px-3 text-sm font-semibold transition-colors hover:border-primary hover:bg-primary/10">
                    <HugeiconsIcon icon={Upload01Icon} size={15} strokeWidth={1.6} />
                    {queuedSourceFile?.name || copy.choosePdf}
                    <input
                      type="file"
                      accept=".pdf,.txt,.md,text/plain,application/pdf"
                      className="hidden"
                      disabled={uploadSourceMutation.isPending}
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null
                        event.target.value = ''
                        setSourceUploadMessage(null)
                        setQueuedSourceFile(file)
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    disabled={
                      uploadSourceMutation.isPending ||
                      !queuedSourceFile ||
                      !bundle.version?.version_id
                    }
                    onClick={() => uploadSourceMutation.mutate()}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border px-3 text-sm font-semibold transition-colors hover:border-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <HugeiconsIcon icon={Upload01Icon} size={15} strokeWidth={1.6} />
                    {uploadSourceMutation.isPending
                      ? copy.uploadingFile
                      : copy.uploadFile}
                  </button>
                  {sourceUploadMessage ? (
                    <div className="rounded border border-border bg-muted px-2 py-1.5 text-xs text-muted-foreground">
                      {sourceUploadMessage}
                    </div>
                  ) : !bundle.version?.version_id ? (
                    <div className="rounded border border-border bg-muted px-2 py-1.5 text-xs text-muted-foreground">
                      {copy.uploadRequiresVersion}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <InspectorPanel title={copy.articleAnchors}>
                  {bundle.sections.length ? (
                    bundle.sections.slice(0, 8).map((section) => (
                      <Row key={section.section_id}>
                        <div>
                          <div className="font-medium">
                            {section.stable_locator || section.section_id}
                          </div>
                          <div className="text-muted-foreground">
                            {section.title || section.ordinal || copy.headingPending}{' '}
                            / {parseSectionSpan(section, copy)}
                          </div>
                        </div>
                        <code>{shortRef(section.local_hash, copy.notRecorded)}</code>
                      </Row>
                    ))
                  ) : (
                    <EmptyState label={copy.noArticleAnchors} />
                  )}
                </InspectorPanel>

                <InspectorPanel title={copy.versionLineage}>
                  {bundle.versionEdges.length ? (
                    bundle.versionEdges.map((edge) => (
                      <Row key={edge.edge_id}>
                        <div>
                          <div className="font-medium">
                            {edge.edge_type || copy.lineage}
                          </div>
                          <div className="text-muted-foreground">
                            {shortRef(edge.from_version_id, copy.notRecorded)}{' '}
                            {copy.lineageTo}{' '}
                            {shortRef(edge.to_version_id, copy.notRecorded)}
                          </div>
                        </div>
                      </Row>
                    ))
                  ) : (
                    <EmptyState label={copy.noLineageEdge} />
                  )}
                </InspectorPanel>
              </div>

              <div className="mt-4 rounded-md border border-border bg-card">
                <div className="border-b border-border px-4 py-3 text-sm font-semibold">
                  {copy.extractedClaims}
                </div>
                <div className="divide-y divide-border">
                  {bundle.candidates.length ? (
                    bundle.candidates.map((candidate) => (
                      <button
                        key={candidate.candidate_id}
                        type="button"
                        onClick={() => setSelectedCandidateId(candidate.candidate_id)}
                        className={cn(
                          'grid w-full gap-2 px-4 py-3 text-left text-sm transition-colors md:grid-cols-[140px_minmax(0,1fr)_180px]',
                          selectedCandidate?.candidate_id ===
                            candidate.candidate_id
                            ? 'bg-primary/10'
                            : 'hover:bg-muted',
                        )}
                      >
                        <span className="font-semibold">
                          {candidate.candidate_type || copy.candidate}
                        </span>
                        <span className="truncate">
                          {candidate.candidate_text || candidate.candidate_id}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {parseSpan(candidate, copy)}
                        </span>
                      </button>
                    ))
                  ) : (
                    <EmptyState label={copy.noExtractedClaims} />
                  )}
                </div>
              </div>
            </>
          )}
        </section>

        <aside className="min-h-0 overflow-y-auto border-t border-border p-4 lg:border-l lg:border-t-0">
          <InspectorPanel title={copy.certifiedActivation}>
            <Fact
              label={copy.registrySnapshot}
              value={shortRef(
                String(
                  evidenceContractQuery.data?.active_pins
                    ?.source_registry_snapshot_id ?? '',
                ),
                copy.notRecorded,
              )}
              fallback={copy.notRecorded}
            />
            <Fact
              label="K_v"
              value={shortRef(
                String(
                  evidenceContractQuery.data?.active_pins
                    ?.knowledge_context_version_id ?? '',
                ),
                copy.notRecorded,
              )}
              fallback={copy.notRecorded}
            />
            <Fact
              label={copy.authorityBundle}
              value={shortRef(
                String(
                  evidenceContractQuery.data?.active_pins
                    ?.authority_bundle_version_id ?? '',
                ),
                copy.notRecorded,
              )}
              fallback={copy.notRecorded}
            />
            <Fact
              label={copy.activation}
              value={
                evidenceContractQuery.data?.active_pins?.activation_performed
                  ? 'activation_performed=true'
                  : copy.notActive
              }
              fallback={copy.notRecorded}
            />
          </InspectorPanel>

          <div className="mt-4 rounded-md border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <HugeiconsIcon icon={CheckListIcon} size={15} strokeWidth={1.6} />
              {copy.aiWorkflowActions}
            </div>
            <div className="mt-3 grid gap-2">
              {[
                ['build_review_package', copy.buildReviewPackage],
                ['curate_source', copy.curateSource],
                ['promote_candidate', copy.promoteCandidate],
                ['certify_source', copy.certifySource],
                ['activate_bundle', copy.activateBundle],
                ['refresh_check', copy.runRefreshCheck],
              ].map(([actionType, label]) => (
                <button
                  key={actionType}
                  type="button"
                  data-legal-action-type={actionType}
                  onClick={() => bindChatContext(actionType)}
                  className="rounded-md border border-border px-3 py-2 text-left text-sm font-medium transition-colors hover:border-primary hover:bg-primary/10"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-md border border-border bg-card p-4">
            <div className="text-sm font-semibold">{copy.dashboardMetrics}</div>
            <div className="mt-3 grid gap-2">
              {[
                'source_inventory_completion',
                'raw_artifact_coverage',
                'article_anchor_coverage',
                'claim_extraction_coverage',
                'open_change_candidates',
                'node_count',
                'edge_count',
              ].map((key) => (
                <Fact
                  key={key}
                  label={key}
                  value={metricValue(metrics[key], copy.notApplicable)}
                  fallback={copy.notRecorded}
                />
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-md border border-border bg-card p-4">
            <div className="text-sm font-semibold">{copy.acceptanceEvidence}</div>
            <div className="mt-3 space-y-2">
              {persistedExportsQuery.data?.length ? (
                persistedExportsQuery.data
                  .slice(0, 3)
                  .map((evidenceExport) => (
                    <PersistedExportRow
                      key={evidenceExport.acceptance_export_id}
                      evidenceExport={evidenceExport}
                      copy={copy}
                    />
                  ))
              ) : (
                <EmptyState label={copy.noSignedExport} />
              )}
            </div>
          </div>
        </aside>
      </main>
    </div>
  )
}

function Metric({
  label,
  value,
  fallback = 'n/a',
}: {
  label: string
  value?: number | null
  fallback?: string
}) {
  return (
    <div className="rounded border border-border bg-card px-2 py-1.5">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold">{metricValue(value, fallback)}</div>
    </div>
  )
}

function Fact({
  label,
  value,
  fallback = 'not recorded',
}: {
  label: string
  value?: string | null
  fallback?: string
}) {
  return (
    <div className="min-w-0 rounded border border-border px-2 py-1.5">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="truncate text-sm font-semibold">{value || fallback}</div>
    </div>
  )
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded border border-border bg-muted px-1.5 py-0.5 text-[11px] font-medium">
      {children}
    </span>
  )
}

function FormField({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="grid gap-1 text-xs font-medium text-muted-foreground">
      <span>{label}</span>
      {children}
    </label>
  )
}

function InspectorPanel({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="rounded-md border border-border bg-card">
      <div className="border-b border-border px-4 py-3 text-sm font-semibold">
        {title}
      </div>
      <div className="space-y-2 p-3">{children}</div>
    </section>
  )
}

function Row({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-3 rounded border border-border px-3 py-2 text-xs">
      {children}
    </div>
  )
}

function PersistedExportRow({
  evidenceExport,
  copy,
}: {
  evidenceExport: LegalAcceptanceEvidenceExportRef
  copy: LegalCopy
}) {
  return (
    <div className="rounded border border-border px-3 py-2 text-xs">
      <div className="font-semibold">
        {evidenceExport.test_run_id || evidenceExport.acceptance_export_id}
      </div>
      <div className="mt-1 text-muted-foreground">
        {copy.exportLabel}{' '}
        {shortRef(evidenceExport.acceptance_export_id, copy.notRecorded)}
      </div>
      <div className="mt-1 text-muted-foreground">
        {copy.recordLabel} {shortRef(evidenceExport.record_hash, copy.notRecorded)}
      </div>
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
      {label}
    </div>
  )
}
