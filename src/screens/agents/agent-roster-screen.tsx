import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import {
  AiBrain03Icon,
  PlusSignIcon,
  Settings01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Tabs, TabsList, TabsTab } from '@/components/ui/tabs'
import { seedAgentPresets } from './agent-presets'
import { OrchestratorCard } from './components/orchestrator-card'
import { AgentRosterCard } from './components/agent-roster-card'
import { AgentRosterDetail } from './components/agent-roster-detail'
import { AgentRosterNewAgentModal } from './components/agent-roster-new-agent-modal'
import { AgentRosterSettingsModal } from './components/agent-roster-settings-modal'
import { FullOutputsView } from './components/full-outputs-view'
import { useAgentRoster } from './hooks/use-agent-roster'
import type { CSSProperties } from 'react'
import { Button } from '@/components/ui/button'
import { t } from '@/lib/i18n'
import { formatRelativeTime } from '@/screens/dashboard/lib/formatters'

export const THEME_STYLE: CSSProperties = {
  ['--theme-bg' as string]: 'var(--color-surface)',
  ['--theme-card' as string]: 'var(--color-primary-50)',
  ['--theme-card2' as string]: 'var(--color-primary-100)',
  ['--theme-border' as string]: 'var(--color-primary-200)',
  ['--theme-border2' as string]: 'var(--color-primary-400)',
  ['--theme-text' as string]: 'var(--color-ink)',
  ['--theme-muted' as string]: 'var(--color-primary-700)',
  ['--theme-muted-2' as string]: 'var(--color-primary-600)',
  ['--theme-accent' as string]: 'var(--color-accent-500)',
  ['--theme-accent-foreground' as string]: '#163300',
  ['--theme-accent-strong' as string]: 'var(--color-accent-600)',
  ['--theme-accent-soft' as string]:
    'color-mix(in srgb, var(--color-accent-500) 12%, transparent)',
  ['--theme-accent-soft-strong' as string]:
    'color-mix(in srgb, var(--color-accent-500) 18%, transparent)',
  ['--theme-shadow' as string]:
    'color-mix(in srgb, var(--color-primary-950) 14%, transparent)',
  ['--theme-danger' as string]: 'var(--color-red-600, #dc2626)',
  ['--theme-danger-soft' as string]:
    'color-mix(in srgb, var(--theme-danger) 12%, transparent)',
  ['--theme-danger-soft-strong' as string]:
    'color-mix(in srgb, var(--theme-danger) 18%, transparent)',
  ['--theme-danger-border' as string]:
    'color-mix(in srgb, var(--theme-danger) 35%, white)',
  ['--theme-warning' as string]: 'var(--color-amber-600, #d97706)',
  ['--theme-warning-soft' as string]:
    'color-mix(in srgb, var(--theme-warning) 12%, transparent)',
  ['--theme-warning-soft-strong' as string]:
    'color-mix(in srgb, var(--theme-warning) 18%, transparent)',
  ['--theme-warning-border' as string]:
    'color-mix(in srgb, var(--theme-warning) 35%, white)',
  ['--theme-success' as string]: 'var(--color-green-700, #15803d)',
  ['--theme-success-soft' as string]:
    'color-mix(in srgb, var(--theme-success) 12%, transparent)',
  ['--theme-success-border' as string]:
    'color-mix(in srgb, var(--theme-success) 32%, white)',
}

export function AgentRosterScreen() {
  useEffect(() => {
    seedAgentPresets()
  }, [])
  const [newAgentOpen, setNewAgentOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsAgentId, setSettingsAgentId] = useState<string | null>(null)
  const [view, setView] = useState<'overview' | 'outputs'>('overview')
  const {
    agents,
    recentActivity,
    configQuery,
    sessionsQuery,
    cronJobsQuery,
    settings,
    saveSettings,
    defaultModel,
    createAgent,
    isCreatingAgent,
    saveAgent,
    isSavingAgent,
    deleteAgent,
    isDeletingAgent,
  } = useAgentRoster()

  const isLoading =
    configQuery.isPending || sessionsQuery.isPending || cronJobsQuery.isPending
  const error =
    (configQuery.error instanceof Error && configQuery.error.message) ||
    (sessionsQuery.error instanceof Error && sessionsQuery.error.message) ||
    (cronJobsQuery.error instanceof Error && cronJobsQuery.error.message) ||
    null
  const settingsAgent =
    agents.find((agent) => agent.id === settingsAgentId) ?? null

  return (
    <main
      className="min-h-full bg-surface px-4 pb-24 pt-6 text-[var(--theme-text)] md:px-6"
      style={THEME_STYLE}
    >
      <section className="mx-auto w-full max-w-[1320px] space-y-4">
        <header className="rounded-card border border-[var(--theme-border)] bg-[var(--theme-card)] p-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-button border border-[var(--theme-border)] bg-[var(--theme-card2)] text-[var(--theme-accent)]">
                <HugeiconsIcon
                  icon={AiBrain03Icon}
                  size={22}
                  strokeWidth={1.8}
                />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-3xl font-semibold leading-none text-[var(--theme-text)]">
                    {t('nav.agentRoster')}
                  </h1>
                  <span className="rounded-md border border-[var(--theme-border)] bg-[var(--theme-card2)] px-2 py-1 text-[11px] font-medium text-[var(--theme-muted)]">
                    {agents.length} agents
                  </span>
                </div>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--theme-muted)]">
                  Persistent agent roster, scheduled work, and generated
                  outputs.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Tabs
                value={view}
                onValueChange={(value) =>
                  setView(value as 'overview' | 'outputs')
                }
              >
                <TabsList
                  variant="underline"
                  className="w-full justify-start gap-2 border-b border-[var(--theme-border)] bg-transparent px-0"
                >
                  <TabsTab
                    value="overview"
                    className="min-w-0 rounded-none px-1 text-[var(--theme-muted)] data-active:text-[var(--theme-text)] [&[data-active]_.tab-badge]:border-[var(--theme-accent)] [&[data-active]_.tab-badge]:bg-[var(--theme-accent-soft)] [&[data-active]_.tab-badge]:text-[var(--theme-text)]"
                  >
                    <span>Overview</span>
                    <span className="tab-badge inline-flex min-w-[1.25rem] items-center justify-center rounded-full border border-[var(--theme-border)] bg-[var(--theme-card)] px-1.5 py-0.5 text-[11px] font-semibold leading-none text-[var(--theme-muted)]">
                      {agents.length}
                    </span>
                  </TabsTab>
                  <TabsTab
                    value="outputs"
                    className="min-w-0 rounded-none px-1 text-[var(--theme-muted)] data-active:text-[var(--theme-text)] [&[data-active]_.tab-badge]:border-[var(--theme-accent)] [&[data-active]_.tab-badge]:bg-[var(--theme-accent-soft)] [&[data-active]_.tab-badge]:text-[var(--theme-text)]"
                  >
                    <span>Outputs</span>
                    <span className="tab-badge inline-flex min-w-[1.25rem] items-center justify-center rounded-full border border-[var(--theme-border)] bg-[var(--theme-card)] px-1.5 py-0.5 text-[11px] font-semibold leading-none text-[var(--theme-muted)]">
                      {recentActivity.length}
                    </span>
                  </TabsTab>
                </TabsList>
              </Tabs>
              <Button
                className="cursor-pointer bg-[var(--theme-accent)] text-[var(--theme-accent-foreground)] hover:bg-[var(--theme-accent-strong)]"
                onClick={() => setNewAgentOpen(true)}
              >
                <HugeiconsIcon
                  icon={PlusSignIcon}
                  size={16}
                  strokeWidth={1.8}
                />
                New Agent
              </Button>
              <Button
                variant="secondary"
                className="cursor-pointer border border-[var(--theme-border)] bg-[var(--theme-card2)] text-[var(--theme-text)] hover:bg-[var(--theme-card)]"
                onClick={() => setSettingsOpen(true)}
              >
                <HugeiconsIcon
                  icon={Settings01Icon}
                  size={16}
                  strokeWidth={1.8}
                />
                Settings
              </Button>
            </div>
          </div>
        </header>

        {isLoading ? (
          <section className="rounded-card border border-[var(--theme-border)] bg-[var(--theme-card)] px-6 py-12 text-center text-sm text-[var(--theme-muted)]">
            Loading Agent Roster…
          </section>
        ) : error ? (
          <section className="rounded-card border border-[var(--theme-danger-border)] bg-[var(--theme-danger-soft)] px-6 py-12 text-center text-sm text-[var(--theme-danger)]">
            {error}
          </section>
        ) : view === 'outputs' ? (
          <FullOutputsView />
        ) : (
          <>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              <OrchestratorCard totalAgents={agents.length} />
            </motion.div>

            <section className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
              {agents.map((agent, index) => (
                <motion.div
                  key={agent.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04, duration: 0.22 }}
                >
                  <AgentRosterCard
                    agent={agent}
                    onOpenSettings={(agentId) => setSettingsAgentId(agentId)}
                  />
                </motion.div>
              ))}
              <motion.button
                type="button"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: agents.length * 0.04, duration: 0.22 }}
                onClick={() => setNewAgentOpen(true)}
                className="flex min-h-[19rem] cursor-pointer flex-col items-center justify-center rounded-card border border-dashed border-[var(--theme-border)] bg-[var(--theme-card)] p-4 text-center transition-colors hover:border-[var(--theme-accent)] hover:bg-[var(--theme-accent-soft)]"
              >
                <HugeiconsIcon
                  icon={PlusSignIcon}
                  size={32}
                  strokeWidth={1.7}
                  className="text-[var(--theme-muted)]"
                />
                <span className="mt-3 text-sm text-[var(--theme-muted)]">
                  Add Agent
                </span>
              </motion.button>
            </section>

            <section className="rounded-card border border-[var(--theme-border)] bg-[var(--theme-card)] p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-[var(--theme-text)]">
                    Recent Activity
                  </h2>
                  <p className="mt-1 text-sm text-[var(--theme-muted-2)]">
                    Latest outputs across the team
                  </p>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {recentActivity.length > 0 ? (
                  recentActivity.map((activity) => {
                    const agent = agents.find(
                      (entry) => entry.id === activity.agentId,
                    )
                    return (
                      <div
                        key={activity.id}
                        className="flex flex-col gap-2 rounded-card border border-[var(--theme-border)] bg-[var(--theme-bg)] px-4 py-3 md:flex-row md:items-center md:justify-between"
                      >
                        <p className="text-sm text-[var(--theme-text)]">
                          <span className="font-medium">
                            {agent?.name ?? activity.agentId}:
                          </span>{' '}
                          {activity.summary}
                        </p>
                        <span className="shrink-0 text-sm text-[var(--theme-muted)]">
                          {formatRelativeTime(activity.timestamp)}
                        </span>
                      </div>
                    )
                  })
                ) : (
                  <div className="rounded-card border border-dashed border-[var(--theme-border)] bg-[var(--theme-bg)] px-4 py-6 text-sm text-[var(--theme-muted)]">
                    No recent activity yet.
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </section>

      <AgentRosterNewAgentModal
        open={newAgentOpen}
        defaultModel={defaultModel}
        onClose={() => setNewAgentOpen(false)}
        onCreate={createAgent}
        isSaving={isCreatingAgent}
      />

      <AgentRosterSettingsModal
        open={settingsOpen}
        settings={settings}
        onClose={() => setSettingsOpen(false)}
        onSave={saveSettings}
      />

      <AgentRosterDetail
        open={Boolean(settingsAgent)}
        agent={settingsAgent}
        onClose={() => setSettingsAgentId(null)}
        onSave={saveAgent}
        onDelete={async (agentId) => {
          await deleteAgent(agentId)
          setSettingsAgentId((current) =>
            current === agentId ? null : current,
          )
        }}
        isSaving={isSavingAgent}
        isDeleting={isDeletingAgent}
      />
    </main>
  )
}
