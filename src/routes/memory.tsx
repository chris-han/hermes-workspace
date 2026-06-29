import { Suspense, lazy, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import BackendUnavailableState from '@/components/backend-unavailable-state'
import { Tabs, TabsList, TabsPanel, TabsTab } from '@/components/ui/tabs'
import { useFeatureAvailable } from '@/hooks/use-feature-available'
import { usePageTitle } from '@/hooks/use-page-title'
import { getUnavailableReason } from '@/lib/feature-gates'

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
  component: function MemoryRoute() {
    const [tab, setTab] = useState<'memory' | 'knowledge' | 'governance'>(
      'memory',
    )
    const memoryAvailable = useFeatureAvailable('memory')

    usePageTitle('Memory')

    return (
      <div className="flex h-full min-h-0 flex-col">
        <Tabs
          value={tab}
          onValueChange={(value) =>
            setTab(value as 'memory' | 'knowledge' | 'governance')
          }
          className="h-full min-h-0 gap-0"
        >
          <div className="border-b border-primary-200 px-3 pt-3 dark:border-neutral-800 md:px-4 md:pt-4">
            <TabsList
              variant="underline"
              className="w-full justify-start gap-1"
            >
              <TabsTab value="memory">Memory</TabsTab>
              <TabsTab value="knowledge">Knowledge</TabsTab>
              <TabsTab value="governance">Governance</TabsTab>
            </TabsList>
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
