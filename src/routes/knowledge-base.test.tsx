import { describe, expect, it } from 'vitest'

import {
  KNOWLEDGE_BASE_BROWSE_TAB_VALUES,
  KNOWLEDGE_BASE_BUILD_TAB_VALUES,
  KNOWLEDGE_BASE_MODE_VALUES,
  getKnowledgeBaseCopy,
  normalizeKnowledgeBaseMode,
  normalizeKnowledgeBaseTab,
} from './knowledge-base'
import {
  KNOWLEDGE_BUILDER_UAT_LABELS,
  POLICY_RULE_UAT_LABELS,
  TENDER_REVIEW_UAT_LABELS,
} from '@/screens/knowledge-base/knowledge-base-screen'

describe('knowledge-base route UAT labels', () => {
  it('separates UAT build workflows from browse surfaces with exact English labels', () => {
    const copy = getKnowledgeBaseCopy('en')

    expect(KNOWLEDGE_BASE_MODE_VALUES).toEqual(['build', 'browse'])
    expect(KNOWLEDGE_BASE_BUILD_TAB_VALUES).toEqual([
      'builder',
      'tenderReview',
      'policyRules',
    ])
    expect(KNOWLEDGE_BASE_BROWSE_TAB_VALUES).toEqual([
      'legal',
      'general',
      'dataset',
      'effective',
      'governance',
    ])
    expect(copy.build).toBe('Build')
    expect(copy.browse).toBe('Browse')
    expect(copy.builder).toBe('Knowledge Builder Studio')
    expect(copy.tenderReview).toBe('Tender Review')
    expect(copy.policyRules).toBe('Policy-to-Rule Studio')
    expect(copy.stepDiscover).toBe('1. Discover')
    expect(copy.stepEvaluate).toBe('2. Evaluate')
    expect(copy.stepActivate).toBe('3. Activate')
    expect(copy.legal).toBe('Legal authority')
    expect(copy.general).toBe('General knowledge')
    expect(copy.dataset).toBe('Dataset')
    expect(copy.effective).toBe('Effective Context')
    expect(copy.governance).toBe('Governance')
  })

  it('exposes exact Chinese mode and workflow labels', () => {
    const copy = getKnowledgeBaseCopy('zh')

    expect(copy.build).toBe('构建')
    expect(copy.browse).toBe('浏览')
    expect(copy.builder).toBe('知识构建工作台')
    expect(copy.tenderReview).toBe('招标文件审查')
    expect(copy.policyRules).toBe('政策转规则工作台')
    expect(copy.stepDiscover).toBe('1. 发现')
    expect(copy.stepEvaluate).toBe('2. 评估')
    expect(copy.stepActivate).toBe('3. 激活')
  })

  it('normalizes mode and tabs to the literal UAT workflow defaults', () => {
    expect(normalizeKnowledgeBaseMode('build')).toBe('build')
    expect(normalizeKnowledgeBaseMode('browse')).toBe('browse')
    expect(normalizeKnowledgeBaseMode(undefined)).toBe('build')
    expect(normalizeKnowledgeBaseTab('build', 'builder')).toBe('builder')
    expect(normalizeKnowledgeBaseTab('build', 'legal')).toBe('builder')
    expect(normalizeKnowledgeBaseTab('browse', 'legal')).toBe('legal')
    expect(normalizeKnowledgeBaseTab('browse', 'builder')).toBe('legal')
  })

  it('keeps UAT action labels exact for Knowledge Builder and Tender Review', () => {
    expect(KNOWLEDGE_BUILDER_UAT_LABELS.en).toEqual({
      title: 'Knowledge Builder Studio',
      sourceText: 'Tender source text',
      sourceRef: 'Source reference',
      runDiscovery: 'Run discovery',
      addEvaluationExamples: 'Add UAT examples',
      runEvaluation: 'Run evaluation',
      loadFeedbackDeltas: 'Load feedback deltas',
      runtimeFeedbackMetrics: 'Runtime feedback metrics',
      promoteRuntimeAuthority: 'Approve and activate',
      rebuildReadModel: 'Rebuild read models',
    })
    expect(TENDER_REVIEW_UAT_LABELS.en).toEqual({
      title: 'Tender Review',
      documentText: 'Tender document text',
      runReview: 'Run governed review',
      falsePositive: 'False positive',
      falseNegative: 'False negative',
      persistReport: 'Persist final report',
    })
    expect(POLICY_RULE_UAT_LABELS.en.title).toBe('Policy-to-Rule Studio')
  })
})
