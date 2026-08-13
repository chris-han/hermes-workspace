import { useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { usePageTitle } from '@/hooks/use-page-title'
import { useSettingsStore } from '@/hooks/use-settings'
import { Tabs, TabsList, TabsPanel, TabsTab } from '@/components/ui/tabs'
import {
  deriveUiState,
  knowledgeEvidenceLink,
  launchBenchmark,
  listBenchmarkOrchestrations,
  listKnowledgeBenchmarkCases,
  listKnowledgeBenchmarkChallengeSlices,
  providerRoleLabel,
  type BenchmarkOrchestration,
  type EvaluationLayer,
  type ExecutionMode,
  type KnowledgeBenchmarkCase,
  type KnowledgeBenchmarkChallengeSlice,
  type ProviderId,
  type UiState,
} from '@/server/knowledge-evaluation'

export const Route = createFileRoute('/evaluation')({ ssr: false, component: EvaluationRoute })

const copy = {
  en: {
    title: 'Knowledge Evaluation',
    subtitle: 'Pinned, reproducible evidence across extraction, graph, and reasoning.',
    launch: 'Queue evaluation',
    empty: 'No evaluation runs yet.',
    unavailable: 'Evaluation service unavailable',
    unofficial: 'Recorded and in-memory runs are diagnostic only and cannot produce official certification.',
    evidence: 'Open governed evidence',
    loading: 'Loading evaluation runs…',
    casesHeading: 'Cases',
    challengeHeading: 'Challenge slices',
    baseline: 'Baseline',
    challenger: 'Challenger',
    compatibility: 'Compatibility',
    recorded: 'Recorded',
    inMemory: 'In-memory',
    real: 'Real',
    stale: 'Stale',
    invalid: 'Invalid',
    notEvaluable: 'Not evaluable',
    pending: 'pending',
  },
  zh: {
    title: '知识评估',
    subtitle: '跨抽取、图谱与推理的固定版本可复现证据。',
    launch: '排队评估',
    empty: '暂无评估运行。',
    unavailable: '评估服务不可用',
    unofficial: '录制与内存运行仅用于诊断，不能生成正式认证。',
    evidence: '打开治理证据',
    loading: '正在加载评估运行…',
    casesHeading: '案例',
    challengeHeading: '挑战切片',
    baseline: '基线',
    challenger: '挑战者',
    compatibility: '兼容',
    recorded: '录制',
    inMemory: '内存',
    real: '真实',
    stale: '过期',
    invalid: '无效',
    notEvaluable: '不可评估',
    pending: '待定',
  },
} as const

const tabs = ['overview', 'extraction', 'graph', 'reasoning', 'cases'] as const

function EvaluationRoute() {
  const locale = useSettingsStore((state) => state.settings.locale)
  const c = locale === 'zh' ? copy.zh : copy.en
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<ExecutionMode>('recorded')
  const [layers, setLayers] = useState<Array<EvaluationLayer>>(['extraction', 'graph', 'reasoning'])
  usePageTitle(c.title)
  const runs = useQuery({ queryKey: ['knowledge-evaluation', 'runs'], queryFn: listBenchmarkOrchestrations, refetchInterval: 10_000 })
  const launch = useMutation({
    mutationFn: () => launchBenchmark({ profileId: 'phase1-default', profileVersion: '1', executionMode: mode, layers }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['knowledge-evaluation', 'runs'] }),
  })
  const selected = runs.data?.[0]
  return (
    <main className="h-full overflow-auto bg-background text-foreground" lang={locale === 'zh' ? 'zh-CN' : 'en'}>
      <div className="mx-auto max-w-[1200px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Evaluation control plane</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{c.title}</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">{c.subtitle}</p></div>
          <div className="flex flex-wrap items-center gap-2">
            <select aria-label="Execution mode" value={mode} onChange={(event) => setMode(event.target.value as ExecutionMode)} className="rounded-md border border-border bg-card px-3 py-2 text-sm"><option value="real">{c.real}</option><option value="recorded">{c.recorded}</option><option value="in_memory">{c.inMemory}</option></select>
            <button disabled={launch.isPending || layers.length === 0} onClick={() => launch.mutate()} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">{c.launch}</button>
          </div>
        </header>
        {mode !== 'real' && <div role="status" className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">{c.unofficial}</div>}
        <section aria-label="Layer selection" className="flex flex-wrap gap-2">{(['extraction', 'graph', 'reasoning'] as const).map((layer) => <button key={layer} aria-pressed={layers.includes(layer)} onClick={() => setLayers((current) => current.includes(layer) ? current.filter((item) => item !== layer) : [...current, layer])} className={`rounded-full border px-3 py-1.5 text-xs font-medium ${layers.includes(layer) ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}>{layer}</button>)}</section>
        {runs.isLoading ? <p className="text-sm text-muted-foreground">{c.loading}</p> : runs.isError ? <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-4"><p className="font-medium">{c.unavailable}</p><p className="mt-1 text-sm text-muted-foreground">{String(runs.error)}</p><button className="mt-3 text-sm text-primary underline" onClick={() => runs.refetch()}>Retry</button></div> : !selected ? <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">{c.empty}</div> : <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Status" value={selected.operational_status}/><Metric label="Certification" value={selected.child_run_refs.map((run) => run.certification_result || c.pending).join(' · ')}/><Metric label="Profile" value={`${selected.profile_id}@${selected.profile_version}`}/><Metric label="Mode" value={modeBadgeLabel(selected.execution_mode, c)}/></section>
          {selected.stale_reason_code ? <div role="status" className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">{c.stale}: {selected.stale_reason_code}</div> : null}
          <Tabs defaultValue="overview"><TabsList variant="underline" className="justify-start">{tabs.map((tab) => <TabsTab key={tab} value={tab}>{tab[0].toUpperCase() + tab.slice(1)}</TabsTab>)}</TabsList>{tabs.map((tab) => <TabsPanel key={tab} value={tab} className="pt-5"><RunPanel tab={tab} run={selected} locale={locale}/></TabsPanel>)}</Tabs>
        </>}
      </div>
    </main>
  )
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-2 break-words text-sm font-semibold">{value}</p></div> }

function modeBadgeLabel(mode: ExecutionMode, c: (typeof copy)['en']): string {
  if (mode === 'real') return c.real
  if (mode === 'recorded') return c.recorded
  return c.inMemory
}

function RoleBadge({ providerId, c }: { providerId: ProviderId | null | undefined; c: (typeof copy)['en'] }) {
  if (!providerId) return null
  const label = providerRoleLabel(providerId)
  const tone =
    label === c.baseline
      ? 'border-primary/40 bg-primary/10 text-primary'
      : label === c.challenger
        ? 'border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300'
        : label === c.compatibility
          ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
          : 'border-destructive/40 bg-destructive/10 text-destructive'
  return <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${tone}`}>{label}</span>
}

function ModeBadge({ mode, c }: { mode: ExecutionMode; c: (typeof copy)['en'] }) {
  const tone =
    mode === 'real'
      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
      : mode === 'recorded'
        ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
        : 'border-purple-500/40 bg-purple-500/10 text-purple-700 dark:text-purple-300'
  return <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${tone}`}>{modeBadgeLabel(mode, c)}</span>
}

function StateBadge({ state, c }: { state: UiState; c: (typeof copy)['en'] }) {
  const label =
    state === 'loading' ? c.loading
    : state === 'running' ? 'running'
    : state === 'empty' ? 'empty'
    : state === 'partial' ? 'partial'
    : state === 'failed' ? 'failed'
    : state === 'invalid' ? c.invalid
    : state === 'not-evaluable' ? c.notEvaluable
    : state === 'stale' ? c.stale
    : state
  return <span className="rounded-full bg-muted px-2 py-1 text-xs">{label}</span>
}

function RunPanel({ tab, run, locale }: { tab: typeof tabs[number]; run: BenchmarkOrchestration; locale: string }) {
  const c = locale === 'zh' ? copy.zh : copy.en
  const children = tab === 'overview' || tab === 'cases' ? run.child_run_refs : run.child_run_refs.filter((child) => child.layer === tab)
  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-border">
        <div className="grid grid-cols-[1.6fr_1fr_1fr_1fr_1fr] gap-3 border-b border-border bg-muted/30 px-4 py-2 text-xs font-medium text-muted-foreground">
          <span>Run / layer</span>
          <span>State</span>
          <span>Certification</span>
          <span>Mode</span>
          <span>Provider role</span>
        </div>
        {children.map((child) => {
          const uiState = deriveUiState(child)
          return (
            <div key={child.evaluation_run_id} className="grid grid-cols-[1.6fr_1fr_1fr_1fr_1fr] items-center gap-3 border-b border-border px-4 py-4 last:border-0">
              <div>
                <p className="font-medium">{child.layer}</p>
                <p className="mt-1 font-mono text-xs text-muted-foreground">{child.evaluation_run_id}</p>
                {child.stale_reason_code ? <p className="mt-1 text-[10px] text-amber-700 dark:text-amber-300">{c.stale}: {child.stale_reason_code}</p> : null}
              </div>
              <StateBadge state={uiState} c={c} />
              <span className="text-xs font-semibold">{child.certification_result || c.pending}</span>
              <ModeBadge mode={run.execution_mode} c={c} />
              <RoleBadge providerId={child.provider_id ?? null} c={c} />
            </div>
          )
        })}
        <div className="border-t border-border px-4 py-3"><Link to={knowledgeEvidenceLink()} className="text-sm font-medium text-primary hover:underline">{c.evidence} →</Link></div>
      </div>
      {tab === 'cases' ? <CasesPanel run={run} locale={locale}/> : null}
    </div>
  )
}

function CasesPanel({ run, locale }: { run: BenchmarkOrchestration; locale: string }) {
  const c = locale === 'zh' ? copy.zh : copy.en
  const targetChild = run.child_run_refs[0]
  if (!targetChild) {
    return <p className="text-sm text-muted-foreground">{c.empty}</p>
  }
  const cases = useQuery({
    queryKey: ['knowledge-evaluation', 'cases', targetChild.evaluation_run_id],
    queryFn: () => listKnowledgeBenchmarkCases({ evaluationRunId: targetChild.evaluation_run_id }),
    refetchInterval: 10_000,
  })
  const slices = useQuery({
    queryKey: ['knowledge-evaluation', 'challenge-slices', targetChild.evaluation_run_id],
    queryFn: () => listKnowledgeBenchmarkChallengeSlices({ evaluationRunId: targetChild.evaluation_run_id }),
    refetchInterval: 10_000,
  })
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <CaseListSection title={c.casesHeading} cases={cases.data ?? []} loading={cases.isLoading}/>
      <ChallengeSlicesSection slices={slices.data ?? []} loading={slices.isLoading}/>
    </div>
  )
}

function CaseListSection({ title, cases, loading }: { title: string; cases: KnowledgeBenchmarkCase[]; loading: boolean }) {
  if (loading) return <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">{title}: …</div>
  if (!cases.length) return <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">{title}: —</div>
  return (
    <section className="overflow-hidden rounded-xl border border-border">
      <header className="border-b border-border bg-muted/30 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</header>
      <div className="divide-y divide-border">
        {cases.map((kase) => (
          <article key={kase.case_id} className="space-y-2 px-4 py-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono text-xs">{kase.case_id}</p>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase">{kase.status}</span>
            </div>
            <p className="text-xs text-muted-foreground">{kase.layer} · {providerRoleLabel(kase.provider_id ?? null)}</p>
            <p className="text-xs text-muted-foreground">Challenges: {kase.challenge_tags.join(', ') || '—'}</p>
            <p className="text-xs text-muted-foreground">Metrics: {kase.key_metric_contributions.join(', ') || '—'}</p>
            <p className="text-xs text-muted-foreground">Source anchors: {kase.source_anchor_refs.join(', ') || '—'}</p>
            <p className="text-xs text-muted-foreground">Assertions: {kase.assertion_refs.join(', ') || '—'}</p>
            <Link to={knowledgeEvidenceLink(kase.assertion_refs[0])} className="text-xs text-primary hover:underline">Open in Knowledge Base →</Link>
          </article>
        ))}
      </div>
    </section>
  )
}

function ChallengeSlicesSection({ slices, loading }: { slices: KnowledgeBenchmarkChallengeSlice[]; loading: boolean }) {
  if (loading) return <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">…</div>
  if (!slices.length) return <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">—</div>
  return (
    <section className="overflow-hidden rounded-xl border border-border">
      <header className="border-b border-border bg-muted/30 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Challenge slices</header>
      <div className="divide-y divide-border">
        {slices.map((slice) => (
          <article key={slice.challenge_tag} className="space-y-1 px-4 py-3 text-sm">
            <p className="font-medium">{slice.challenge_tag}</p>
            <p className="text-xs text-muted-foreground">base {slice.base_case_count} → included {slice.included_case_count} (excluded {slice.excluded_case_count})</p>
            <p className="text-xs text-muted-foreground">policy: {slice.denominator_policy}</p>
          </article>
        ))}
      </div>
    </section>
  )
}