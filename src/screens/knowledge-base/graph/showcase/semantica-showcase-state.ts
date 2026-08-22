/**
 * Semantica showcase — deterministic state resolution (plan §4.1.3).
 *
 * This module is the single implementation of the canonical fallback
 * contract for dataset/lens/submode state. The screen's dataset-switch logic
 * and the tests must call `resolveShowcaseState` rather than re-implementing
 * the algorithm or the canonical orders (which live in
 * `semantica-showcase-types.ts`).
 *
 * Algorithm (§4.1.3):
 *   1. preserve the requested lens iff the active dataset supports it;
 *   2. otherwise choose the first supported lens in canonical lens order;
 *   3. for lenses with submodes, preserve the requested submode iff the
 *      dataset declares it (declared-and-present is guaranteed by the loader
 *      consistency checks in `semantica-showcase-dataset.ts`);
 *   4. otherwise choose the first declared submode in canonical submode order;
 *   5. a supported submode lens with no declared submode is a registry
 *      integrity error — raise; never fall back to stale content.
 */

import {
  SHOWCASE_ANALYTICS_SUBMODE_ORDER,
  SHOWCASE_LENS_ORDER,
  SHOWCASE_TEMPORAL_SUBMODE_ORDER,
  type AnalyticsShowcaseSubmode,
  type ShowcaseSupportedSubmodes,
  type ShowcaseVisualizationMode,
  type TemporalShowcaseSubmode,
} from './semantica-showcase-types'

export interface ShowcaseCapability {
  supportedLenses: ReadonlyArray<ShowcaseVisualizationMode>
  supportedSubmodes?: ShowcaseSupportedSubmodes
}

export interface ShowcaseStateRequest {
  lens?: ShowcaseVisualizationMode
  temporalSubmode?: TemporalShowcaseSubmode
  analyticsSubmode?: AnalyticsShowcaseSubmode
}

export interface ShowcaseStateResolution {
  lens: ShowcaseVisualizationMode
  /** Resolved when the dataset declares temporal submodes; otherwise null. */
  temporalSubmode: TemporalShowcaseSubmode | null
  /** Resolved when the dataset declares analytics submodes; otherwise null. */
  analyticsSubmode: AnalyticsShowcaseSubmode | null
}

function pickFirstInCanonicalOrder<T extends string>(
  canonicalOrder: ReadonlyArray<T>,
  supported: ReadonlyArray<T>,
): T | null {
  for (const candidate of canonicalOrder) {
    if (supported.includes(candidate)) return candidate
  }
  return null
}

export function resolveShowcaseState(
  capability: ShowcaseCapability,
  requested: ShowcaseStateRequest = {},
): ShowcaseStateResolution {
  const supportedLenses = capability.supportedLenses
  const lens =
    requested.lens && supportedLenses.includes(requested.lens)
      ? requested.lens
      : pickFirstInCanonicalOrder(SHOWCASE_LENS_ORDER, supportedLenses)
  if (!lens) {
    // Empty capability sets are a registry error; the loader rejects them but
    // surface a clear error if the invariant is violated.
    throw new Error(
      'Showcase dataset has empty supportedLenses; this is a registry error.',
    )
  }

  const declaredTemporal = capability.supportedSubmodes?.temporal ?? []
  const declaredAnalytics = capability.supportedSubmodes?.analytics ?? []

  // §4.1.3 step 5: a supported submode lens with no declared (and, per the
  // loader, present) submode is invalid — raise instead of substituting stale
  // content from another dataset or lens.
  if (lens === 'temporal' && declaredTemporal.length === 0) {
    throw new Error(
      'Showcase dataset supports the temporal lens but declares no temporal submode; registry integrity error.',
    )
  }
  if (lens === 'analytics' && declaredAnalytics.length === 0) {
    throw new Error(
      'Showcase dataset supports the analytics lens but declares no analytics submode; registry integrity error.',
    )
  }

  const temporalSubmode =
    declaredTemporal.length === 0
      ? null
      : requested.temporalSubmode && declaredTemporal.includes(requested.temporalSubmode)
        ? requested.temporalSubmode
        : pickFirstInCanonicalOrder(SHOWCASE_TEMPORAL_SUBMODE_ORDER, declaredTemporal)
  const analyticsSubmode =
    declaredAnalytics.length === 0
      ? null
      : requested.analyticsSubmode && declaredAnalytics.includes(requested.analyticsSubmode)
        ? requested.analyticsSubmode
        : pickFirstInCanonicalOrder(SHOWCASE_ANALYTICS_SUBMODE_ORDER, declaredAnalytics)

  return { lens, temporalSubmode, analyticsSubmode }
}
