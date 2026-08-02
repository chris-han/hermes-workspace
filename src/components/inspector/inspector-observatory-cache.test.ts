import { afterEach, describe, expect, it } from 'vitest'

import {
  clearObservatoryCache,
  invalidateObservatoryCache,
  observatoryQueryKey,
  readObservatoryCache,
  writeObservatoryCache,
} from './inspector-observatory-cache'

describe('Inspector observatory cache keys', () => {
  afterEach(clearObservatoryCache)

  it('qualifies cache identity by session and checkpoint', () => {
    expect(observatoryQueryKey('session_a', 'checkpoint_1')).toEqual([
      'inspector',
      'effective-context',
      'session_a',
      'checkpoint_1',
    ])
    writeObservatoryCache('session_a', 'checkpoint_1', { value: 'a' })
    writeObservatoryCache('session_b', 'checkpoint_2', { value: 'b' })

    expect(readObservatoryCache('session_a')).toEqual({ value: 'a' })
    expect(readObservatoryCache('session_b')).toEqual({ value: 'b' })
    invalidateObservatoryCache('session_a', 'checkpoint_2')
    expect(readObservatoryCache('session_a')).toEqual({ value: 'a' })
    invalidateObservatoryCache('session_a', 'checkpoint_1')
    expect(readObservatoryCache('session_a')).toBeNull()
  })
})
