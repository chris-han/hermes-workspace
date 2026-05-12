import { describe, expect, it } from 'vitest'

import {
  buildIndustryOptions,
  industryLabelForCode,
  shouldShowProfileCompletion,
} from './profile-completion-screen'

describe('shouldShowProfileCompletion', () => {
  it('shows the completion flow only for authenticated incomplete profiles', () => {
    expect(shouldShowProfileCompletion(true, false)).toBe(true)
    expect(shouldShowProfileCompletion(true, true)).toBe(false)
    expect(shouldShowProfileCompletion(false, false)).toBe(false)
    expect(shouldShowProfileCompletion(undefined, false)).toBe(false)
  })

  it('builds unique industry options from seeded demo profiles', () => {
    expect(
      buildIndustryOptions([
        {
          organization_id: 'org_demo_apparel_trade_cn',
          organization_name: '北京宝库电子商务有限公司',
          industry_code: 'apparel_customization_trade',
          seeded: true,
        },
        {
          organization_id: 'org_demo_apparel_trade_cn_dup',
          organization_name: '北京宝库电子商务有限公司-重复',
          industry_code: 'apparel_customization_trade',
          seeded: true,
        },
      ]),
    ).toEqual([
      {
        industryCode: 'apparel_customization_trade',
        label: '服饰定制生产和贸易',
        organizationName: '北京宝库电子商务有限公司',
        seeded: true,
      },
    ])
  })

  it('labels known industries for onboarding copy', () => {
    expect(industryLabelForCode('apparel_customization_trade')).toBe(
      '服饰定制生产和贸易',
    )
    expect(industryLabelForCode('construction')).toBe(
      '建筑工程与项目型服务',
    )
  })
})
