import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import {
  ChatEmptyState,
  capabilityChipsForPromptProfile,
  categoriesForPromptProfile,
  resolveChatEmptyStatePromptProfile,
} from './chat-empty-state'

vi.mock('@/lib/semantier-auth', () => ({
  useSemantierAuthStatus: () => ({
    data: {
      organization_id: 'org_smb_cn',
      dataset_type: 'DEFAULT_REALISTIC_SAMPLE',
      industry_code: null,
    },
  }),
}))

vi.mock('@/lib/organization-membership', () => ({
  ensureDefaultSmbOrganization: vi.fn(),
}))

describe('chat empty state prompt profiles', () => {
  it('uses the apparel trade walkthrough for the apparel demo organization', () => {
    const profile = resolveChatEmptyStatePromptProfile({
      organizationId: 'org_demo_apparel_trade_cn',
      datasetType: 'DEMO',
      industryCode: 'apparel_customization_trade',
    })

    expect(profile).toBe('apparel_trade')
    expect(categoriesForPromptProfile(profile)[0]?.examples.map((item) => item.title)).toEqual([
      '营业分析',
      '日常入账报销',
      '报税报告生成',
      '合规报告生成',
    ])
  })

  it('uses the SMB walkthrough for the seeded default realistic sample org', () => {
    const profile = resolveChatEmptyStatePromptProfile({
      organizationId: 'org_smb_cn',
      datasetType: 'DEFAULT_REALISTIC_SAMPLE',
    })

    expect(profile).toBe('smb_default')
    expect(categoriesForPromptProfile(profile)[0]?.examples.map((item) => item.title)).toEqual([
      '试用 索阳 示例公司 — 60 秒获得洞察',
      '一键运行 3 条示例分析 — 60 秒获得洞察',
      '营业分析',
      '日常入账报销',
      '报税报告生成',
      '合规报告生成',
    ])
    expect(capabilityChipsForPromptProfile(profile)).toContain(
      'Bootstrap Demo Dataset',
    )
  })

  it('falls back to the generic profile for non-demo organizations', () => {
    const profile = resolveChatEmptyStatePromptProfile({
      organizationId: 'org_real_customer',
      datasetType: 'REAL',
      industryCode: 'manufacturing',
    })

    expect(profile).toBe('generic')
    expect(capabilityChipsForPromptProfile(profile)).toContain(
      '56 Finance Skills',
    )
  })

  it('renders the demo walkthrough actions inside the walkthrough cards', () => {
    const markup = renderToStaticMarkup(<ChatEmptyState />)

    expect(markup).toContain('试用 索阳 示例公司 — 60 秒获得洞察')
    expect(markup).toContain('一键运行 3 条示例分析 — 60 秒获得洞察')
  })
})
