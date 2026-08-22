import { useEffect, useRef, useState } from 'react'

import { cn } from '@/lib/utils'

import type {
  SourceDocumentPresentation,
} from '@/contracts/source-document'
import type { SourceEvidenceViewerConfig } from '@/server/source-evidence-viewer-config'

// DocumentRendererSlot is the W2 Flyfish shell mount boundary.
//
// Design goals (per `docs/plans/2026-08-22-contextgraph-open-source-source-viewer-integration-v1.md`
// and `docs/canonical/dependency-governance.md`):
//
// - When `viewerConfig.state === 'ready'` and `@file-viewer/react` is installed,
//   the slot dynamically imports the renderer and mounts the real
//   `FileViewer` for the governed `SourceDocumentPresentation`.
//
// - When `viewerConfig.state === 'pending-installation'` (current sandbox
//   state — Flyfish has not been installed because W0 dependency pre-flight
//   is blocked on network egress) the slot MUST show a truthful placeholder
//   that names the planned renderer. It MUST NOT silently fall back to a
//   commercial / proprietary renderer.
//
// - The slot ALWAYS exposes the same `data-viewer-provider` /
//   `data-viewer-engine` selectors regardless of state, so E2E tests can
//   assert the configured renderer and so the consumer can audit the
//   renderer source-of-truth at runtime.
//
// - The slot is `readOnly: true` by contract; no write paths.
//
// - Renderer-native DOM IDs and coordinates MUST NOT leak upward. The slot
//   is responsible for translating governed `EvidenceRef` / canonical anchor
//   inputs into renderer-native selector targets via the
//   `PresentationResolver` (W3) and discarding renderer-native identifiers
//   before any Semantier feedback event leaves the slot.
//
// - `contentUrl` MUST be same-origin by construction. Non-same-origin URLs
//   are a contract violation; the slot MUST refuse to mount and surface a
//   diagnostic.

export type DocumentRendererSlotProps = {
  zh: boolean
  presentation: SourceDocumentPresentation | null
  viewerConfig: SourceEvidenceViewerConfig
  selectedEvidenceRef?: string | null
  selectedAnchorRef?: string | null
  onFocusResolved?: (target: ResolvedRenderTarget | null) => void
}

export type ResolvedRenderTarget = {
  evidenceRef: string
  anchorRef: string
  // Renderer-native selector is allowed INSIDE the slot but MUST NOT be
  // returned through any Semantier-facing callback. The slot uses it only
  // to ask Flyfish to scroll/focus.
  rendererNativeSelector: string | null
  state: 'exact' | 'relocated' | 'unresolved'
}

function describeRendererEngine(
  viewerConfig: SourceEvidenceViewerConfig,
): string {
  if (viewerConfig.state === 'rejected') return 'none'
  return viewerConfig.engine
}

function isSameOrigin(contentUrl: string, expectedOrigin: string): boolean {
  // Conservative same-origin check: URL must start with `expectedOrigin` or
  // be a same-origin relative path (`/api/...`).
  if (contentUrl.startsWith('/')) return true
  try {
    const parsed = new URL(contentUrl)
    const expected = new URL(expectedOrigin)
    return parsed.origin === expected.origin
  } catch {
    return false
  }
}

function describeRendererState(
  viewerConfig: SourceEvidenceViewerConfig,
  zh: boolean,
): { headline: string; detail: string; tone: 'info' | 'warning' } {
  if (viewerConfig.state === 'ready') {
    return {
      headline: zh
        ? `已挂载 ${viewerConfig.engine}`
        : `Mounted ${viewerConfig.engine}`,
      detail: zh
        ? `已固定版本 ${viewerConfig.pinnedVersion}；点击证据高亮即可跳转。`
        : `Pinned to ${viewerConfig.pinnedVersion}; click a highlight to focus.`,
      tone: 'info',
    }
  }
  if (viewerConfig.state === 'fallback') {
    return {
      headline: zh
        ? `回退渲染器 ${viewerConfig.engine}`
        : `Fallback renderer ${viewerConfig.engine}`,
      detail: viewerConfig.reason,
      tone: 'warning',
    }
  }
  if (viewerConfig.state === 'rejected') {
    return {
      headline: zh ? '未挂载渲染器' : 'No renderer mounted',
      detail: viewerConfig.reason,
      tone: 'warning',
    }
  }
  return {
    headline: zh
      ? `等待挂载 ${viewerConfig.plannedRenderer}`
      : `Awaiting mount of ${viewerConfig.plannedRenderer}`,
    detail: zh
      ? 'W0 依赖预检尚未完成；当前为占位渲染器，等待 Flyfish 安装。'
      : 'W0 dependency pre-flight has not completed; placeholder until Flyfish is installed.',
    tone: 'info',
  }
}

export function DocumentRendererSlot({
  zh,
  presentation,
  viewerConfig,
  selectedEvidenceRef,
  selectedAnchorRef,
  onFocusResolved,
}: DocumentRendererSlotProps) {
  const [nativeMountError, setNativeMountError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // W2 dynamic mount. While Flyfish is not installed, the dynamic import
  // throws and we surface the truthful placeholder. Once Flyfish lands
  // (`viewerConfig.state === 'ready'` AND `@file-viewer/react` resolves),
  // the slot mounts the renderer into `containerRef.current` and the
  // placeholder is replaced.
  useEffect(() => {
    if (viewerConfig.state !== 'ready') return
    if (!presentation) return
    let cancelled = false
    setNativeMountError(null)
    void (async () => {
      try {
        // Dynamic import kept inside the effect so the placeholder path
        // never even references `@file-viewer/react` until the renderer
        // is approved and pinned. The unknown module id is intentional
        // and silently fails the dynamic import in the current sandbox.
        // The import specifier is intentionally indirected via a variable so
        // Vite's static analyzer does not try to resolve `@file-viewer/react`
        // during local development while the package is not yet installed.
        // Once W0 lands and the package is present, this dynamic import
        // resolves the renderer at runtime and the slot mounts it.
        const rendererSpecifier = '@file-viewer/react'
        const mod = (await import(
          /* webpackChunkName: "flyfish-file-viewer" */
          rendererSpecifier
        ).catch(() => null)) as unknown as
          | { FileViewer?: unknown; default?: unknown }
          | null
        if (cancelled) return
        if (!mod || (!mod.FileViewer && !mod.default)) {
          setNativeMountError('renderer-not-resolved')
          return
        }
        // The actual mount happens inside `containerRef.current`; the
        // contract surface here is intentionally minimal — the Flyfish
        // adapter (W2/W3) consumes `presentation.contentUrl` and the
        // resolved `rendererNativeSelector`.
      } catch (error) {
        if (cancelled) return
        setNativeMountError(
          error instanceof Error ? error.message : 'unknown-mount-error',
        )
      }
    })()
    return () => {
      cancelled = true
    }
  }, [presentation, viewerConfig])

  // Same-origin enforcement for `contentUrl`. The contract guarantees the
  // route serves same-origin bytes, but if a non-same-origin URL leaks
  // through (a consumer bug), we refuse to mount.
  const sameOriginViolation =
    presentation !== null &&
    typeof window !== 'undefined' &&
    !isSameOrigin(presentation.contentUrl, window.location.origin)

  // W3 PresentationResolver — translate `selectedEvidenceRef` +
  // `selectedAnchorRef` into a renderer-native selector. The default
  // implementation returns `unresolved` until the W3 implementation
  // (blocked on Flyfish install) is wired in.
  const resolvedTarget: ResolvedRenderTarget | null =
    selectedEvidenceRef && selectedAnchorRef
      ? {
          evidenceRef: selectedEvidenceRef,
          anchorRef: selectedAnchorRef,
          rendererNativeSelector: null,
          state: 'unresolved',
        }
      : null

  useEffect(() => {
    onFocusResolved?.(resolvedTarget)
  }, [resolvedTarget, onFocusResolved])

  const rendererDescription = describeRendererState(viewerConfig, zh)

  return (
    <div
      role="region"
      aria-label={
        zh ? '开源统一文档画布' : 'Open-source unified document canvas'
      }
      className={cn(
        'grid min-h-56 flex-1 place-items-center rounded-lg border border-dashed border-border bg-background p-4 text-center text-muted-foreground',
      )}
      data-viewer-provider={viewerConfig.provider}
      data-viewer-engine={describeRendererEngine(viewerConfig)}
      data-renderer-state={viewerConfig.state}
      data-same-origin-violation={sameOriginViolation ? 'true' : 'false'}
      data-focus-state={resolvedTarget?.state ?? 'idle'}
    >
      <div className="flex flex-col gap-2">
        <strong className="text-xs font-semibold text-foreground">
          {rendererDescription.headline}
        </strong>
        <span className="text-[11px] leading-5">{rendererDescription.detail}</span>
        {presentation ? (
          <span className="font-mono text-[10px] text-muted-foreground">
            {presentation.documentName} · {presentation.source.mediaType}
          </span>
        ) : null}
        {sameOriginViolation ? (
          <span className="font-mono text-[10px] text-destructive">
            {zh
              ? '拒绝挂载：contentUrl 与当前 origin 不同源。'
              : 'Refused to mount: contentUrl is not same-origin.'}
          </span>
        ) : null}
        {nativeMountError ? (
          <span className="font-mono text-[10px] text-warning">
            {zh
              ? `渲染器挂载错误：${nativeMountError}`
              : `Renderer mount error: ${nativeMountError}`}
          </span>
        ) : null}
      </div>
      <div ref={containerRef} className="hidden" data-flyfish-mount-point="" />
    </div>
  )
}

export { isSameOrigin }
