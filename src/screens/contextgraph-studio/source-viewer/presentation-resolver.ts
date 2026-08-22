import type { SourceDocumentPresentation } from '@/contracts/source-document'

import type { ResolvedRenderTarget } from './document-renderer-slot'

// PresentationResolver maps a governed `EvidenceRef` + canonical `anchorRef`
// pair into an ephemeral renderer-native selector that the active
// `DocumentRendererSlot` can hand to the renderer for scroll/focus.
//
// Invariants (per `docs/plans/2026-08-22-contextgraph-open-source-source-viewer-integration-v1.md`
// C3 and `docs/derived/evidence-location-invariance-architecture-v1.md`):
//
// - The resolver NEVER returns a renderer-native ID through any
//   Semantier-facing callback. Renderer-native selectors are allowed inside
//   `ResolvedRenderTarget.rendererNativeSelector` and are consumed only by
//   the `DocumentRendererSlot` to ask the renderer to scroll/focus.
//
// - The resolver MUST preserve the canonical `EvidenceRef` and `anchorRef`
//   on the result regardless of state. Resolution failure is explicit and
//   does not mutate the canonical evidence reference.
//
// - The resolver MUST be deterministic for a given
//   `(evidenceRef, anchorRef, mediaType)` tuple; non-determinism would
//   defeat the W7 round-trip E2E gate.
//
// - Resolution state `unresolved` is returned for evidence refs the
//   renderer cannot yet translate (e.g. before the W2 Flyfish shell
//   exposes its selector API). It is NOT a hard error.
//
// The Flyfish-backed implementation will be wired in W3 once W0 has
// installed `@file-viewer/react`. The default implementation below returns
// `unresolved` so callers have a deterministic placeholder during W0.

export type ResolveFocusInput = {
  evidenceRef: string
  anchorRef: string
  presentation: SourceDocumentPresentation | null
}

export type PresentationResolver = (input: ResolveFocusInput) => ResolvedRenderTarget | null

export const pendingPresentationResolver: PresentationResolver = (input) => {
  if (!input.evidenceRef || !input.anchorRef) return null
  return {
    evidenceRef: input.evidenceRef,
    anchorRef: input.anchorRef,
    rendererNativeSelector: null,
    state: 'unresolved',
  }
}
