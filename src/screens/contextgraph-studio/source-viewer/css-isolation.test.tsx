// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'

import { SourceIdentitySchema } from '@/contracts/source-document'
import { DocumentRendererSlot } from './document-renderer-slot'

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

describe('DocumentRendererSlot CSS isolation', () => {
  it('keeps the renderer mount point inside a host-token-free subtree', () => {
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
      />,
    )

    // The Flyfish mount point must be findable for the renderer adapter and
    // MUST live inside the slot so future renderer output cannot leak
    // outside the isolated subtree.
    const mountPoint = container.querySelector(
      '[data-flyfish-mount-point]',
    ) as HTMLElement | null
    expect(mountPoint).not.toBeNull()
    expect(mountPoint?.parentElement?.getAttribute('data-viewer-engine')).toBe(
      'placeholder-pending-flyfish-installation',
    )
  })

  it('does NOT inject --theme-* presentation tokens onto the renderer mount subtree', () => {
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
      />,
    )

    const mountPoint = container.querySelector(
      '[data-flyfish-mount-point]',
    ) as HTMLElement | null
    // Future renderer output is responsible for the document CSS, but the
    // mount point must not already carry `--theme-*` rules that would
    // force the rendered document content to inherit the host shell's
    // accent / focus tokens. The placeholder has no inline style and no
    // Tailwind `bg-*` / `text-*` / `border-*` overrides on the mount
    // point itself.
    expect(mountPoint?.className ?? '').not.toMatch(/bg-|text-|border-/)
  })

  it('keeps the host outer region using theme tokens so the rest of the chrome still reads from --theme-*', () => {
    const { container } = render(
      <DocumentRendererSlot
        zh={false}
        presentation={null}
        viewerConfig={pendingConfig}
      />,
    )

    const region = container.querySelector('[role="region"]') as HTMLElement | null
    // The host outer region intentionally uses Tailwind theme classes
    // (`bg-background`, `border-border`, `text-muted-foreground`) so it
    // composes with the rest of the Studio shell. The mount point itself
    // is the boundary that the renderer adapter must NOT escape.
    expect(region?.className ?? '').toMatch(/bg-background|border-border/)
  })

  it('uses data-* hooks (not inline classes) to identify the renderer mount subtree', () => {
    const { container } = render(
      <DocumentRendererSlot
        zh={false}
        presentation={null}
        viewerConfig={pendingConfig}
      />,
    )

    // The Flyfish adapter should key off `data-flyfish-mount-point` /
    // `data-viewer-engine` rather than CSS classes; this protects the
    // renderer mount subtree from accidental class-based host overrides
    // and keeps the boundary testable.
    expect(container.querySelector('[data-flyfish-mount-point]')).not.toBeNull()
    expect(
      container.querySelector('[data-viewer-engine="placeholder-pending-flyfish-installation"]'),
    ).not.toBeNull()
  })
})
