import { describe, expect, it } from 'vitest'

import { SourceIdentitySchema } from '@/contracts/source-document'

import { pendingPresentationResolver } from './presentation-resolver'

const baseSource = SourceIdentitySchema.parse({
  sourceIdentityRef: 'src-test-1',
  tenantId: 'tenant-test-1',
  workspaceId: 'ws-test-1',
  sourceHash:
    'sha256:0000000000000000000000000000000000000000000000000000000000000000',
  sourceVersion: 'v1',
  mediaType: 'application/pdf',
})

describe('pendingPresentationResolver', () => {
  it('preserves the canonical EvidenceRef and anchorRef on the resolved target', () => {
    const resolved = pendingPresentationResolver({
      evidenceRef: 'evidence:src-test-1:page:1:rect:10,20,30,40',
      anchorRef: 'page:1:rect:10,20,30,40',
      presentation: null,
    })

    expect(resolved).toEqual({
      evidenceRef: 'evidence:src-test-1:page:1:rect:10,20,30,40',
      anchorRef: 'page:1:rect:10,20,30,40',
      rendererNativeSelector: null,
      state: 'unresolved',
    })
  })

  it('returns null for empty evidence or anchor refs without leaking renderer IDs', () => {
    expect(
      pendingPresentationResolver({
        evidenceRef: '',
        anchorRef: 'page:1:rect:1,2,3,4',
        presentation: null,
      }),
    ).toBeNull()
    expect(
      pendingPresentationResolver({
        evidenceRef: 'evidence:src-test-1',
        anchorRef: '',
        presentation: null,
      }),
    ).toBeNull()
  })

  it('does NOT leak a renderer-native selector to the Semantier-facing surface', () => {
    const resolved = pendingPresentationResolver({
      evidenceRef: 'evidence:src-test-1:anchor-42',
      anchorRef: 'anchor-42',
      presentation: {
        sourceIdentityRef: 'src-test-1',
        documentName: 'tender.pdf',
        source: baseSource,
        contentUrl: '/api/contextgraph/source-documents/src-test-1/content',
        readOnly: true,
      },
    })

    expect(resolved?.state).toBe('unresolved')
    expect(resolved?.rendererNativeSelector).toBeNull()
    // The canonical identifiers MUST be preserved unchanged.
    expect(resolved?.evidenceRef).toBe('evidence:src-test-1:anchor-42')
    expect(resolved?.anchorRef).toBe('anchor-42')
  })

  it('is deterministic for the same (evidenceRef, anchorRef, mediaType) tuple', () => {
    const input = {
      evidenceRef: 'evidence:src-test-1:anchor-7',
      anchorRef: 'anchor-7',
      presentation: {
        sourceIdentityRef: 'src-test-1',
        documentName: 'tender.pdf',
        source: baseSource,
        contentUrl: '/api/contextgraph/source-documents/src-test-1/content',
        readOnly: true as const,
      },
    }
    const a = pendingPresentationResolver(input)
    const b = pendingPresentationResolver(input)
    expect(a).toEqual(b)
  })
})
