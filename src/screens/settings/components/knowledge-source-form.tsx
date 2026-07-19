import {
  CheckmarkCircle02Icon,
  CodeIcon,
  Folder01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

export type KnowledgeSourceDraft =
  | { type: 'local'; path: string }
  | { type: 'github'; repo: string; branch: string; path: string }

export type KnowledgeTreeEntry = {
  name: string
  path: string
  kind: 'directory' | 'file'
  size?: number
  modified?: string
  children?: Array<KnowledgeTreeEntry>
}

export type KnowledgeSourceModalViewModel = {
  source: KnowledgeSourceDraft
  savedSource: KnowledgeSourceDraft | null
  configuredPath: string
  savedConfiguredPath: string
  effectiveRootLabel: string
  upstreamWikiPathLabel: string
  usesWorkspaceDefault: boolean
  dirty: boolean
  status: {
    kind:
      | 'idle'
      | 'dirty'
      | 'saving'
      | 'saved'
      | 'syncing'
      | 'uploaded'
      | 'review'
      | 'ingesting'
      | 'failed'
    message: string
    failures: Array<{ filename: string; error: string }>
    renamed: Array<{ originalName: string; storedName: string }>
    ingested: Array<{
      originalName: string
      storedMarkdownPath: string
      parserMethod: string
      normalizedDocumentArtifactRef: string
    }>
  }
  contextEngineering: {
    authorityLabel:
      | 'raw_source'
      | 'curation_context'
      | 'canonical_artifact_derivative'
    candidateOnly: boolean
    governedPromotionRequired: boolean
  }
}

type KnowledgeSourceFormProps = {
  viewModel: KnowledgeSourceModalViewModel
  onChange: (next: KnowledgeSourceDraft) => void
  onUseWorkspaceDefault: () => void
  onSave: () => Promise<void> | void
  onSync?: () => Promise<void> | void
  onDismissStatus: () => void
}

export function createDefaultKnowledgeSourceDraft(): KnowledgeSourceDraft {
  return { type: 'local', path: '' }
}

export function KnowledgeSourceForm({
  viewModel,
  onChange,
  onUseWorkspaceDefault,
  onSave,
  onSync,
  onDismissStatus,
}: KnowledgeSourceFormProps) {
  const value = viewModel.source
  const hasFailures = viewModel.status.failures.length > 0

  return (
    <div className="space-y-4">
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
            className="flex flex-1 items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors"
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
            className="flex flex-1 items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors"
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
        <>
          <section className="space-y-3 rounded-lg border border-border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <h3 className="text-base font-semibold">Workspace wiki root</h3>
                <p className="text-xs" style={{ color: 'var(--theme-muted)' }}>
                  Source files and generated wiki files are managed from the
                  main Knowledge view.
                </p>
              </div>
              <div
                className="text-right text-xs"
                style={{ color: 'var(--theme-muted)' }}
              >
                Root: {viewModel.upstreamWikiPathLabel}
              </div>
            </div>
          </section>

          <section className="space-y-3 rounded-lg border border-border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold">Saved config</h3>
                <p className="text-xs" style={{ color: 'var(--theme-muted)' }}>
                  Save only changes the source configuration. It does not upload
                  files.
                </p>
              </div>
              <button
                type="button"
                onClick={onUseWorkspaceDefault}
                className="rounded-lg border border-border px-2 py-1 text-xs font-medium"
              >
                Use LLM Wiki default
              </button>
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
              placeholder="wiki"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none"
              style={{
                backgroundColor: 'var(--theme-card)',
                color: 'var(--theme-text)',
              }}
            />
            <div
              className="space-y-1 text-xs"
              style={{ color: 'var(--theme-muted)' }}
            >
              <p>
                Saved config:{' '}
                {viewModel.savedConfiguredPath || '(workspace default)'}
              </p>
              <p>Effective root: {viewModel.effectiveRootLabel}</p>
              <p>Agent WIKI_PATH: {viewModel.upstreamWikiPathLabel}</p>
            </div>
          </section>
        </>
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
                onChange({ ...value, repo: event.target.value })
              }
              placeholder="owner/repo"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none"
              style={{
                backgroundColor: 'var(--theme-card)',
                color: 'var(--theme-text)',
              }}
            />
          </div>
          <div className="flex gap-3">
            <input
              type="text"
              value={value.branch}
              onChange={(event) =>
                onChange({ ...value, branch: event.target.value })
              }
              placeholder="main"
              className="min-w-0 flex-1 rounded-lg border border-border px-3 py-2 text-sm outline-none"
            />
            <input
              type="text"
              value={value.path}
              onChange={(event) =>
                onChange({ ...value, path: event.target.value })
              }
              placeholder="wiki"
              className="min-w-0 flex-1 rounded-lg border border-border px-3 py-2 text-sm outline-none"
            />
          </div>
        </div>
      )}

      <div className="sticky bottom-0 space-y-2 rounded-lg border border-border bg-surface p-3">
        {viewModel.status.message ? (
          <div
            role={hasFailures ? 'alert' : 'status'}
            aria-live={hasFailures ? 'assertive' : 'polite'}
            className="flex items-start justify-between gap-3 text-sm"
          >
            <span className="flex min-w-0 items-start gap-2">
              {!hasFailures ? (
                <HugeiconsIcon
                  icon={CheckmarkCircle02Icon}
                  size={16}
                  strokeWidth={1.7}
                />
              ) : null}
              <span>{viewModel.status.message}</span>
            </span>
            {hasFailures ? (
              <button
                type="button"
                onClick={onDismissStatus}
                className="rounded-md border border-border px-2 py-1 text-xs"
              >
                Dismiss
              </button>
            ) : null}
          </div>
        ) : null}
        {viewModel.status.renamed.length > 0 ? (
          <div className="text-xs" style={{ color: 'var(--theme-muted)' }}>
            {viewModel.status.renamed
              .map((item) => `${item.originalName} -> ${item.storedName}`)
              .join(', ')}
          </div>
        ) : null}
        {viewModel.status.ingested.length > 0 ? (
          <div className="text-xs" style={{ color: 'var(--theme-muted)' }}>
            {viewModel.status.ingested
              .map(
                (item) => `${item.originalName} -> ${item.storedMarkdownPath}`,
              )
              .join(', ')}
          </div>
        ) : null}
        {hasFailures ? (
          <ul className="space-y-1 text-xs text-red-600">
            {viewModel.status.failures.map((failure) => (
              <li key={`${failure.filename}:${failure.error}`}>
                {failure.filename}: {failure.error}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="flex justify-end gap-2">
          {value.type === 'github' && onSync ? (
            <button
              type="button"
              onClick={() => void onSync()}
              disabled={
                viewModel.status.kind === 'syncing' || !value.repo.trim()
              }
              className="rounded-lg border border-border px-3 py-2 text-sm font-medium disabled:opacity-50"
            >
              {viewModel.status.kind === 'syncing' ? 'Syncing...' : 'Sync now'}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void onSave()}
            disabled={viewModel.status.kind === 'saving'}
            className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {viewModel.status.kind === 'saving' ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
