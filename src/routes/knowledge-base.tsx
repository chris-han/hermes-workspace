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
} from '@/screens/knowledge-base/knowledge-base-screen'
import { GovernedGraphWorkSurface } from '@/screens/knowledge-base/graph/work-surface'

const knowledgeBaseSearchSchema = z.object({
  tab: z
    .enum(['legal', 'general', 'dataset', 'effective', 'governance'])
    .optional(),
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
    legal: 'Legal authority',
    general: 'General knowledge',
    dataset: 'Dataset',
    effective: 'Effective Context',
    governance: 'Governance',
    loadingLegal: 'Loading legal knowledge base...',
    loadingGeneral: 'Loading knowledge browser...',
    loadingDataset: 'Loading governed datasets...',
    loadingEffective: 'Loading effective context...',
    loadingGovernance: 'Loading governance model...',
  },
  zh: {
    legal: '法律权威',
    general: '通用知识',
    dataset: '数据集',
    effective: '有效上下文',
    governance: '治理',
    loadingLegal: '正在加载法律知识库...',
    loadingGeneral: '正在加载知识浏览器...',
    loadingDataset: '正在加载治理数据集...',
    loadingEffective: '正在加载有效上下文...',
    loadingGovernance: '正在加载治理模型...',
  },
} as const

type KnowledgeBaseTab =
  | 'legal'
  | 'general'
  | 'dataset'
  | 'effective'
  | 'governance'

function normalizeKnowledgeBaseTab(
  tab:
    | 'legal'
    | 'general'
    | 'dataset'
    | 'effective'
    | 'governance'
    | undefined,
): KnowledgeBaseTab {
  return tab === 'general' ||
    tab === 'dataset' ||
    tab === 'effective' ||
    tab === 'governance'
    ? tab
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
  const copy = locale === 'zh' ? KNOWLEDGE_BASE_COPY.zh : KNOWLEDGE_BASE_COPY.en
  const [tab, setTab] = useState<KnowledgeBaseTab>(
    normalizeKnowledgeBaseTab(search.tab),
  )
  const showGraphSurface =
    search.view === 'graph' && (tab === 'legal' || tab === 'governance')
  usePageTitle(t('nav.knowledgeBase'))

  useEffect(() => {
    if (search.tab) setTab(normalizeKnowledgeBaseTab(search.tab))
  }, [search.tab])

  return (
    <div
      lang={locale === 'zh' ? 'zh-CN' : 'en'}
      className="flex h-full min-h-0 flex-col bg-background text-foreground"
    >
      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as KnowledgeBaseTab)}
        className="h-full min-h-0 gap-0"
      >
        <div className="border-b border-border">
          <div className="mx-auto w-full max-w-[1200px] px-4 pt-4 sm:px-6 lg:px-8">
            <TabsList variant="underline" className="w-full justify-start gap-1">
              <TabsTab value="legal">{copy.legal}</TabsTab>
              <TabsTab value="general">{copy.general}</TabsTab>
              <TabsTab value="dataset">{copy.dataset}</TabsTab>
              <TabsTab value="effective">{copy.effective}</TabsTab>
              <TabsTab value="governance">{copy.governance}</TabsTab>
            </TabsList>
          </div>
        </div>

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
