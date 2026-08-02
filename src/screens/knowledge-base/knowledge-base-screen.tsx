import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  CheckListIcon,
  Clock01Icon,
  Database01Icon,
  Search01Icon,
  Add01Icon,
  Tick02Icon,
  Upload01Icon,
} from '@hugeicons/core-free-icons'
import { Switch } from '@/components/ui/switch'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import {
  fetchLegalAcceptanceEvidence,
  fetchLegalAcceptanceEvidenceExports,
  fetchLegalCandidateImpact,
  fetchLegalChangeCandidates,
  fetchLegalCorpusDashboard,
  fetchLegalCorpusInventory,
  fetchLegalEvidenceContract,
  fetchLegalScanRuns,
  fetchLegalSourceStatus,
  registerLegalSource,
  uploadLegalSourceArtifact,
  type LegalAcceptanceEvidenceExportRef,
  type LegalCorpusInventory,
  type LegalCandidateImpact,
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
    lifecycleStates: {
      DRAFT: 'Draft',
      CONSULTATION: 'Consultation',
      REGISTERED: 'Registered',
      CHANGE_DETECTED: 'Change detected',
      CERTIFIED: 'Certified',
      ACTIVE: 'Active',
      SUPERSEDED: 'Superseded',
      REPEALED: 'Repealed',
      UNRESOLVED: 'Unresolved',
    },
    current: 'current',
    rawArtifacts: 'Raw artifacts',
    artifact: 'artifact',
    mimePending: 'mime pending',
    noRawArtifact: 'No raw artifact recorded',
    runtimeMonitor: 'Runtime monitor',
    sourceHealth: 'Source health',
    knowledgeReview: 'Knowledge review',
    runtimePosture: 'Runtime posture',
    latestComparison: 'Latest comparison',
    lastCheck: 'Last check',
    nextDueCheck: 'Next due',
    reviewRequired: 'Review required',
    changedAnchors: 'Changed anchors',
    activeVersions: 'Active versions',
    pendingVersions: 'Pending versions',
    scanHistory: 'Scan history',
    noScanRuns: 'No scan runs recorded',
    changeCandidates: 'Change candidates',
    noChangeCandidates: 'No open change candidates',
    impactReport: 'Impact report',
    impactPosture: 'Impact posture',
    dependencies: 'Dependencies',
    authorityEdges: 'Authority edges',
    safeMonitorActions: 'Monitor actions',
    sourceStatusAction: 'Inspect source status',
    scanHistoryAction: 'Review scan history',
    candidateImpactAction: 'Inspect candidate impact',
    acknowledgementAction: 'Prepare acknowledgement',
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
    lifecycleStates: {
      DRAFT: '草稿',
      CONSULTATION: '征求意见',
      REGISTERED: '已登记',
      CHANGE_DETECTED: '发现变更',
      CERTIFIED: '已认证',
      ACTIVE: '生效',
      SUPERSEDED: '已替代',
      REPEALED: '已废止',
      UNRESOLVED: '未解析',
    },
    current: '当前',
    rawArtifacts: '原始制品',
    artifact: '制品',
    mimePending: 'MIME 待定',
    noRawArtifact: '暂无原始制品记录',
    runtimeMonitor: '运行时监控',
    sourceHealth: '来源健康',
    knowledgeReview: '知识评审',
    runtimePosture: '运行时姿态',
    latestComparison: '最新比对',
    lastCheck: '上次检查',
    nextDueCheck: '下次到期',
    reviewRequired: '需要评审',
    changedAnchors: '变更锚点',
    activeVersions: '生效版本',
    pendingVersions: '待处理版本',
    scanHistory: '扫描历史',
    noScanRuns: '暂无扫描运行记录',
    changeCandidates: '变更候选项',
    noChangeCandidates: '暂无待处理变更候选项',
    impactReport: '影响报告',
    impactPosture: '影响姿态',
    dependencies: '依赖项',
    authorityEdges: '权威边',
    safeMonitorActions: '监控操作',
    sourceStatusAction: '查看来源状态',
    scanHistoryAction: '查看扫描历史',
    candidateImpactAction: '查看候选影响',
    acknowledgementAction: '准备确认',
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

type LegalCopy = (typeof LEGAL_COPY)[keyof typeof LEGAL_COPY]

const DATASET_COPY = {
  en: {
    title: 'Database',
    subtitle: 'Governed dataset context and effective query authority',
    loading: 'Loading dataset governance...',
    empty: 'No governed dataset activation is available for this workspace.',
    source: 'Source',
    authority: 'Governed authority',
    aiContext: 'Use in AI context',
    analysis: 'Use for analysis',
    evidence: 'Context evidence',
    lifecycle: 'Lifecycle',
    role: 'Role',
    type: 'Type',
    version: 'Version',
    actor: 'Last actor',
    locked: 'Locked',
    optional: 'Optional',
    retrieval: 'Retrieval',
    prompt: 'Prompt',
    query: 'Query',
    details: 'Audit details',
    policyVersion: 'Resolver policy',
    activationHash: 'Activation set hash',
    sourceHash: 'Source hash',
    assets: 'Assets',
    metadataReadiness: 'Metadata readiness',
    runtimeAuthority: 'Runtime authority',
    lineage: 'Lineage',
    sourceAnchors: 'Source anchors',
    evidenceDrawer: 'Evidence / Audit Drawer',
    redaction: 'Redaction',
    notRecorded: 'not recorded',
    metadataOnlyNotice:
      'Metadata readiness is evidence only. Runtime authority is granted only by governed activation and resolver inclusion.',
    unavailable: 'Dataset governance API unavailable',
  },
  zh: {
    title: '数据库',
    subtitle: '受治理的数据集上下文与有效查询权威',
    loading: '正在加载数据集治理...',
    empty: '当前工作区没有可用的治理数据集激活记录。',
    source: '来源',
    authority: '治理权威',
    aiContext: '用于 AI 背景信息',
    analysis: '用于分析',
    evidence: '背景信息证据',
    lifecycle: '生命周期',
    role: '角色',
    type: '类型',
    version: '版本',
    actor: '最近操作者',
    locked: '锁定',
    optional: '可选',
    retrieval: '检索',
    prompt: '提示词',
    query: '查询',
    details: '审计详情',
    policyVersion: '解析策略',
    activationHash: '激活集哈希',
    sourceHash: '来源哈希',
    assets: '资产',
    metadataReadiness: '元数据就绪',
    runtimeAuthority: '运行时权威',
    lineage: '沿革',
    sourceAnchors: '来源锚点',
    evidenceDrawer: '证据 / 审计抽屉',
    redaction: '脱敏',
    notRecorded: '未记录',
    metadataOnlyNotice:
      '元数据就绪只是证据。运行时权威只能来自治理激活和解析器纳入。',
    unavailable: '数据集治理 API 不可用',
  },
} as const

type DatasetCopy = (typeof DATASET_COPY)[keyof typeof DATASET_COPY]

const EFFECTIVE_CONTEXT_COPY = {
  en: {
    title: 'Effective Context',
    subtitle:
      'Unified observability for the knowledge, memory, and database sources resolved into this workspace.',
    loading: 'Loading effective context...',
    unavailable: 'Effective context API unavailable',
    noGraph: 'No effective context graph is available.',
    graphLegend:
      'Effective, optional, excluded, and execution-gate sources across Knowledge Base, Memory, and Database',
    activationHash: 'Activation set hash',
    nativeMetadataParity: 'Native metadata parity / resolver snapshot',
  },
  zh: {
    title: '有效背景信息',
    subtitle: '统一查看当前工作区解析进来的知识库、记忆和数据库来源。',
    loading: '正在加载有效背景信息...',
    unavailable: '有效背景信息 API 不可用',
    noGraph: '暂无有效背景信息图。',
    graphLegend: '跨知识库、记忆和数据库的生效、可选、排除和执行门控来源',
    activationHash: '激活集哈希',
    nativeMetadataParity: '原生元数据一致性 / 解析器快照',
  },
} as const

type DatasetGovernanceRow = {
  activationId: string
  sourceKind: string
  semanticTier: string
  lifecycleStatus: string
  effectiveAuthorityStatus: string
  userContextControlLevel: string
  retrievalToggleVisible: boolean
  promptContextToggleVisible: boolean
  queryContextToggleVisible: boolean
  retrievalEnabled: boolean
  promptContextEnabled: boolean
  queryContextEnabled: boolean
  datasetUsageRole: string
  datasetType: string | null
  datasetKey: string | null
  datasetVersionId: string | null
  sourceVersionId: string
  lastActivationActor: string
  auditHash: string
  locked: boolean
}

type DatasetGovernancePayload = {
  activationResolverPolicyVersion: string
  resolvedActivationSetHash: string
  rows: Array<DatasetGovernanceRow>
}

type NativeMetadataSummaryPayload = {
  resolverSnapshotHash: string
  assetRows: Array<{
    assetId: string
    assetKind: string
    displayName: string
    owner: string
    domain: string
    version: string
    lifecycleState: string
    qualityState: string
    contractState: string
    lineageState: string
    sourceAnchors: Array<string>
    sourceHash: string
    semanticTier: string | null
    authorityRole: string
    governanceDecision: string
    activationState: string
    userControlCeiling: string
    resolverStatus: string
    snapshotHash: string
    replayAuditRefs: Array<string>
    metadataReadinessState: string
    runtimeAuthorityState: string
    locked: boolean
  }>
  lineageEdges: Array<{
    source: string
    target: string
    relationType: string
    sourceAnchorRefs: Array<string>
  }>
  sourceAnchors: Array<{
    anchorId: string
    assetId: string
    locator: string
    sourceHash: string
  }>
  evidenceDrawer: {
    redaction: string
    rows: Array<{
      assetId: string
      evidenceKind: string
      sourceHash: string
      snapshotHash: string
      replayAuditRefs: Array<string>
    }>
  }
}

type DatasetPreferenceDimension =
  | 'retrievalEnabled'
  | 'promptContextEnabled'
  | 'queryContextEnabled'

type EffectiveContextGraphPayload = {
  effectiveContext?: {
    nodes: Array<{
      id: string
      label: string
      nodeType: string
      metadata: Record<string, string | boolean | null>
    }>
    edges: Array<{
      source: string
      target: string
      edgeType: string
    }>
    activationResolverPolicyVersion: string | null
    resolvedActivationSetHash: string | null
    evidenceRef: string
  }
  nativeMetadata?: NativeMetadataSummaryPayload
}

type PolicyRuleCandidate = {
  ruleCandidateId: string
  ruleFamily: string
  candidateState: string
  sourceAnchorRefs: Array<string>
  applicabilityScope: Record<string, unknown>
  extractedRationale: string
  draftRuleText: string
  severity?: string | null
  confidence?: number | null
  uncertaintyNotes?: string | null
  humanEdits: Array<Record<string, unknown>>
  approvalEvidence: Record<string, unknown>
  testEvidence: Record<string, unknown>
  activationRefs: Array<string>
  createdByActorType: string
  isRuntimeAuthority: boolean
  nonAuthorityReason?: string | null
}

const POLICY_RULE_COPY = {
  en: {
    title: 'Policy-to-Rule Studio',
    subtitle:
      'Source-linked rule candidates for review, approval, activation, and audit.',
    loading: 'Loading rule candidates...',
    unavailable: 'Policy-to-rule API unavailable',
    empty: 'No rule candidates yet.',
    candidate: 'Candidate',
    state: 'State',
    evidence: 'Evidence',
    review: 'Review',
    aiText: 'AI-generated draft',
    humanEdits: 'Human edits',
    sourceAnchors: 'Source anchors',
    applicability: 'Applicability',
    confidence: 'Confidence',
    uncertainty: 'Uncertainty',
    nonAuthority: 'Not runtime authority',
    runtimeAuthority: 'Runtime authority after governed activation',
    approvalEvidence: 'Approval evidence',
    testEvidence: 'Test evidence',
  },
  zh: {
    title: '政策转规则工作台',
    subtitle: '带来源锚点的规则候选项，用于评审、批准、激活和审计。',
    loading: '正在加载规则候选项...',
    unavailable: '政策转规则 API 不可用',
    empty: '暂无规则候选项。',
    candidate: '候选项',
    state: '状态',
    evidence: '证据',
    review: '评审',
    aiText: 'AI 生成草稿',
    humanEdits: '人工编辑',
    sourceAnchors: '来源锚点',
    applicability: '适用范围',
    confidence: '置信度',
    uncertainty: '不确定性',
    nonAuthority: '不是运行时权威',
    runtimeAuthority: '治理激活后的运行时权威',
    approvalEvidence: '批准证据',
    testEvidence: '测试证据',
  },
} as const

type PolicyRuleCopy = (typeof POLICY_RULE_COPY)[keyof typeof POLICY_RULE_COPY]

type TenderDetectionFinding = {
  finding_id: string
  issue_type: string
  matched_text: string
  judgment_basis: string
  severity: string
  confidence: number
  suggested_replacement?: string | null
  escalation_flag: boolean
}

type TenderDetectionRun = {
  run_id: string
  tender_document_id: string
  source_document_hash: string
  parent_run_id?: string | null
  root_run_id?: string | null
  findings: Array<TenderDetectionFinding>
  dispositions: Array<Record<string, unknown>>
}

type RuntimeFeedbackPayload = {
  feedbackEvent?: { feedback_event_id?: string }
  candidateDelta?: {
    candidate_delta_id?: string
    delta_kind?: string
    governance_state?: string
    discovery_run_id?: string
  }
  discoveryRun?: { discovery_run_id?: string }
}

const TENDER_REVIEW_COPY = {
  en: {
    title: 'Tender Review',
    subtitle:
      'Runtime screening against activated governed rules with report and replay evidence.',
    documentText: 'Tender document text',
    placeholder: 'Paste tender clauses for pre-release screening...',
    runReview: 'Run governed review',
    running: 'Running review...',
    findings: 'Findings',
    noFindings: 'No activated governed rule findings.',
    aiSuggestion: 'AI-assisted recommendation',
    persistReport: 'Persist final report',
    reportPersisted: 'Final report persisted with replay binding',
    accept: 'Accept',
    reject: 'Reject',
    edit: 'Record edit',
    falsePositive: 'False positive',
    falseNegative: 'False negative',
    ambiguous: 'Ambiguous',
    escalate: 'Escalate to reviewer',
    feedbackSent: 'Feedback sent to Knowledge Builder',
    unavailable: 'Tender review API unavailable',
  },
  zh: {
    title: '招标文件审查',
    subtitle: '基于已激活治理规则进行运行时筛查，并保留报告与回放证据。',
    documentText: '招标文件文本',
    placeholder: '粘贴招标条款进行发布前筛查...',
    runReview: '运行治理审查',
    running: '审查中...',
    findings: '发现项',
    noFindings: '没有命中已激活治理规则。',
    aiSuggestion: 'AI 辅助建议',
    persistReport: '持久化最终报告',
    reportPersisted: '最终报告已持久化并绑定回放证据',
    accept: '接受',
    reject: '拒绝',
    edit: '记录编辑',
    falsePositive: '误报',
    falseNegative: '漏报',
    ambiguous: '歧义',
    escalate: '升级评审',
    feedbackSent: '反馈已发送到知识构建',
    unavailable: '招标审查 API 不可用',
  },
} as const

type TenderReviewCopy =
  (typeof TENDER_REVIEW_COPY)[keyof typeof TENDER_REVIEW_COPY]

type KnowledgeBuilderDiscoveryRun = {
  discovery_run_id: string
  source_id: string
  run_status: string
  governance_state: string
  content_hash?: string
}

type KnowledgeBuilderCandidateNode = {
  node_id: string
  label: string
  node_type: string
  evidence_summary: string
  governance_state: string
}

type KnowledgeBuilderCandidateRelation = {
  relation_id: string
  relation_type: string
  from_node_id: string
  to_node_id: string
  evidence_summary?: string
  source_anchor_refs?: Array<string>
  governance_state: string
}

type KnowledgeBuilderCandidateCluster = {
  cluster_id: string
  cluster_label: string
  governance_state: string
}

type KnowledgeBuilderEvaluationDataset = {
  evaluation_dataset_id: string
  examples: Array<{
    evaluation_example_id: string
    case_type: string
    input_text: string
    expected_outcome: string
  }>
}

type KnowledgeBuilderEvaluationRun = {
  evaluation_run_id: string
  metrics: Record<string, number>
  authority_notice: string
  results: Array<{
    evaluation_result_id: string
    expected_outcome: string
    actual_outcome: string
    ai_assisted_rating: string
    human_rating?: string | null
    explanation_acceptance: string
    error_labels: Array<string>
  }>
}

type KnowledgeBuilderFeedbackDelta = {
  candidate_delta_id: string
  feedback_event_id: string
  discovery_run_id: string
  delta_kind: string
  feedback_type?: string
  governance_state: string
  evaluation_routing?: Record<string, unknown>
}

type KnowledgeBuilderAuthorityVersion = {
  authority_version_id: string
  authority_state: string
  canonical_label: string
  evaluation_run_id: string
  approved_by: string
  activated_by: string
}

type KnowledgeBuilderReadModelRebuild = {
  rebuild_id: string
  rebuild_status: string
  non_authoritative_notice: string
}

type KnowledgeBuilderSourceUpload = {
  ok: boolean
  kind?: string
  originalName?: string
  storedName?: string
  stagedUploadRef?: string
  retryUploadRef?: string
  requiresIngest?: boolean
  ingestKind?: string
  canonicalArtifactKind?: string
  targetWikiPath?: string
  message?: string
}

type KnowledgeBuilderCompiledCandidate = {
  rule_candidate_id?: string
  candidate_state?: string
  draft_rule_text?: string
  severity?: string
  source_anchor_refs?: Array<string>
  applicability_scope?: {
    match_terms?: Array<string>
    normalized_term?: string
    term_category?: string | null
    compiler_profile_version?: string
    knowledge_source_compilation_run_id?: string
    canonical_anchor_ref?: string
  }
}

type KnowledgeBuilderDiscoveryResult = {
  discoveryRun: KnowledgeBuilderDiscoveryRun
  ingest?: {
    originalName?: string
    normalizedDocumentArtifactRef?: string
    sourceHash?: string
    parserMethod?: string
    storedMarkdownPath?: string
  }
  importResult?: {
    status: string
    knowledge_source?: Record<string, unknown>
    compilation_run?: {
      knowledge_source_compilation_run_id?: string
      compiler_profile_version?: string
      mapped_source_anchor_refs?: Array<string>
      source_hash?: string
    }
    candidates?: Array<KnowledgeBuilderCompiledCandidate>
    knowledge_builder_evidence?: Array<Record<string, unknown>>
    compiler_profile_version?: string
  }
}

const KNOWLEDGE_BUILDER_COPY = {
  en: {
    title: 'Knowledge Builder Studio',
    subtitle:
      'Discover non-authoritative candidate graphs from tender evidence before curation and promotion.',
    sourceRef: 'Source reference',
    sourceRefPlaceholder: 'uat-tender-sample',
    governedDocumentUpload: 'Governed document upload',
    chooseGovernedDocument: 'Choose DOCX',
    uploadGovernedDocument: 'Upload governed document',
    uploadingGovernedDocument: 'Uploading governed document...',
    uploadGovernedDocumentHelp:
      'Upload a DOCX through the workspace upload boundary and use the returned governed upload ref as Source reference.',
    sourceKind: 'Source kind',
    semanticPurpose: 'Semantic purpose',
    compilerProfile: 'Compiler profile',
    governedUploadRef: 'Governed upload ref',
    governedSourceRef: 'Governed source ref',
    knowledgeSourceContentHash: 'Knowledge source content hash',
    uploadAndRegisterSource: 'Upload and register source',
    uploadReadyForSourceReference:
      'Source reference set from governed upload ref',
    runDiscovery: 'Run discovery',
    running: 'Discovering...',
    graphPreview: 'Candidate graph preview',
    uploadedDocumentPreview: 'Uploaded document preview',
    lexiconPreview: 'Sensitive lexicon compilation preview',
    viewLexicon: 'Lexicon',
    viewGraph: 'Graph',
    parsedRows: 'Parsed rows',
    candidateTerms: 'Candidate terms',
    compilationRun: 'Compilation run',
    normalizedArtifact: 'Normalized artifact',
    term: 'Term',
    category: 'Category',
    example: 'Example',
    state: 'State',
    nodes: 'Nodes',
    relations: 'Relations',
    notes: 'Notes',
    clusters: 'Clusters',
    evidence: 'Evidence',
    explanation: 'Explanation',
    relationReview: 'Relation review',
    relationType: 'Curated relation type',
    acceptRelation: 'Accept relation',
    rejectRelation: 'Reject relation',
    changeRelation: 'Change relation',
    falseFriend: 'Mark false friend',
    splitCluster: 'Split cluster',
    mergeCluster: 'Merge cluster',
    canonicalTerm: 'Canonical term candidate',
    canonicalLabel: 'Canonical label',
    definition: 'Definition',
    aliases: 'Aliases',
    promoteTerm: 'Propose canonical term',
    curationSaved: 'Curation event saved',
    evaluationLab: 'Evaluation lab',
    addEvaluationExamples: 'Add UAT examples',
    runEvaluation: 'Run evaluation',
    activationGate: 'Activation-gate summary',
    expectedActual: 'Expected vs actual',
    ratePass: 'Rate pass',
    rateFail: 'Rate fail',
    rateReview: 'Needs review',
    evaluationSaved: 'Evaluation rating saved',
    governanceQueue: 'Governance queue',
    promoteRuntimeAuthority: 'Approve and activate',
    rebuildReadModel: 'Rebuild read models',
    activationStatus: 'Activation status',
    readModelStatus: 'Read-model rebuild',
    lineage: 'Lineage',
    feedbackDeltas: 'Feedback-derived deltas',
    runtimeFeedbackMetrics: 'Runtime feedback metrics',
    feedbackCaptureRate: 'Capture rate',
    typeOneError: 'Type I error',
    typeTwoError: 'Type II error',
    totalFeedback: 'Total feedback',
    queuedForEvaluation: 'Queued for evaluation',
    importedLexiconCandidates: 'Imported lexicon candidates',
    importedLexiconEmpty: 'No imported DOCX lexicon candidates yet.',
    sourceAnchors: 'Source anchors',
    loadFeedbackDeltas: 'Load feedback deltas',
    noFeedbackDeltas: 'No runtime feedback deltas queued.',
    nonAuthority: 'Non-authoritative until governed promotion and activation',
    empty: 'Run discovery to preview candidate graph evidence.',
    unavailable: 'Knowledge Builder API unavailable',
  },
  zh: {
    title: '知识构建工作台',
    subtitle: '从招标证据中发现非权威候选图谱，供后续整理、评估和治理提升。',
    sourceRef: '来源引用',
    sourceRefPlaceholder: 'uat-tender-sample',
    governedDocumentUpload: '治理文档上传',
    chooseGovernedDocument: '选择 DOCX',
    uploadGovernedDocument: '上传治理文档',
    uploadingGovernedDocument: '正在上传治理文档...',
    uploadGovernedDocumentHelp:
      '通过工作区上传边界上传 DOCX，并将返回的治理上传引用作为来源引用。',
    sourceKind: '来源类型',
    semanticPurpose: '语义目的',
    compilerProfile: '编译器配置',
    governedUploadRef: '治理上传引用',
    governedSourceRef: '治理来源引用',
    knowledgeSourceContentHash: '知识来源内容哈希',
    uploadAndRegisterSource: '上传并注册来源',
    uploadReadyForSourceReference: '已从治理上传引用设置来源引用',
    runDiscovery: '运行发现',
    running: '发现中...',
    graphPreview: '候选图谱预览',
    uploadedDocumentPreview: '上传文档预览',
    lexiconPreview: '敏感词库编译预览',
    viewLexicon: '敏感词库',
    viewGraph: '图谱',
    parsedRows: '解析行数',
    candidateTerms: '候选词条',
    compilationRun: '编译运行',
    normalizedArtifact: '规范化文档',
    term: '词条',
    category: '分类',
    example: '示例',
    state: '状态',
    nodes: '节点',
    relations: '关系',
    notes: '笔记',
    clusters: '聚类',
    evidence: '证据',
    explanation: '解释',
    relationReview: '关系评审',
    relationType: '治理关系类型',
    acceptRelation: '接受关系',
    rejectRelation: '拒绝关系',
    changeRelation: '变更关系',
    falseFriend: '标记伪同义',
    splitCluster: '拆分聚类',
    mergeCluster: '合并聚类',
    canonicalTerm: '规范术语候选',
    canonicalLabel: '规范标签',
    definition: '定义',
    aliases: '别名',
    promoteTerm: '提出规范术语',
    curationSaved: '治理事件已保存',
    evaluationLab: '评估实验室',
    addEvaluationExamples: '添加 UAT 示例',
    runEvaluation: '运行评估',
    activationGate: '激活门控摘要',
    expectedActual: '预期与实际',
    ratePass: '标记通过',
    rateFail: '标记失败',
    rateReview: '需要复核',
    evaluationSaved: '评估评分已保存',
    governanceQueue: '治理队列',
    promoteRuntimeAuthority: '批准并激活',
    rebuildReadModel: '重建读取模型',
    activationStatus: '激活状态',
    readModelStatus: '读取模型重建',
    lineage: '沿革',
    feedbackDeltas: '反馈生成的候选增量',
    runtimeFeedbackMetrics: '运行时反馈指标',
    feedbackCaptureRate: '捕获率',
    typeOneError: '一类错误',
    typeTwoError: '二类错误',
    totalFeedback: '反馈总数',
    queuedForEvaluation: '待评估',
    importedLexiconCandidates: '已导入词表候选项',
    importedLexiconEmpty: '暂无已导入 DOCX 词表候选项。',
    sourceAnchors: '来源锚点',
    loadFeedbackDeltas: '加载反馈增量',
    noFeedbackDeltas: '暂无运行时反馈增量。',
    nonAuthority: '治理提升并激活前不是运行时权威',
    empty: '运行发现后预览候选图谱证据。',
    unavailable: '知识构建 API 不可用',
  },
} as const

export const KNOWLEDGE_BUILDER_UAT_LABELS = {
  en: {
    title: KNOWLEDGE_BUILDER_COPY.en.title,
    sourceRef: KNOWLEDGE_BUILDER_COPY.en.sourceRef,
    governedDocumentUpload: KNOWLEDGE_BUILDER_COPY.en.governedDocumentUpload,
    chooseGovernedDocument: KNOWLEDGE_BUILDER_COPY.en.chooseGovernedDocument,
    uploadGovernedDocument: KNOWLEDGE_BUILDER_COPY.en.uploadGovernedDocument,
    sourceKind: KNOWLEDGE_BUILDER_COPY.en.sourceKind,
    semanticPurpose: KNOWLEDGE_BUILDER_COPY.en.semanticPurpose,
    compilerProfile: KNOWLEDGE_BUILDER_COPY.en.compilerProfile,
    governedUploadRef: KNOWLEDGE_BUILDER_COPY.en.governedUploadRef,
    runDiscovery: KNOWLEDGE_BUILDER_COPY.en.runDiscovery,
    addEvaluationExamples: KNOWLEDGE_BUILDER_COPY.en.addEvaluationExamples,
    runEvaluation: KNOWLEDGE_BUILDER_COPY.en.runEvaluation,
    loadFeedbackDeltas: KNOWLEDGE_BUILDER_COPY.en.loadFeedbackDeltas,
    runtimeFeedbackMetrics: KNOWLEDGE_BUILDER_COPY.en.runtimeFeedbackMetrics,
    promoteRuntimeAuthority: KNOWLEDGE_BUILDER_COPY.en.promoteRuntimeAuthority,
    rebuildReadModel: KNOWLEDGE_BUILDER_COPY.en.rebuildReadModel,
  },
} as const

export const TENDER_REVIEW_UAT_LABELS = {
  en: {
    title: TENDER_REVIEW_COPY.en.title,
    documentText: TENDER_REVIEW_COPY.en.documentText,
    runReview: TENDER_REVIEW_COPY.en.runReview,
    falsePositive: TENDER_REVIEW_COPY.en.falsePositive,
    falseNegative: TENDER_REVIEW_COPY.en.falseNegative,
    persistReport: TENDER_REVIEW_COPY.en.persistReport,
  },
} as const

export const POLICY_RULE_UAT_LABELS = {
  en: {
    title: POLICY_RULE_COPY.en.title,
  },
} as const

type KnowledgeBuilderCopy =
  (typeof KNOWLEDGE_BUILDER_COPY)[keyof typeof KNOWLEDGE_BUILDER_COPY]

async function fetchDatasetGovernance(): Promise<DatasetGovernancePayload> {
  const response = await fetch('/api/knowledge/config')
  if (!response.ok) {
    throw new Error(`knowledge-config-${response.status}`)
  }
  const payload = (await response.json()) as {
    datasetGovernance?: DatasetGovernancePayload
  }
  return (
    payload.datasetGovernance ?? {
      activationResolverPolicyVersion: 'knowledge_activation_resolver.v1',
      resolvedActivationSetHash: '',
      rows: [],
    }
  )
}

async function fetchNativeMetadataSummary(): Promise<NativeMetadataSummaryPayload> {
  const response = await fetch('/api/knowledge/config')
  if (!response.ok) {
    throw new Error(`knowledge-config-${response.status}`)
  }
  const payload = (await response.json()) as {
    nativeMetadata?: NativeMetadataSummaryPayload
  }
  return (
    payload.nativeMetadata ?? {
      resolverSnapshotHash: 'governed_activation_snapshot_unavailable',
      assetRows: [],
      lineageEdges: [],
      sourceAnchors: [],
      evidenceDrawer: { redaction: 'redacted', rows: [] },
    }
  )
}

async function updateDatasetPreference(input: {
  activationId: string
  dimension: DatasetPreferenceDimension
  enabled: boolean
}) {
  const response = await fetch('/api/knowledge/config', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      activationId: input.activationId,
      preferenceScope: 'principal',
      [input.dimension]: input.enabled,
    }),
  })
  if (!response.ok) {
    throw new Error(`knowledge-preference-${response.status}`)
  }
  return response.json()
}

async function fetchEffectiveContextGraph() {
  const response = await fetch('/api/knowledge/graph')
  if (!response.ok) {
    throw new Error(`knowledge-graph-${response.status}`)
  }
  const payload = (await response.json()) as EffectiveContextGraphPayload
  return payload
}

async function fetchPolicyRuleCandidates(): Promise<
  Array<PolicyRuleCandidate>
> {
  const response = await fetch('/api/knowledge/policy-rules')
  if (!response.ok) {
    throw new Error(`policy-rules-${response.status}`)
  }
  const payload = (await response.json()) as {
    candidates?: Array<PolicyRuleCandidate>
  }
  return payload.candidates ?? []
}

async function uploadKnowledgeBuilderSourceDocument(
  file: File,
): Promise<KnowledgeBuilderSourceUpload> {
  const form = new FormData()
  form.append('files', file)
  form.append('path', 'uploads')
  form.append('ingestMode', 'extract')
  form.append('session_id', 'knowledge-builder')
  const response = await fetch('/api/knowledge/upload', {
    method: 'POST',
    body: form,
  })
  if (!response.ok) {
    throw new Error(`knowledge-source-upload-${response.status}`)
  }
  const payload = (await response.json()) as KnowledgeBuilderSourceUpload[]
  const result = payload.at(0)
  if (!result) {
    throw new Error('knowledge-source-upload-empty')
  }
  if (!result.ok) {
    throw new Error(result.message || 'knowledge-source-upload-failed')
  }
  return result
}

async function readApiError(
  response: Response,
  fallback: string,
): Promise<Error> {
  const payload = (await response.json().catch(() => ({}))) as {
    detail?: unknown
    error?: unknown
    message?: unknown
  }
  return new Error(
    String(payload.detail || payload.error || payload.message || fallback),
  )
}

async function createTenderDetectionRun(
  documentText: string,
): Promise<TenderDetectionRun> {
  const response = await fetch('/api/tender-document-review', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      documentText,
      requestedRuleFamilies: ['tender_compliance'],
    }),
  })
  if (!response.ok) {
    throw new Error(`tender-review-${response.status}`)
  }
  const payload = (await response.json()) as { run?: TenderDetectionRun }
  if (!payload.run) throw new Error('tender-review-empty-run')
  return payload.run
}

async function recordTenderDisposition(input: {
  runId: string
  findingId: string
  disposition: 'accepted' | 'rejected' | 'edited'
  editedReplacement?: string
}) {
  const response = await fetch('/api/tender-document-review', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      action: 'disposition',
      runId: input.runId,
      findingId: input.findingId,
      disposition: input.disposition,
      editedReplacement: input.editedReplacement,
    }),
  })
  if (!response.ok) throw new Error(`tender-disposition-${response.status}`)
  return response.json()
}

async function recordTenderFeedback(input: {
  runId: string
  findingId: string
  feedbackType:
    | 'false_positive'
    | 'false_negative'
    | 'ambiguity'
    | 'weak_explanation'
  userDisposition: Record<string, unknown>
  escalationOutcome?: 'not_escalated' | 'escalated'
  reviewerNotes?: string
  editedRemediation?: string
}): Promise<{ feedback?: RuntimeFeedbackPayload }> {
  const response = await fetch('/api/tender-document-review', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      action: 'feedback',
      ...input,
    }),
  })
  if (!response.ok) throw new Error(`tender-feedback-${response.status}`)
  return response.json()
}

async function createTenderReport(runId: string) {
  const response = await fetch('/api/tender-document-review', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      action: 'report',
      runId,
    }),
  })
  if (!response.ok) throw new Error(`tender-report-${response.status}`)
  return response.json()
}

async function createKnowledgeBuilderRun(input: {
  sourceRef: string
  uploadRef: string
}): Promise<KnowledgeBuilderDiscoveryResult> {
  const sourceRef = input.sourceRef.trim() || 'uat-tender-sample'
  const uploadRef = input.uploadRef.trim()
  if (!uploadRef) {
    const response = await fetch('/api/knowledge/builder', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sourceKind: 'file',
        sourceRef,
        sourceMetadata: {
          semantic_purpose: 'knowledge_builder_discovery',
        },
      }),
    })
    if (!response.ok)
      throw await readApiError(response, `knowledge-builder-${response.status}`)
    const payload = (await response.json()) as {
      run?: KnowledgeBuilderDiscoveryRun
    }
    if (!payload.run) throw new Error('knowledge-builder-empty-discovery-run')
    return { discoveryRun: payload.run }
  }

  const response = await fetch('/api/knowledge/builder', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      action: 'compileSensitiveLexicon',
      sourceRef,
      uploadRef,
    }),
  })
  if (!response.ok)
    throw await readApiError(response, `knowledge-builder-${response.status}`)
  const payload = (await response.json()) as {
    discoveryResult?: KnowledgeBuilderDiscoveryResult
  }
  if (!payload.discoveryResult)
    throw new Error('knowledge-builder-empty-discovery-result')
  return payload.discoveryResult
}

async function fetchKnowledgeBuilderDiscoveryRun(
  runId: string,
): Promise<KnowledgeBuilderDiscoveryRun> {
  const response = await fetch(
    `/api/knowledge/builder?runId=${encodeURIComponent(runId)}`,
  )
  if (!response.ok)
    throw await readApiError(
      response,
      `knowledge-builder-discovery-run-${response.status}`,
    )
  const payload = (await response.json()) as {
    run?: KnowledgeBuilderDiscoveryRun
  }
  if (!payload.run) throw new Error('knowledge-builder-empty-discovery-run')
  return payload.run
}

async function fetchKnowledgeBuilderFeedbackDeltas(
  runId?: string,
): Promise<Array<KnowledgeBuilderFeedbackDelta>> {
  const params = new URLSearchParams({ feedbackDeltas: '1' })
  if (runId) params.set('runId', runId)
  const response = await fetch(`/api/knowledge/builder?${params.toString()}`)
  if (!response.ok)
    throw await readApiError(
      response,
      `knowledge-builder-feedback-${response.status}`,
    )
  const payload = (await response.json()) as {
    feedbackDeltas?: Array<KnowledgeBuilderFeedbackDelta>
  }
  return payload.feedbackDeltas ?? []
}

const KNOWLEDGE_BUILDER_RELATION_TYPES = [
  'synonym_of',
  'variant_of',
  'projects_to',
  'not_same_as',
  'allowed_context_for',
  'prohibited_context_for',
  'exception_to',
  'conflicts_with',
] as const

type KnowledgeBuilderRelationType =
  (typeof KNOWLEDGE_BUILDER_RELATION_TYPES)[number]

async function postKnowledgeBuilderAction<T>(
  body: Record<string, unknown>,
): Promise<T> {
  const response = await fetch('/api/knowledge/builder', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok)
    throw await readApiError(
      response,
      `knowledge-builder-action-${response.status}`,
    )
  return (await response.json()) as T
}

const LIFECYCLE_STATES = [
  'DRAFT',
  'CONSULTATION',
  'REGISTERED',
  'CHANGE_DETECTED',
  'CERTIFIED',
  'ACTIVE',
  'SUPERSEDED',
  'REPEALED',
  'UNRESOLVED',
] as const

type LifecycleState = (typeof LIFECYCLE_STATES)[number]

function isLifecycleState(state: string): state is LifecycleState {
  return LIFECYCLE_STATES.includes(state as LifecycleState)
}

function lifecycleStateLabel(
  state: string | null | undefined,
  copy: LegalCopy,
): string {
  if (!state) return copy.unresolved
  return isLifecycleState(state) ? copy.lifecycleStates[state] : state
}

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
const selectFieldClassName = `role-config-select ${fieldClassName}`

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
    const span = JSON.parse(candidate.source_span_json) as Record<
      string,
      unknown
    >
    const locator = String(span.stable_locator ?? copy.locatorPending)
    const start = span.char_start
    const end = span.char_end
    return `${locator} ${start ?? '?'}-${end ?? '?'}`
  } catch {
    return copy.spanParseFailed
  }
}

function parseSectionSpan(
  section: LegalSourceSection,
  copy: LegalCopy,
): string {
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

export function KnowledgeBaseScreen() {
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
  const scanRunsQuery = useQuery({
    queryKey: ['legal-corpus', 'scan-runs'],
    queryFn: () => fetchLegalScanRuns(10),
    staleTime: 10_000,
  })
  const sourceStatusQuery = useQuery({
    queryKey: ['legal-corpus', 'source-status', selectedSourceId],
    queryFn: () => fetchLegalSourceStatus(selectedSourceId || ''),
    enabled: Boolean(selectedSourceId),
    staleTime: 10_000,
  })
  const changeCandidatesQuery = useQuery({
    queryKey: ['legal-corpus', 'change-candidates', 'UNRESOLVED'],
    queryFn: () => fetchLegalChangeCandidates('UNRESOLVED', 25),
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
  const selectedChangeCandidate =
    changeCandidatesQuery.data?.find(
      (candidate) => candidate.candidate_id === selectedCandidateId,
    ) ?? changeCandidatesQuery.data?.[0]
  const activeCandidateId =
    selectedChangeCandidate?.candidate_id ?? selectedCandidate?.candidate_id
  const candidateImpactQuery = useQuery({
    queryKey: ['legal-corpus', 'candidate-impact', activeCandidateId],
    queryFn: () => fetchLegalCandidateImpact(activeCandidateId || ''),
    enabled: Boolean(activeCandidateId),
    staleTime: 10_000,
  })

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
      return uploadLegalSourceArtifact(
        bundle.version.version_id,
        queuedSourceFile,
      )
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

  function updateSourceForm<TKey extends keyof RegisterLegalSourceInput>(
    field: TKey,
    value: RegisterLegalSourceInput[TKey],
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
    const sourceId =
      bundle.source?.source_id || selectedChangeCandidate?.source_id
    if (!sourceId) return
    const contextType =
      actionType === 'scan_history'
        ? 'scan_run'
        : actionType === 'candidate_impact'
          ? 'impact_report'
          : actionType === 'build_review_package'
            ? 'review_package'
            : actionType === 'acknowledge_alert'
              ? 'review_package'
              : actionType === 'source_status'
                ? 'source'
                : 'candidate'
    setLegalContext({
      sourceId,
      title:
        bundle.source?.canonical_title ||
        selectedChangeCandidate?.canonical_title ||
        sourceId,
      contextType,
      versionId: bundle.version?.version_id,
      scanRunId: scanRunsQuery.data?.[0]?.scan_run_id,
      candidateId: activeCandidateId,
      impactReportRef: candidateImpactQuery.data?.impact_report_ref,
      bundleId:
        sourceStatusQuery.data?.runtime_status
          ?.active_authority_bundle_version_id || undefined,
      posture:
        candidateImpactQuery.data?.posture ||
        sourceStatusQuery.data?.runtime_status?.posture,
      comparisonClass:
        sourceStatusQuery.data?.source_status?.latest_comparison_class ||
        undefined,
      lifecycleState: bundle.version?.lifecycle_state,
      authorityTier: bundle.source?.authority_tier,
      candidateCount: bundle.candidates.length,
      anchorCount: bundle.sections.length,
    })
    setChatPanelOpen(true)
    return actionType
  }

  const metrics = dashboardQuery.data?.metrics ?? {}
  const sourceStatus = sourceStatusQuery.data
  const impact = candidateImpactQuery.data
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
                  <DropdownSelect
                    value={sourceForm.authority_tier}
                    onChange={(event) =>
                      updateSourceForm('authority_tier', event.target.value)
                    }
                    className={selectFieldClassName}
                  >
                    <option value="NATIONAL_LAW">NATIONAL_LAW</option>
                    <option value="ADMIN_REGULATION">ADMIN_REGULATION</option>
                    <option value="DEPARTMENT_RULE">DEPARTMENT_RULE</option>
                    <option value="LOCAL_RULE">LOCAL_RULE</option>
                    <option value="POLICY">POLICY</option>
                  </DropdownSelect>
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
                  <DropdownSelect
                    value={sourceForm.expected_status}
                    onChange={(event) =>
                      updateSourceForm('expected_status', event.target.value)
                    }
                    className={selectFieldClassName}
                  >
                    {(
                      [
                        'ACTIVE',
                        'DRAFT',
                        'CONSULTATION',
                        'SUPERSEDED',
                        'REPEALED',
                      ] as const
                    ).map((state) => (
                      <option key={state} value={state}>
                        {lifecycleStateLabel(state, copy)}
                      </option>
                    ))}
                  </DropdownSelect>
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
                      <Badge>
                        {lifecycleStateLabel(current?.lifecycle_state, copy)}
                      </Badge>
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
                <Badge>
                  {lifecycleStateLabel(bundle.version?.lifecycle_state, copy)}
                </Badge>
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
                  value={shortRef(
                    bundle.version?.source_hash,
                    copy.notRecorded,
                  )}
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
                {LIFECYCLE_STATES.map((state) => (
                  <div
                    key={state}
                    className={cn(
                      'flex items-center justify-between rounded border px-2 py-1.5 text-xs',
                      bundle.version?.lifecycle_state === state
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'border-border text-muted-foreground',
                    )}
                  >
                    <span>{lifecycleStateLabel(state, copy)}</span>
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

          <div className="mt-4 grid gap-4 xl:grid-cols-3">
            <InspectorPanel title={copy.sourceHealth}>
              <Fact
                label={copy.runtimeMonitor}
                value={sourceStatus?.source_status?.availability_state}
                fallback={copy.notRecorded}
              />
              <Fact
                label={copy.latestComparison}
                value={sourceStatus?.source_status?.latest_comparison_class}
                fallback={copy.notRecorded}
              />
              <Fact
                label={copy.lastCheck}
                value={sourceStatus?.source_status?.last_check?.checked_at}
                fallback={copy.notRecorded}
              />
              <Fact
                label={copy.nextDueCheck}
                value={sourceStatus?.source_status?.next_due_check}
                fallback={copy.notRecorded}
              />
            </InspectorPanel>

            <InspectorPanel title={copy.knowledgeReview}>
              <Fact
                label={copy.reviewRequired}
                value={
                  sourceStatus?.knowledge_status
                    ? String(
                        Boolean(sourceStatus.knowledge_status.review_required),
                      )
                    : undefined
                }
                fallback={copy.notRecorded}
              />
              <Fact
                label={copy.changedAnchors}
                value={
                  sourceStatus?.knowledge_status?.changed_anchors
                    ? String(
                        sourceStatus.knowledge_status.changed_anchors.length,
                      )
                    : undefined
                }
                fallback={copy.notRecorded}
              />
              <Fact
                label={copy.activeVersions}
                value={
                  sourceStatus?.knowledge_status?.active_version_ids
                    ? String(
                        sourceStatus.knowledge_status.active_version_ids.length,
                      )
                    : undefined
                }
                fallback={copy.notRecorded}
              />
              <Fact
                label={copy.pendingVersions}
                value={
                  sourceStatus?.knowledge_status?.pending_version_ids
                    ? String(
                        sourceStatus.knowledge_status.pending_version_ids
                          .length,
                      )
                    : undefined
                }
                fallback={copy.notRecorded}
              />
            </InspectorPanel>

            <InspectorPanel title={copy.runtimePosture}>
              <Fact
                label={copy.runtimePosture}
                value={sourceStatus?.runtime_status?.posture}
                fallback={copy.notRecorded}
              />
              <Fact
                label={copy.authorityBundle}
                value={shortRef(
                  sourceStatus?.runtime_status
                    ?.active_authority_bundle_version_id,
                  copy.notRecorded,
                )}
                fallback={copy.notRecorded}
              />
              <Fact
                label={copy.activation}
                value={
                  sourceStatus?.runtime_status
                    ? `activation_ready=${Boolean(
                        sourceStatus.runtime_status.activation_ready,
                      )}`
                    : undefined
                }
                fallback={copy.notRecorded}
              />
            </InspectorPanel>
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
                      <code>
                        {shortRef(artifact.content_hash, copy.notRecorded)}
                      </code>
                    </Row>
                  ))
                ) : (
                  <EmptyState label={copy.noRawArtifact} />
                )}
              </InspectorPanel>

              <div className="rounded-md border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <HugeiconsIcon
                    icon={Upload01Icon}
                    size={15}
                    strokeWidth={1.6}
                  />
                  {copy.uploadSourceFile}
                </div>
                <div className="mt-3 grid gap-3">
                  <label className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border border-border px-3 text-sm font-semibold transition-colors hover:border-primary hover:bg-primary/10">
                    <HugeiconsIcon
                      icon={Upload01Icon}
                      size={15}
                      strokeWidth={1.6}
                    />
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
                    <HugeiconsIcon
                      icon={Upload01Icon}
                      size={15}
                      strokeWidth={1.6}
                    />
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
                            {section.title ||
                              section.ordinal ||
                              copy.headingPending}{' '}
                            / {parseSectionSpan(section, copy)}
                          </div>
                        </div>
                        <code>
                          {shortRef(section.local_hash, copy.notRecorded)}
                        </code>
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
                        onClick={() =>
                          setSelectedCandidateId(candidate.candidate_id)
                        }
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
              {copy.safeMonitorActions}
            </div>
            <div className="mt-3 grid gap-2">
              {[
                ['source_status', copy.sourceStatusAction],
                ['scan_history', copy.scanHistoryAction],
                ['candidate_impact', copy.candidateImpactAction],
                ['acknowledge_alert', copy.acknowledgementAction],
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

          <InspectorPanelWithMargin title={copy.scanHistory}>
            {scanRunsQuery.data?.length ? (
              scanRunsQuery.data.slice(0, 4).map((run) => (
                <Row key={run.scan_run_id}>
                  <div className="min-w-0">
                    <div className="font-medium">
                      {run.status || copy.unresolved}
                    </div>
                    <div className="truncate text-muted-foreground">
                      {run.trigger || copy.notRecorded} /{' '}
                      {run.scheduled_window ||
                        run.started_at ||
                        copy.notRecorded}
                    </div>
                  </div>
                  <code>{shortRef(run.scan_run_id, copy.notRecorded)}</code>
                </Row>
              ))
            ) : (
              <EmptyState label={copy.noScanRuns} />
            )}
          </InspectorPanelWithMargin>

          <InspectorPanelWithMargin title={copy.changeCandidates}>
            {changeCandidatesQuery.data?.length ? (
              changeCandidatesQuery.data.slice(0, 5).map((candidate) => (
                <button
                  key={candidate.candidate_id}
                  type="button"
                  onClick={() => setSelectedCandidateId(candidate.candidate_id)}
                  className={cn(
                    'w-full rounded border border-border px-3 py-2 text-left text-xs transition-colors hover:border-primary hover:bg-primary/10',
                    activeCandidateId === candidate.candidate_id
                      ? 'border-primary bg-primary/10'
                      : '',
                  )}
                >
                  <div className="truncate font-semibold">
                    {candidate.canonical_title || candidate.source_id}
                  </div>
                  <div className="mt-1 truncate text-muted-foreground">
                    {candidate.candidate_type || copy.candidate} /{' '}
                    {candidate.stable_locator || copy.locatorPending}
                  </div>
                </button>
              ))
            ) : (
              <EmptyState label={copy.noChangeCandidates} />
            )}
          </InspectorPanelWithMargin>

          <InspectorPanelWithMargin title={copy.impactReport}>
            <ImpactSummary impact={impact} copy={copy} />
          </InspectorPanelWithMargin>

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
            <div className="text-sm font-semibold">
              {copy.acceptanceEvidence}
            </div>
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

export function DatasetKnowledgeBaseScreen() {
  const locale = useSettingsStore((state) => state.settings.locale)
  const copy = locale === 'zh' ? DATASET_COPY.zh : DATASET_COPY.en
  const queryClient = useQueryClient()
  const datasetQuery = useQuery({
    queryKey: ['knowledge-base', 'dataset-governance'],
    queryFn: fetchDatasetGovernance,
    staleTime: 10_000,
  })
  const nativeMetadataQuery = useQuery({
    queryKey: ['knowledge-base', 'native-metadata-summary'],
    queryFn: fetchNativeMetadataSummary,
    staleTime: 10_000,
  })
  const payload = datasetQuery.data
  const rows = payload?.rows ?? []
  const nativeMetadata = nativeMetadataQuery.data
  const preferenceMutation = useMutation({
    mutationFn: updateDatasetPreference,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['knowledge-base', 'dataset-governance'],
      })
      void queryClient.invalidateQueries({
        queryKey: ['knowledge-base', 'effective-context-graph'],
      })
    },
  })

  return (
    <div
      lang={locale === 'zh' ? 'zh-CN' : 'en'}
      className="flex h-full min-h-0 flex-col bg-background text-foreground"
    >
      <header className="border-b border-border px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">{copy.title}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {copy.subtitle}
            </p>
          </div>
          {payload?.resolvedActivationSetHash ? (
            <div className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">
              <div className="font-semibold text-foreground">
                {copy.evidence}
              </div>
              <div className="mt-1">
                {copy.activationHash}:{' '}
                <code>{shortRef(payload.resolvedActivationSetHash)}</code>
              </div>
            </div>
          ) : null}
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        <section className="mb-4 rounded-md border border-border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">{copy.assets}</h2>
              <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
                {copy.metadataOnlyNotice}
              </p>
            </div>
            <Badge>
              {copy.redaction}:{' '}
              {nativeMetadata?.evidenceDrawer.redaction ?? 'redacted'}
            </Badge>
          </div>
          <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="grid gap-2">
              {(nativeMetadata?.assetRows ?? []).slice(0, 8).map((asset) => (
                <div
                  key={asset.assetId}
                  className="rounded-md border border-border bg-background p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">
                        {asset.displayName}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {asset.assetKind} / {asset.owner} / {asset.domain}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge>{asset.metadataReadinessState}</Badge>
                      <Badge>{asset.runtimeAuthorityState}</Badge>
                      {asset.locked ? <Badge>{copy.locked}</Badge> : null}
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2 xl:grid-cols-4">
                    <Fact
                      label={copy.version}
                      value={shortRef(asset.version, copy.notRecorded)}
                    />
                    <Fact label={copy.lifecycle} value={asset.lifecycleState} />
                    <Fact
                      label={copy.metadataReadiness}
                      value={`${asset.qualityState} / ${asset.contractState}`}
                    />
                    <Fact
                      label={copy.runtimeAuthority}
                      value={`${asset.governanceDecision} / ${asset.resolverStatus}`}
                    />
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {copy.sourceAnchors}:{' '}
                    {asset.sourceAnchors.slice(0, 3).join(', ') ||
                      copy.notRecorded}
                  </div>
                </div>
              ))}
              {nativeMetadataQuery.isLoading ? (
                <EmptyState label={copy.loading} />
              ) : nativeMetadataQuery.isError ? (
                <EmptyState label={copy.unavailable} />
              ) : (nativeMetadata?.assetRows.length ?? 0) === 0 ? (
                <EmptyState label={copy.empty} />
              ) : null}
            </div>
            <div className="rounded-md border border-border bg-background p-3">
              <div className="text-sm font-semibold">{copy.evidenceDrawer}</div>
              <div className="mt-3 grid gap-2">
                {(nativeMetadata?.evidenceDrawer.rows ?? [])
                  .slice(0, 6)
                  .map((row) => (
                    <div
                      key={`${row.assetId}-${row.evidenceKind}`}
                      className="rounded border border-border bg-card p-2 text-xs"
                    >
                      <div className="font-medium">{row.evidenceKind}</div>
                      <div className="mt-1 truncate text-muted-foreground">
                        {row.assetId}
                      </div>
                      <div className="mt-1 truncate text-muted-foreground">
                        {copy.sourceHash}:{' '}
                        {shortRef(row.sourceHash, copy.notRecorded)}
                      </div>
                      <div className="truncate text-muted-foreground">
                        {copy.activationHash}:{' '}
                        {shortRef(row.snapshotHash, copy.notRecorded)}
                      </div>
                    </div>
                  ))}
              </div>
              <div className="mt-4 text-sm font-semibold">{copy.lineage}</div>
              <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
                {(nativeMetadata?.lineageEdges ?? [])
                  .slice(0, 6)
                  .map((edge) => (
                    <div
                      key={`${edge.source}-${edge.target}-${edge.relationType}`}
                      className="truncate"
                    >
                      <code>{edge.source}</code> {edge.relationType}{' '}
                      <code>{edge.target}</code>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </section>
        {datasetQuery.isLoading ? (
          <EmptyState label={copy.loading} />
        ) : datasetQuery.isError ? (
          <EmptyState label={copy.unavailable} />
        ) : rows.length === 0 ? (
          <EmptyState label={copy.empty} />
        ) : (
          <div className="overflow-hidden rounded-md border border-border bg-card">
            <div className="hidden grid-cols-[minmax(180px,1.4fr)_minmax(120px,0.8fr)_minmax(220px,1fr)_minmax(180px,0.8fr)] border-b border-border px-4 py-2 text-xs font-semibold text-muted-foreground md:grid">
              <div>{copy.source}</div>
              <div>{copy.authority}</div>
              <div>{copy.aiContext}</div>
              <div>{copy.evidence}</div>
            </div>
            <div className="divide-y divide-border">
              {rows.map((row) => (
                <DatasetGovernanceRowView
                  key={row.activationId}
                  row={row}
                  copy={copy}
                  onPreferenceChange={(dimension, enabled) => {
                    preferenceMutation.mutate({
                      activationId: row.activationId,
                      dimension,
                      enabled,
                    })
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export function EffectiveContextScreen() {
  const locale = useSettingsStore((state) => state.settings.locale)
  const copy =
    locale === 'zh' ? EFFECTIVE_CONTEXT_COPY.zh : EFFECTIVE_CONTEXT_COPY.en
  const graphQuery = useQuery({
    queryKey: ['knowledge-base', 'effective-context-graph'],
    queryFn: fetchEffectiveContextGraph,
    staleTime: 10_000,
  })
  const effectiveGraph = graphQuery.data?.effectiveContext
  const nativeMetadata = graphQuery.data?.nativeMetadata

  return (
    <div
      lang={locale === 'zh' ? 'zh-CN' : 'en'}
      className="flex h-full min-h-0 flex-col bg-background text-foreground"
    >
      <header className="border-b border-border px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">{copy.title}</h1>
            <p className="mt-0.5 max-w-3xl text-sm text-muted-foreground">
              {copy.subtitle}
            </p>
          </div>
          {effectiveGraph?.resolvedActivationSetHash ? (
            <div className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">
              <div className="font-semibold text-foreground">
                {copy.activationHash}
              </div>
              <code className="mt-1 block">
                {shortRef(effectiveGraph.resolvedActivationSetHash)}
              </code>
            </div>
          ) : null}
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        <section className="rounded-card border border-border bg-card p-4">
          <div>
            <h2 className="text-sm font-semibold">{copy.title}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {copy.graphLegend}
            </p>
          </div>
          {graphQuery.isLoading ? (
            <EmptyState label={copy.loading} />
          ) : graphQuery.isError ? (
            <EmptyState label={copy.unavailable} />
          ) : effectiveGraph?.nodes.length ? (
            <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.55fr)]">
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {effectiveGraph.nodes.map((node) => (
                  <div
                    key={node.id}
                    className="rounded-md border border-border bg-background px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold">
                        {node.label}
                      </span>
                      <Badge>{node.nodeType}</Badge>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {Object.entries(node.metadata)
                        .slice(0, 4)
                        .map(([key, value]) => (
                          <div key={key} className="truncate">
                            {key}: {String(value ?? '-')}
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="rounded-md border border-border bg-background p-3 text-xs text-muted-foreground">
                {effectiveGraph.edges.map((edge) => (
                  <div key={`${edge.source}-${edge.target}-${edge.edgeType}`}>
                    <code>{edge.source}</code> {edge.edgeType}{' '}
                    <code>{edge.target}</code>
                  </div>
                ))}
              </div>
              {nativeMetadata ? (
                <div className="rounded-md border border-border bg-background p-3 text-xs text-muted-foreground lg:col-span-2">
                  <div className="mb-2 font-semibold text-foreground">
                    {copy.nativeMetadataParity}:{' '}
                    <code>{shortRef(nativeMetadata.resolverSnapshotHash)}</code>
                  </div>
                  <div className="grid gap-1 sm:grid-cols-2">
                    {nativeMetadata.lineageEdges.slice(0, 8).map((edge) => (
                      <div
                        key={`${edge.source}-${edge.target}-${edge.relationType}`}
                        className="truncate"
                      >
                        <code>{edge.source}</code> {edge.relationType}{' '}
                        <code>{edge.target}</code>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <EmptyState label={copy.noGraph} />
          )}
        </section>
      </main>
    </div>
  )
}

export function PolicyRuleStudioScreen() {
  const locale = useSettingsStore((state) => state.settings.locale)
  const copy = locale === 'zh' ? POLICY_RULE_COPY.zh : POLICY_RULE_COPY.en
  const policyRuleQuery = useQuery({
    queryKey: ['knowledge-base', 'policy-rule-candidates'],
    queryFn: fetchPolicyRuleCandidates,
    staleTime: 10_000,
  })
  const candidates = policyRuleQuery.data ?? []

  return (
    <div
      lang={locale === 'zh' ? 'zh-CN' : 'en'}
      className="flex h-full min-h-0 flex-col bg-background text-foreground"
    >
      <header className="border-b border-border px-4 py-3 sm:px-6">
        <div>
          <h1 className="text-lg font-semibold">{copy.title}</h1>
          <p className="mt-0.5 max-w-3xl text-sm text-muted-foreground">
            {copy.subtitle}
          </p>
        </div>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        {policyRuleQuery.isLoading ? (
          <EmptyState label={copy.loading} />
        ) : policyRuleQuery.isError ? (
          <EmptyState label={copy.unavailable} />
        ) : candidates.length === 0 ? (
          <EmptyState label={copy.empty} />
        ) : (
          <div className="grid gap-3">
            {candidates.map((candidate) => (
              <PolicyRuleCandidateCard
                key={candidate.ruleCandidateId}
                candidate={candidate}
                copy={copy}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

export function TenderDocumentReviewScreen() {
  const queryClient = useQueryClient()
  const locale = useSettingsStore((state) => state.settings.locale)
  const copy = locale === 'zh' ? TENDER_REVIEW_COPY.zh : TENDER_REVIEW_COPY.en
  const [documentText, setDocumentText] = useState('')
  const [run, setRun] = useState<TenderDetectionRun | null>(null)
  const [reportPersisted, setReportPersisted] = useState(false)
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)

  const reviewMutation = useMutation({
    mutationFn: createTenderDetectionRun,
    onSuccess: (nextRun) => {
      setRun(nextRun)
      setReportPersisted(false)
    },
  })
  const dispositionMutation = useMutation({
    mutationFn: recordTenderDisposition,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tender-document-review'] })
    },
  })
  const reportMutation = useMutation({
    mutationFn: createTenderReport,
    onSuccess: () => setReportPersisted(true),
  })
  const feedbackMutation = useMutation({
    mutationFn: recordTenderFeedback,
    onSuccess: () => setFeedbackMessage(copy.feedbackSent),
  })

  return (
    <div
      lang={locale === 'zh' ? 'zh-CN' : 'en'}
      className="flex h-full min-h-0 flex-col bg-background text-foreground"
    >
      <header className="border-b border-border px-4 py-3 sm:px-6">
        <h1 className="text-lg font-semibold">{copy.title}</h1>
        <p className="mt-0.5 max-w-3xl text-sm text-muted-foreground">
          {copy.subtitle}
        </p>
      </header>
      <main className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 sm:p-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="rounded-md border border-border bg-card p-4">
          <label className="text-sm font-medium" htmlFor="tender-document-text">
            {copy.documentText}
          </label>
          <textarea
            id="tender-document-text"
            className="mt-3 min-h-72 w-full rounded-md border border-border bg-background p-3 text-sm outline-none focus:border-primary"
            placeholder={copy.placeholder}
            value={documentText}
            onChange={(event) => setDocumentText(event.target.value)}
          />
          <button
            type="button"
            className="mt-3 rounded-button bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:scale-105 hover:bg-primary/90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!documentText.trim() || reviewMutation.isPending}
            onClick={() => reviewMutation.mutate(documentText)}
          >
            {reviewMutation.isPending ? copy.running : copy.runReview}
          </button>
          {reviewMutation.isError ? (
            <p className="mt-3 text-sm text-destructive">{copy.unavailable}</p>
          ) : null}
        </section>
        <section className="rounded-card border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">{copy.findings}</h2>
              {run ? (
                <p className="text-xs text-muted-foreground">
                  {run.run_id} · {run.source_document_hash}
                </p>
              ) : null}
            </div>
            {run ? (
              <button
                type="button"
                className="rounded-button border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                disabled={reportMutation.isPending}
                onClick={() => reportMutation.mutate(run.run_id)}
              >
                {copy.persistReport}
              </button>
            ) : null}
          </div>
          {reportPersisted ? (
            <p className="mt-3 rounded-md border border-[var(--theme-success)]/40 bg-[var(--theme-success)]/10 p-2 text-xs text-[var(--theme-success)]">
              {copy.reportPersisted}
            </p>
          ) : null}
          {feedbackMessage ? (
            <p className="mt-3 rounded-md border border-[var(--theme-success)]/40 bg-[var(--theme-success)]/10 p-2 text-xs text-[var(--theme-success)]">
              {feedbackMessage}
            </p>
          ) : null}
          {!run || run.findings.length === 0 ? (
            <EmptyState label={copy.noFindings} />
          ) : (
            <div className="mt-4 grid gap-3">
              {run.findings.map((finding) => (
                <TenderFindingCard
                  key={finding.finding_id}
                  finding={finding}
                  runId={run.run_id}
                  copy={copy}
                  onDisposition={(disposition) =>
                    dispositionMutation.mutate({
                      runId: run.run_id,
                      findingId: finding.finding_id,
                      disposition,
                      editedReplacement:
                        disposition === 'edited'
                          ? finding.suggested_replacement || undefined
                          : undefined,
                    })
                  }
                  onFeedback={(feedbackType, escalationOutcome) =>
                    feedbackMutation.mutate({
                      runId: run.run_id,
                      findingId: finding.finding_id,
                      feedbackType,
                      userDisposition: {
                        finding_id: finding.finding_id,
                        matched_text: finding.matched_text,
                      },
                      escalationOutcome,
                      reviewerNotes:
                        feedbackType === 'false_positive'
                          ? 'Runtime reviewer marked this finding as a false positive.'
                          : 'Runtime reviewer sent this exception back to Knowledge Builder.',
                      editedRemediation:
                        feedbackType === 'weak_explanation'
                          ? finding.suggested_replacement || undefined
                          : undefined,
                    })
                  }
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

export function KnowledgeBuilderStudioScreen() {
  const locale = useSettingsStore((state) => state.settings.locale)
  const copy =
    locale === 'zh' ? KNOWLEDGE_BUILDER_COPY.zh : KNOWLEDGE_BUILDER_COPY.en
  const [sourceRef, setSourceRef] = useState('uat-tender-sample')
  const [runId, setRunId] = useState<string | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedRelationId, setSelectedRelationId] = useState<string | null>(
    null,
  )
  const [relationType, setRelationType] =
    useState<KnowledgeBuilderRelationType>('not_same_as')
  const [canonicalLabel, setCanonicalLabel] = useState(
    'exclusive supplier restriction',
  )
  const [definition, setDefinition] = useState(
    'Tender wording that restricts competition to one supplier, brand, or authorization path.',
  )
  const [aliases, setAliases] = useState('唯一供应商, 独家授权, 指定品牌')
  const [curationMessage, setCurationMessage] = useState<string | null>(null)
  const [relationCandidateId, setRelationCandidateId] = useState<string | null>(
    null,
  )
  const [termCandidateId, setTermCandidateId] = useState<string | null>(null)
  const [evaluationDataset, setEvaluationDataset] =
    useState<KnowledgeBuilderEvaluationDataset | null>(null)
  const [evaluationRun, setEvaluationRun] =
    useState<KnowledgeBuilderEvaluationRun | null>(null)
  const [authorityVersion, setAuthorityVersion] =
    useState<KnowledgeBuilderAuthorityVersion | null>(null)
  const [readModelRebuild, setReadModelRebuild] =
    useState<KnowledgeBuilderReadModelRebuild | null>(null)
  const [sourceUpload, setSourceUpload] =
    useState<KnowledgeBuilderSourceUpload | null>(null)
  const [selectedSourceDocument, setSelectedSourceDocument] =
    useState<File | null>(null)
  const [discoveryResult, setDiscoveryResult] =
    useState<KnowledgeBuilderDiscoveryResult | null>(null)
  const [discoveryView, setDiscoveryView] = useState<'lexicon' | 'graph'>(
    'lexicon',
  )
  const queryClient = useQueryClient()
  const discoveryRunQuery = useQuery({
    queryKey: ['knowledge-builder-discovery-run', runId],
    queryFn: () => fetchKnowledgeBuilderDiscoveryRun(runId as string),
    enabled: Boolean(runId),
  })
  const feedbackDeltasQuery = useQuery({
    queryKey: ['knowledge-builder-feedback-deltas', runId],
    queryFn: () => fetchKnowledgeBuilderFeedbackDeltas(runId || undefined),
    enabled: false,
  })
  const importedLexiconCandidatesQuery = useQuery({
    queryKey: ['knowledge-builder-imported-lexicon-candidates'],
    queryFn: fetchPolicyRuleCandidates,
  })
  const importedLexiconCandidates = useMemo(
    () =>
      (importedLexiconCandidatesQuery.data ?? []).filter((candidate) =>
        String(
          candidate.applicabilityScope?.compiler_profile_version || '',
        ).startsWith('sensitive_lexicon_docx.'),
      ),
    [importedLexiconCandidatesQuery.data],
  )
  const runtimeFeedbackMetrics = useMemo(() => {
    const deltas = feedbackDeltasQuery.data ?? []
    const total = deltas.length
    const falsePositiveCount = deltas.filter(
      (delta) => delta.feedback_type === 'false_positive',
    ).length
    const falseNegativeCount = deltas.filter(
      (delta) => delta.feedback_type === 'false_negative',
    ).length
    return {
      total,
      queued: deltas.filter(
        (delta) =>
          String(delta.evaluation_routing?.route_to || '') ===
          'knowledge_builder_evaluation_lab',
      ).length,
      captureRate: total ? 1 - falseNegativeCount / total : 0,
      typeOneErrorRate: total ? falsePositiveCount / total : 0,
      typeTwoErrorRate: total ? falseNegativeCount / total : 0,
    }
  }, [feedbackDeltasQuery.data])
  const discoveryMutation = useMutation({
    mutationFn: createKnowledgeBuilderRun,
    onSuccess: (result) => {
      setDiscoveryResult(result)
      setRunId(result.discoveryRun.discovery_run_id)
      setSelectedNodeId(null)
      setSelectedRelationId(null)
      setCurationMessage(null)
      setRelationCandidateId(null)
      setTermCandidateId(null)
      setEvaluationDataset(null)
      setEvaluationRun(null)
      setAuthorityVersion(null)
      setReadModelRebuild(null)
    },
  })
  const sourceUploadMutation = useMutation({
    mutationFn: uploadKnowledgeBuilderSourceDocument,
    onSuccess: (upload) => {
      setSourceUpload(upload)
      setSelectedSourceDocument(null)
      const uploadRef = upload.stagedUploadRef || upload.retryUploadRef
      if (uploadRef) {
        setSourceRef(uploadRef)
      }
      setCurationMessage(copy.uploadReadyForSourceReference)
    },
  })
  const discoveryRun = discoveryRunQuery.data
  const compiledCandidates = discoveryResult?.importResult?.candidates ?? []
  const compiledCategories = Array.from(
    new Set(
      compiledCandidates
        .map((candidate) => candidate.applicability_scope?.term_category)
        .filter((category): category is string => Boolean(category)),
    ),
  )
  const compiledAnchorCount =
    discoveryResult?.importResult?.compilation_run?.mapped_source_anchor_refs
      ?.length ?? 0
  const governedUploadRef =
    sourceUpload?.stagedUploadRef || sourceUpload?.retryUploadRef || ''
  const candidateNodes: Array<KnowledgeBuilderCandidateNode> = []
  const candidateRelations: Array<KnowledgeBuilderCandidateRelation> = []
  const candidateClusters: Array<KnowledgeBuilderCandidateCluster> = []
  const selectedNode = candidateNodes.find(
    (node) => node.node_id === selectedNodeId,
  )
  const selectedRelation =
    candidateRelations.find(
      (relation) => relation.relation_id === selectedRelationId,
    ) ?? candidateRelations[0]
  const selectedCluster = candidateClusters[0]
  const selectedRelationAnchors = selectedRelation?.source_anchor_refs ?? []
  const refreshDiscoveryRun = () => {
    if (runId)
      void queryClient.invalidateQueries({
        queryKey: ['knowledge-builder-discovery-run', runId],
      })
  }
  const relationMutation = useMutation({
    mutationFn: (input: {
      decision: 'accept' | 'reject' | 'change'
      relationType: KnowledgeBuilderRelationType
    }) =>
      postKnowledgeBuilderAction({
        action: 'curateRelation',
        relationId: selectedRelation?.relation_id,
        decision: input.decision,
        relationType: input.relationType,
        reviewerNotes:
          input.relationType === 'not_same_as'
            ? 'Reviewer marked this semantic neighborhood as a false friend.'
            : 'Reviewer curated semantic relation.',
      }),
    onSuccess: (payload) => {
      const relationCandidate = (
        payload as {
          relationCandidate?: { semantic_relation_candidate_id?: string }
        }
      ).relationCandidate
      if (relationCandidate?.semantic_relation_candidate_id) {
        setRelationCandidateId(relationCandidate.semantic_relation_candidate_id)
      }
      setCurationMessage(copy.curationSaved)
      refreshDiscoveryRun()
    },
  })
  const splitMutation = useMutation({
    mutationFn: () =>
      postKnowledgeBuilderAction({
        action: 'splitCluster',
        clusterId: selectedCluster?.cluster_id,
        nodeIds: candidateNodes.slice(0, 2).map((node) => node.node_id),
        reviewerNotes: 'Reviewer split semantic neighborhood false friends.',
      }),
    onSuccess: () => {
      setCurationMessage(copy.curationSaved)
      refreshDiscoveryRun()
    },
  })
  const mergeMutation = useMutation({
    mutationFn: () =>
      postKnowledgeBuilderAction({
        action: 'mergeClusters',
        clusterIds: selectedCluster ? [selectedCluster.cluster_id] : [],
        reviewerNotes: 'Reviewer merged related semantic neighborhoods.',
      }),
    onSuccess: () => {
      setCurationMessage(copy.curationSaved)
      refreshDiscoveryRun()
    },
  })
  const termMutation = useMutation({
    mutationFn: () =>
      postKnowledgeBuilderAction({
        action: 'canonicalTerm',
        discoveryRunId: runId,
        domain: 'tender_compliance',
        canonicalLabel,
        definition,
        aliases: aliases
          .split(',')
          .map((alias) => alias.trim())
          .filter(Boolean),
        allowedContexts: ['supplier qualification evidence'],
        prohibitedContexts: ['unique serial number', 'identifier-only wording'],
        sourceAnchorRefs: selectedRelationAnchors,
        evidenceSummary:
          selectedRelation?.evidence_summary ||
          'Reviewer promoted curated tender semantic neighborhood evidence.',
        proposedRuntimeEffect: {
          control_family: 'tender_compliance',
          suggested_rule_family: 'competition_restriction',
          authority_state: 'candidate_only',
        },
        governanceState: 'PROPOSED',
      }),
    onSuccess: (payload) => {
      const termCandidate = (
        payload as { termCandidate?: { term_candidate_id?: string } }
      ).termCandidate
      if (termCandidate?.term_candidate_id) {
        setTermCandidateId(termCandidate.term_candidate_id)
      }
      setCurationMessage(copy.curationSaved)
    },
  })
  const evaluationDatasetMutation = useMutation({
    mutationFn: () =>
      postKnowledgeBuilderAction<{
        evaluationDataset: KnowledgeBuilderEvaluationDataset
      }>({
        action: 'createEvaluationDataset',
        discoveryRunId: runId,
        useTenderUatFixture: true,
      }),
    onSuccess: (payload) => {
      setEvaluationDataset(payload.evaluationDataset)
      setEvaluationRun(null)
      setCurationMessage(copy.curationSaved)
    },
  })
  const evaluationRunMutation = useMutation({
    mutationFn: () =>
      postKnowledgeBuilderAction<{
        evaluationRun: KnowledgeBuilderEvaluationRun
      }>({
        action: 'runEvaluation',
        evaluationDatasetId: evaluationDataset?.evaluation_dataset_id,
        discoveryRunId: runId,
      }),
    onSuccess: (payload) => {
      setEvaluationRun(payload.evaluationRun)
      setCurationMessage(copy.curationSaved)
    },
  })
  const ratingMutation = useMutation({
    mutationFn: (input: {
      resultId: string
      humanRating: 'pass' | 'fail' | 'needs_review'
      explanationAcceptance: 'accepted' | 'rejected' | 'needs_review'
    }) =>
      postKnowledgeBuilderAction({
        action: 'rateEvaluationResult',
        resultId: input.resultId,
        humanRating: input.humanRating,
        explanationAcceptance: input.explanationAcceptance,
        errorLabels: [],
        reviewerNotes: 'Hermes Evaluation Lab reviewer rating.',
      }),
    onSuccess: () => setCurationMessage(copy.evaluationSaved),
  })
  const promotionMutation = useMutation({
    mutationFn: () =>
      postKnowledgeBuilderAction<{
        authorityVersion: KnowledgeBuilderAuthorityVersion
      }>({
        action: 'promoteRuntimeSemantics',
        termCandidateId,
        semanticRelationCandidateIds: relationCandidateId
          ? [relationCandidateId]
          : [],
        evaluationRunId: evaluationRun?.evaluation_run_id,
      }),
    onSuccess: (payload) => {
      setAuthorityVersion(payload.authorityVersion)
      setCurationMessage(copy.curationSaved)
    },
  })
  const rebuildMutation = useMutation({
    mutationFn: () =>
      postKnowledgeBuilderAction<{
        readModelRebuild: KnowledgeBuilderReadModelRebuild
      }>({
        action: 'rebuildReadModels',
        authorityVersionId: authorityVersion?.authority_version_id,
      }),
    onSuccess: (payload) => {
      setReadModelRebuild(payload.readModelRebuild)
      setCurationMessage(copy.curationSaved)
    },
  })

  return (
    <div
      lang={locale === 'zh' ? 'zh-CN' : 'en'}
      className="flex h-full min-h-0 flex-col bg-background text-foreground"
    >
      <header className="border-b border-border px-4 py-3 sm:px-6">
        <h1 className="text-lg font-semibold">{copy.title}</h1>
        <p className="mt-0.5 max-w-3xl text-sm text-muted-foreground">
          {copy.subtitle}
        </p>
      </header>
      <main className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 sm:p-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <section className="rounded-card border border-border bg-card p-4">
          <div className="mb-4 rounded-md border border-border bg-background p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">
                  {copy.governedDocumentUpload}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {copy.uploadGovernedDocumentHelp}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="rounded-button border border-border bg-card px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted">
                  <input
                    type="file"
                    accept=".docx"
                    className="sr-only"
                    onChange={(event) => {
                      setSelectedSourceDocument(event.target.files?.[0] ?? null)
                    }}
                  />
                  {copy.chooseGovernedDocument}
                </label>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-button bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-colors hover:scale-105 hover:bg-primary/90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={
                    !selectedSourceDocument || sourceUploadMutation.isPending
                  }
                  onClick={() => {
                    if (selectedSourceDocument) {
                      sourceUploadMutation.mutate(selectedSourceDocument)
                    }
                  }}
                >
                  <HugeiconsIcon
                    icon={Upload01Icon}
                    size={14}
                    strokeWidth={1.7}
                  />
                  {sourceUploadMutation.isPending
                    ? copy.uploadingGovernedDocument
                    : copy.uploadGovernedDocument}
                </button>
              </div>
            </div>
            <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
              {selectedSourceDocument ? (
                <div className="break-all">
                  {copy.uploadGovernedDocument}:{' '}
                  <code>{selectedSourceDocument.name}</code>
                </div>
              ) : null}
              <div>
                {copy.sourceKind}: <code>controlled_document</code>
              </div>
              <div>
                {copy.semanticPurpose}: <code>sensitive_lexicon</code>
              </div>
              <div>
                {copy.compilerProfile}: <code>sensitive_lexicon_docx.v1</code>
              </div>
              {sourceUpload?.stagedUploadRef || sourceUpload?.retryUploadRef ? (
                <div className="break-all">
                  {copy.governedUploadRef}:{' '}
                  <code>
                    {sourceUpload.stagedUploadRef ||
                      sourceUpload.retryUploadRef}
                  </code>
                </div>
              ) : null}
              {sourceUpload ? (
                <div className="break-all">
                  {copy.governedSourceRef}:{' '}
                  <code>pending governed source registration</code>
                </div>
              ) : null}
              {sourceUpload ? (
                <div>
                  {copy.knowledgeSourceContentHash}: <code>pending</code>
                </div>
              ) : null}
            </div>
            {sourceUploadMutation.isError ? (
              <p className="mt-3 text-xs text-destructive">
                {sourceUploadMutation.error instanceof Error
                  ? sourceUploadMutation.error.message
                  : copy.unavailable}
              </p>
            ) : null}
          </div>
          <label className="text-sm font-medium" htmlFor="kb-source-ref">
            {copy.sourceRef}
          </label>
          <input
            id="kb-source-ref"
            className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            placeholder={copy.sourceRefPlaceholder}
            value={sourceRef}
            onChange={(event) => setSourceRef(event.target.value)}
          />
          <button
            type="button"
            className="mt-3 rounded-button bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:scale-105 hover:bg-primary/90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!sourceRef.trim() || discoveryMutation.isPending}
            onClick={() =>
              discoveryMutation.mutate({
                sourceRef,
                uploadRef: governedUploadRef,
              })
            }
          >
            {discoveryMutation.isPending ? copy.running : copy.runDiscovery}
          </button>
          {discoveryMutation.isError || discoveryRunQuery.isError ? (
            <p className="mt-3 text-sm text-destructive">
              {discoveryMutation.error instanceof Error
                ? discoveryMutation.error.message
                : discoveryRunQuery.error instanceof Error
                  ? discoveryRunQuery.error.message
                  : copy.unavailable}
            </p>
          ) : null}
          {discoveryResult ? (
            <div className="mt-4 rounded-md border border-border bg-background p-3">
              <h2 className="text-sm font-semibold">
                {copy.uploadedDocumentPreview}
              </h2>
              <dl className="mt-3 grid gap-2 text-xs">
                <div className="flex flex-wrap justify-between gap-2">
                  <dt className="text-muted-foreground">
                    {copy.uploadGovernedDocument}
                  </dt>
                  <dd className="font-mono">
                    {discoveryResult.ingest?.originalName ||
                      selectedSourceDocument?.name ||
                      '-'}
                  </dd>
                </div>
                <div className="flex flex-wrap justify-between gap-2">
                  <dt className="text-muted-foreground">
                    {copy.normalizedArtifact}
                  </dt>
                  <dd className="break-all font-mono">
                    {discoveryResult.ingest?.normalizedDocumentArtifactRef ||
                      '-'}
                  </dd>
                </div>
                <div className="flex flex-wrap justify-between gap-2">
                  <dt className="text-muted-foreground">
                    {copy.knowledgeSourceContentHash}
                  </dt>
                  <dd className="break-all font-mono">
                    {discoveryResult.ingest?.sourceHash || '-'}
                  </dd>
                </div>
              </dl>
              <div className="mt-3 grid gap-2">
                {compiledCandidates.slice(0, 8).map((candidate) => (
                  <div
                    key={candidate.rule_candidate_id}
                    className="rounded border border-border bg-card p-2 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">
                        {candidate.applicability_scope?.match_terms?.[0] ||
                          candidate.applicability_scope?.normalized_term ||
                          '-'}
                      </span>
                      <span className="text-muted-foreground">
                        {candidate.applicability_scope?.term_category || '-'}
                      </span>
                    </div>
                    <div className="mt-1 truncate font-mono text-muted-foreground">
                      {candidate.source_anchor_refs?.[0] || '-'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
        <section className="rounded-card border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">
              {discoveryView === 'lexicon'
                ? copy.lexiconPreview
                : copy.graphPreview}
            </h2>
            <div className="inline-flex rounded-md border border-border bg-background p-1">
              {(['lexicon', 'graph'] as const).map((view) => (
                <button
                  key={view}
                  type="button"
                  className={cn(
                    'rounded px-3 py-1 text-xs font-medium',
                    discoveryView === view
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted',
                  )}
                  onClick={() => setDiscoveryView(view)}
                >
                  {view === 'lexicon' ? copy.viewLexicon : copy.viewGraph}
                </button>
              ))}
            </div>
          </div>
          {discoveryResult ? (
            <div className="mt-3 grid gap-4">
              <p className="rounded-md border border-dashed border-border p-2 text-xs text-muted-foreground">
                {copy.nonAuthority}
              </p>
              <dl className="grid gap-2 rounded-md border border-border bg-background p-3 text-xs">
                <div className="flex flex-wrap justify-between gap-2">
                  <dt className="text-muted-foreground">discovery_run_id</dt>
                  <dd className="font-mono">
                    {discoveryResult.discoveryRun.discovery_run_id}
                  </dd>
                </div>
                <div className="flex flex-wrap justify-between gap-2">
                  <dt className="text-muted-foreground">
                    {copy.compilationRun}
                  </dt>
                  <dd className="font-mono">
                    {discoveryResult.importResult?.compilation_run
                      ?.knowledge_source_compilation_run_id || 'pending'}
                  </dd>
                </div>
                <div className="flex flex-wrap justify-between gap-2">
                  <dt className="text-muted-foreground">
                    {copy.normalizedArtifact}
                  </dt>
                  <dd className="break-all font-mono">
                    {discoveryResult.ingest?.normalizedDocumentArtifactRef ||
                      '-'}
                  </dd>
                </div>
                <div className="flex flex-wrap justify-between gap-2">
                  <dt className="text-muted-foreground">
                    {copy.compilerProfile}
                  </dt>
                  <dd>
                    {discoveryResult.importResult?.compiler_profile_version ||
                      discoveryResult.importResult?.compilation_run
                        ?.compiler_profile_version ||
                      'knowledge_builder_discovery.v1'}
                  </dd>
                </div>
              </dl>
              <div className="grid gap-3 sm:grid-cols-2">
                <KnowledgeBuilderMetric
                  label={copy.candidateTerms}
                  value={compiledCandidates.length}
                />
                <KnowledgeBuilderMetric
                  label={copy.sourceAnchors}
                  value={compiledAnchorCount}
                />
                <KnowledgeBuilderMetric
                  label={copy.category}
                  value={compiledCategories.length}
                />
                <KnowledgeBuilderMetric
                  label={copy.parsedRows}
                  value={compiledAnchorCount}
                />
              </div>
              {discoveryView === 'lexicon' ? (
                <div className="max-h-[520px] overflow-auto rounded-md border border-border bg-background">
                  <table className="w-full min-w-[720px] text-left text-xs">
                    <thead className="sticky top-0 bg-muted text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">{copy.term}</th>
                        <th className="px-3 py-2 font-medium">
                          {copy.category}
                        </th>
                        <th className="px-3 py-2 font-medium">{copy.state}</th>
                        <th className="px-3 py-2 font-medium">
                          {copy.sourceAnchors}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {compiledCandidates.slice(0, 200).map((candidate) => (
                        <tr
                          key={candidate.rule_candidate_id}
                          className="border-t border-border"
                        >
                          <td className="px-3 py-2 font-medium">
                            {candidate.applicability_scope?.match_terms?.[0] ||
                              candidate.applicability_scope?.normalized_term ||
                              '-'}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {candidate.applicability_scope?.term_category ||
                              '-'}
                          </td>
                          <td className="px-3 py-2">
                            {candidate.candidate_state || 'PROPOSED'}
                          </td>
                          <td className="max-w-[260px] truncate px-3 py-2 font-mono text-muted-foreground">
                            {candidate.source_anchor_refs?.[0] || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="grid gap-3">
                  {compiledCategories.slice(0, 12).map((category) => {
                    const terms = compiledCandidates.filter(
                      (candidate) =>
                        candidate.applicability_scope?.term_category ===
                        category,
                    )
                    return (
                      <div
                        key={category}
                        className="rounded-md border border-border bg-background p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-semibold">
                            {category}
                          </span>
                          <span className="rounded-full bg-muted px-2 py-1 text-xs">
                            {terms.length}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {terms.slice(0, 24).map((candidate) => (
                            <span
                              key={candidate.rule_candidate_id}
                              className="rounded border border-border bg-card px-2 py-1 text-xs"
                            >
                              {candidate.applicability_scope
                                ?.match_terms?.[0] ||
                                candidate.applicability_scope
                                  ?.normalized_term ||
                                '-'}
                            </span>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              <div className="rounded-md border border-border bg-background p-3">
                <h3 className="text-sm font-semibold">{copy.canonicalTerm}</h3>
                <label
                  className="mt-3 block text-xs font-medium"
                  htmlFor="kb-canonical-label"
                >
                  {copy.canonicalLabel}
                </label>
                <input
                  id="kb-canonical-label"
                  className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-xs outline-none focus:border-primary"
                  value={canonicalLabel}
                  onChange={(event) => setCanonicalLabel(event.target.value)}
                />
                <label
                  className="mt-3 block text-xs font-medium"
                  htmlFor="kb-definition"
                >
                  {copy.definition}
                </label>
                <textarea
                  id="kb-definition"
                  className="mt-1 min-h-20 w-full rounded-md border border-border bg-card p-3 text-xs outline-none focus:border-primary"
                  value={definition}
                  onChange={(event) => setDefinition(event.target.value)}
                />
                <label
                  className="mt-3 block text-xs font-medium"
                  htmlFor="kb-aliases"
                >
                  {copy.aliases}
                </label>
                <input
                  id="kb-aliases"
                  className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-xs outline-none focus:border-primary"
                  value={aliases}
                  onChange={(event) => setAliases(event.target.value)}
                />
                <button
                  type="button"
                  className="mt-3 rounded-button bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:scale-105 hover:bg-primary/90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={
                    !runId || !canonicalLabel.trim() || termMutation.isPending
                  }
                  onClick={() => termMutation.mutate()}
                >
                  {copy.promoteTerm}
                </button>
                <p className="mt-2 text-xs text-muted-foreground">
                  {copy.nonAuthority}
                </p>
                {curationMessage ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {curationMessage}
                  </p>
                ) : null}
              </div>
              <div className="rounded-md border border-border bg-background p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">
                    {copy.importedLexiconCandidates}
                  </h3>
                  <span className="rounded-full bg-muted px-2 py-1 text-xs">
                    {copy.nonAuthority}
                  </span>
                </div>
                {importedLexiconCandidates.length ? (
                  <div className="mt-3 grid gap-2">
                    {importedLexiconCandidates.slice(0, 8).map((candidate) => (
                      <div
                        key={candidate.ruleCandidateId}
                        className="rounded-md border border-border bg-card p-3 text-xs"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-medium">
                            {String(
                              candidate.applicabilityScope?.normalized_term ||
                                candidate.draftRuleText ||
                                candidate.ruleCandidateId,
                            )}
                          </span>
                          <span className="rounded-full bg-muted px-2 py-1">
                            {candidate.candidateState}
                          </span>
                        </div>
                        <p className="mt-2 text-muted-foreground">
                          {candidate.extractedRationale}
                        </p>
                        <div className="mt-2 grid gap-1 text-muted-foreground">
                          <span>
                            {copy.compilerProfile}:{' '}
                            {String(
                              candidate.applicabilityScope
                                ?.compiler_profile_version || 'n/a',
                            )}
                          </span>
                          <span className="break-all">
                            {copy.sourceAnchors}:{' '}
                            {candidate.sourceAnchorRefs.length
                              ? candidate.sourceAnchorRefs.join(', ')
                              : 'n/a'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-muted-foreground">
                    {copy.importedLexiconEmpty}
                  </p>
                )}
              </div>
              <div className="rounded-md border border-border bg-background p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">
                    {copy.evaluationLab}
                  </h3>
                  <span className="rounded-full bg-muted px-2 py-1 text-xs">
                    {copy.nonAuthority}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-button border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!runId || evaluationDatasetMutation.isPending}
                    onClick={() => evaluationDatasetMutation.mutate()}
                  >
                    {copy.addEvaluationExamples}
                  </button>
                  <button
                    type="button"
                    className="rounded-button bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:scale-105 hover:bg-primary/90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={
                      !evaluationDataset ||
                      !runId ||
                      evaluationRunMutation.isPending
                    }
                    onClick={() => evaluationRunMutation.mutate()}
                  >
                    {copy.runEvaluation}
                  </button>
                </div>
                {evaluationDataset ? (
                  <div className="mt-3 grid gap-2">
                    {evaluationDataset.examples.map((example) => (
                      <div
                        key={example.evaluation_example_id}
                        className="rounded-md border border-border bg-card p-2 text-xs"
                      >
                        <span className="font-medium">{example.case_type}</span>
                        <span className="ml-2 text-muted-foreground">
                          {example.expected_outcome}
                        </span>
                        <p className="mt-1 text-muted-foreground">
                          {example.input_text}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
                {evaluationRun ? (
                  <div className="mt-4 grid gap-3">
                    <div>
                      <h4 className="text-xs font-semibold">
                        {copy.activationGate}
                      </h4>
                      <div className="mt-2 grid gap-2 sm:grid-cols-3">
                        {Object.entries(evaluationRun.metrics).map(
                          ([key, value]) => (
                            <KnowledgeBuilderMetric
                              key={key}
                              label={key}
                              value={Number(value)}
                            />
                          ),
                        )}
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {evaluationRun.authority_notice}
                      </p>
                    </div>
                    <div className="grid gap-2">
                      <h4 className="text-xs font-semibold">
                        {copy.expectedActual}
                      </h4>
                      {evaluationRun.results.map((result) => (
                        <div
                          key={result.evaluation_result_id}
                          className="rounded-md border border-border bg-card p-2 text-xs"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span>
                              {result.expected_outcome} /{' '}
                              {result.actual_outcome}
                            </span>
                            <span className="text-muted-foreground">
                              AI: {result.ai_assisted_rating}
                              {result.human_rating
                                ? ` · human: ${result.human_rating}`
                                : ''}
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="rounded-button border border-border bg-background px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                              disabled={ratingMutation.isPending}
                              onClick={() =>
                                ratingMutation.mutate({
                                  resultId: result.evaluation_result_id,
                                  humanRating: 'pass',
                                  explanationAcceptance: 'accepted',
                                })
                              }
                            >
                              {copy.ratePass}
                            </button>
                            <button
                              type="button"
                              className="rounded-button border border-border bg-background px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                              disabled={ratingMutation.isPending}
                              onClick={() =>
                                ratingMutation.mutate({
                                  resultId: result.evaluation_result_id,
                                  humanRating: 'fail',
                                  explanationAcceptance: 'rejected',
                                })
                              }
                            >
                              {copy.rateFail}
                            </button>
                            <button
                              type="button"
                              className="rounded-button border border-border bg-background px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                              disabled={ratingMutation.isPending}
                              onClick={() =>
                                ratingMutation.mutate({
                                  resultId: result.evaluation_result_id,
                                  humanRating: 'needs_review',
                                  explanationAcceptance: 'needs_review',
                                })
                              }
                            >
                              {copy.rateReview}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="rounded-md border border-border bg-background p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">
                    {copy.feedbackDeltas}
                  </h3>
                  <button
                    type="button"
                    className="rounded-button border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={feedbackDeltasQuery.isFetching}
                    onClick={() => void feedbackDeltasQuery.refetch()}
                  >
                    {copy.loadFeedbackDeltas}
                  </button>
                </div>
                {feedbackDeltasQuery.data?.length ? (
                  <div className="mt-3 grid gap-3">
                    <div className="rounded-md border border-dashed border-border bg-card p-3">
                      <h4 className="text-xs font-semibold">
                        {copy.runtimeFeedbackMetrics}
                      </h4>
                      <div className="mt-2 grid gap-2 sm:grid-cols-5">
                        <KnowledgeBuilderMetric
                          label={copy.totalFeedback}
                          value={runtimeFeedbackMetrics.total}
                        />
                        <KnowledgeBuilderMetric
                          label={copy.queuedForEvaluation}
                          value={runtimeFeedbackMetrics.queued}
                        />
                        <KnowledgeBuilderMetric
                          label={copy.feedbackCaptureRate}
                          value={runtimeFeedbackMetrics.captureRate}
                        />
                        <KnowledgeBuilderMetric
                          label={copy.typeOneError}
                          value={runtimeFeedbackMetrics.typeOneErrorRate}
                        />
                        <KnowledgeBuilderMetric
                          label={copy.typeTwoError}
                          value={runtimeFeedbackMetrics.typeTwoErrorRate}
                        />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      {feedbackDeltasQuery.data.map((delta) => (
                        <div
                          key={delta.candidate_delta_id}
                          className="rounded-md border border-border bg-card p-2 text-xs"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-medium">
                              {delta.feedback_type || delta.delta_kind}
                            </span>
                            <span className="text-muted-foreground">
                              {delta.governance_state}
                            </span>
                          </div>
                          <p className="mt-1 text-muted-foreground">
                            {delta.discovery_run_id} · {delta.delta_kind} ·{' '}
                            {String(
                              delta.evaluation_routing?.route_to ||
                                'evaluation',
                            )}
                          </p>
                          <button
                            type="button"
                            className="mt-2 rounded-button border border-border bg-background px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                            onClick={() => setRunId(delta.discovery_run_id)}
                          >
                            {copy.runEvaluation}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-muted-foreground">
                    {copy.noFeedbackDeltas}
                  </p>
                )}
              </div>
              <div className="rounded-md border border-border bg-background p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">
                    {copy.governanceQueue}
                  </h3>
                  <span className="rounded-full bg-muted px-2 py-1 text-xs">
                    {authorityVersion?.authority_state || copy.nonAuthority}
                  </span>
                </div>
                <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
                  <p>
                    {copy.lineage}: {termCandidateId || 'term pending'} ·{' '}
                    {relationCandidateId || 'relation pending'} ·{' '}
                    {evaluationRun?.evaluation_run_id || 'evaluation pending'}
                  </p>
                  {authorityVersion ? (
                    <p>
                      {copy.activationStatus}:{' '}
                      {authorityVersion.authority_version_id} ·{' '}
                      {authorityVersion.approved_by} ·{' '}
                      {authorityVersion.activated_by}
                    </p>
                  ) : null}
                  {readModelRebuild ? (
                    <p>
                      {copy.readModelStatus}: {readModelRebuild.rebuild_status}{' '}
                      · {readModelRebuild.rebuild_id}
                    </p>
                  ) : null}
                  {readModelRebuild?.non_authoritative_notice ? (
                    <p>{readModelRebuild.non_authoritative_notice}</p>
                  ) : null}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-button bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:scale-105 hover:bg-primary/90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={
                      !termCandidateId ||
                      !relationCandidateId ||
                      !evaluationRun ||
                      promotionMutation.isPending
                    }
                    onClick={() => promotionMutation.mutate()}
                  >
                    {copy.promoteRuntimeAuthority}
                  </button>
                  <button
                    type="button"
                    className="rounded-button border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!authorityVersion || rebuildMutation.isPending}
                    onClick={() => rebuildMutation.mutate()}
                  >
                    {copy.rebuildReadModel}
                  </button>
                </div>
              </div>
              <aside className="rounded-md border border-border bg-background p-3">
                <h3 className="text-sm font-semibold">{copy.explanation}</h3>
                {selectedNode ? (
                  <div className="mt-2 text-xs text-muted-foreground">
                    <p>{selectedNode.evidence_summary}</p>
                    <p className="mt-2">{copy.nonAuthority}</p>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {copy.evidence}
                  </p>
                )}
              </aside>
            </div>
          ) : (
            <EmptyState label={copy.empty} />
          )}
        </section>
      </main>
    </div>
  )
}

function KnowledgeBuilderMetric({
  label,
  value,
}: {
  label: string
  value: number
}) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  )
}

function TenderFindingCard({
  finding,
  runId,
  copy,
  onDisposition,
  onFeedback,
}: {
  finding: TenderDetectionFinding
  runId: string
  copy: TenderReviewCopy
  onDisposition: (disposition: 'accepted' | 'rejected' | 'edited') => void
  onFeedback: (
    feedbackType:
      | 'false_positive'
      | 'false_negative'
      | 'ambiguity'
      | 'weak_explanation',
    escalationOutcome: 'not_escalated' | 'escalated',
  ) => void
}) {
  return (
    <article className="rounded-md border border-border bg-background p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">{finding.issue_type}</h3>
          <p className="text-xs text-muted-foreground">
            {runId} · {finding.severity} ·{' '}
            {Math.round(finding.confidence * 100)}%
          </p>
        </div>
        {finding.escalation_flag ? (
          <span className="rounded-full bg-amber-500/10 px-2 py-1 text-xs text-amber-700">
            escalation
          </span>
        ) : null}
      </div>
      <p className="mt-3 rounded bg-muted p-2 text-sm">
        {finding.matched_text}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        {finding.judgment_basis}
      </p>
      {finding.suggested_replacement ? (
        <div className="mt-3 rounded-md border border-dashed border-border p-2 text-xs">
          <div className="font-medium">{copy.aiSuggestion}</div>
          <p className="mt-1 text-muted-foreground">
            {finding.suggested_replacement}
          </p>
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-button border border-border bg-background px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          onClick={() => onDisposition('accepted')}
        >
          {copy.accept}
        </button>
        <button
          type="button"
          className="rounded-button border border-border bg-background px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          onClick={() => onDisposition('rejected')}
        >
          {copy.reject}
        </button>
        <button
          type="button"
          className="rounded-button border border-border bg-background px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          onClick={() => onDisposition('edited')}
        >
          {copy.edit}
        </button>
        <button
          type="button"
          className="rounded-button border border-border bg-background px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          onClick={() => onFeedback('false_positive', 'not_escalated')}
        >
          {copy.falsePositive}
        </button>
        <button
          type="button"
          className="rounded-button border border-border bg-background px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          onClick={() => onFeedback('false_negative', 'not_escalated')}
        >
          {copy.falseNegative}
        </button>
        <button
          type="button"
          className="rounded-button border border-border bg-background px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          onClick={() => onFeedback('ambiguity', 'not_escalated')}
        >
          {copy.ambiguous}
        </button>
        <button
          type="button"
          className="rounded-button border border-border bg-background px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          onClick={() => onFeedback('weak_explanation', 'escalated')}
        >
          {copy.escalate}
        </button>
      </div>
    </article>
  )
}

function PolicyRuleCandidateCard({
  candidate,
  copy,
}: {
  candidate: PolicyRuleCandidate
  copy: PolicyRuleCopy
}) {
  const nonAuthority =
    candidate.candidateState === 'DRAFT' ||
    candidate.candidateState === 'PROPOSED' ||
    !candidate.isRuntimeAuthority
  return (
    <article className="rounded-md border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-sm font-semibold">
              {candidate.ruleCandidateId}
            </h2>
            <Badge>{candidate.ruleFamily}</Badge>
            <Badge>{candidate.candidateState}</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {nonAuthority
              ? candidate.nonAuthorityReason || copy.nonAuthority
              : copy.runtimeAuthority}
          </p>
        </div>
        <Badge>
          {nonAuthority ? copy.nonAuthority : copy.runtimeAuthority}
        </Badge>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <InspectorPanel title={copy.aiText}>
          <p className="text-sm text-foreground">{candidate.draftRuleText}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {candidate.extractedRationale}
          </p>
        </InspectorPanel>
        <InspectorPanel title={copy.review}>
          <Fact
            label={copy.humanEdits}
            value={String(candidate.humanEdits.length)}
          />
          <Fact
            label={copy.approvalEvidence}
            value={JSON.stringify(candidate.approvalEvidence)}
          />
          <Fact
            label={copy.testEvidence}
            value={JSON.stringify(candidate.testEvidence)}
          />
        </InspectorPanel>
        <InspectorPanel title={copy.evidence}>
          <Fact
            label={copy.sourceAnchors}
            value={candidate.sourceAnchorRefs.join(', ') || '-'}
          />
          <Fact
            label={copy.applicability}
            value={JSON.stringify(candidate.applicabilityScope)}
          />
        </InspectorPanel>
        <InspectorPanel title={copy.uncertainty}>
          <Fact label={copy.confidence} value={percent(candidate.confidence)} />
          <Fact
            label={copy.uncertainty}
            value={candidate.uncertaintyNotes || '-'}
          />
        </InspectorPanel>
      </div>
    </article>
  )
}

function DatasetGovernanceRowView({
  row,
  copy,
  onPreferenceChange,
}: {
  row: DatasetGovernanceRow
  copy: DatasetCopy
  onPreferenceChange: (
    dimension: DatasetPreferenceDimension,
    enabled: boolean,
  ) => void
}) {
  const authorityLabel =
    row.effectiveAuthorityStatus === 'binding_effective'
      ? copy.locked
      : copy.optional
  return (
    <div className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(180px,1.4fr)_minmax(120px,0.8fr)_minmax(220px,1fr)_minmax(180px,0.8fr)] md:items-center">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <HugeiconsIcon icon={Database01Icon} size={15} strokeWidth={1.6} />
          <span className="truncate">
            {row.datasetKey || row.datasetVersionId || row.activationId}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
          <Badge>{row.sourceKind}</Badge>
          <Badge>{row.semanticTier}</Badge>
          <Badge>{row.lifecycleStatus}</Badge>
        </div>
        <dl className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4 md:hidden">
          <DatasetMeta label={copy.role} value={row.datasetUsageRole} />
          <DatasetMeta label={copy.type} value={row.datasetType} />
          <DatasetMeta label={copy.version} value={row.sourceVersionId} />
          <DatasetMeta label={copy.actor} value={row.lastActivationActor} />
        </dl>
      </div>
      <div>
        <Badge>{authorityLabel}</Badge>
        <div className="mt-1 text-xs text-muted-foreground">
          {row.effectiveAuthorityStatus}
        </div>
      </div>
      <div className="grid gap-2 text-sm">
        <DatasetSwitch
          label={copy.retrieval}
          checked={row.retrievalEnabled}
          disabled={!row.retrievalToggleVisible || row.locked}
          onCheckedChange={(enabled) => {
            onPreferenceChange('retrievalEnabled', enabled)
          }}
        />
        <DatasetSwitch
          label={copy.prompt}
          checked={row.promptContextEnabled}
          disabled={!row.promptContextToggleVisible || row.locked}
          onCheckedChange={(enabled) => {
            onPreferenceChange('promptContextEnabled', enabled)
          }}
        />
        <DatasetSwitch
          label={copy.query}
          checked={row.queryContextEnabled}
          disabled={!row.queryContextToggleVisible || row.locked}
          onCheckedChange={(enabled) => {
            onPreferenceChange('queryContextEnabled', enabled)
          }}
        />
      </div>
      <div className="min-w-0 text-xs text-muted-foreground">
        <div>
          {copy.policyVersion}: <code>{row.userContextControlLevel}</code>
        </div>
        <div className="mt-1 truncate">
          {copy.activationHash}: <code>{shortRef(row.auditHash)}</code>
        </div>
        <div className="mt-1 hidden md:block">
          {copy.role}: {row.datasetUsageRole}
        </div>
      </div>
    </div>
  )
}

function DatasetSwitch({
  label,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string
  checked: boolean
  disabled: boolean
  onCheckedChange: (enabled: boolean) => void
}) {
  return (
    <label className="flex min-h-7 items-center justify-between gap-3 rounded-md border border-border px-2 py-1 text-xs">
      <span className="truncate">{label}</span>
      <Switch
        checked={checked}
        disabled={disabled}
        aria-label={label}
        onCheckedChange={onCheckedChange}
      />
    </label>
  )
}

function DatasetMeta({
  label,
  value,
}: {
  label: string
  value?: string | null
}) {
  return (
    <div>
      <dt className="font-semibold text-foreground">{label}</dt>
      <dd className="truncate">{value || '-'}</dd>
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
      <div className="text-sm font-semibold">
        {metricValue(value, fallback)}
      </div>
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

function InspectorPanelWithMargin({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className="mt-4">
      <InspectorPanel title={title}>{children}</InspectorPanel>
    </div>
  )
}

function ImpactSummary({
  impact,
  copy,
}: {
  impact?: LegalCandidateImpact
  copy: LegalCopy
}) {
  if (!impact?.candidate && !impact?.impact_report_ref) {
    return <EmptyState label={copy.noChangeCandidates} />
  }
  return (
    <>
      <Fact
        label={copy.impactPosture}
        value={impact.posture}
        fallback={copy.notRecorded}
      />
      <Fact
        label={copy.impactReport}
        value={shortRef(impact.impact_report_ref, copy.notRecorded)}
        fallback={copy.notRecorded}
      />
      <Fact
        label={copy.dependencies}
        value={String(impact.dependencies?.length ?? 0)}
        fallback={copy.notRecorded}
      />
      <Fact
        label={copy.authorityEdges}
        value={String(impact.authority_edges?.length ?? 0)}
        fallback={copy.notRecorded}
      />
    </>
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
        {copy.recordLabel}{' '}
        {shortRef(evidenceExport.record_hash, copy.notRecorded)}
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
