import { useState } from 'react'

export function InspectorPanel({ graphState, evidence, history }: { graphState: 'candidate' | 'extraction-only' | 'connected-graph'; evidence?: string; history?: string }) {
  const [tab, setTab] = useState<'Guidance' | 'Evidence' | 'History'>('Guidance')
  return <aside aria-label="Inspector panel" aria-live="polite" className="rounded-xl border border-border bg-card p-4"><div className="flex gap-2">{(['Guidance', 'Evidence', 'History'] as const).map((value) => <button key={value} type="button" onClick={() => setTab(value)} className="rounded-full border px-2 py-1 text-[11px]">{value}</button>)}</div><div className="mt-4 text-sm">{tab === 'Guidance' ? <p><span aria-hidden="true">●</span> {graphState === 'connected-graph' ? 'Connected graph · non-authoritative' : graphState === 'extraction-only' ? 'Extraction-only · build required' : 'Candidate graph · reviewable'}</p> : tab === 'Evidence' ? <p>{evidence ?? 'Select a node to inspect pinned source evidence.'}</p> : <p>{history ?? 'Immutable checkpoint lineage appears here.'}</p>}</div></aside>
}
