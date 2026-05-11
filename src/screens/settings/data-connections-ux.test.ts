import { describe, expect, it } from 'vitest'

import { SETTINGS_NAV_ITEMS } from '@/routes/settings/index'

describe('data connections discoverability', () => {
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
