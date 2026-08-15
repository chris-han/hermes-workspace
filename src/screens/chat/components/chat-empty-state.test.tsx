import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { KnowledgeWorkbenchContext } from '@/contracts/knowledge-workbench'
import {
  ChatEmptyState,
  capabilityChipsForPromptProfile,
  categoriesForPromptProfile,
  contextAwareCategoriesForWorkbench,
  resolveChatEmptyStatePromptProfile,
} from './chat-empty-state'

vi.mock('@/lib/semantier-auth', () => ({
  useSemantierAuthStatus: () => ({
    data: {
      organization_id: 'org_construction_3_year_cn',
      dataset_type: 'DEFAULT_REALISTIC_SAMPLE',
      industry_code: null,
    },
  }),
}))

vi.mock('@/lib/organization-membership', () => ({
  ensureDefaultSmbOrganization: vi.fn(),
}))

const WORKBENCH_CONTEXT: KnowledgeWorkbenchContext = {
  schemaVersion: 'knowledge_workbench_context.v2',
  graphRef: 'graph_demo',
  graphVersion: 'v12',
  graphHash: 'hash_demo',
  authorityState: 'candidate',
  runMode: null,
  candidateGraphId: 'graph_demo',
  acceptedReleaseId: null,
  acceptedReleaseVersion: null,
  selectedNodeIds: ['node_1'],
  selectedEdgeIds: [],
  selectedRuleIds: ['node_1'],
  selectedCandidateId: null,
  selectedEvidenceRefs: ['ev_1'],
  activeSourceIdentityRef: 'source_1',
  sourceAnchors: [],
  governanceState: 'candidate',
  hasAcceptedRelease: false,
  extractionRunId: null,
  providerRef: 'semantica',
  providerCommit: null,
}

describe('chat empty state prompt profiles', () => {
  it('uses the apparel trade walkthrough for the apparel demo organization', () => {
    const profile = resolveChatEmptyStatePromptProfile({
      organizationId: 'org_demo_apparel_trade_cn',
      datasetType: 'DEMO',
      industryCode: 'apparel_customization_trade',
    })

    expect(profile).toBe('apparel_trade')
    expect(
      categoriesForPromptProfile(profile)[0]?.examples.map(
        (item) => item.title,
      ),
    ).toEqual(['营业分析', '日常入账报销', '报税报告生成', '合规报告生成'])
  })

  it('uses the SMB walkthrough for the seeded default realistic sample org', () => {
    const profile = resolveChatEmptyStatePromptProfile({
      organizationId: 'org_construction_3_year_cn',
      datasetType: 'DEFAULT_REALISTIC_SAMPLE',
    })

    expect(profile).toBe('smb_default')
    expect(
      categoriesForPromptProfile(profile)[0]?.examples.map(
        (item) => item.title,
      ),
    ).toEqual([
      '试用 索阳 示例公司 — 60 秒获得洞察',
      '营业分析',
      '日常入账报销',
      '报税报告生成',
      '合规报告生成',
    ])
    expect(capabilityChipsForPromptProfile(profile)).toContain(
      'Bootstrap Demo Dataset',
    )
  })

  it('uses the SMB walkthrough when anonymous auth has no organization context', () => {
    const profile = resolveChatEmptyStatePromptProfile({})

    expect(profile).toBe('smb_default')
    expect(
      categoriesForPromptProfile(profile)[0]?.examples.map(
        (item) => item.title,
      ),
    ).toContain('试用 索阳 示例公司 — 60 秒获得洞察')
  })

  it('falls back to the demo walkthrough for non-demo organizations', () => {
    const profile = resolveChatEmptyStatePromptProfile({
      organizationId: 'org_real_customer',
      datasetType: 'REAL',
      industryCode: 'manufacturing',
    })

    expect(profile).toBe('smb_default')
    expect(categoriesForPromptProfile(profile)[0]?.examples.map((item) => item.title)).toContain(
      '试用 索阳 示例公司 — 60 秒获得洞察',
    )
  })

  it('derives graph and evidence prompts from unified workbench context', () => {
    const categories = contextAwareCategoriesForWorkbench(WORKBENCH_CONTEXT, true)
    const titles = categories?.[0]?.examples.map((item) => item.title)

    expect(titles).toContain('解释当前图选择')
    expect(titles).toContain('查看相关概念与关系')
    expect(titles).toContain('追溯支持证据')
  })

  it('derives evaluation prompts only when evaluation runMode is active', () => {
    const categories = contextAwareCategoriesForWorkbench(
      { ...WORKBENCH_CONTEXT, runMode: 'evaluation_baseline' },
      false,
    )
    const titles = categories?.[0]?.examples.map((item) => item.title)

    expect(titles).toContain('Explain current evaluation')
    expect(titles).toContain('Diagnose failed gates')
  })

  it('renders the demo walkthrough actions inside the walkthrough cards', () => {
    const markup = renderToStaticMarkup(<ChatEmptyState />)

    expect(markup).toContain('试用 索阳 示例公司 — 60 秒获得洞察')
    expect(markup).toContain('初始化索阳示例公司并进入演示工作区。')
    expect(markup).not.toContain('一键运行 3 条示例分析 — 60 秒获得洞察')
  })
})
