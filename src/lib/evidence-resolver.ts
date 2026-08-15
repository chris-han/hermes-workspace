import type { EvidenceSelector, ResolvedLocation } from '@/contracts/evidence-location'
import type { DocumentEnvelope, DocumentSpan } from '@/contracts/source-document'

export type EvidenceResolutionStatus = 'exact' | 'relocated_exact' | 'normalized_match' | 'ambiguous' | 'unresolved' | 'source_changed'
export type EvidenceResolution = { status: EvidenceResolutionStatus; location: ResolvedLocation | null; candidates: string[] }

const normalize = (value: string) => value.normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase()
const hash = (value: string) => {
  // Stable, local identity hash. The server remains authoritative for cryptographic source hashes.
  let h = 2166136261
  for (const char of value) { h ^= char.charCodeAt(0); h = Math.imul(h, 16777619) }
  return `local:${(h >>> 0).toString(16).padStart(8, '0')}`
}

function location(span: DocumentSpan, selector: EvidenceSelector, status: EvidenceResolutionStatus): ResolvedLocation {
  const table = selector.table
  return {
    schemaVersion: 'semantier.resolved_location.v1',
    evidenceRef: `unmaterialized:${span.elementRef}`,
    sourceIdentityRef: '',
    representationType: 'anydoc_document',
    representationRef: span.elementRef,
    representationHash: null,
    locationType: span.kind === 'cell' ? 'table_cell' : 'document_structure',
    status,
    location: { elementRef: span.elementRef, tableOrdinal: table?.tableOrdinal ?? null, rowKey: table?.rowKey ?? null, columnKey: table?.columnKey ?? null, characterStart: 0, characterEnd: span.text.length },
    matchedText: span.text,
    resolverVersion: 'hermes-evidence-resolver.v1',
    resolvedAt: new Date().toISOString(),
  }
}

export function resolveEvidenceSelector(envelope: DocumentEnvelope, selector: EvidenceSelector): EvidenceResolution {
  const requestedHash = (selector as EvidenceSelector & { sourceHash?: string }).sourceHash
  if (requestedHash && requestedHash !== envelope.source.sourceHash) return { status: 'source_changed', location: null, candidates: [] }
  const spans = envelope.spans.filter((span) => !selector.sourceElementRef || span.elementRef === selector.sourceElementRef)
  const quote = selector.exactQuote
  const exact = spans.filter((span) => quote && span.text.includes(quote))
  if (exact.length === 1) { const status = selector.sourceElementRef ? 'exact' : 'relocated_exact'; return { status, location: location(exact[0], selector, status), candidates: [exact[0].elementRef] } }
  if (exact.length > 1) return { status: 'ambiguous', location: null, candidates: exact.map((span) => span.elementRef) }
  const normalized = spans.filter((span) => quote && normalize(span.text).includes(normalize(quote)))
  if (normalized.length === 1) return { status: 'normalized_match', location: location(normalized[0], selector, 'normalized_match'), candidates: [normalized[0].elementRef] }
  if (normalized.length > 1) return { status: 'ambiguous', location: null, candidates: normalized.map((span) => span.elementRef) }
  return { status: 'unresolved', location: null, candidates: [] }
}

export function buildDocumentSpan(text: string, elementRef: string, kind: DocumentSpan['kind'], index: number, parentRef: string | null = null): DocumentSpan {
  return { elementRef, kind, text, contentHash: hash(text), headingLevel: null, parentRef, index }
}
