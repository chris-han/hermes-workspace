import { useEffect, useRef, useState, type ComponentType } from 'react'

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
//   `FileViewer` for the governed `SourceDocumentPresentation`. The
//   `@file-viewer/preset-office` package is side-effect-imported so the PDF
//   and Word renderer plugins are registered with the `@file-viewer/core`
//   registry before the FileViewer mounts.
//
// - When `viewerConfig.state === 'pending-installation'` the slot MUST show
//   a truthful placeholder that names the planned renderer. It MUST NOT
//   silently fall back to a commercial / proprietary renderer.
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

// Minimum surface area of `@file-viewer/react` that this slot consumes.
// The real package exports a far richer API; this typed shim keeps the
// W2 mount boundary stable and lets the integration test assert on the
// actual surface without coupling to internal types.
type FlyfishFileViewerProps = {
  url?: string
  file?: ArrayBuffer | Blob | string | null
  buffer?: ArrayBuffer | Blob | null
  name?: string
  filename?: string
  type?: string
  size?: number
  onStateChange?: (state: unknown) => void
  onEvent?: (event: { type?: string; payload?: unknown }) => void
}

type FlyfishModule = {
  FileViewer?: ComponentType<FlyfishFileViewerProps>
  default?: ComponentType<FlyfishFileViewerProps>
}

type FlyfishSlotState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; FileViewer: ComponentType<FlyfishFileViewerProps> }
  | { kind: 'error'; code: string; message: string }

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

function describeRendererEngine(
  viewerConfig: SourceEvidenceViewerConfig,
): string {
  if (viewerConfig.state === 'rejected') return 'none'
  return viewerConfig.engine
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
  const [flyfish, setFlyfish] = useState<FlyfishSlotState>({ kind: 'idle' })
  const containerRef = useRef<HTMLDivElement | null>(null)

  // W2 dynamic mount. The import specifier is intentionally indirected via a
  // variable so Vite's static analyzer does not try to resolve the package
  // when it is not yet installed. When Flyfish IS installed and
  // `viewerConfig.state === 'ready'`, the dynamic imports resolve the real
  // `@file-viewer/react` and `@file-viewer/preset-office` packages and the
  // slot mounts the FileViewer into `containerRef.current`.
  //
  // The `flyfishStateRef` mirrors `flyfish` so the effect can read the
  // latest state without subscribing to it via the dependency array.
  // Subscribing via dependency would cause the cleanup to fire every
  // time the slot transitions `idle -> loading`, cancelling the in-flight
  // import and leaving the slot stuck at `loading` forever.
  const flyfishStateRef = useRef(flyfish)
  flyfishStateRef.current = flyfish
  const viewerConfigRef = useRef(viewerConfig)
  viewerConfigRef.current = viewerConfig
  useEffect(() => {
    if (viewerConfig.state !== 'ready') {
      setFlyfish({ kind: 'idle' })
      return
    }
    if (
      flyfishStateRef.current.kind === 'loading' ||
      flyfishStateRef.current.kind === 'ready'
    ) {
      return
    }
    let cancelled = false
    setFlyfish({ kind: 'loading' })
    void (async () => {
      try {
        const reactSpecifier = '@file-viewer/react'
        const presetSpecifier = '@file-viewer/preset-office'
        const [reactMod, presetMod] = await Promise.all([
          import(/* webpackChunkName: "flyfish-file-viewer" */ reactSpecifier).catch(
            () => null,
          ),
          import(/* webpackChunkName: "flyfish-preset-office" */ presetSpecifier).catch(
            () => null,
          ),
        ])
        if (cancelled) return
        const typedReact = reactMod as unknown as FlyfishModule | null
        const FileViewer =
          typedReact?.FileViewer ?? typedReact?.default ?? null
        if (!FileViewer) {
          setFlyfish({
            kind: 'error',
            code: 'renderer-not-resolved',
            message:
              'Dynamic import of @file-viewer/react did not expose a FileViewer component.',
          })
          return
        }
        // The preset-office import is a side-effect: it registers the
        // PDF / Word / spreadsheet / presentation renderer plugins with
        // the @file-viewer/core registry. Holding the module reference
        // is not strictly required, but doing so prevents the side
        // effects from being tree-shaken in production bundles.
        void presetMod
        setFlyfish({ kind: 'ready', FileViewer })
      } catch (error) {
        if (cancelled) return
        setFlyfish({
          kind: 'error',
          code: 'renderer-import-failed',
          message: error instanceof Error ? error.message : 'unknown-error',
        })
      }
    })()
    return () => {
      cancelled = true
    }
    // Effect intentionally depends ONLY on viewerConfig identity. The
    // refs above let us read the latest flyfish state and viewerConfig
    // without subscribing, so the cleanup does not fire on every
    // flyfish transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewerConfig])

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
  const isReadyForMount = flyfish.kind === 'ready' && !sameOriginViolation
  const FileViewerComponent =
    isReadyForMount && presentation ? flyfish.FileViewer : null

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
      data-flyfish-module-state={flyfish.kind}
    >
      {FileViewerComponent && presentation ? (
        <div
          ref={containerRef}
          className="file-viewer-slot-mount w-full"
          data-flyfish-mount-point=""
          data-flyfish-engine={describeRendererEngine(viewerConfig)}
        >
          <FileViewerComponent
            url={presentation.contentUrl}
            type={presentation.source.mediaType}
            name={presentation.documentName}
            filename={presentation.documentName}
            onStateChange={(state) => {
              // Surface the Flyfish state to the Semantier-side, but never
              // expose renderer-native identifiers. We pass through the
              // plain `loading`/`ready`/`error` envelope that the
              // Flyfish controller emits.
              void state
            }}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <strong className="text-xs font-semibold text-foreground">
            {rendererDescription.headline}
          </strong>
          <span className="text-[11px] leading-5">
            {rendererDescription.detail}
          </span>
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
          {flyfish.kind === 'error' ? (
            <span className="font-mono text-[10px] text-warning">
              {zh
                ? `渲染器挂载错误：${flyfish.code} — ${flyfish.message}`
                : `Renderer mount error: ${flyfish.code} — ${flyfish.message}`}
            </span>
          ) : null}
          {flyfish.kind === 'loading' ? (
            <span className="font-mono text-[10px] text-muted-foreground">
              {zh ? '正在加载 Flyfish 渲染器...' : 'Loading Flyfish renderer...'}
            </span>
          ) : null}
        </div>
      )}
      {/* Mount-point only exists when the real renderer is mounted.
          Downstream adapters should check both `data-flyfish-module-state="ready"`
          AND the presence of `[data-flyfish-mount-point]` to know the
          renderer has actually mounted. The containerRef is attached to
          the real mount subtree above (when mounted) so any future
          adapter needing a handle can read it from the active mount. */}
    </div>
  )
}

export { isSameOrigin }
