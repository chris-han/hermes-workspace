import { describe, expect, it } from 'vitest'
import {
  ORGANIZATION_SETTINGS_COPY,
  buildOrganizationSearchOptions,
  filterOrganizationSearchOptions,
} from './organization-settings-screen'

describe('organization settings copy', () => {
  it('describes demo-to-real company onboarding', () => {
    expect(ORGANIZATION_SETTINGS_COPY.title).toBe('Organization Context')
    expect(ORGANIZATION_SETTINGS_COPY.subtitle).toContain(
      'governed bootstrap demo organization',
    )
    expect(ORGANIZATION_SETTINGS_COPY.subtitle).toContain('real company')
  })

  it('keeps organization context messaging focused on governed defaults', () => {
    expect(ORGANIZATION_SETTINGS_COPY.subtitle).toContain('governed')
  })
})

describe('organization search options', () => {
  it('merges governed demo profiles with known memberships', () => {
    const options = buildOrganizationSearchOptions(
      [
        {
          organization_id: 'org_smb_cn',
          organization_name: '北京索阳科技有限公司',
          membership_status: 'active',
          member_role: 'owner',
        },
      ],
      [
        {
          organization_id: 'org_smb_cn',
          organization_name: '北京索阳科技有限公司',
          dataset_type: 'smb',
          industry_code: 'CN-SMB',
          dataset_key: 'smb_cn',
          seeded: true,
        },
        {
          organization_id: 'org_retail_cn',
          organization_name: '上海零售样例有限公司',
          dataset_type: 'retail',
          industry_code: 'CN-RETAIL',
          seeded: true,
        },
      ],
    )

    expect(options).toHaveLength(2)
    expect(options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          organization_id: 'org_smb_cn',
          organization_name: '北京索阳科技有限公司',
          membership_status: 'active',
          member_role: 'owner',
          dataset_key: 'smb_cn',
          seeded: true,
        }),
        expect.objectContaining({
          organization_id: 'org_retail_cn',
          organization_name: '上海零售样例有限公司',
        }),
      ]),
    )
  })

  it('filters by organization name, id, and dataset fields', () => {
    const options = buildOrganizationSearchOptions(
      [],
      [
        {
          organization_id: 'org_smb_cn',
          organization_name: '北京索阳科技有限公司',
          dataset_type: 'smb',
          industry_code: 'CN-SMB',
          dataset_key: 'smb_cn',
        },
        {
          organization_id: 'org_retail_cn',
          organization_name: '上海零售样例有限公司',
          dataset_type: 'retail',
          industry_code: 'CN-RETAIL',
          dataset_key: 'retail_cn',
        },
      ],
    )

    expect(filterOrganizationSearchOptions(options, '索阳')).toHaveLength(1)
    expect(
      filterOrganizationSearchOptions(options, 'org_retail_cn')[0],
    ).toMatchObject({
      organization_id: 'org_retail_cn',
    })
    expect(filterOrganizationSearchOptions(options, 'CN-SMB')[0]).toMatchObject(
      {
        organization_id: 'org_smb_cn',
      },
    )
  })
})
