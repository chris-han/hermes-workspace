import { Link } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CloudIcon,
  DatabaseIcon,
  Plug01Icon,
  SatelliteIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useEffect, useMemo, useState } from 'react'
import { DataConnectionStatusCard } from './components/data-connection-status-card'
import { CompanyDatasetImportPanel } from './components/company-dataset-import-panel'
import {
  KnowledgeSourceForm,
  createDefaultKnowledgeSourceDraft,
} from './components/knowledge-source-form'
import type {
  KnowledgeSourceDraft,
  KnowledgeSourceModalViewModel,
} from './components/knowledge-source-form'
import type { DataConnectionsSummary } from '@/server/data-connections'
import { toast } from '@/components/ui/toast'
import { useOrganizationSettings } from '@/lib/organization-membership'

type SummaryResponse = {
  ok?: boolean
  summary?: DataConnectionsSummary
  error?: string
}

type KnowledgeConfigResponse = {
  config?: {
    source?: KnowledgeSourceDraft
  }
  resolved?: {
    configuredPath?: string
    effectiveRoot?: string
    effectiveRootLabel?: string
    usesWorkspaceDefault?: boolean
    upstreamWikiPath?: string
  }
  error?: string
}

async function readJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  const payload = (await response.json().catch(() => ({}))) as T
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as { error?: unknown }).error || '')
        : `Request failed (${response.status})`
    throw new Error(message || `Request failed (${response.status})`)
  }
  return payload
}

export const DATA_CONNECTIONS_PAGE_COPY = {
  title: 'Data Connections',
  subtitle:
    'Configure source connections and inspect the current authority boundary between governed storage, derived mirrors, and read-only query runtime.',
}

export function DataConnectionsScreen() {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<KnowledgeSourceDraft>(
    createDefaultKnowledgeSourceDraft(),
  )
  const [savedDraft, setSavedDraft] = useState<KnowledgeSourceDraft>(
    createDefaultKnowledgeSourceDraft(),
  )
  const [savePending, setSavePending] = useState(false)
  const [syncPending, setSyncPending] = useState(false)
  const [knowledgeError, setKnowledgeError] = useState<string | null>(null)

  const summaryQuery = useQuery({
    queryKey: ['data-connections', 'summary'],
    queryFn: () => readJson<SummaryResponse>('/api/data-connections/summary'),
  })

  const knowledgeConfigQuery = useQuery({
    queryKey: ['knowledge', 'config'],
    queryFn: () => readJson<KnowledgeConfigResponse>('/api/knowledge/config'),
  })
  const organizationQuery = useOrganizationSettings()

  useEffect(() => {
    const source = knowledgeConfigQuery.data?.config?.source
    if (source) {
      setDraft(source)
      setSavedDraft(source)
    }
  }, [knowledgeConfigQuery.data?.config?.source])

  const knowledgeDirty = useMemo(() => {
    return JSON.stringify(draft) !== JSON.stringify(savedDraft)
  }, [draft, savedDraft])

  const knowledgeStatus = useMemo<
    KnowledgeSourceModalViewModel['status']
  >(() => {
    const error = knowledgeError ?? knowledgeConfigQuery.data?.error ?? null
    if (savePending) {
      return {
        kind: 'saving',
        message: 'Saving...',
        failures: [],
        renamed: [],
        ingested: [],
      }
    }
    if (syncPending) {
      return {
        kind: 'syncing',
        message: 'Syncing...',
        failures: [],
        renamed: [],
        ingested: [],
      }
    }
    if (error) {
      return {
        kind: 'failed',
        message: error,
        failures: [{ filename: 'knowledge', error }],
        renamed: [],
        ingested: [],
      }
    }
    if (knowledgeDirty) {
      return {
        kind: 'dirty',
        message: 'Unsaved changes',
        failures: [],
        renamed: [],
        ingested: [],
      }
    }
    return {
      kind: 'idle',
      message: '',
      failures: [],
      renamed: [],
      ingested: [],
    }
  }, [
    knowledgeConfigQuery.data?.error,
    knowledgeDirty,
    knowledgeError,
    savePending,
    syncPending,
  ])

  const knowledgeViewModel = useMemo<KnowledgeSourceModalViewModel>(() => {
    const resolved = knowledgeConfigQuery.data?.resolved
    return {
      source: draft,
      savedSource: savedDraft,
      configuredPath: resolved?.configuredPath || '',
      savedConfiguredPath: resolved?.configuredPath || '',
      effectiveRootLabel:
        resolved?.effectiveRootLabel || resolved?.effectiveRoot || 'wiki',
      upstreamWikiPathLabel: resolved?.upstreamWikiPath || 'wiki',
      usesWorkspaceDefault: resolved?.usesWorkspaceDefault ?? true,
      dirty: knowledgeDirty,
      status: knowledgeStatus,
      contextEngineering: {
        authorityLabel: 'raw_source',
        candidateOnly: true,
        governedPromotionRequired: true,
      },
    }
  }, [
    draft,
    knowledgeConfigQuery.data?.resolved,
    knowledgeDirty,
    knowledgeStatus,
    savedDraft,
  ])

  async function handleSave() {
    setSavePending(true)
    setKnowledgeError(null)
    try {
      const source =
        draft.type === 'local'
          ? { type: 'local' as const, path: draft.path.trim() }
          : {
              type: 'github' as const,
              repo: draft.repo.trim(),
              branch: draft.branch.trim() || 'main',
              path: draft.path.trim(),
            }
      const response = await fetch('/api/knowledge/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source }),
      })
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string
      }
      if (!response.ok || payload.error) {
        throw new Error(payload.error || `Save failed (${response.status})`)
      }
      await queryClient.invalidateQueries({ queryKey: ['knowledge'] })
      setDraft(source)
      setSavedDraft(source)
      toast('Knowledge source saved', { type: 'success' })
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to save knowledge source'
      setKnowledgeError(message)
      toast(message, { type: 'warning' })
    } finally {
      setSavePending(false)
    }
  }

  async function handleSync() {
    if (draft.type !== 'github') return
    setSyncPending(true)
    setKnowledgeError(null)
    try {
      const response = await fetch('/api/knowledge/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: draft }),
      })
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string
      }
      if (!response.ok || payload.error) {
        throw new Error(payload.error || `Sync failed (${response.status})`)
      }
      await queryClient.invalidateQueries({ queryKey: ['knowledge'] })
      toast('Knowledge source synced', { type: 'success' })
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to sync knowledge source'
      setKnowledgeError(message)
      toast(message, { type: 'warning' })
    } finally {
      setSyncPending(false)
    }
  }

  const summary = summaryQuery.data?.summary

  return (
    <div className="min-h-screen bg-surface text-(--theme-text)">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <header className="rounded-3xl border border-(--theme-border) bg-(--theme-card2) p-4  dark:bg-neutral-950/60">
          <div className="flex items-start gap-4">
            <span className="inline-flex size-10 items-center justify-center rounded-md border border-(--theme-border) bg-(--theme-card2)/70">
              <HugeiconsIcon icon={Plug01Icon} size={20} strokeWidth={1.5} />
            </span>
            <div className="space-y-1">
              <h1 className="text-xl font-semibold text-(--theme-text)">
                {DATA_CONNECTIONS_PAGE_COPY.title}
              </h1>
              <p className="max-w-3xl text-sm text-(--theme-muted)">
                {DATA_CONNECTIONS_PAGE_COPY.subtitle}
              </p>
            </div>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-2">
          <Link
            to="/settings/providers"
            className="rounded-md border border-(--theme-border) bg-(--theme-card2) p-4 transition hover:-translate-y-0.5 hover:bg-(--theme-card2)/80 dark:bg-neutral-950/60 dark:hover:bg-neutral-900/80"
          >
            <div className="flex items-start gap-4">
              <HugeiconsIcon icon={CloudIcon} size={20} strokeWidth={1.5} />
              <div>
                <div className="text-sm font-semibold text-(--theme-text)">
                  Providers
                </div>
                <p className="mt-1 text-sm text-(--theme-muted)">
                  Configure model providers and execution credentials used by
                  Hermes and Semantier workflows.
                </p>
              </div>
            </div>
          </Link>

          <Link
            to="/settings/mcp"
            className="rounded-md border border-(--theme-border) bg-(--theme-card2) p-4 transition hover:-translate-y-0.5 hover:bg-(--theme-card2)/80 dark:bg-neutral-950/60 dark:hover:bg-neutral-900/80"
          >
            <div className="flex items-start gap-4">
              <HugeiconsIcon icon={SatelliteIcon} size={20} strokeWidth={1.5} />
              <div>
                <div className="text-sm font-semibold text-(--theme-text)">
                  MCP Servers
                </div>
                <p className="mt-1 text-sm text-(--theme-muted)">
                  Manage read and tool connections that can extend workspace
                  capabilities without becoming semantic authority.
                </p>
              </div>
            </div>
          </Link>
        </section>

        <section className="rounded-3xl border border-(--theme-border) bg-(--theme-card2) p-4  dark:bg-neutral-950/60">
          <div className="mb-4 flex items-start gap-4">
            <span className="inline-flex size-10 items-center justify-center rounded-md border border-(--theme-border) bg-(--theme-card2)/70">
              <HugeiconsIcon icon={DatabaseIcon} size={20} strokeWidth={1.5} />
            </span>
            <div>
              <h2 className="text-base font-semibold text-(--theme-text)">
                Governed Data Surfaces
              </h2>
              <p className="mt-1 text-sm text-(--theme-muted)">
                EOS remains authoritative. Lakehouse artifacts are derived
                mirrors, and DuckDB mounts those persisted artifacts for
                read-only analytics.
              </p>
            </div>
          </div>

          {summaryQuery.isLoading ? (
            <div className="rounded-md border border-(--theme-border) bg-(--theme-card2) px-4 py-6 text-sm text-(--theme-muted)/70">
              Loading data surface summary...
            </div>
          ) : summaryQuery.error instanceof Error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-6 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
              {summaryQuery.error.message}
            </div>
          ) : summary ? (
            <div className="grid gap-4 xl:grid-cols-3">
              <DataConnectionStatusCard surface={summary.eos} />
              <DataConnectionStatusCard surface={summary.lakehouse} />
              <DataConnectionStatusCard surface={summary.duckdb} />
            </div>
          ) : null}
        </section>

        <section className="rounded-3xl border border-(--theme-border) bg-(--theme-card2) p-4  dark:bg-neutral-950/60">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-(--theme-text)">
              Knowledge Source Connection
            </h2>
            <p className="mt-1 text-sm text-(--theme-muted)">
              Configure where browsing content comes from. This connection
              supplies candidate source material and does not, by itself,
              activate governed knowledge.
            </p>
          </div>

          <KnowledgeSourceForm
            viewModel={knowledgeViewModel}
            onChange={setDraft}
            onUseWorkspaceDefault={() =>
              setDraft({ type: 'local', path: 'wiki' })
            }
            onSave={handleSave}
            onSync={draft.type === 'github' ? handleSync : undefined}
            onDismissStatus={() => setKnowledgeError(null)}
          />
        </section>

        <CompanyDatasetImportPanel
          organization={organizationQuery.data?.organization ?? null}
        />
      </div>
    </div>
  )
}
