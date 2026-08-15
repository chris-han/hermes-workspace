import { useMemo, useState } from 'react'
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { emitMvlTelemetry } from './mvl-telemetry'

export type ExtractionReviewItem = { id: string; text: string; mapping: string; confidence: number; evidence: string }
const PAGE_SIZE = 20
const telemetryContext = { tenantId: 'current-tenant', workspaceId: 'current-workspace', graphRef: 'tender-sensitive', graphVersion: 'candidate', graphHash: 'pending', locale: 'en' }

export function ExtractionReviewPanel({ items, onReview }: { items: ExtractionReviewItem[]; onReview?: (action: string, item: ExtractionReviewItem) => void }) {
  const [selected, setSelected] = useState<ExtractionReviewItem | null>(null)
  const [page, setPage] = useState(0)
  const [form, setForm] = useState<'relabel' | 'merge' | null>(null)
  const pages = Math.max(1, Math.ceil(items.length / PAGE_SIZE))
  const visible = useMemo(() => items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [items, page])
  const review = (action: string) => {
    if (!selected) return
    emitMvlTelemetry(`extraction.review.${action}`, telemetryContext)
    onReview?.(action, selected)
    if (action !== 'relabeled' && action !== 'merged') setSelected(null)
  }
  return <section aria-label="Extraction review" className="rounded-xl border border-border bg-card p-4">
    <div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-semibold">Extraction preview</h2><p className="mt-1 text-xs text-muted-foreground">Review candidate mappings before building a connected graph.</p></div><span className="rounded-full border px-2 py-1 text-[11px]">{items.length} candidates</span></div>
    <div className="mt-3 space-y-2">{visible.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2"><span className="min-w-0"><span className="block truncate text-sm">{item.text}</span><span className="block text-[11px] text-muted-foreground">{item.mapping} · {Math.round(item.confidence * 100)}%</span></span><button type="button" onClick={() => { emitMvlTelemetry('extraction.review.opened', telemetryContext); setSelected(item); setForm(null) }} className="h-8 shrink-0 rounded-full border px-3 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">Review</button></div>)}</div>
    {pages > 1 ? <nav aria-label="Extraction pages" className="mt-3 flex items-center justify-between text-xs"><button type="button" className="h-8 rounded-full border px-3" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page + 1} of {pages}</span><button type="button" className="h-8 rounded-full border px-3" disabled={page === pages - 1} onClick={() => setPage(page + 1)}>Next</button></nav> : null}
    <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}><SheetContent aria-label="Candidate review drawer"><SheetTitle>Candidate review</SheetTitle><SheetDescription className="mt-1">MVL dock · evidence and mapping review</SheetDescription>{selected ? <><p className="mt-5 text-sm font-medium">{selected.text}</p><p className="mt-1 text-xs text-muted-foreground">{selected.evidence}</p><p className="mt-3 text-xs text-muted-foreground">Mapping: {selected.mapping} · Confidence: {Math.round(selected.confidence * 100)}%</p><div className="mt-5 flex flex-wrap gap-2"><button className="h-8 rounded-full border px-3 text-xs" onClick={() => review('accepted')}>Accept</button><button className="h-8 rounded-full border px-3 text-xs" onClick={() => review('rejected')}>Reject</button><button className="h-8 rounded-full border px-3 text-xs" onClick={() => { emitMvlTelemetry('extraction.review.relabeled', telemetryContext); setForm('relabel') }}>Relabel</button><button className="h-8 rounded-full border px-3 text-xs" onClick={() => { emitMvlTelemetry('extraction.review.merged', telemetryContext); setForm('merge') }}>Merge</button></div>{form ? <form className="mt-4 space-y-2" onSubmit={(event) => { event.preventDefault(); review(form === 'relabel' ? 'relabeled' : 'merged'); setForm(null) }}><label className="block text-xs font-medium">{form === 'relabel' ? 'New label' : 'Merge target'}<input required className="mt-1 h-8 w-full rounded-md border bg-background px-2 text-sm" /></label><button className="h-8 rounded-md bg-primary px-3 text-xs text-primary-foreground" type="submit">Apply {form}</button></form> : null}</> : null}<SheetClose className="mt-auto h-8 rounded-md border px-3 text-xs">Close</SheetClose></SheetContent></Sheet>
  </section>
}
