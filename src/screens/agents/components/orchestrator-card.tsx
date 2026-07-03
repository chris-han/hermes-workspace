import { Suspense, lazy, useState } from 'react'
import { Cancel01Icon, Settings01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ORCHESTRATOR_AVATAR_ACCENT_COLOR,
  ORCHESTRATOR_AVATAR_COLOR,
  ORCHESTRATOR_AVATAR_STATUS,
  ORCHESTRATOR_PROGRESS_CLASS_NAME,
  ORCHESTRATOR_PROGRESS_STATUS,
  ORCHESTRATOR_PROGRESS_VALUE,
} from './orchestrator-visuals'
import { AgentProgress } from '@/components/agent-view/agent-progress'
import { PixelAvatar } from '@/components/agent-swarm/pixel-avatar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const ChatScreen = lazy(() =>
  import('@/screens/chat/chat-screen').then((m) => ({ default: m.ChatScreen })),
)

const ORCHESTRATOR_NAME_KEY = 'operations:orchestrator:name'
const DEFAULT_ORCHESTRATOR_NAME = 'Main Agent'

export function OrchestratorCard({ totalAgents }: { totalAgents: number }) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [orchestratorName, setOrchestratorName] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_ORCHESTRATOR_NAME
    return (
      window.localStorage.getItem(ORCHESTRATOR_NAME_KEY) ||
      DEFAULT_ORCHESTRATOR_NAME
    )
  })
  const [draftName, setDraftName] = useState(orchestratorName)

  const openSettings = () => {
    setDraftName(orchestratorName)
    setSettingsOpen(true)
  }

  const saveSettings = () => {
    const nextName = draftName.trim() || DEFAULT_ORCHESTRATOR_NAME
    window.localStorage.setItem(ORCHESTRATOR_NAME_KEY, nextName)
    setOrchestratorName(nextName)
    setDraftName(nextName)
    setSettingsOpen(false)
  }

  return (
    <>
      <article className="flex h-[720px] min-h-[720px] flex-col rounded-card border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 lg:h-[800px] lg:min-h-[800px]">
        <div className="flex flex-col gap-4 px-1 pt-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative flex size-[56px] shrink-0 items-center justify-center">
              <AgentProgress
                value={ORCHESTRATOR_PROGRESS_VALUE}
                status={ORCHESTRATOR_PROGRESS_STATUS}
                size={56}
                strokeWidth={3}
                className={ORCHESTRATOR_PROGRESS_CLASS_NAME}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <PixelAvatar
                  size={44}
                  color={ORCHESTRATOR_AVATAR_COLOR}
                  accentColor={ORCHESTRATOR_AVATAR_ACCENT_COLOR}
                  status={ORCHESTRATOR_AVATAR_STATUS}
                />
              </div>
            </div>

            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold text-[var(--theme-text)]">
                {orchestratorName}
              </h2>
              <p className="mt-1 text-sm text-[var(--theme-muted)]">
                Orchestrator · {totalAgents} agents reporting
              </p>
              <div className="mt-2 inline-flex items-center gap-2 rounded-md border border-[var(--theme-success-border)] bg-[var(--theme-success-soft)] px-2 py-1 text-[11px] font-medium text-[var(--theme-success)]">
                <span
                  className={cn(
                    'h-2 w-2 rounded-full bg-[var(--theme-success)]',
                    totalAgents > 0 && 'animate-pulse',
                  )}
                  aria-hidden="true"
                />
                Active
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={openSettings}
            className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-button border border-[var(--theme-border)] bg-[var(--theme-card2)] text-[var(--theme-muted)] transition-colors hover:border-[var(--theme-accent)] hover:text-[var(--theme-text)]"
            aria-label="Orchestrator settings"
            title="Orchestrator settings"
          >
            <HugeiconsIcon icon={Settings01Icon} size={16} strokeWidth={1.8} />
          </button>
        </div>

        <div className="mt-4 flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-card border border-[var(--theme-border)] bg-[var(--theme-card2)]">
          <div className="flex-1 min-h-0 overflow-hidden">
            <Suspense
              fallback={
                <div className="flex h-full w-full items-center justify-center bg-[var(--theme-card2)] px-4 text-sm text-[var(--theme-muted)]">
                  Loading…
                </div>
              }
            >
              <div className="h-full w-full min-h-0 overflow-hidden">
                <ChatScreen
                  activeFriendlyId="main"
                  compact
                  embedded
                  isNewChat={false}
                />
              </div>
            </Suspense>
          </div>
        </div>
      </article>

      {settingsOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,var(--theme-bg)_48%,transparent)] px-4 py-6 backdrop-blur-md"
          onClick={() => setSettingsOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-card border border-[var(--theme-border2)] bg-[var(--theme-card)] p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="flex size-11 items-center justify-center rounded-button border border-[var(--theme-border)] bg-[var(--theme-bg)] text-[var(--theme-accent)]">
                  <HugeiconsIcon
                    icon={Settings01Icon}
                    size={20}
                    strokeWidth={1.8}
                  />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-[var(--theme-text)]">
                    Orchestrator Settings
                  </h2>
                  <p className="mt-1 text-sm text-[var(--theme-muted-2)]">
                    Update the display name used on this card.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="inline-flex size-10 cursor-pointer items-center justify-center rounded-button border border-[var(--theme-border)] bg-[var(--theme-card2)] text-[var(--theme-muted)] transition-colors hover:border-[var(--theme-accent)] hover:text-[var(--theme-text)]"
                aria-label="Close orchestrator settings"
              >
                <HugeiconsIcon
                  icon={Cancel01Icon}
                  size={18}
                  strokeWidth={1.8}
                />
              </button>
            </div>

            <label className="mt-6 block space-y-2">
              <span className="text-sm font-medium text-[var(--theme-text)]">
                Display name
              </span>
              <input
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                placeholder={DEFAULT_ORCHESTRATOR_NAME}
                className="w-full rounded-md border border-[var(--theme-border)] bg-[var(--theme-bg)] px-4 py-3 text-sm text-[var(--theme-text)] outline-none focus:ring-2 focus:ring-[var(--theme-accent)]"
              />
            </label>

            <div className="mt-6 flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setSettingsOpen(false)}
              >
                Close
              </Button>
              <Button type="button" onClick={saveSettings}>
                Save
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
