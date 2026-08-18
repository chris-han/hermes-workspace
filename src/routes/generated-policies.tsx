import { Input } from '@/components/ui/input'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  CheckListIcon,
  File01Icon,
  RefreshIcon,
  ShieldKeyIcon,
  Tick02Icon,
} from '@hugeicons/core-free-icons'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DialogContent,
  DialogDescription,
  DialogRoot,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsPanel, TabsTab } from '@/components/ui/tabs'
import { usePageTitle } from '@/hooks/use-page-title'
import { useSettingsStore } from '@/hooks/use-settings'
import { cn } from '@/lib/utils'

type Locale = 'en' | 'zh'
type Tab = 'drafts' | 'queue' | 'active'

type GeneratedPolicySummary = {
  candidate_id?: string
  policy_family?: string
  model_id?: string
  model_version?: string
  ontology_table_hash?: string
  jdm_artifact_hash?: string
  schema_validation_status?: string | null
  runtime_validation_status?: string | null
  candidate_status?: string
  authority_badge?: string
  activation_state?: string
  created_at?: string | null
  proposed_by?: string | null
}

type GeneratedPolicyDetail = GeneratedPolicySummary & {
  artifact_refs?: Record<string, string | null | undefined>
  validation?: {
    schema_validation?: Record<string, unknown> | null
    runtime_validation?: Record<string, unknown> | null
  }
  promotion_controls?: {
    submit_for_promotion?: boolean
    approve?: boolean
    activate?: boolean
    request_changes?: boolean
    reject?: boolean
  }
  promotion_events?: Array<Record<string, unknown>>
  decision_graph?: {
    nodes?: Array<{ id?: string; kind?: string; status?: string }>
    lineage_ref?: string | null
  }
  policy_diff?: {
    comparison?: string
    added_rules?: number
    changed_rules?: number
    removed_rules?: number
  }
}

type PromotionQueueItem = {
  candidate_id?: string
  policy_family?: string
  proposed_version?: string
  requesting_actor?: string | null
  source_workspace_id?: string | null
  semantic_tier?: string | null
  current_promotion_state?: string
  validation_status?: {
    schema?: string | null
    editor_conformance?: string | null
    runtime?: string | null
    fixture_count?: number | null
  }
  activation_ready?: boolean
}

type InstitutionalPolicy = {
  policy_family?: string
  active_model_version?: string
  model_artifact_ref?: string
  model_hash?: string
  ontology_table_hash?: string | null
  activation_event_id?: string | null
  loader_layout?: string
  authority_badge?: string
  history?: Array<Record<string, unknown>>
}

type GeneratedPoliciesResponse = {
  status?: string
  error_code?: string
  authority_invariant?: string
  generated_policies?: Array<GeneratedPolicySummary>
}

type GeneratedPolicyResponse = {
  status?: string
  error_code?: string
  generated_policy?: GeneratedPolicyDetail
}

type PromotionQueueResponse = {
  status?: string
  error_code?: string
  approval_activation_separation?: string
  promotion_queue?: Array<PromotionQueueItem>
}

type InstitutionalPolicyResponse = {
  status?: string
  error_code?: string
  institutional_policy?: InstitutionalPolicy
}

const COPY = {
  en: {
    title: 'Generated Policies',
    subtitle: 'Workspace drafts, promotion review, and active policy state',
    drafts: 'Workspace Drafts',
    queue: 'Promotion Queue',
    active: 'Institutional Policy',
    refresh: 'Refresh',
    replay: 'Record replay',
    approve: 'Approve',
    requestChanges: 'Request changes',
    reject: 'Reject',
    submitPromotion: 'Submit for Promotion',
    promotionDialogTitle: 'Submit for Promotion',
    promotionDialogDescription:
      'Freeze this workspace artifact for governed review.',
    targetScope: 'Target scope',
    proposedVersion: 'Proposed version',
    effectiveFrom: 'Effective from',
    changeSummary: 'Change summary',
    riskImpact: 'Risk and impact',
    rollbackStrategy: 'Rollback strategy',
    reviewerRoles: 'Requested reviewer roles',
    institutionalTarget: 'Institutional target',
    cancel: 'Cancel',
    submit: 'Submit',
    overview: 'Overview',
    decisionGraph: 'Decision Graph',
    policyDiff: 'Policy Diff',
    testEvidence: 'Test Evidence',
    lineage: 'Ontology lineage',
    graphStatus: 'Graph status',
    comparison: 'Comparison',
    added: 'Added',
    changed: 'Changed',
    removed: 'Removed',
    eventHistory: 'Promotion events',
    activate: 'Activate',
    rollback: 'Rollback',
    deprecate: 'Deprecate',
    validation: 'Validation',
    artifacts: 'Artifacts',
    emptyDrafts: 'No generated policy drafts are available for this workspace.',
    emptyQueue: 'No executable policy candidates are waiting for review.',
    activeMissing: 'No active institutional policy pointer is available.',
    schema: 'Schema',
    runtime: 'Runtime',
    editor: 'Editor',
    fixtures: 'Fixtures',
    candidate: 'Candidate',
    version: 'Version',
    family: 'Family',
    jdmHash: 'JDM hash',
    ontologyHash: 'Ontology hash',
    authority: 'Authority',
    proposedBy: 'Proposed by',
    created: 'Created',
    modelRef: 'Model ref',
    activationEvent: 'Activation event',
    layout: 'Loader layout',
    history: 'History',
    separation:
      'Approval only authorizes activation review; it does not make a model active.',
    invariant:
      'Workspace drafts and promotion candidates are not runtime authority.',
    loading: 'Loading generated policy state...',
    failed: 'Failed to load generated policy state',
    actionFailed: 'Lifecycle action failed',
    actionDone: 'Lifecycle action recorded',
    details: 'Details',
    rollbackReason: 'Rollback reason',
    deprecationReason: 'Deprecation reason',
  },
  zh: {
    title: '生成策略',
    subtitle: '工作区草稿、提升审核与机构策略状态',
    drafts: '工作区草稿',
    queue: '提升队列',
    active: '机构策略',
    refresh: '刷新',
    replay: '记录回放',
    approve: '批准',
    requestChanges: '要求修改',
    reject: '拒绝',
    submitPromotion: '提交提升',
    promotionDialogTitle: '提交提升',
    promotionDialogDescription: '冻结工作区工件并提交治理审核。',
    targetScope: '目标范围',
    proposedVersion: '提议版本',
    effectiveFrom: '生效时间',
    changeSummary: '变更摘要',
    riskImpact: '风险与影响',
    rollbackStrategy: '回滚策略',
    reviewerRoles: '请求审核角色',
    institutionalTarget: '机构目标',
    cancel: '取消',
    submit: '提交',
    overview: '概览',
    decisionGraph: '决策图',
    policyDiff: '策略差异',
    testEvidence: '测试证据',
    lineage: '本体血缘',
    graphStatus: '图状态',
    comparison: '比较对象',
    added: '新增',
    changed: '变更',
    removed: '移除',
    eventHistory: '提升事件',
    activate: '激活',
    rollback: '回滚',
    deprecate: '废止',
    validation: '验证',
    artifacts: '工件',
    emptyDrafts: '当前工作区暂无生成策略草稿。',
    emptyQueue: '暂无等待审核的可执行策略候选。',
    activeMissing: '暂无有效的机构策略指针。',
    schema: '结构',
    runtime: '运行时',
    editor: '编辑器',
    fixtures: '夹具',
    candidate: '候选',
    version: '版本',
    family: '策略族',
    jdmHash: 'JDM 哈希',
    ontologyHash: '本体哈希',
    authority: '权威状态',
    proposedBy: '提交人',
    created: '创建时间',
    modelRef: '模型引用',
    activationEvent: '激活事件',
    layout: '加载布局',
    history: '历史',
    separation: '批准仅授权激活审核，不会直接使模型生效。',
    invariant: '工作区草稿和提升候选都不是运行时权威。',
    loading: '正在加载生成策略状态...',
    failed: '生成策略状态加载失败',
    actionFailed: '生命周期操作失败',
    actionDone: '生命周期操作已记录',
    details: '详情',
    rollbackReason: '回滚原因',
    deprecationReason: '废止原因',
  },
} as const

export const Route = createFileRoute('/generated-policies')({
  ssr: false,
  component: GeneratedPoliciesRoute,
})

function GeneratedPoliciesRoute() {
  const locale: Locale =
    useSettingsStore((state) => state.settings.locale) === 'zh' ? 'zh' : 'en'
  const copy = COPY[locale]
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>('drafts')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  usePageTitle(copy.title)

  const generatedQuery = useQuery({
    queryKey: ['generated-policies', 'list'],
    queryFn: () =>
      fetchPluginJson<GeneratedPoliciesResponse>('/generated-policies'),
    refetchInterval: 30_000,
  })
  const queueQuery = useQuery({
    queryKey: ['generated-policies', 'queue'],
    queryFn: () => fetchPluginJson<PromotionQueueResponse>('/promotion-queue'),
    refetchInterval: 30_000,
  })
  const activeQuery = useQuery({
    queryKey: ['generated-policies', 'active'],
    queryFn: () =>
      fetchPluginJson<InstitutionalPolicyResponse>(
        '/institutional-policies/tender-sensitive-term-detection-model',
      ),
    retry: false,
    refetchInterval: 30_000,
  })

  const policies = generatedQuery.data?.generated_policies ?? []
  const selectedPolicyId = selectedId ?? policies[0]?.candidate_id ?? null
  const selectedPolicyQuery = useQuery({
    queryKey: ['generated-policies', 'detail', selectedPolicyId],
    queryFn: () =>
      fetchPluginJson<GeneratedPolicyResponse>(
        `/generated-policies/${encodeURIComponent(selectedPolicyId || '')}`,
      ),
    enabled: Boolean(selectedPolicyId),
  })
  const selectedPolicy = selectedPolicyQuery.data?.generated_policy

  const actionMutation = useMutation({
    mutationFn: (action: {
      candidateId: string
      endpoint: string
      payload?: Record<string, unknown>
    }) =>
      fetchPluginJson<Record<string, unknown>>(
        `/generated-policies/${encodeURIComponent(action.candidateId)}/${action.endpoint}`,
        {
          method: 'POST',
          body: JSON.stringify(action.payload ?? {}),
        },
      ),
    onSuccess: async () => {
      setStatusMessage(copy.actionDone)
      await queryClient.invalidateQueries({ queryKey: ['generated-policies'] })
    },
    onError: (error) => {
      setStatusMessage(
        `${copy.actionFailed}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    },
  })
  const policyActionMutation = useMutation({
    mutationFn: (action: {
      endpoint: string
      payload?: Record<string, unknown>
    }) =>
      fetchPluginJson<Record<string, unknown>>(
        `/institutional-policies/tender-sensitive-term-detection-model/${action.endpoint}`,
        {
          method: 'POST',
          body: JSON.stringify(action.payload ?? {}),
        },
      ),
    onSuccess: async () => {
      setStatusMessage(copy.actionDone)
      await queryClient.invalidateQueries({ queryKey: ['generated-policies'] })
    },
    onError: (error) => {
      setStatusMessage(
        `${copy.actionFailed}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    },
  })

  const isLoading =
    generatedQuery.isLoading || queueQuery.isLoading || activeQuery.isLoading
  const loadError =
    generatedQuery.error || queueQuery.error || activeQuery.error || null

  const activePolicy = activeQuery.data?.institutional_policy
  const queue = queueQuery.data?.promotion_queue ?? []
  const invariant =
    generatedQuery.data?.authority_invariant ||
    queueQuery.data?.approval_activation_separation ||
    copy.invariant

  const summary = useMemo(
    () => [
      { label: copy.drafts, value: String(policies.length) },
      { label: copy.queue, value: String(queue.length) },
      {
        label: copy.active,
        value: activePolicy?.active_model_version || 'not active',
      },
    ],
    [
      activePolicy?.active_model_version,
      copy.active,
      copy.drafts,
      copy.queue,
      policies.length,
      queue.length,
    ],
  )

  return (
    <div
      lang={locale === 'zh' ? 'zh-CN' : 'en'}
      className="flex h-full min-h-0 flex-col bg-background text-foreground"
    >
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-normal">
                {copy.title}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {copy.subtitle}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void generatedQuery.refetch()
                void queueQuery.refetch()
                void activeQuery.refetch()
                if (selectedPolicyId) void selectedPolicyQuery.refetch()
              }}
            >
              <HugeiconsIcon icon={RefreshIcon} size={16} />
              {copy.refresh}
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {summary.map((item) => (
              <div
                key={item.label}
                className="rounded-md border border-border bg-card px-3 py-2"
              >
                <div className="text-xs text-muted-foreground">
                  {item.label}
                </div>
                <div className="mt-1 truncate text-sm font-semibold">
                  {item.value}
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            {invariant}
          </div>
          {statusMessage ? (
            <div className="rounded-md border border-border bg-card px-3 py-2 text-xs">
              {statusMessage}
            </div>
          ) : null}
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto grid w-full max-w-[1280px] gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
            <TabsList variant="underline" className="justify-start">
              <TabsTab value="drafts">{copy.drafts}</TabsTab>
              <TabsTab value="queue">{copy.queue}</TabsTab>
              <TabsTab value="active">{copy.active}</TabsTab>
            </TabsList>

            {isLoading ? (
              <div className="rounded-md border border-border bg-card p-4 text-sm text-muted-foreground">
                {copy.loading}
              </div>
            ) : loadError ? (
              <div className="rounded-md border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
                {copy.failed}
              </div>
            ) : null}

            <TabsPanel value="drafts" className="pt-3">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,420px)]">
                <section className="grid gap-2">
                  {policies.length === 0 ? (
                    <EmptyState text={copy.emptyDrafts} />
                  ) : (
                    policies.map((policy) => (
                      <PolicyRow
                        key={policy.candidate_id}
                        policy={policy}
                        copy={copy}
                        selected={policy.candidate_id === selectedPolicyId}
                        onSelect={() =>
                          setSelectedId(policy.candidate_id || null)
                        }
                      />
                    ))
                  )}
                </section>
                <PolicyDetail
                  policy={selectedPolicy}
                  copy={copy}
                  busy={
                    actionMutation.isPending || selectedPolicyQuery.isFetching
                  }
                  onReplay={(candidateId) =>
                    actionMutation.mutate({
                      candidateId,
                      endpoint: 'replay',
                      payload: { regressions: [], tested_claims: 1 },
                    })
                  }
                  onApprove={(candidateId) =>
                    actionMutation.mutate({
                      candidateId,
                      endpoint: 'approve',
                      payload: { actor_roles: ['policy_reviewer'] },
                    })
                  }
                  onRequestChanges={(candidateId) =>
                    actionMutation.mutate({
                      candidateId,
                      endpoint: 'request-changes',
                      payload: {
                        reason: 'Changes requested from workspace UI',
                      },
                    })
                  }
                  onReject={(candidateId) =>
                    actionMutation.mutate({
                      candidateId,
                      endpoint: 'reject',
                      payload: { reason: 'Rejected from workspace UI' },
                    })
                  }
                  onSubmitPromotion={(candidateId, payload) =>
                    actionMutation.mutate({
                      candidateId,
                      endpoint: 'submit-for-promotion',
                      payload,
                    })
                  }
                />
              </div>
            </TabsPanel>

            <TabsPanel value="queue" className="pt-3">
              <section className="grid gap-2">
                {queue.length === 0 ? (
                  <EmptyState text={copy.emptyQueue} />
                ) : (
                  queue.map((item) => (
                    <QueueRow
                      key={item.candidate_id}
                      item={item}
                      copy={copy}
                      busy={actionMutation.isPending}
                      onActivate={(candidateId) =>
                        actionMutation.mutate({
                          candidateId,
                          endpoint: 'activate',
                          payload: { actor_roles: ['policy_activator'] },
                        })
                      }
                    />
                  ))
                )}
              </section>
            </TabsPanel>

            <TabsPanel value="active" className="pt-3">
              {activePolicy ? (
                <ActivePolicy
                  policy={activePolicy}
                  copy={copy}
                  busy={policyActionMutation.isPending}
                  onRollback={(version, modelHash) => {
                    const reason =
                      typeof window === 'undefined'
                        ? ''
                        : window.prompt(copy.rollbackReason) || ''
                    if (!reason.trim()) return
                    policyActionMutation.mutate({
                      endpoint: 'rollback',
                      payload: {
                        actor_roles: ['governance_chair'],
                        target_version: version,
                        target_model_hash: modelHash,
                        reason,
                      },
                    })
                  }}
                  onDeprecate={(modelHash) => {
                    const reason =
                      typeof window === 'undefined'
                        ? ''
                        : window.prompt(copy.deprecationReason) || ''
                    if (!reason.trim()) return
                    policyActionMutation.mutate({
                      endpoint: 'deprecate',
                      payload: {
                        actor_roles: ['governance_chair'],
                        expected_model_hash: modelHash,
                        reason,
                      },
                    })
                  }}
                />
              ) : (
                <EmptyState text={copy.activeMissing} />
              )}
            </TabsPanel>
          </Tabs>
        </div>
      </main>
    </div>
  )
}

function PolicyRow({
  policy,
  copy,
  selected,
  onSelect,
}: {
  policy: GeneratedPolicySummary
  copy: (typeof COPY)[Locale]
  selected: boolean
  onSelect: () => void
}) {
  return (
    <Button
      type="button"
      onClick={onSelect}
      className={cn(
        'grid w-full gap-3 rounded-md border bg-card p-3 text-left transition-colors hover:bg-muted/50',
        selected ? 'border-primary bg-primary/10' : 'border-border',
      )}
    >
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">
            {policy.model_id || policy.candidate_id}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {copy.candidate}: {policy.candidate_id || 'unknown'}
          </div>
        </div>
        <StatusBadge value={policy.candidate_status || 'UNKNOWN'} />
      </div>
      <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
        <Meta label={copy.version} value={policy.model_version} />
        <Meta label={copy.authority} value={policy.authority_badge} />
        <Meta label={copy.schema} value={policy.schema_validation_status} />
        <Meta label={copy.runtime} value={policy.runtime_validation_status} />
        <Meta
          label={copy.jdmHash}
          value={shortValue(policy.jdm_artifact_hash)}
        />
        <Meta
          label={copy.ontologyHash}
          value={shortValue(policy.ontology_table_hash)}
        />
      </div>
    </Button>
  )
}

function PolicyDetail({
  policy,
  copy,
  busy,
  onReplay,
  onApprove,
  onRequestChanges,
  onReject,
  onSubmitPromotion,
}: {
  policy?: GeneratedPolicyDetail
  copy: (typeof COPY)[Locale]
  busy: boolean
  onReplay: (candidateId: string) => void
  onApprove: (candidateId: string) => void
  onRequestChanges: (candidateId: string) => void
  onReject: (candidateId: string) => void
  onSubmitPromotion: (
    candidateId: string,
    payload: Record<string, unknown>,
  ) => void
}) {
  const [detailTab, setDetailTab] = useState<
    'overview' | 'graph' | 'diff' | 'evidence'
  >('overview')
  const [promotionOpen, setPromotionOpen] = useState(false)
  const [form, setForm] = useState({
    target_scope: 'workspace',
    proposed_version: '',
    effective_from: '',
    change_summary: '',
    risk_impact: '',
    rollback_strategy: '',
    requested_reviewer_roles: '',
  })
  if (!policy?.candidate_id) {
    return (
      <aside className="rounded-md border border-border bg-card p-4 text-sm text-muted-foreground">
        {copy.details}
      </aside>
    )
  }
  const runtime = policy.validation?.runtime_validation || {}
  const schema = policy.validation?.schema_validation || {}
  const graph = policy.decision_graph || {}
  const diff = policy.policy_diff || {}
  return (
    <aside className="grid gap-3 rounded-md border border-border bg-card p-4">
      <div className="flex items-start gap-2">
        <HugeiconsIcon icon={File01Icon} size={18} />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">
            {policy.model_id || policy.candidate_id}
          </div>
          <div className="text-xs text-muted-foreground">
            {policy.authority_badge}
          </div>
        </div>
      </div>

      <Tabs
        value={detailTab}
        onValueChange={(value) => setDetailTab(value as typeof detailTab)}
      >
        <TabsList
          variant="underline"
          className="w-full justify-start overflow-x-auto"
        >
          <TabsTab value="overview">{copy.overview}</TabsTab>
          <TabsTab value="graph">{copy.decisionGraph}</TabsTab>
          <TabsTab value="diff">{copy.policyDiff}</TabsTab>
          <TabsTab value="evidence">{copy.testEvidence}</TabsTab>
        </TabsList>
        <TabsPanel value="overview" className="grid gap-3 pt-2">
          <div className="grid gap-2 text-xs">
            <Meta label={copy.family} value={policy.policy_family} />
            <Meta label={copy.created} value={policy.created_at} />
            <Meta label={copy.proposedBy} value={policy.proposed_by} />
          </div>
          <SectionTitle icon={Tick02Icon} text={copy.validation} />
          <div className="grid gap-2 text-xs">
            <Meta
              label={copy.schema}
              value={String(schema.status || 'unknown')}
            />
            <Meta
              label={copy.editor}
              value={String(schema.editor_conformance || 'unknown')}
            />
            <Meta
              label={copy.runtime}
              value={String(runtime.status || 'unknown')}
            />
            <Meta
              label={copy.fixtures}
              value={String(runtime.fixture_count || 'unknown')}
            />
          </div>
          <SectionTitle icon={CheckListIcon} text={copy.artifacts} />
          <div className="grid gap-2 text-xs">
            {Object.entries(policy.artifact_refs || {}).map(([key, value]) => (
              <Meta key={key} label={key} value={shortValue(value)} />
            ))}
          </div>
        </TabsPanel>
        <TabsPanel value="graph" className="grid gap-2 pt-2">
          <Meta label={copy.lineage} value={shortValue(graph.lineage_ref)} />
          {(graph.nodes || []).map((node) => (
            <div
              key={node.id}
              className="flex items-center justify-between gap-3 border-b border-border py-2 text-xs"
            >
              <span className="font-medium">
                {node.id || 'unknown'}{' '}
                <span className="text-muted-foreground">
                  ({node.kind || 'node'})
                </span>
              </span>
              <StatusBadge value={node.status || 'unknown'} />
            </div>
          ))}
        </TabsPanel>
        <TabsPanel value="diff" className="grid gap-2 pt-2 text-xs">
          <Meta label={copy.comparison} value={diff.comparison} />
          <div className="grid gap-2 sm:grid-cols-3">
            <Meta label={copy.added} value={diff.added_rules} />
            <Meta label={copy.changed} value={diff.changed_rules} />
            <Meta label={copy.removed} value={diff.removed_rules} />
          </div>
        </TabsPanel>
        <TabsPanel value="evidence" className="grid gap-2 pt-2 text-xs">
          <Meta
            label={copy.schema}
            value={String(schema.status || 'unknown')}
          />
          <Meta
            label={copy.runtime}
            value={`${String(runtime.status || 'unknown')} (${String(runtime.fixture_count || 0)} fixtures)`}
          />
          <Meta
            label={copy.eventHistory}
            value={String(policy.promotion_events?.length || 0)}
          />
          <Meta label={copy.lineage} value={shortValue(graph.lineage_ref)} />
        </TabsPanel>
      </Tabs>

      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => onReplay(policy.candidate_id || '')}
        >
          {copy.replay}
        </Button>
        {policy.promotion_controls?.approve ? (
          <Button
            size="sm"
            disabled={busy}
            onClick={() => onApprove(policy.candidate_id || '')}
          >
            {copy.approve}
          </Button>
        ) : null}
        {policy.promotion_controls?.submit_for_promotion ? (
          <Button
            size="sm"
            disabled={busy}
            onClick={() => setPromotionOpen(true)}
          >
            {copy.submitPromotion}
          </Button>
        ) : null}
        {policy.promotion_controls?.request_changes ? (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => onRequestChanges(policy.candidate_id || '')}
          >
            {copy.requestChanges}
          </Button>
        ) : null}
        {policy.promotion_controls?.reject ? (
          <Button
            size="sm"
            variant="destructive"
            disabled={busy}
            onClick={() => onReject(policy.candidate_id || '')}
          >
            {copy.reject}
          </Button>
        ) : null}
      </div>
      <DialogRoot open={promotionOpen} onOpenChange={setPromotionOpen}>
        <DialogContent className="w-[min(560px,94vw)]">
          <div className="grid gap-4 p-5">
            <div>
              <DialogTitle>{copy.promotionDialogTitle}</DialogTitle>
              <DialogDescription className="mt-1">
                {copy.promotionDialogDescription}
              </DialogDescription>
            </div>
            <form
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault()
                onSubmitPromotion(policy.candidate_id || '', {
                  ...form,
                  requested_reviewer_roles: form.requested_reviewer_roles
                    .split(',')
                    .map((role) => role.trim())
                    .filter(Boolean),
                })
                setPromotionOpen(false)
              }}
            >
              <div className="grid gap-1 text-xs">
                <span className="font-medium">{copy.institutionalTarget}</span>
                <div className="rounded-md border border-border bg-muted/40 px-3 py-2 font-mono text-[11px] break-all">
                  .semantier-home/institutional_policies/Tender_Sensitive_Term_Detection_Model
                </div>
              </div>
              {(
                [
                  'target_scope',
                  'proposed_version',
                  'effective_from',
                  'change_summary',
                  'risk_impact',
                  'rollback_strategy',
                  'requested_reviewer_roles',
                ] as const
              ).map((field) => (
                <label key={field} className="grid gap-1 text-xs font-medium">
                  {
                    copy[
                      field === 'target_scope'
                        ? 'targetScope'
                        : field === 'proposed_version'
                          ? 'proposedVersion'
                          : field === 'effective_from'
                            ? 'effectiveFrom'
                            : field === 'change_summary'
                              ? 'changeSummary'
                              : field === 'risk_impact'
                                ? 'riskImpact'
                                : field === 'rollback_strategy'
                                  ? 'rollbackStrategy'
                                  : 'reviewerRoles'
                    ]
                  }
                  <Input
                    required
                    value={form[field]}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        [field]: event.target.value,
                      }))
                    }
                    className="h-9 rounded-md border border-border bg-background px-2 text-sm font-normal outline-none focus:ring-2 focus:ring-primary"
                  />
                </label>
              ))}
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPromotionOpen(false)}
                >
                  {copy.cancel}
                </Button>
                <Button type="submit">{copy.submit}</Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </DialogRoot>
    </aside>
  )
}

function QueueRow({
  item,
  copy,
  busy,
  onActivate,
}: {
  item: PromotionQueueItem
  copy: (typeof COPY)[Locale]
  busy: boolean
  onActivate: (candidateId: string) => void
}) {
  return (
    <div className="grid gap-3 rounded-md border border-border bg-card p-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <div className="truncate text-sm font-semibold">
            {item.policy_family || item.candidate_id}
          </div>
          <StatusBadge value={item.current_promotion_state || 'UNKNOWN'} />
          {item.activation_ready ? (
            <StatusBadge value="ACTIVATION_READY" />
          ) : null}
        </div>
        <div className="mt-2 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
          <Meta label={copy.candidate} value={item.candidate_id} />
          <Meta label={copy.version} value={item.proposed_version} />
          <Meta label={copy.proposedBy} value={item.requesting_actor} />
          <Meta label={copy.schema} value={item.validation_status?.schema} />
          <Meta
            label={copy.editor}
            value={item.validation_status?.editor_conformance}
          />
          <Meta label={copy.runtime} value={item.validation_status?.runtime} />
          <Meta
            label={copy.fixtures}
            value={String(item.validation_status?.fixture_count || 'unknown')}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">{copy.separation}</span>
        <Button
          size="sm"
          disabled={busy || !item.activation_ready || !item.candidate_id}
          onClick={() => onActivate(item.candidate_id || '')}
        >
          <HugeiconsIcon icon={ShieldKeyIcon} size={16} />
          {copy.activate}
        </Button>
      </div>
    </div>
  )
}

function ActivePolicy({
  policy,
  copy,
  busy,
  onRollback,
  onDeprecate,
}: {
  policy: InstitutionalPolicy
  copy: (typeof COPY)[Locale]
  busy: boolean
  onRollback: (version: string, modelHash: string) => void
  onDeprecate: (modelHash: string) => void
}) {
  const history = Array.isArray(policy.history) ? policy.history : []
  return (
    <section className="grid gap-3 rounded-md border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <HugeiconsIcon icon={ShieldKeyIcon} size={18} />
        <div>
          <div className="text-sm font-semibold">
            {policy.authority_badge || copy.active}
          </div>
          <div className="text-xs text-muted-foreground">
            {policy.policy_family}
          </div>
        </div>
      </div>
      <div className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-3">
        <Meta label={copy.version} value={policy.active_model_version} />
        <Meta
          label={copy.modelRef}
          value={shortValue(policy.model_artifact_ref)}
        />
        <Meta label={copy.jdmHash} value={shortValue(policy.model_hash)} />
        <Meta
          label={copy.ontologyHash}
          value={shortValue(policy.ontology_table_hash)}
        />
        <Meta label={copy.activationEvent} value={policy.activation_event_id} />
        <Meta label={copy.layout} value={policy.loader_layout} />
      </div>
      <div className="flex flex-wrap gap-2 border-t border-border pt-3">
        <Button
          size="sm"
          variant="destructive"
          disabled={busy || !policy.model_hash}
          onClick={() => onDeprecate(policy.model_hash || '')}
        >
          {copy.deprecate}
        </Button>
      </div>
      {history.length > 0 ? (
        <div className="grid gap-2 border-t border-border pt-3">
          <SectionTitle icon={CheckListIcon} text={copy.history} />
          {history
            .slice()
            .reverse()
            .map((item, index) => {
              const version = String(
                item.model_version || item.target_model_version || '',
              )
              const modelHash = String(
                item.model_hash || item.target_model_hash || '',
              )
              const eventType = String(item.event_type || 'ACTIVATION')
              return (
                <div
                  key={`${eventType}-${version}-${index}`}
                  className="grid gap-2 rounded-md border border-border bg-muted/30 p-2 text-xs sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                >
                  <div className="min-w-0">
                    <div className="font-semibold">{eventType}</div>
                    <div className="mt-1 grid gap-1 text-muted-foreground sm:grid-cols-2">
                      <Meta label={copy.version} value={version} />
                      <Meta
                        label={copy.jdmHash}
                        value={shortValue(modelHash)}
                      />
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy || !version || !modelHash}
                    onClick={() => onRollback(version, modelHash)}
                  >
                    {copy.rollback}
                  </Button>
                </div>
              )
            })}
        </div>
      ) : null}
    </section>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
      {text}
    </div>
  )
}

function SectionTitle({
  icon,
  text,
}: {
  icon: typeof CheckListIcon
  text: string
}) {
  return (
    <div className="flex items-center gap-2 border-t border-border pt-3 text-xs font-semibold uppercase text-muted-foreground">
      <HugeiconsIcon icon={icon} size={14} />
      {text}
    </div>
  )
}

function Meta({
  label,
  value,
}: {
  label: string
  value?: string | number | null
}) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-medium text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 truncate font-medium text-foreground">
        {value === undefined || value === null || value === ''
          ? 'unknown'
          : value}
      </div>
    </div>
  )
}

function StatusBadge({ value }: { value: string }) {
  const tone =
    value === 'ACTIVE' || value === 'APPROVED' || value === 'passed'
      ? 'border-success/30 bg-success/10 text-success'
      : value === 'REJECTED' || value === 'failed'
        ? 'border-danger/30 bg-danger/10 text-danger'
        : 'border-border bg-muted text-muted-foreground'
  return (
    <span
      className={cn(
        'inline-flex h-6 max-w-full items-center rounded-md border px-2 text-[11px] font-semibold',
        tone,
      )}
    >
      <span className="truncate">{value}</span>
    </span>
  )
}

async function fetchPluginJson<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(
    `/api/semantier-proxy/api/plugins/tender-sensitive-term-detection-modeling/v1${path}`,
    {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(init?.headers || {}),
      },
    },
  )
  const data = (await response.json()) as T & {
    status?: string
    error_code?: string
  }
  if (!response.ok || data.status === 'error') {
    throw new Error(data.error_code || `HTTP ${response.status}`)
  }
  return data
}

function shortValue(value?: string | null): string {
  if (!value) return 'unknown'
  const normalized = value.replace(/^sha256:/, '')
  if (normalized.length <= 24) return value
  return `${normalized.slice(0, 10)}...${normalized.slice(-8)}`
}
