import { describe, expect, it } from 'vitest'

import { isBareSettingsPath } from './settings'

describe('settings route redirect', () => {
  it('treats the bare settings path as the settings screen path', () => {
    expect(isBareSettingsPath('/settings')).toBe(true)
  })

  it('does not treat nested settings routes as the bare settings screen', () => {
    expect(isBareSettingsPath('/settings/data-connections')).toBe(false)
  })
})
