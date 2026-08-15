import type { DocumentEnvelope } from '@/contracts/source-document'
import type { EvidenceResolution } from '@/lib/evidence-resolver'
import { DocxEvidenceViewer } from './docx-evidence-viewer'
import { PdfEvidenceViewer, type PdfTextPage } from './pdf-evidence-viewer'

export function SourceEvidenceViewer({ mediaType, envelope, pages, primary, supporting }: { mediaType: string; envelope?: DocumentEnvelope | null; pages?: PdfTextPage[]; primary: EvidenceResolution | null; supporting?: EvidenceResolution[] }) {
  if (mediaType === 'application/pdf') return <PdfEvidenceViewer pages={pages ?? []} primary={primary} supporting={supporting} />
  if (envelope) return <DocxEvidenceViewer envelope={envelope} primary={primary} supporting={supporting} />
  return <div role="status" className="p-4 text-sm text-muted-foreground">No structured source representation is available.</div>
}
