// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, render, waitFor } from '@testing-library/react'

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

// Mock fetch globally: jsdom cannot resolve relative URLs in fetch().
// The Flyfish controller calls fetch() with the contentUrl when the
// real renderer is mounted; this mock satisfies that call so the
// tests can assert on the slot's mount surface without involving
// the real network.
const originalFetch = globalThis.fetch
beforeAll(() => {
  // jsdom's Response.blob() returns a Blob that is NOT instanceof Blob
  // (cross-realm), so Flyfish's wrapFileViewerFileRef rejects it. The
  // Flyfish controller accepts a Response-like with ok/status/statusText
  // and a blob() method returning a *global* Blob. Use a global Blob
  // (created via the test scope's `Blob` reference) so the Flyfish
  // module's `data instanceof Blob` check passes.
  globalThis.fetch = vi.fn(async (): Promise<Response> => {
    const responseLike = {
      ok: true,
      status: 200,
      statusText: 'OK',
      blob: async () =>
        new Blob([new Uint8Array(0)], { type: 'application/pdf' }),
    }
    return responseLike as unknown as Response
  })
})
afterAll(() => {
  globalThis.fetch = originalFetch
})

const readyConfig = {
  configured: true as const,
  provider: 'open-source-unified' as const,
  state: 'ready' as const,
  engine: 'flyfish-preset-office' as const,
  pinnedVersion: '2.3.0',
}

describe('DocumentRendererSlot CSS isolation', () => {
  it('keeps the renderer mount point inside a host-token-free subtree', async () => {
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
        viewerConfig={readyConfig}
      />,
    )

    // Wait for the dynamic import to resolve before asserting on the
    // mount-point structure (the renderer is mounted asynchronously).
    await waitFor(() => {
      expect(
        container
          .querySelector('[role="region"]')
          ?.getAttribute('data-flyfish-module-state'),
      ).toBe('ready')
    })

    // The Flyfish mount point must be findable for the renderer adapter and
    // MUST live inside the slot so future renderer output cannot leak
    // outside the isolated subtree.
    const mountPoint = container.querySelector(
      '[data-flyfish-mount-point]',
    ) as HTMLElement | null
    expect(mountPoint).not.toBeNull()
    expect(mountPoint?.getAttribute('data-flyfish-engine')).toBe(
      'flyfish-preset-office',
    )
  })

  it('does NOT inject --theme-* presentation tokens onto the renderer mount subtree', async () => {
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
        viewerConfig={readyConfig}
      />,
    )

    await waitFor(() => {
      expect(
        container
          .querySelector('[role="region"]')
          ?.getAttribute('data-flyfish-module-state'),
      ).toBe('ready')
    })

    const mountPoint = container.querySelector(
      '[data-flyfish-mount-point]',
    ) as HTMLElement | null
    expect(mountPoint).not.toBeNull()
    // Future renderer output is responsible for the document CSS, but the
    // mount point must not already carry `--theme-*` rules that would
    // force the rendered document content to inherit the host shell's
    // accent / focus tokens. The mount subtree has no inline style and
    // no Tailwind `bg-*` / `text-*` / `border-*` overrides on the mount
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

  it('uses data-* hooks (not inline classes) to identify the renderer mount subtree', async () => {
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
        viewerConfig={readyConfig}
      />,
    )

    await waitFor(() => {
      expect(
        container
          .querySelector('[role="region"]')
          ?.getAttribute('data-flyfish-module-state'),
      ).toBe('ready')
    })

    // The Flyfish adapter should key off `data-flyfish-mount-point` /
    // `data-flyfish-engine` rather than CSS classes; this protects the
    // renderer mount subtree from accidental class-based host overrides
    // and keeps the boundary testable.
    expect(container.querySelector('[data-flyfish-mount-point]')).not.toBeNull()
    expect(
      container.querySelector('[data-flyfish-engine="flyfish-preset-office"]'),
    ).not.toBeNull()
  })
})
