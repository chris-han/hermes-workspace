import { CodeIcon, Folder01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

export type KnowledgeSourceDraft =
  | { type: 'local'; path: string }
  | { type: 'github'; repo: string; branch: string; path: string }

type KnowledgeSourceFormProps = {
  value: KnowledgeSourceDraft
  onChange: (next: KnowledgeSourceDraft) => void
  onUseWorkspaceDefault?: () => void
  onSave: () => Promise<void> | void
  onSync?: () => Promise<void> | void
  saving: boolean
  syncing: boolean
  error: string | null
  mode: 'embedded' | 'dialog'
  configuredPathLabel?: string
  effectiveRootLabel?: string
  upstreamWikiPathLabel?: string
}

export function createDefaultKnowledgeSourceDraft(): KnowledgeSourceDraft {
  return { type: 'local', path: '' }
}

export function KnowledgeSourceForm({
  value,
  onChange,
  onUseWorkspaceDefault,
  onSave,
  onSync,
  saving,
  syncing,
  error,
  mode,
  configuredPathLabel,
  effectiveRootLabel,
  upstreamWikiPathLabel,
}: KnowledgeSourceFormProps) {
  const containerClassName =
    mode === 'embedded'
      ? 'space-y-4 rounded-2xl border border-primary-200 bg-primary-50/80 p-4 dark:border-neutral-800 dark:bg-neutral-950/60'
      : 'space-y-4'

  return (
    <div className={containerClassName}>
      <div className="space-y-2">
        <label className="text-sm font-medium">Source type</label>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() =>
              onChange({
                type: 'local',
                path: value.type === 'local' ? value.path : '',
              })
            }
            className="flex flex-1 items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors"
            style={{
              borderColor:
                value.type === 'local'
                  ? 'var(--accent-color, #f97316)'
                  : 'var(--theme-border)',
              backgroundColor:
                value.type === 'local' ? 'var(--theme-card)' : 'transparent',
              color: 'var(--theme-text)',
            }}
          >
            <HugeiconsIcon icon={Folder01Icon} size={16} strokeWidth={1.7} />
            Local folder
          </button>
          <button
            type="button"
            onClick={() =>
              onChange({
                type: 'github',
                repo: value.type === 'github' ? value.repo : '',
                branch: value.type === 'github' ? value.branch : 'main',
                path: value.type === 'github' ? value.path : '',
              })
            }
            className="flex flex-1 items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors"
            style={{
              borderColor:
                value.type === 'github'
                  ? 'var(--accent-color, #f97316)'
                  : 'var(--theme-border)',
              backgroundColor:
                value.type === 'github' ? 'var(--theme-card)' : 'transparent',
              color: 'var(--theme-text)',
            }}
          >
            <HugeiconsIcon icon={CodeIcon} size={16} strokeWidth={1.7} />
            GitHub repo
          </button>
        </div>
      </div>

      {value.type === 'local' ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <label
              className="text-sm font-medium"
              htmlFor="knowledge-source-local-path"
            >
              Folder path
            </label>
            {onUseWorkspaceDefault ? (
              <button
                type="button"
                onClick={onUseWorkspaceDefault}
                className="rounded-lg border border-border px-2 py-1 text-xs font-medium transition-colors hover:bg-primary-100 dark:hover:bg-neutral-900"
                style={{ color: 'var(--theme-text)' }}
              >
                Use LLM Wiki default
              </button>
            ) : null}
          </div>
          <input
            id="knowledge-source-local-path"
            type="text"
            value={value.path}
            onChange={(event) =>
              onChange({
                type: 'local',
                path: event.target.value,
              })
            }
            placeholder="~/my-wiki or /absolute/path"
            className="w-full rounded-xl border border-border px-3 py-2 text-sm outline-none"
            style={{
              backgroundColor: 'var(--theme-card)',
              color: 'var(--theme-text)',
            }}
          />
          {(configuredPathLabel || effectiveRootLabel || upstreamWikiPathLabel) && (
            <div className="space-y-1 rounded-lg border border-primary-200 bg-primary-50/70 px-3 py-2 text-xs dark:border-neutral-800 dark:bg-neutral-900/60">
              {configuredPathLabel ? (
                <p>
                  <span className="font-medium">Saved config:</span>{' '}
                  {configuredPathLabel}
                </p>
              ) : null}
              {effectiveRootLabel ? (
                <p>
                  <span className="font-medium">Effective root:</span>{' '}
                  {effectiveRootLabel}
                </p>
              ) : null}
              {upstreamWikiPathLabel ? (
                <p>
                  <span className="font-medium">Agent WIKI_PATH:</span>{' '}
                  {upstreamWikiPathLabel}
                </p>
              ) : null}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label
              className="text-sm font-medium"
              htmlFor="knowledge-source-github-repo"
            >
              Repository
            </label>
            <input
              id="knowledge-source-github-repo"
              type="text"
              value={value.repo}
              onChange={(event) =>
                onChange({
                  ...value,
                  repo: event.target.value,
                })
              }
              placeholder="owner/repo"
              className="w-full rounded-xl border border-border px-3 py-2 text-sm outline-none"
              style={{
                backgroundColor: 'var(--theme-card)',
                color: 'var(--theme-text)',
              }}
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1 space-y-1.5">
              <label
                className="text-sm font-medium"
                htmlFor="knowledge-source-github-branch"
              >
                Branch
              </label>
              <input
                id="knowledge-source-github-branch"
                type="text"
                value={value.branch}
                onChange={(event) =>
                  onChange({
                    ...value,
                    branch: event.target.value,
                  })
                }
                placeholder="main"
                className="w-full rounded-xl border border-border px-3 py-2 text-sm outline-none"
                style={{
                  backgroundColor: 'var(--theme-card)',
                  color: 'var(--theme-text)',
                }}
              />
            </div>
            <div className="flex-1 space-y-1.5">
              <label
                className="text-sm font-medium"
                htmlFor="knowledge-source-github-path"
              >
                Sub-folder
              </label>
              <input
                id="knowledge-source-github-path"
                type="text"
                value={value.path}
                onChange={(event) =>
                  onChange({
                    ...value,
                    path: event.target.value,
                  })
                }
                placeholder="wiki (optional)"
                className="w-full rounded-xl border border-border px-3 py-2 text-sm outline-none"
                style={{
                  backgroundColor: 'var(--theme-card)',
                  color: 'var(--theme-text)',
                }}
              />
            </div>
          </div>
        </div>
      )}

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end gap-2 pt-1">
        {value.type === 'github' && onSync ? (
          <button
            type="button"
            onClick={() => void onSync()}
            disabled={syncing || !value.repo.trim()}
            className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-primary-100 disabled:opacity-50 dark:hover:bg-neutral-900"
            style={{ color: 'var(--theme-text)' }}
          >
            {syncing ? 'Syncing…' : 'Sync now'}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => void onSave()}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-600 disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}
