import { Suspense, lazy, useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { Tabs, TabsList, TabsPanel, TabsTab } from '@/components/ui/tabs'
import { usePageTitle } from '@/hooks/use-page-title'
import { useSettingsStore } from '@/hooks/use-settings'
import { t } from '@/lib/i18n'
import { KnowledgeBaseScreen } from '@/screens/knowledge-base/knowledge-base-screen'

const knowledgeBaseSearchSchema = z.object({
  tab: z.enum(['legal', 'general', 'governance']).optional(),
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
    governance: 'Governance',
    loadingLegal: 'Loading legal knowledge base...',
    loadingGeneral: 'Loading knowledge browser...',
    loadingGovernance: 'Loading governance model...',
  },
  zh: {
    legal: '法律权威',
    general: '通用知识',
    governance: '治理',
    loadingLegal: '正在加载法律知识库...',
    loadingGeneral: '正在加载知识浏览器...',
    loadingGovernance: '正在加载治理模型...',
  },
} as const

export const Route = createFileRoute('/knowledge-base')({
  ssr: false,
  validateSearch: knowledgeBaseSearchSchema,
  component: KnowledgeBaseRoute,
})

function KnowledgeBaseRoute() {
  const search = Route.useSearch()
  const locale = useSettingsStore((state) => state.settings.locale)
  const copy = locale === 'zh' ? KNOWLEDGE_BASE_COPY.zh : KNOWLEDGE_BASE_COPY.en
  const [tab, setTab] = useState<'legal' | 'general' | 'governance'>(
    search.tab || 'legal',
  )
  usePageTitle(t('nav.knowledgeBase'))

  useEffect(() => {
    if (search.tab) setTab(search.tab)
  }, [search.tab])

  return (
    <div
      lang={locale === 'zh' ? 'zh-CN' : 'en'}
      className="flex h-full min-h-0 flex-col bg-background text-foreground"
    >
      <Tabs
        value={tab}
        onValueChange={(value) =>
          setTab(value as 'legal' | 'general' | 'governance')
        }
        className="h-full min-h-0 gap-0"
      >
        <div className="border-b border-border">
          <div className="mx-auto w-full max-w-[1200px] px-4 pt-4 sm:px-6 lg:px-8">
            <TabsList variant="underline" className="w-full justify-start gap-1">
              <TabsTab value="legal">{copy.legal}</TabsTab>
              <TabsTab value="general">{copy.general}</TabsTab>
              <TabsTab value="governance">{copy.governance}</TabsTab>
            </TabsList>
          </div>
        </div>

        <TabsPanel value="legal" className="min-h-0 flex-1">
          {tab === 'legal' ? (
            <Suspense fallback={<RouteLoadingState label={copy.loadingLegal} />}>
              <KnowledgeBaseScreen />
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

        <TabsPanel value="governance" className="min-h-0 flex-1">
          {tab === 'governance' ? (
            <Suspense
              fallback={<RouteLoadingState label={copy.loadingGovernance} />}
            >
              <GovernanceModelExplainer />
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
