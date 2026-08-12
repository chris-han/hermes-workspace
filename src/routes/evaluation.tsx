import { useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { usePageTitle } from '@/hooks/use-page-title'
import { useSettingsStore } from '@/hooks/use-settings'
import { Tabs, TabsList, TabsPanel, TabsTab } from '@/components/ui/tabs'
import {
  knowledgeEvidenceLink,
  launchBenchmark,
  listBenchmarkOrchestrations,
  type EvaluationLayer,
} from '@/server/knowledge-evaluation'

export const Route = createFileRoute('/evaluation')({ ssr: false, component: EvaluationRoute })

const copy = {
  en: { title: 'Knowledge Evaluation', subtitle: 'Pinned, reproducible evidence across extraction, graph, and reasoning.', launch: 'Queue evaluation', empty: 'No evaluation runs yet.', unavailable: 'Evaluation service unavailable', unofficial: 'Recorded and in-memory runs are diagnostic only and cannot produce official certification.', evidence: 'Open governed evidence', loading: 'Loading evaluation runs…' },
  zh: { title: '知识评估', subtitle: '跨抽取、图谱与推理的固定版本可复现证据。', launch: '排队评估', empty: '暂无评估运行。', unavailable: '评估服务不可用', unofficial: '录制与内存运行仅用于诊断，不能生成正式认证。', evidence: '打开治理证据', loading: '正在加载评估运行…' },
} as const

const tabs = ['overview', 'extraction', 'graph', 'reasoning', 'cases'] as const

function EvaluationRoute() {
  const locale = useSettingsStore((state) => state.settings.locale)
  const c = locale === 'zh' ? copy.zh : copy.en
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<'real' | 'recorded' | 'in_memory'>('recorded')
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
            <select aria-label="Execution mode" value={mode} onChange={(event) => setMode(event.target.value as typeof mode)} className="rounded-md border border-border bg-card px-3 py-2 text-sm"><option value="real">real</option><option value="recorded">recorded</option><option value="in_memory">in_memory</option></select>
            <button disabled={launch.isPending || layers.length === 0} onClick={() => launch.mutate()} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">{c.launch}</button>
          </div>
        </header>
        {mode !== 'real' && <div role="status" className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">{c.unofficial}</div>}
        <section aria-label="Layer selection" className="flex flex-wrap gap-2">{(['extraction', 'graph', 'reasoning'] as const).map((layer) => <button key={layer} aria-pressed={layers.includes(layer)} onClick={() => setLayers((current) => current.includes(layer) ? current.filter((item) => item !== layer) : [...current, layer])} className={`rounded-full border px-3 py-1.5 text-xs font-medium ${layers.includes(layer) ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}>{layer}</button>)}</section>
        {runs.isLoading ? <p className="text-sm text-muted-foreground">{c.loading}</p> : runs.isError ? <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-4"><p className="font-medium">{c.unavailable}</p><p className="mt-1 text-sm text-muted-foreground">{String(runs.error)}</p><button className="mt-3 text-sm text-primary underline" onClick={() => runs.refetch()}>Retry</button></div> : !selected ? <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">{c.empty}</div> : <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Status" value={selected.operational_status}/><Metric label="Certification" value={selected.child_run_refs.map((run) => run.certification_result || 'pending').join(' · ')}/><Metric label="Profile" value={`${selected.profile_id}@${selected.profile_version}`}/><Metric label="Mode" value={selected.execution_mode}/></section>
          <Tabs defaultValue="overview"><TabsList variant="underline" className="justify-start">{tabs.map((tab) => <TabsTab key={tab} value={tab}>{tab[0].toUpperCase() + tab.slice(1)}</TabsTab>)}</TabsList>{tabs.map((tab) => <TabsPanel key={tab} value={tab} className="pt-5"><RunPanel tab={tab} run={selected}/></TabsPanel>)}</Tabs>
        </>}
      </div>
    </main>
  )
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-2 break-words text-sm font-semibold">{value}</p></div> }

function RunPanel({ tab, run }: { tab: typeof tabs[number]; run: Awaited<ReturnType<typeof listBenchmarkOrchestrations>>[number] }) {
  const children = tab === 'overview' || tab === 'cases' ? run.child_run_refs : run.child_run_refs.filter((child) => child.layer === tab)
  return <div className="overflow-hidden rounded-xl border border-border"><div className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-border bg-muted/30 px-4 py-2 text-xs font-medium text-muted-foreground"><span>Run / layer</span><span>Status</span><span>Certification</span></div>{children.map((child) => <div key={child.evaluation_run_id} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-border px-4 py-4 last:border-0"><div><p className="font-medium">{child.layer}</p><p className="mt-1 font-mono text-xs text-muted-foreground">{child.evaluation_run_id}</p></div><span className="rounded-full bg-muted px-2 py-1 text-xs">{child.operational_status}</span><span className="text-xs font-semibold">{child.certification_result || 'pending'}</span></div>)}<div className="border-t border-border px-4 py-3"><Link to={knowledgeEvidenceLink()} className="text-sm font-medium text-primary hover:underline">Open governed evidence →</Link></div></div>
}
