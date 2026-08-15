import type { DocumentEnvelope, DocumentSpan, SourceIdentity } from '@/contracts/source-document'
import { buildDocumentSpan } from './evidence-resolver'

export type AnyDocBlock = { kind: DocumentSpan['kind']; text: string; elementRef: string; parentRef?: string | null; headingLevel?: number | null }
export const ANYDOC_PROVIDER = { provider: 'anydoc' as const, version: '0.1.9', commit: 'e754e1d33a1a540ebc9226e36f11d3f401852c9e' }

/** Convert structured AnyDoc output directly into the stable envelope; Markdown offsets are never accepted. */
export function createAnyDocEnvelope(source: SourceIdentity, blocks: AnyDocBlock[], tables: Array<{ elementRef: string; rowRefs: string[] }> = []): DocumentEnvelope {
  const spans = blocks.map((block, index) => ({ ...buildDocumentSpan(block.text, block.elementRef, block.kind, index, block.parentRef ?? null), headingLevel: block.headingLevel ?? null }))
  return { schemaVersion: 'semantier.document_envelope.v1', source, parser: ANYDOC_PROVIDER, spans, tables: tables.map((table) => ({ ...table, contentHash: `local:${table.rowRefs.join('|').length.toString(16)}` })) }
}
