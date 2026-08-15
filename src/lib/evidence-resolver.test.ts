import { describe, expect, it } from 'vitest'
import { createAnyDocEnvelope } from './anydoc-envelope'
import { resolveEvidenceSelector } from './evidence-resolver'

const source = { sourceIdentityRef: 'src-1', tenantId: 'tenant-1', workspaceId: 'ws-1', sourceHash: `sha256:${'a'.repeat(64)}`, sourceVersion: 'v1', mediaType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' as const }
const selector = (quote: string, sourceElementRef: string | null = null) => ({ schemaVersion: 'semantier.evidence_selector.v1' as const, selectorKind: 'quote' as const, exactQuote: quote, prefix: null, suffix: null, normalizedQuote: null, structuralPath: [], table: null, sourceElementRef })

describe('deterministic evidence resolver', () => {
  const envelope = createAnyDocEnvelope(source, [
    { kind: 'heading', text: 'Sensitive Terms', elementRef: 'h1', headingLevel: 1 },
    { kind: 'cell', text: '企业规模不得低于大型', elementRef: 'table-0.row-0.cell-1', parentRef: 'table-0.row-0' },
  ])
  it('resolves a structural exact match and relocates by quote', () => {
    expect(resolveEvidenceSelector(envelope, selector('企业规模', 'table-0.row-0.cell-1')).status).toBe('exact')
    expect(resolveEvidenceSelector(envelope, selector('Sensitive Terms')).status).toBe('relocated_exact')
  })
  it('fails closed for ambiguity and no match', () => {
    const ambiguous = createAnyDocEnvelope(source, [{ kind: 'paragraph', text: 'same phrase', elementRef: 'p1' }, { kind: 'paragraph', text: 'same phrase', elementRef: 'p2' }])
    expect(resolveEvidenceSelector(ambiguous, selector('same phrase')).status).toBe('ambiguous')
    expect(resolveEvidenceSelector(envelope, selector('not present')).status).toBe('unresolved')
  })
})
