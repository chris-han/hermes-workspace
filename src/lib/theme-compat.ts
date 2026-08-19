/**
 * Legacy theme compatibility resolver (convergence v2 §5.2, Wave 1).
 *
 * Maps any of the eight deprecated Hermes theme IDs to the corresponding
 * Semantier light / dark mode. The single canonical resolver for all callers
 * that previously read or persisted legacy theme IDs.
 *
 * After Wave 4, the only persisted theme values are `system` / `light` / `dark`.
 * The resolver remains in place for the Wave 7 final cleanup so any legacy
 * persisted value continues to resolve to a valid Semantier mode.
 */

export type LegacyThemeId =
  | 'hermes-nous'
  | 'hermes-nous-light'
  | 'hermes-official'
  | 'hermes-official-light'
  | 'hermes-classic'
  | 'hermes-classic-light'
  | 'hermes-slate'
  | 'hermes-slate-light'

export type CanonicalMode = 'light' | 'dark'

const LEGACY_TO_CANONICAL: Record<LegacyThemeId, CanonicalMode> = {
  'hermes-nous': 'dark',
  'hermes-nous-light': 'light',
  'hermes-official': 'dark',
  'hermes-official-light': 'light',
  'hermes-classic': 'dark',
  'hermes-classic-light': 'light',
  'hermes-slate': 'dark',
  'hermes-slate-light': 'light',
}

const LEGACY_SET = new Set<string>(Object.keys(LEGACY_TO_CANONICAL))

export function isLegacyThemeId(value: string): value is LegacyThemeId {
  return LEGACY_SET.has(value)
}

export function resolveLegacyTheme(value: string): CanonicalMode | null {
  if (isLegacyThemeId(value)) {
    return LEGACY_TO_CANONICAL[value]
  }
  return null
}

/**
 * Resolves any theme id (legacy or canonical) to the Semantier mode it maps to.
 * Returns null for unrecognized values.
 */
export function resolveToCanonicalMode(value: string): CanonicalMode | null {
  if (isLegacyThemeId(value)) {
    return LEGACY_TO_CANONICAL[value]
  }
  if (value === 'semantier-light') return 'light'
  if (value === 'semantier') return 'dark'
  return null
}

/**
 * Converts a Semantier mode back into the canonical persisted `data-theme`
 * attribute value.
 */
export function canonicalThemeIdForMode(mode: CanonicalMode): string {
  return mode === 'light' ? 'semantier-light' : 'semantier'
}