import { useEffect, useRef } from 'react'
import type { DocumentEnvelope } from '@/contracts/source-document'
import type { EvidenceResolution } from '@/lib/evidence-resolver'

export function DocxEvidenceViewer({ envelope, primary, supporting = [] }: { envelope: DocumentEnvelope; primary: EvidenceResolution | null; supporting?: EvidenceResolution[] }) {
  const refs = useRef<Record<string, HTMLElement | null>>({})
  const targets = new Set([primary, ...supporting].filter(Boolean).map((item) => item?.location?.representationRef))
  useEffect(() => { const target = primary?.location?.representationRef; if (target) refs.current[target]?.scrollIntoView({ block: 'center', behavior: 'smooth' }) }, [primary])
  return <div aria-label="DOCX evidence viewer" className="h-full overflow-auto p-4 space-y-2">{envelope.spans.map((span) => {
    const active = targets.has(span.elementRef)
    const Tag = span.kind === 'heading' ? 'h3' : span.kind === 'cell' ? 'td' : 'p'
    return <Tag key={span.elementRef} ref={(node) => { refs.current[span.elementRef] = node }} data-element-ref={span.elementRef} className={`${span.kind === 'cell' ? 'border border-border p-2' : 'py-1'} ${active ? 'bg-primary/15 outline outline-2 outline-primary/50' : ''}`}>
      {active && primary?.location?.matchedText ? (() => { const matchedText = primary.location?.matchedText ?? ''; return span.text.split(matchedText).map((part, index, parts) => <span key={`${span.elementRef}-${index}`}>{part}{index < parts.length - 1 ? <mark className="rounded bg-amber-200 px-0.5 text-foreground">{matchedText}</mark> : null}</span>) })() : span.text}
    </Tag>
  })}</div>
}
