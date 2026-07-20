import { Suspense, lazy, useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import BackendUnavailableState from '@/components/backend-unavailable-state'
import { Tabs, TabsList, TabsPanel, TabsTab } from '@/components/ui/tabs'
import { useFeatureAvailable } from '@/hooks/use-feature-available'
import { usePageTitle } from '@/hooks/use-page-title'
import { getUnavailableReason } from '@/lib/feature-gates'
import { t } from '@/lib/i18n'
import { useSettingsStore } from '@/hooks/use-settings'

const memorySearchSchema = z.object({
  tab: z.enum(['memory', 'knowledge', 'governance']).optional(),
})

const MemoryBrowserScreen = lazy(async () => {
  const module = await import('@/screens/memory/memory-browser-screen')
  return { default: module.MemoryBrowserScreen }
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

export const Route = createFileRoute('/memory')({
  ssr: false,
  validateSearch: memorySearchSchema,
  component: function MemoryRoute() {
    const search = Route.useSearch()
    const [tab, setTab] = useState<'memory' | 'knowledge' | 'governance'>(
      search.tab || 'memory',
    )
    const memoryAvailable = useFeatureAvailable('memory')
    const locale = useSettingsStore((state) => state.settings.locale)

    usePageTitle(t('nav.memory'))

    useEffect(() => {
      if (search.tab) setTab(search.tab)
    }, [search.tab])

    return (
      <div lang={locale} className="flex h-full min-h-0 flex-col">
        <Tabs
          value={tab}
          onValueChange={(value) =>
            setTab(value as 'memory' | 'knowledge' | 'governance')
          }
          className="h-full min-h-0 gap-0"
        >
          <div className="border-b border-primary-200 dark:border-neutral-800">
            <div className="mx-auto w-full max-w-[1200px] px-4 pt-4 sm:px-6 lg:px-8">
              <TabsList
                variant="underline"
                className="w-full justify-start gap-1"
              >
                <TabsTab value="memory">
                  {t('memory.tabs.memory')}
                </TabsTab>
                <TabsTab value="knowledge">
                  {t('memory.tabs.knowledge')}
                </TabsTab>
                <TabsTab value="governance">
                  {t('memory.tabs.governance')}
                </TabsTab>
              </TabsList>
            </div>
          </div>

          <TabsPanel value="memory" className="min-h-0 flex-1">
            {tab === 'memory' ? (
              <Suspense
                fallback={
                  <RouteLoadingState label="Loading memory browser..." />
                }
              >
                {memoryAvailable ? (
                  <MemoryBrowserScreen />
                ) : (
                  <BackendUnavailableState
                    feature="Memory"
                    description={getUnavailableReason('Memory')}
                  />
                )}
              </Suspense>
            ) : null}
          </TabsPanel>

          <TabsPanel value="knowledge" className="min-h-0 flex-1">
            {tab === 'knowledge' ? (
              <Suspense
                fallback={
                  <RouteLoadingState label="Loading knowledge browser..." />
                }
              >
                <KnowledgeBrowserScreen />
              </Suspense>
            ) : null}
          </TabsPanel>

          <TabsPanel value="governance" className="min-h-0 flex-1">
            {tab === 'governance' ? (
              <Suspense
                fallback={
                  <RouteLoadingState label="Loading governance model..." />
                }
              >
                <GovernanceModelExplainer />
              </Suspense>
            ) : null}
          </TabsPanel>
        </Tabs>
      </div>
    )
  },
})

function RouteLoadingState({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-[240px] items-center justify-center px-4 text-sm text-primary-500 dark:text-neutral-400">
      {label}
    </div>
  )
}
