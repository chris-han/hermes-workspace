import type { DocumentEnvelope } from '@/contracts/source-document'
import type { EvidenceResolution } from '@/lib/evidence-resolver'
import { SourceEvidenceViewer } from './source-evidence-viewer'

export function SourcePane({ open, onToggle, mediaType, envelope, pages, primary, supporting }: { open: boolean; onToggle: () => void; mediaType: string; envelope?: DocumentEnvelope | null; pages?: { page: number; text: string }[]; primary: EvidenceResolution | null; supporting?: EvidenceResolution[] }) {
  return <aside data-testid="source-pane" data-open={open} className={open ? 'flex min-w-0 flex-col border-r border-border bg-card' : 'hidden'}>
    <div className="flex h-10 items-center justify-between border-b border-border px-3"><h2 className="text-xs font-semibold">{mediaType === 'application/pdf' ? 'Original PDF' : 'Original DOCX'}</h2><button type="button" onClick={onToggle} aria-label="Close source pane" className="rounded border border-border px-2 py-1 text-xs">Close / 关闭</button></div>
    <div className="min-h-0 flex-1"><SourceEvidenceViewer mediaType={mediaType} envelope={envelope} pages={pages} primary={primary} supporting={supporting} /></div>
  </aside>
}
