/**
 * Re-export of the canonical showcase screen for routing use.
 *
 * The plan designates `semantica-showcase-screen.tsx` as the implementation
 * entry point. This thin module makes the route binding explicit and gives
 * callers a stable import surface that won't change when internals are split.
 */
export { SemanticaShowcaseScreen } from './semantica-showcase-screen'

/**
 * Plan §11.4 / W6-13 decision log:
 *
 * The reference HTML pair shows an "Assistant / Query" subpanel in the right
 * rail. We deliberately OMIT it in the React showcase:
 *
 *   1. No existing Hermes Workspace capability can drive a chat/query panel
 *      against the showcase subtree without adding a live-runtime dependency
 *      to the showcase, which would violate §12 (offline/no-backend contract)
 *      and §13 (product/runtime boundary).
 *   2. Faking the subpanel with placeholder controls would violate the
 *      plan's "no fake HTML telemetry" rule.
 *
 * The right rail therefore hosts only inspector fields, metric cards, and
 * provenance — all sourced from the active fixture/renderer state. If a
 * future Hermes capability (e.g. a fully-offline assistant) is added, the
 * subpanel can be re-introduced behind the same ShowcaseViewMeta contract.
 */
