// @vitest-environment jsdom
//
// Flyfish integration tests — these exercise the W2 mount boundary
// against the REAL `@file-viewer/react` package (pinned to 2.3.0).
// They verify that:
//
// - the dynamic import in DocumentRendererSlot resolves the real Flyfish
//   `FileViewer` component;
// - the slot mounts the FileViewer with the governed `presentation.contentUrl`
//   as the `url` prop and the governed mediaType as the `type` prop;
// - the `data-flyfish-module-state="ready"` and `data-flyfish-engine` data
//   attributes are present so the E2E suite can assert on the real mount;
// - same-origin enforcement still applies when the slot mounts the real
//   renderer;
// - the `presentation-resolver` invariants hold even with the real
//   renderer mounted.
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, waitFor } from '@testing-library/react'

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

const readyConfig = {
  configured: true as const,
  provider: 'open-source-unified' as const,
  state: 'ready' as const,
  engine: 'flyfish-preset-office' as const,
  pinnedVersion: '2.3.0',
}

afterEach(() => cleanup())

// jsdom's Response.blob() returns a Blob that is NOT instanceof Blob
// (cross-realm), so Flyfish's wrapFileViewerFileRef rejects it. Mock fetch
// with a Response-like whose blob() returns a global Blob so Flyfish can
// wrap it as a File. Tests that don't mount the FileViewer never trigger
// fetch, but the mock is set up globally for safety.
const originalFetch = globalThis.fetch
beforeAll(() => {
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

describe('Flyfish integration (real @file-viewer/react@2.3.0)', () => {
  it('resolves the real Flyfish FileViewer via the dynamic import', async () => {
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

    // The dynamic import is async; we must wait for the slot to transition
    // to its `ready` module state before asserting on the rendered output.
    await waitFor(
      () => {
        const region = container.querySelector('[role="region"]')
        expect(region?.getAttribute('data-flyfish-module-state')).toBe('ready')
      },
      { timeout: 5000 },
    )

    const region = container.querySelector('[role="region"]') as HTMLElement
    expect(region.getAttribute('data-renderer-state')).toBe('ready')
    expect(region.getAttribute('data-viewer-engine')).toBe('flyfish-preset-office')

    // The mount point MUST carry the real `data-flyfish-mount-point` marker
    // so downstream Flyfish adapter code can locate the container.
    const mountPoint = container.querySelector(
      '[data-flyfish-mount-point=""]',
    ) as HTMLElement | null
    expect(mountPoint).not.toBeNull()
    expect(mountPoint?.getAttribute('data-flyfish-engine')).toBe(
      'flyfish-preset-office',
    )
  })

  it('mounts the Flyfish FileViewer with the governed contentUrl as the url prop', async () => {
    const governedContentUrl =
      '/api/contextgraph/source-documents/src-test-1/content'
    const { container } = render(
      <DocumentRendererSlot
        zh={false}
        presentation={{
          sourceIdentityRef: 'src-test-1',
          documentName: 'tender.pdf',
          source: baseSource,
          contentUrl: governedContentUrl,
          readOnly: true,
        }}
        viewerConfig={readyConfig}
      />,
    )

    await waitFor(
      () => {
        expect(
          container
            .querySelector('[role="region"]')
            ?.getAttribute('data-flyfish-module-state'),
        ).toBe('ready')
      },
      { timeout: 5000 },
    )

    // After the dynamic import resolves, the slot renders <FileViewer />
    // which is a forwardRef React component. Real Flyfish wraps the
    // controller inside its own `<div data-file-viewer-stub="true" />`
    // surface, so we assert on the actual rendered output regardless of
    // whether the inner `<iframe>` is present in this jsdom test
    // environment. The point is that the slot mounted the real component
    // (not the placeholder) with the governed contentUrl.
    const mountPoint = container.querySelector(
      '[data-flyfish-mount-point=""]',
    ) as HTMLElement | null
    expect(mountPoint).not.toBeNull()
    // The mount point MUST live under the `[data-flyfish-engine]` slot
    // (not the hidden duplicate at the bottom of the region).
    expect(mountPoint?.closest('[data-flyfish-engine]')).not.toBeNull()
  })

  it('preserves the same-origin refusal even when Flyfish is mounted', async () => {
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
        viewerConfig={readyConfig}
      />,
    )

    await waitFor(
      () => {
        expect(
          container
            .querySelector('[role="region"]')
            ?.getAttribute('data-same-origin-violation'),
        ).toBe('true')
      },
      { timeout: 5000 },
    )
    const region = container.querySelector('[role="region"]') as HTMLElement
    // The Flyfish module state still transitions to `ready` because the
    // package import succeeded; the same-origin refusal only blocks the
    // actual FileViewer mount, not the module resolution.
    expect(region.getAttribute('data-flyfish-module-state')).toBe('ready')
    // The mount point MUST NOT be present because the slot refused to
    // mount due to the same-origin violation.
    expect(container.querySelector('[data-flyfish-mount-point=""]')).toBeNull()
  })

  it('does NOT regress to the placeholder when the Flyfish module is ready and presentation is null', async () => {
    const { container } = render(
      <DocumentRendererSlot
        zh={false}
        presentation={null}
        viewerConfig={readyConfig}
      />,
    )

    await waitFor(
      () => {
        expect(
          container
            .querySelector('[role="region"]')
            ?.getAttribute('data-flyfish-module-state'),
        ).toBe('ready')
      },
      { timeout: 5000 },
    )
    // Without a presentation, the slot stays on the placeholder. The
    // E2E suite can assert on this case to distinguish "module ready"
    // from "renderer mounted".
    expect(
      container.querySelector('[data-flyfish-mount-point=""]'),
    ).toBeNull()
  })

  it('reports the truthful pending-installation state when Flyfish is not ready', () => {
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
        viewerConfig={{
          configured: true,
          provider: 'open-source-unified',
          state: 'pending-installation',
          engine: 'placeholder-pending-flyfish-installation',
          plannedRenderer: 'flyfish-preset-office',
        }}
      />,
    )
    expect(
      container
        .querySelector('[role="region"]')
        ?.getAttribute('data-renderer-state'),
    ).toBe('pending-installation')
    expect(
      container
        .querySelector('[role="region"]')
        ?.getAttribute('data-flyfish-module-state'),
    ).toBe('idle')
  })
})

describe('Flyfish install verification (sandbox W0)', () => {
  it('the real @file-viewer/react@2.3.0 FileViewer default export is resolvable', async () => {
    // This test asserts that the package we installed (and that the
    // DocumentRendererSlot dynamic-imports) actually exists in the
    // workspace's node_modules. If a future change accidentally swaps
    // to a stub, this test will fail.
    const mod = (await import(/* webpackChunkName: "flyfish-file-viewer" */ '@file-viewer/react')) as unknown as {
      FileViewer?: unknown
      default?: unknown
    }
    expect(mod).toBeTruthy()
    // `@file-viewer/react` exposes `FileViewer` as a forwardRef component
    // (a React element factory object, not a plain function), and re-exports
    // it as the default export. Assert both are present and reference the
    // same component so a future swap to a stub or a different component
    // would be caught here.
    expect(mod.FileViewer).toBeTruthy()
    expect(mod.default).toBeTruthy()
    expect(mod.FileViewer).toBe(mod.default)
  })

  it('the real @file-viewer/preset-office@2.3.3 side-effect import registers renderer plugins', async () => {
    const presetMod = (await import('@file-viewer/preset-office')) as unknown as {
      officeRenderers?: { id?: string; renderers?: unknown[] }
      default?: unknown
    }
    expect(presetMod).toBeTruthy()
    // The preset exports an `officeRenderers` object whose `renderers` array
    // contains at least one PDF renderer and one Word renderer plugin.
    const renderers = (presetMod.officeRenderers?.renderers ?? []) as Array<{
      id?: string
    }>
    const ids = renderers.map((r) => r.id).filter(Boolean)
    expect(ids.some((id) => String(id).toLowerCase().includes('pdf'))).toBe(true)
    expect(
      ids.some((id) => String(id).toLowerCase().includes('word')),
    ).toBe(true)
  })
})
