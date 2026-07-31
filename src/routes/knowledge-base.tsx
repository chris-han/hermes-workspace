import { Suspense, lazy, useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { Tabs, TabsList, TabsPanel, TabsTab } from '@/components/ui/tabs'
import { usePageTitle } from '@/hooks/use-page-title'
import { useSettingsStore } from '@/hooks/use-settings'
import { t } from '@/lib/i18n'
import {
  DatasetKnowledgeBaseScreen,
  EffectiveContextScreen,
  KnowledgeBaseScreen,
  KnowledgeBuilderStudioScreen,
  PolicyRuleStudioScreen,
  TenderDocumentReviewScreen,
} from '@/screens/knowledge-base/knowledge-base-screen'
import { GovernedGraphWorkSurface } from '@/screens/knowledge-base/graph/work-surface'

export const KNOWLEDGE_BASE_MODE_VALUES = ['build', 'browse'] as const
export const KNOWLEDGE_BASE_BUILD_TAB_VALUES = [
  'builder',
  'tenderReview',
  'policyRules',
] as const
export const KNOWLEDGE_BASE_BROWSE_TAB_VALUES = [
  'legal',
  'general',
  'dataset',
  'effective',
  'governance',
] as const
export const KNOWLEDGE_BASE_TAB_VALUES = [
  ...KNOWLEDGE_BASE_BUILD_TAB_VALUES,
  ...KNOWLEDGE_BASE_BROWSE_TAB_VALUES,
] as const

type KnowledgeBaseMode = (typeof KNOWLEDGE_BASE_MODE_VALUES)[number]
type KnowledgeBaseTab = (typeof KNOWLEDGE_BASE_TAB_VALUES)[number]

const knowledgeBaseSearchSchema = z.object({
  mode: z.enum(KNOWLEDGE_BASE_MODE_VALUES).optional(),
  tab: z.enum(KNOWLEDGE_BASE_TAB_VALUES).optional(),
  view: z.enum(['graph']).optional(),
  lens: z
    .enum([
      'overview',
      'evidence',
      'sensitivity',
      'authority',
      'conflict',
      'lineage',
      'replay',
      'impact',
      'governance',
    ])
    .optional(),
  node_id: z.string().optional(),
  assertion_id: z.string().optional(),
  source_ref: z.string().optional(),
  graph_snapshot_ref: z.string().optional(),
  as_of: z.string().optional(),
})

const KnowledgeBrowserScreen = lazy(async () => {
  const module = await import('@/screens/memory/knowledge-browser-screen')
  return { default: module.KnowledgeBrowserScreen }
})

const GovernanceModelExplainer = lazy(async () => {
  const module =
    await import('@/screens/memory/components/governance-model-explainer')
  return { default: module.GovernanceModelExplainer }
})

const KNOWLEDGE_BASE_COPY = {
  en: {
    build: 'Build',
    browse: 'Browse',
    builder: 'Knowledge Builder Studio',
    tenderReview: 'Tender Review',
    policyRules: 'Policy-to-Rule Studio',
    stepDiscover: '1. Discover',
    stepEvaluate: '2. Evaluate',
    stepActivate: '3. Activate',
    legal: 'Legal authority',
    general: 'General knowledge',
    dataset: 'Dataset',
    effective: 'Effective Context',
    governance: 'Governance',
    loadingLegal: 'Loading legal knowledge base...',
    loadingBuilder: 'Loading Knowledge Builder Studio...',
    loadingTenderReview: 'Loading Tender Review...',
    loadingPolicyRules: 'Loading Policy-to-Rule Studio...',
    loadingGeneral: 'Loading knowledge browser...',
    loadingDataset: 'Loading governed datasets...',
    loadingEffective: 'Loading effective context...',
    loadingGovernance: 'Loading governance model...',
  },
  zh: {
    build: '构建',
    browse: '浏览',
    builder: '知识构建工作台',
    tenderReview: '招标文件审查',
    policyRules: '政策转规则工作台',
    stepDiscover: '1. 发现',
    stepEvaluate: '2. 评估',
    stepActivate: '3. 激活',
    legal: '法律权威',
    general: '通用知识',
    dataset: '数据集',
    effective: '有效上下文',
    governance: '治理',
    loadingLegal: '正在加载法律知识库...',
    loadingBuilder: '正在加载知识构建工作台...',
    loadingTenderReview: '正在加载招标文件审查...',
    loadingPolicyRules: '正在加载政策转规则工作台...',
    loadingGeneral: '正在加载知识浏览器...',
    loadingDataset: '正在加载治理数据集...',
    loadingEffective: '正在加载有效上下文...',
    loadingGovernance: '正在加载治理模型...',
  },
} as const

export function getKnowledgeBaseCopy(locale: 'en' | 'zh') {
  return locale === 'zh' ? KNOWLEDGE_BASE_COPY.zh : KNOWLEDGE_BASE_COPY.en
}

export function normalizeKnowledgeBaseMode(
  mode: KnowledgeBaseMode | undefined,
): KnowledgeBaseMode {
  return mode === 'browse' ? 'browse' : 'build'
}

export function normalizeKnowledgeBaseTab(
  mode: KnowledgeBaseMode,
  tab: KnowledgeBaseTab | undefined,
): KnowledgeBaseTab {
  const values =
    mode === 'build'
      ? KNOWLEDGE_BASE_BUILD_TAB_VALUES
      : KNOWLEDGE_BASE_BROWSE_TAB_VALUES
  return tab && values.includes(tab as never)
    ? tab
    : mode === 'build'
      ? 'builder'
      : 'legal'
}

export const Route = createFileRoute('/knowledge-base')({
  ssr: false,
  validateSearch: knowledgeBaseSearchSchema,
  component: KnowledgeBaseRoute,
})

function KnowledgeBaseRoute() {
  const search = Route.useSearch()
  const locale = useSettingsStore((state) => state.settings.locale)
  const copy = getKnowledgeBaseCopy(locale === 'zh' ? 'zh' : 'en')
  const searchMode = normalizeKnowledgeBaseMode(search.mode)
  const [mode, setMode] = useState<KnowledgeBaseMode>(searchMode)
  const [tab, setTab] = useState<KnowledgeBaseTab>(
    normalizeKnowledgeBaseTab(searchMode, search.tab),
  )
  const showGraphSurface =
    search.view === 'graph' && (tab === 'legal' || tab === 'governance')
  usePageTitle(t('nav.knowledgeBase'))

  useEffect(() => {
    const nextMode = normalizeKnowledgeBaseMode(search.mode)
    setMode(nextMode)
    setTab(normalizeKnowledgeBaseTab(nextMode, search.tab))
  }, [search.mode, search.tab])

  return (
    <div
      lang={locale === 'zh' ? 'zh-CN' : 'en'}
      className="flex h-full min-h-0 flex-col bg-background text-foreground"
    >
      <div className="border-b border-border">
        <div className="mx-auto grid w-full max-w-[1200px] gap-2 px-4 pt-4 sm:px-6 lg:px-8">
          <Tabs
            value={mode}
            onValueChange={(value) => {
              const nextMode = normalizeKnowledgeBaseMode(
                value as KnowledgeBaseMode,
              )
              setMode(nextMode)
              setTab(normalizeKnowledgeBaseTab(nextMode, undefined))
            }}
            className="gap-0"
          >
            <TabsList variant="underline" className="justify-start gap-4">
              <TabsTab value="build">{copy.build}</TabsTab>
              <TabsTab value="browse">{copy.browse}</TabsTab>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {mode === 'build' ? (
        <div className="border-b border-border bg-background px-4 py-2 sm:px-6 lg:px-8">
          <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-md border border-border bg-card px-2 py-1">
              {copy.stepDiscover}
            </span>
            <span>{'->'}</span>
            <span className="rounded-md border border-border bg-card px-2 py-1">
              {copy.stepEvaluate}
            </span>
            <span>{'->'}</span>
            <span className="rounded-md border border-border bg-card px-2 py-1">
              {copy.stepActivate}
            </span>
          </div>
        </div>
      ) : null}

      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as KnowledgeBaseTab)}
        className="h-full min-h-0 gap-0"
      >
        <div className="border-b border-border">
          <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8">
            <TabsList variant="underline" className="w-full justify-start gap-1 overflow-visible">
              {mode === 'build' ? (
                <>
                  <TabsTab value="builder">{copy.builder}</TabsTab>
                  <TabsTab value="tenderReview">{copy.tenderReview}</TabsTab>
                  <TabsTab value="policyRules">{copy.policyRules}</TabsTab>
                </>
              ) : (
                <>
                  <TabsTab value="legal">{copy.legal}</TabsTab>
                  <TabsTab value="general">{copy.general}</TabsTab>
                  <TabsTab value="dataset">{copy.dataset}</TabsTab>
                  <TabsTab value="effective">{copy.effective}</TabsTab>
                  <TabsTab value="governance">{copy.governance}</TabsTab>
                </>
              )}
            </TabsList>
          </div>
        </div>

        <TabsPanel value="builder" className="min-h-0 flex-1">
          {tab === 'builder' ? (
            <Suspense
              fallback={<RouteLoadingState label={copy.loadingBuilder} />}
            >
              <KnowledgeBuilderStudioScreen />
            </Suspense>
          ) : null}
        </TabsPanel>

        <TabsPanel value="tenderReview" className="min-h-0 flex-1">
          {tab === 'tenderReview' ? (
            <Suspense
              fallback={<RouteLoadingState label={copy.loadingTenderReview} />}
            >
              <TenderDocumentReviewScreen />
            </Suspense>
          ) : null}
        </TabsPanel>

        <TabsPanel value="policyRules" className="min-h-0 flex-1">
          {tab === 'policyRules' ? (
            <Suspense
              fallback={<RouteLoadingState label={copy.loadingPolicyRules} />}
            >
              <PolicyRuleStudioScreen />
            </Suspense>
          ) : null}
        </TabsPanel>

        <TabsPanel value="legal" className="min-h-0 flex-1">
          {tab === 'legal' ? (
            <Suspense fallback={<RouteLoadingState label={copy.loadingLegal} />}>
              {showGraphSurface ? (
                <GovernedGraphWorkSurface
                  entryTab="legal"
                  deepLink={{
                    lens: search.lens,
                    nodeId: search.node_id,
                    assertionId: search.assertion_id,
                    sourceRef: search.source_ref,
                    graphSnapshotRef: search.graph_snapshot_ref,
                    asOf: search.as_of,
                  }}
                />
              ) : (
                <KnowledgeBaseScreen />
              )}
            </Suspense>
          ) : null}
        </TabsPanel>

        <TabsPanel value="general" className="min-h-0 flex-1">
          {tab === 'general' ? (
            <Suspense
              fallback={<RouteLoadingState label={copy.loadingGeneral} />}
            >
              <KnowledgeBrowserScreen />
            </Suspense>
          ) : null}
        </TabsPanel>

        <TabsPanel value="dataset" className="min-h-0 flex-1">
          {tab === 'dataset' ? (
            <Suspense
              fallback={<RouteLoadingState label={copy.loadingDataset} />}
            >
              <DatasetKnowledgeBaseScreen />
            </Suspense>
          ) : null}
        </TabsPanel>

        <TabsPanel value="effective" className="min-h-0 flex-1">
          {tab === 'effective' ? (
            <Suspense
              fallback={<RouteLoadingState label={copy.loadingEffective} />}
            >
              <EffectiveContextScreen />
            </Suspense>
          ) : null}
        </TabsPanel>

        <TabsPanel value="governance" className="min-h-0 flex-1">
          {tab === 'governance' ? (
            <Suspense
              fallback={<RouteLoadingState label={copy.loadingGovernance} />}
            >
              {showGraphSurface ? (
                <GovernedGraphWorkSurface
                  entryTab="governance"
                  deepLink={{
                    lens: search.lens,
                    nodeId: search.node_id,
                    assertionId: search.assertion_id,
                    sourceRef: search.source_ref,
                    graphSnapshotRef: search.graph_snapshot_ref,
                    asOf: search.as_of,
                  }}
                />
              ) : (
                <GovernanceModelExplainer />
              )}
            </Suspense>
          ) : null}
        </TabsPanel>
      </Tabs>
    </div>
  )
}

function RouteLoadingState({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-[240px] items-center justify-center px-4 text-sm text-muted-foreground">
      {label}
    </div>
  )
}
