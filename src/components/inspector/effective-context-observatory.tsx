import { Button } from '@/components/ui/button'

import { useEffect, useMemo, useState } from 'react'

import { useSettingsStore } from '@/hooks/use-settings'

import {
  readObservatoryCache,
  writeObservatoryCache,
} from './inspector-observatory-cache'

type EffectiveContextRef = {
  ref_type?: string
  ref_id?: string
  version_ref?: string | null
  admission_state?: string | null
}

export type EffectiveContextPayload = {
  boundary_cursor?: { event_sequence?: number; checkpoint_id?: string | null }
  checkpoint?: Record<string, unknown> | null
  checkpoints?: Array<Record<string, unknown>>
  verification?: { status?: string; reason?: string }
  closure?: { gaps?: string[]; closed?: boolean }
  branchability?: { status?: string; remediation?: string | null }
  lineage?: Array<Record<string, unknown>>
  diffs?: Array<Record<string, unknown>>
  eval?: unknown
  eval_comparison?: { metric_deltas?: Record<string, number | null>; first_failure_point?: number | null }
  evidence?: Record<string, unknown> & { bundle_hash?: string }
  restored?: {
    knowledge_state?: Record<string, unknown>
    active_contract?: { items?: Array<Record<string, unknown>> }
    authority_pins?: Record<string, unknown>
  } | null
  events?: Array<Record<string, unknown>>
}

export function isCheckpointBranchable(snapshot: EffectiveContextPayload | null): boolean {
  return snapshot?.branchability?.status === 'branchable'
}

export function effectiveContextEvidenceBundle(
  snapshot: EffectiveContextPayload | null,
): Record<string, unknown> {
  return snapshot?.evidence ?? {
    schema: 'effective_context_observatory_evidence.v1',
    status: 'unavailable',
  }
}

function asRefs(value: unknown): EffectiveContextRef[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is EffectiveContextRef => Boolean(item && typeof item === 'object'))
}

function short(value: unknown): string {
  if (typeof value === 'string') return value
  if (value == null) return '—'
  return JSON.stringify(value)
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

export function ContextTab({ sessionKey }: { sessionKey: string | null }) {
  const locale = useSettingsStore((state) => state.settings.locale)
  const zh = locale === 'zh'
  const [snapshot, setSnapshot] = useState<EffectiveContextPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showRawEvents, setShowRawEvents] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    setSnapshot(sessionKey ? readObservatoryCache<EffectiveContextPayload>(sessionKey) : null)
    setError(null)
    if (!sessionKey) return () => controller.abort()
    setLoading(true)
    fetch(`/api/semantier-proxy/api/sessions/${encodeURIComponent(sessionKey)}/effective-context`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`context: HTTP ${response.status}`)
        return response.json() as Promise<EffectiveContextPayload>
      })
      .then((nextSnapshot) => {
        writeObservatoryCache(
          sessionKey,
          nextSnapshot.boundary_cursor?.checkpoint_id ?? null,
          nextSnapshot,
        )
        setSnapshot(nextSnapshot)
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Context unavailable')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [sessionKey])

  const disclosed = useMemo(() => {
    const refs = snapshot?.events?.flatMap((event) => [...asRefs(event.input_refs), ...asRefs(event.output_refs)]) ?? []
    const unique = new Map<string, EffectiveContextRef>()
    refs.forEach((ref) => unique.set(`${ref.ref_type}:${ref.ref_id}:${ref.version_ref ?? ''}`, ref))
    return [...unique.values()]
  }, [snapshot])
  const disclosedByType = useMemo(() => {
    const groups = new Map<string, EffectiveContextRef[]>()
    disclosed.forEach((ref) => {
      const type = ref.ref_type ?? 'unknown'
      groups.set(type, [...(groups.get(type) ?? []), ref])
    })
    return [...groups.entries()]
  }, [disclosed])

  if (!sessionKey) return <div className="p-3 text-xs text-[var(--theme-muted)]">{zh ? '打开一个会话以查看上下文' : 'Open a session to inspect effective context'}</div>
  if (loading) return <div className="p-3 text-xs text-[var(--theme-muted)]">{zh ? '正在加载上下文…' : 'Loading effective context…'}</div>
  if (error) return <div className="m-3 rounded-md p-3 text-xs" style={{ background: 'var(--theme-card2)', color: 'var(--theme-danger)' }}>{error}</div>

  const checkpoint = snapshot?.checkpoint
  const verification = snapshot?.verification
  const requirements = snapshot?.restored?.active_contract?.items ?? []
  const pins = snapshot?.restored?.authority_pins ?? {}
  const historicalProof = pins.historical_admission_proof_ref
  const currentPins = Object.entries(pins).filter(([key]) => key !== 'historical_admission_proof_ref')
  const status = verification?.status ?? 'degraded'
  const branchable = isCheckpointBranchable(snapshot)
  const evalResult = snapshot?.eval ?? snapshot?.restored?.knowledge_state?.eval
  const evalRecord = objectValue(evalResult)
  const roundAccounting = objectValue(evalRecord.harbor_round_accounting)
  const exportEvidence = () => {
    const body = JSON.stringify(effectiveContextEvidenceBundle(snapshot), null, 2)
    const url = URL.createObjectURL(new Blob([body], { type: 'application/json' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `effective-context-${sessionKey}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-3 p-3 text-xs" data-testid="effective-context-observatory">
      <section className="rounded-lg p-3" style={{ background: 'var(--theme-card2)', border: '1px solid var(--theme-border)' }}>
        <div className="flex items-center justify-between gap-2"><strong style={{ color: 'var(--theme-text)' }}>{zh ? '当前检查点' : 'Current checkpoint'}</strong><span className="rounded-full px-2 py-1 font-semibold" style={{ color: status === 'verified' ? 'var(--theme-accent)' : 'var(--theme-danger)', background: 'var(--theme-card)' }}>{status}</span></div>
        <dl className="mt-2 space-y-1" style={{ color: 'var(--theme-muted)' }}>
          <div><dt className="inline">{zh ? '检查点：' : 'Checkpoint: '}</dt><dd className="inline break-all">{short(checkpoint?.checkpoint_id)}</dd></div>
          <div><dt className="inline">{zh ? '哈希：' : 'Hash: '}</dt><dd className="inline break-all">{short(checkpoint?.checkpoint_hash)}</dd></div>
          <div><dt className="inline">{zh ? '边界序列：' : 'Boundary: '}</dt><dd className="inline">{short(snapshot?.boundary_cursor?.event_sequence)}</dd></div>
          <div><dt className="inline">{zh ? '边界消息：' : 'Boundary message: '}</dt><dd className="inline break-all">{short(checkpoint?.boundary_message_id)}</dd></div>
          <div><dt className="inline">{zh ? '父检查点：' : 'Parent checkpoint: '}</dt><dd className="inline break-all">{short(checkpoint?.parent_checkpoint_id)}</dd></div>
          <div><dt className="inline">{zh ? '校验原因：' : 'Verification: '}</dt><dd className="inline">{short(verification?.reason)}</dd></div>
        </dl>
        <div className="mt-2" style={{ color: branchable ? 'var(--theme-accent)' : 'var(--theme-muted)' }}>{branchable ? (zh ? '可分支：边界已验证' : 'Branchable: verified boundary') : (zh ? '不可分支：需要修复检查点' : 'Not branchable: repair checkpoint first')}</div>
        {snapshot?.closure?.gaps?.length ? <div className="mt-1 break-all" style={{ color: 'var(--theme-danger)' }}>{zh ? '闭合缺口：' : 'Closure gaps: '}{snapshot.closure.gaps.join(', ')}</div> : null}
      </section>
      <section className="rounded-lg p-3" style={{ background: 'var(--theme-card2)', border: '1px solid var(--theme-border)' }}><strong style={{ color: 'var(--theme-text)' }}>{zh ? '有效知识披露' : 'Effective knowledge disclosures'}</strong><div className="mt-2 space-y-2" style={{ color: 'var(--theme-muted)' }}>{disclosedByType.length === 0 ? <div>{zh ? '没有记录的披露' : 'No disclosures recorded'}</div> : disclosedByType.map(([type, refs]) => <div key={type}><div className="font-semibold" style={{ color: 'var(--theme-accent)' }}>{type} ({refs.length})</div>{refs.map((ref) => <div key={`${ref.ref_type}:${ref.ref_id}:${ref.version_ref ?? ''}`} className="break-all pl-2">{ref.ref_id} · {ref.admission_state ?? 'observed'}</div>)}</div>)}</div></section>
      <section className="rounded-lg p-3" style={{ background: 'var(--theme-card2)', border: '1px solid var(--theme-border)' }}><strong style={{ color: 'var(--theme-text)' }}>{zh ? '活动合同与权威 Pin' : 'Active contract and authority pins'}</strong><div className="mt-2 space-y-2" style={{ color: 'var(--theme-muted)' }}><div><div className="font-semibold" style={{ color: 'var(--theme-accent)' }}>{zh ? '要求状态' : 'Requirement state'}</div>{requirements.length === 0 ? <div>{zh ? '没有活动要求' : 'No active requirements recorded'}</div> : requirements.map((item, index) => <div key={`${String(item.requirement_id ?? index)}`} className="break-all">{short(item.requirement_id)} · {short(item.status)} · {short(item.source_event_id ?? 'source event unavailable')}</div>)}</div><div><div className="font-semibold" style={{ color: 'var(--theme-accent)' }}>{zh ? '当前权威 Pin' : 'Current authority pins'}</div>{currentPins.length === 0 ? <div>{zh ? '没有当前 Pin' : 'No current pins recorded'}</div> : currentPins.map(([key, value]) => <div key={key} className="break-all">{key}: {short(value)}</div>)}</div><div><div className="font-semibold" style={{ color: 'var(--theme-accent)' }}>{zh ? '历史准入证明' : 'Historical admission proof'}</div><div className="break-all">{short(historicalProof)}</div></div></div></section>
      <section className="rounded-lg p-3" style={{ background: 'var(--theme-card2)', border: '1px solid var(--theme-border)' }}><div className="flex items-center justify-between"><strong style={{ color: 'var(--theme-text)' }}>{zh ? '评估证据' : 'Evaluation evidence'}</strong><Button type="button" className="rounded-full border px-2 py-1" style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-muted)' }} onClick={exportEvidence}>{zh ? '导出 JSON' : 'Export JSON'}</Button></div><div className="mt-2 break-all" style={{ color: 'var(--theme-muted)' }}>{zh ? '状态：' : 'Status: '}{short(evalRecord.status)}</div><div className="mt-1" style={{ color: 'var(--theme-muted)' }}>{zh ? '轮次：' : 'Rounds: '}{short(roundAccounting.rounds_completed)} / {short(roundAccounting.rounds_total)} · {zh ? '首次失败：' : 'First failure: '}{short(evalRecord.first_failure_point)}</div><div className="mt-1 break-all" style={{ color: 'var(--theme-muted)' }}>{zh ? '指标：' : 'Metrics: '}{short(evalRecord.metrics)}</div><div className="mt-1 break-all" style={{ color: 'var(--theme-muted)' }}>{zh ? '证据哈希：' : 'Evidence hash: '}{short(snapshot?.evidence?.bundle_hash)}</div><div className="mt-1 break-all" style={{ color: 'var(--theme-muted)' }}>{zh ? 'Agent/参考差异：' : 'Agent/reference deltas: '}{short(snapshot?.eval_comparison?.metric_deltas ?? 'not available')}</div></section>
      <section className="rounded-lg p-3" style={{ background: 'var(--theme-card2)', border: '1px solid var(--theme-border)' }}><div className="flex items-center justify-between"><strong style={{ color: 'var(--theme-text)' }}>{zh ? '血缘与事件' : 'Lineage and semantic events'}</strong><Button type="button" className="rounded-full border px-2 py-1" style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-muted)' }} onClick={() => setShowRawEvents((value) => !value)}>{showRawEvents ? (zh ? '隐藏原始' : 'Hide raw') : (zh ? '显示原始' : 'Show raw')}</Button></div><div className="mt-2" style={{ color: 'var(--theme-muted)' }}>{zh ? '检查点数量：' : 'Checkpoints: '}{snapshot?.lineage?.length ?? 0} · {zh ? '语义事件：' : 'Events: '}{snapshot?.events?.length ?? 0} · {zh ? '差异：' : 'Diffs: '}{snapshot?.diffs?.length ?? 0}</div><div className="mt-2 space-y-1">{(snapshot?.diffs ?? []).map((diff, index) => <div key={`${String(diff.to_checkpoint_id ?? index)}`} className="break-all rounded px-2 py-1" style={{ background: 'var(--theme-card)', color: 'var(--theme-muted)' }}>{short(diff.from_checkpoint_id)} → {short(diff.to_checkpoint_id)} · {short(diff.changed_fields)} · {short(diff.risk_flags)}{objectValue(diff.compaction).started || objectValue(diff.compaction).committed ? ` · ${zh ? '压缩转换' : 'compaction transition'}` : ''}</div>)}</div>{showRawEvents ? <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all rounded p-2 text-[10px]" style={{ background: 'var(--theme-card)', color: 'var(--theme-muted)' }}>{JSON.stringify({ lineage: snapshot?.lineage ?? [], diffs: snapshot?.diffs ?? [], events: snapshot?.events ?? [] }, null, 2)}</pre> : null}</section>
    </div>
  )
}
