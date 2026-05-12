import { describe, expect, it } from 'vitest'

import { SETTINGS_NAV_ITEMS } from './settings-screen'

describe('data connections discoverability', () => {
  it('keeps organization settings in navigation before data connections', () => {
    expect(
      SETTINGS_NAV_ITEMS.some(
        (item) =>
          item.id === 'organization' &&
          item.label === 'Organization' &&
          item.to === '/settings/organization',
      ),
    ).toBe(true)
  })

  it('keeps data connections in settings navigation', () => {
    expect(
      SETTINGS_NAV_ITEMS.some(
        (item) =>
          item.id === 'data_connections' &&
          item.label === 'Data Connections' &&
          item.to === '/settings/data-connections',
      ),
    ).toBe(true)
  })
})
