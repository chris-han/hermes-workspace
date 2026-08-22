// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'

import { SourceIdentitySchema } from '@/contracts/source-document'

import { DocumentRendererSlot, isSameOrigin } from './document-renderer-slot'

const baseSource = SourceIdentitySchema.parse({
  sourceIdentityRef: 'src-test-1',
  tenantId: 'tenant-test-1',
  workspaceId: 'ws-test-1',
  sourceHash:
    'sha256:0000000000000000000000000000000000000000000000000000000000000000',
  sourceVersion: 'v1',
  mediaType: 'application/pdf',
})

const pendingConfig = {
  configured: true as const,
  provider: 'open-source-unified' as const,
  state: 'pending-installation' as const,
  engine: 'placeholder-pending-flyfish-installation' as const,
  plannedRenderer: 'flyfish-preset-office' as const,
}

afterEach(() => cleanup())

describe('DocumentRendererSlot', () => {
  it('truthfully reports pending-installation state when Flyfish is not installed', () => {
    const { container, getByText } = render(
      <DocumentRendererSlot
        zh={false}
        presentation={null}
        viewerConfig={pendingConfig}
      />,
    )
    expect(
      container.querySelector('[data-renderer-state="pending-installation"]'),
    ).not.toBeNull()
    expect(container.querySelector('[data-viewer-engine]')?.getAttribute('data-viewer-engine')).toBe(
      'placeholder-pending-flyfish-installation',
    )
    expect(container.querySelector('[data-viewer-provider]')?.getAttribute('data-viewer-provider')).toBe(
      'open-source-unified',
    )
    expect(getByText(/Awaiting mount of flyfish-preset-office/)).toBeTruthy()
  })

  it('renders the planned renderer name in Chinese when zh is true', () => {
    const { getByText } = render(
      <DocumentRendererSlot
        zh
        presentation={null}
        viewerConfig={pendingConfig}
      />,
    )
    expect(getByText(/等待挂载 flyfish-preset-office/)).toBeTruthy()
  })

  it('surfaces the governed presentation identity without leaking it into renderer-native IDs', () => {
    const { container } = render(
      <DocumentRendererSlot
        zh={false}
        presentation={{
          sourceIdentityRef: 'src-test-1',
          documentName: 'tender.pdf',
          source: baseSource,
          contentUrl: '/api/contextgraph/source-documents/src-test-1/content',
          readOnly: true,
        }}
        viewerConfig={pendingConfig}
        selectedEvidenceRef="evidence:src-test-1:anchor-42"
        selectedAnchorRef="anchor-42"
        onFocusResolved={() => undefined}
      />,
    )
    // The renderer-native selector must remain null until the W3
    // PresentationResolver is wired against Flyfish. Semantier feedback
    // callbacks MUST NOT receive renderer-native IDs.
    const region = container.querySelector('[role="region"]') as HTMLElement | null
    expect(region?.getAttribute('data-focus-state')).toBe('unresolved')
    expect(region?.getAttribute('data-same-origin-violation')).toBe('false')
  })

  it('refuses to mount and surfaces a diagnostic when contentUrl is not same-origin', () => {
    const { container } = render(
      <DocumentRendererSlot
        zh={false}
        presentation={{
          sourceIdentityRef: 'src-test-1',
          documentName: 'tender.pdf',
          source: baseSource,
          contentUrl: 'https://attacker.example/secret.pdf',
          readOnly: true,
        }}
        viewerConfig={pendingConfig}
      />,
    )
    const region = container.querySelector('[role="region"]') as HTMLElement | null
    expect(region?.getAttribute('data-same-origin-violation')).toBe('true')
  })

  it('records a fallback renderer headline when state is fallback', () => {
    const { getByText } = render(
      <DocumentRendererSlot
        zh={false}
        presentation={null}
        viewerConfig={{
          configured: true,
          provider: 'open-source-unified',
          state: 'fallback',
          engine: 'pdfjs-plus-oss-docx',
          reason: 'Flyfish failed a hard W0 fidelity gate; deferred to separate adapters.',
        }}
      />,
    )
    expect(getByText(/Fallback renderer pdfjs-plus-oss-docx/)).toBeTruthy()
  })

  it('records a rejected headline when state is rejected', () => {
    const { getByText } = render(
      <DocumentRendererSlot
        zh={false}
        presentation={null}
        viewerConfig={{
          configured: false,
          provider: 'canonical-source-ir',
          state: 'rejected',
          reason: 'No admissible open-source renderer could be approved.',
        }}
      />,
    )
    expect(getByText(/No renderer mounted/)).toBeTruthy()
  })
})

describe('isSameOrigin', () => {
  it('treats absolute same-origin URLs as same-origin', () => {
    expect(
      isSameOrigin('https://app.example/api/x', 'https://app.example'),
    ).toBe(true)
  })

  it('rejects URLs with a different origin', () => {
    expect(
      isSameOrigin('https://attacker.example/x', 'https://app.example'),
    ).toBe(false)
  })

  it('treats relative URLs as same-origin', () => {
    expect(isSameOrigin('/api/contextgraph/x', 'https://app.example')).toBe(true)
  })

  it('rejects malformed URLs conservatively', () => {
    expect(isSameOrigin('not-a-url', 'https://app.example')).toBe(false)
  })
})
