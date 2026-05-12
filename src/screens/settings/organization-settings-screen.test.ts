import { describe, expect, it } from 'vitest'
import { ORGANIZATION_SETTINGS_COPY } from './organization-settings-screen'

describe('organization settings copy', () => {
  it('describes the active org as SMB analytics default context', () => {
    expect(ORGANIZATION_SETTINGS_COPY.title).toBe('Organization Context')
    expect(ORGANIZATION_SETTINGS_COPY.subtitle).toContain(
      'default SMB analytics context',
    )
    expect(ORGANIZATION_SETTINGS_COPY.subtitle).toContain('organization_id')
  })
})
