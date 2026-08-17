export const VIZ_FALLBACK = [
  '#2F6BFF',
  '#7A3CFF',
  '#00A7E1',
  '#00C27A',
  '#84CC16',
  '#FFB020',
  '#FF7A00',
  '#FF5C8A',
  '#E5484D',
  '#B658D6',
  '#14B8A6',
  '#6B8AFB',
  '#22C55E',
  '#F59E0B',
  '#EC4899',
  '#06B6D4',
] as const

export function stableGraphKeyHash(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function cssToken(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

export function graphCategoryColor(key: string): string {
  const slot = stableGraphKeyHash(key) % VIZ_FALLBACK.length
  return cssToken(`--viz-${slot + 1}`, VIZ_FALLBACK[slot])
}
