import { describe, expect, it } from 'vitest'

import {
  REAL_COMPANY_SETTINGS_COPY,
  SETTINGS_NAV_ITEMS,
} from './settings-screen'

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

  it('exposes real-company switching from the main settings screen', () => {
    expect(REAL_COMPANY_SETTINGS_COPY.title).toBe('Company context')
    expect(REAL_COMPANY_SETTINGS_COPY.switchAction).toBe(
      'Switch to real company',
    )
    expect(REAL_COMPANY_SETTINGS_COPY.switchDemoAction).toBe(
      'Switch to demo company',
    )
    expect(REAL_COMPANY_SETTINGS_COPY.importAction).toBe('Open dataset import')
  })
})
