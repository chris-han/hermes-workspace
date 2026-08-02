export type ObservatoryQueryKey = readonly [
  'inspector',
  'effective-context',
  string,
  string | null,
]

type CachedSnapshot<T> = {
  key: ObservatoryQueryKey
  value: T
}

const cache = new Map<string, CachedSnapshot<unknown>>()

export function observatoryQueryKey(
  sessionKey: string,
  checkpointId: string | null = null,
): ObservatoryQueryKey {
  return ['inspector', 'effective-context', sessionKey, checkpointId]
}

export function readObservatoryCache<T>(sessionKey: string): T | null {
  const entry = cache.get(sessionKey)
  return entry ? (entry.value as T) : null
}

export function writeObservatoryCache<T>(
  sessionKey: string,
  checkpointId: string | null,
  value: T,
): void {
  cache.set(sessionKey, {
    key: observatoryQueryKey(sessionKey, checkpointId),
    value,
  })
}

export function invalidateObservatoryCache(
  sessionKey: string,
  checkpointId?: string | null,
): void {
  const entry = cache.get(sessionKey)
  if (!entry) return
  if (checkpointId === undefined || entry.key[3] === checkpointId) {
    cache.delete(sessionKey)
  }
}

export function clearObservatoryCache(): void {
  cache.clear()
}
