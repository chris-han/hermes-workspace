import { describe, expect, it } from 'vitest'

import {
  SourceDocumentPresentationSchema,
  SourceIdentitySchema,
} from './source-document'

const baseSource = SourceIdentitySchema.parse({
  sourceIdentityRef: 'src-test-1',
  tenantId: 'tenant-test-1',
  workspaceId: 'ws-test-1',
  sourceHash:
    'sha256:0000000000000000000000000000000000000000000000000000000000000000',
  sourceVersion: 'v1',
  mediaType: 'application/pdf',
})

describe('SourceDocumentPresentationSchema', () => {
  it('accepts a minimal governed PDF presentation projection', () => {
    const parsed = SourceDocumentPresentationSchema.parse({
      sourceIdentityRef: 'src-test-1',
      documentName: 'tender.pdf',
      source: baseSource,
      contentUrl: '/api/contextgraph/source-documents/src-test-1/content',
      readOnly: true,
    })

    expect(parsed.documentName).toBe('tender.pdf')
    expect(parsed.readOnly).toBe(true)
    expect(parsed.source.tenantId).toBe('tenant-test-1')
    expect(parsed.source.workspaceId).toBe('ws-test-1')
    expect(parsed.source.mediaType).toBe('application/pdf')
  })

  it('embeds the full SourceIdentity verbatim (no authority drift)', () => {
    const parsed = SourceDocumentPresentationSchema.parse({
      sourceIdentityRef: 'src-test-2',
      documentName: 'tender.docx',
      source: baseSource,
      contentUrl: '/api/contextgraph/source-documents/src-test-2/content',
      readOnly: true,
    })

    // SourceIdentity is preserved as the authority-bearing object; the
    // presentation projection MUST NOT replicate tenant/workspace/hash fields
    // outside of `source`, and consumers MUST derive documentKind from
    // source.mediaType, not from a separate field on the presentation.
    expect(parsed.source).toEqual(baseSource)
    expect(parsed.source.sourceHash).toBe(baseSource.sourceHash)
    expect(parsed.source.tenantId).toBe(baseSource.tenantId)
    expect(parsed.source.workspaceId).toBe(baseSource.workspaceId)
  })

  it('rejects non-readOnly presentations', () => {
    const result = SourceDocumentPresentationSchema.safeParse({
      sourceIdentityRef: 'src-test-3',
      documentName: 'tender.pdf',
      source: baseSource,
      contentUrl: '/api/contextgraph/source-documents/src-test-3/content',
      readOnly: false,
    })

    expect(result.success).toBe(false)
  })

  it('rejects presentations whose source fails SourceIdentity validation', () => {
    const result = SourceDocumentPresentationSchema.safeParse({
      sourceIdentityRef: 'src-test-4',
      documentName: 'tender.pdf',
      source: {
        ...baseSource,
        sourceHash: 'not-a-sha256',
      },
      contentUrl: '/api/contextgraph/source-documents/src-test-4/content',
      readOnly: true,
    })

    expect(result.success).toBe(false)
  })

  it('requires a non-empty contentUrl so callers cannot pass an empty string', () => {
    const result = SourceDocumentPresentationSchema.safeParse({
      sourceIdentityRef: 'src-test-5',
      documentName: 'tender.pdf',
      source: baseSource,
      contentUrl: '',
      readOnly: true,
    })

    expect(result.success).toBe(false)
  })
})
