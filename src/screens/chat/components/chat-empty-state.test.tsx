import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/semantier-auth', () => ({
  useSemantierAuthStatus: () => ({
    data: null,
  }),
}))

vi.mock('@/lib/organization-membership', () => ({
  ensureDefaultSmbOrganization: vi.fn(),
}))

import {
  ChatEmptyState,
  capabilityChipsForPromptProfile,
  categoriesForPromptProfile,
  resolveChatEmptyStatePromptProfile,
} from './chat-empty-state'

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

  it('renders the insights action when runtime props are provided', () => {
    const markup = renderToStaticMarkup(
      <ChatEmptyState
        onRunInsights={() => {}}
        isRunningInsights
      />,
    )

    expect(markup).toContain('正在生成洞察...')
    expect(markup).toContain('disabled')
  })
})
