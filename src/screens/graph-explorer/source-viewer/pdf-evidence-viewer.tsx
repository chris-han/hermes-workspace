import { useEffect, useRef } from 'react'
import type { EvidenceResolution } from '@/lib/evidence-resolver'

export type PdfTextPage = { page: number; text: string }
export type PdfEvidenceViewerProps = { pages: PdfTextPage[]; primary: EvidenceResolution | null; supporting?: EvidenceResolution[]; onSelect?: (page: number) => void }

/** Text-layer-first PDF viewer. Image-only documents intentionally show a closed/unresolved state. */
export function PdfEvidenceViewer({ pages, primary, supporting = [], onSelect }: PdfEvidenceViewerProps) {
  const refs = useRef<Record<number, HTMLElement | null>>({})
  const all = primary ? [primary, ...supporting] : supporting
  useEffect(() => {
    const target = primary?.location?.location?.page
    if (typeof target === 'number') refs.current[target]?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [primary])
  if (pages.length === 0) return <div role="status" className="p-4 text-sm text-muted-foreground">PDF text is unavailable. Evidence is unresolved; review or reground manually.</div>
  return <div aria-label="PDF evidence viewer" className="h-full overflow-auto p-4">{pages.map((page) => {
    const selected = all.some((item) => item.location?.location?.page === page.page)
    return <button key={page.page} ref={(node) => { refs.current[page.page] = node }} type="button" onClick={() => onSelect?.(page.page)} className={`mb-3 block w-full rounded border p-3 text-left ${selected ? 'border-primary bg-primary/10' : 'border-border'}`}>
      <span className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Page {page.page}</span>
      <span className="whitespace-pre-wrap text-sm">{page.text}</span>
      {selected ? <span className="mt-2 block text-xs font-medium text-primary">Evidence {primary && primary.status !== 'ambiguous' ? primary.status : 'unresolved/ambiguous'}</span> : null}
    </button>
  })}</div>
}
