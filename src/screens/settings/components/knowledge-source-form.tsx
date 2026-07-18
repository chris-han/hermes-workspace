import {
  CheckmarkCircle02Icon,
  CodeIcon,
  File01Icon,
  Folder01Icon,
  Upload01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useState } from 'react'

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
  browser: {
    currentPath: string
    breadcrumb: Array<{ label: string; path: string }>
    fileCount: number
    directoryCount: number
    entries: Array<{
      name: string
      path: string
      kind: 'directory' | 'file'
      size?: number
      modified?: string
      children?: Array<KnowledgeTreeEntry>
    }>
    treeRoot: KnowledgeTreeEntry
    loading: boolean
    error: string | null
    uploadTargetPath: string
  }
  upload: {
    pending: boolean
    acceptedExtensions: Array<string>
    queuedFiles: Array<{ name: string; size: number }>
  }
  reviewRows: Array<{
    originalName: string
    storedName: string
    size: number
    retryUploadRef: string
    targetWikiPath?: string
    ingestKind: 'document_extraction' | 'table_ingestion'
    canonicalArtifactKind: 'canonical_document' | 'canonical_table'
  }>
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
  onBrowse: (path: string) => void
  onQueueUploadFiles: (files: Array<File>) => void
  onClearUploadQueue: () => void
  onUploadQueued: () => Promise<void> | void
  onCreateFolder: (folderName: string) => Promise<void> | void
  onSave: () => Promise<void> | void
  onSync?: () => Promise<void> | void
  onIngest: (uploadRef: string) => Promise<void> | void
  onRemoveReviewRow: (uploadRef: string) => void
  onDismissStatus: () => void
}

export function createDefaultKnowledgeSourceDraft(): KnowledgeSourceDraft {
  return { type: 'local', path: '' }
}

function formatBytes(size = 0): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

type KnowledgeTreeNodeProps = {
  entry: KnowledgeTreeEntry
  depth: number
  expanded: Set<string>
  selectedPath: string
  onToggle: (path: string) => void
  onSelectFolder: (path: string) => void
}

function KnowledgeTreeNode({
  entry,
  depth,
  expanded,
  selectedPath,
  onToggle,
  onSelectFolder,
}: KnowledgeTreeNodeProps) {
  const isFolder = entry.kind === 'directory'
  const isExpanded = expanded.has(entry.path)
  const isSelected = selectedPath === entry.path
  const paddingLeft = 12 + depth * 16

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          if (!isFolder) return
          onSelectFolder(entry.path)
          onToggle(entry.path)
        }}
        className={[
          'flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-left text-sm transition-colors',
          isSelected
            ? 'bg-accent-500/15 text-accent-600 dark:text-accent-400'
            : 'hover:bg-primary-100 dark:hover:bg-neutral-900',
        ].join(' ')}
        style={{ paddingLeft }}
        aria-current={isSelected ? 'true' : undefined}
      >
        {isFolder ? (
          <span
            className={[
              'w-3 shrink-0 text-xs transition-transform duration-150',
              isExpanded ? 'rotate-90' : 'rotate-0',
            ].join(' ')}
          >
            ▶
          </span>
        ) : (
          <span className="w-3 shrink-0" />
        )}
        <HugeiconsIcon
          icon={isFolder ? Folder01Icon : File01Icon}
          size={16}
          strokeWidth={1.7}
          className="shrink-0"
        />
        <span className="min-w-0 truncate">{entry.name}</span>
      </button>

      {isFolder && isExpanded && entry.children?.length ? (
        <div>
          {entry.children.map((child) => (
            <KnowledgeTreeNode
              key={child.path || 'wiki'}
              entry={child}
              depth={depth + 1}
              expanded={expanded}
              selectedPath={selectedPath}
              onToggle={onToggle}
              onSelectFolder={onSelectFolder}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function KnowledgeSourceForm({
  viewModel,
  onChange,
  onUseWorkspaceDefault,
  onBrowse,
  onQueueUploadFiles,
  onClearUploadQueue,
  onUploadQueued,
  onCreateFolder,
  onSave,
  onSync,
  onIngest,
  onRemoveReviewRow,
  onDismissStatus,
}: KnowledgeSourceFormProps) {
  const value = viewModel.source
  const hasFailures = viewModel.status.failures.length > 0
  const [newFolderName, setNewFolderName] = useState('')
  const [expandedTreePaths, setExpandedTreePaths] = useState<Set<string>>(
    () => new Set(['']),
  )

  function toggleTreePath(path: string) {
    setExpandedTreePaths((current) => {
      const next = new Set(current)
      if (next.has(path)) {
        if (path) next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }

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
          <section className="space-y-4 rounded-lg border border-border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <h3 className="text-base font-semibold">
                  Workspace wiki files
                </h3>
                <p className="text-xs" style={{ color: 'var(--theme-muted)' }}>
                  Browse the authenticated workspace wiki and choose where new
                  files are uploaded.
                </p>
              </div>
              <div
                className="text-right text-xs"
                style={{ color: 'var(--theme-muted)' }}
              >
                Root: {viewModel.upstreamWikiPathLabel}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {viewModel.browser.breadcrumb.map((crumb, index) => (
                    <button
                      key={`${crumb.path}:${index}`}
                      type="button"
                      onClick={() => onBrowse(crumb.path)}
                      className="rounded-md border border-border px-2 py-1 font-medium"
                    >
                      {crumb.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold">
                      {viewModel.browser.currentPath || 'wiki'}
                    </h3>
                    <p
                      className="text-xs"
                      style={{ color: 'var(--theme-muted)' }}
                    >
                      {viewModel.browser.directoryCount} folders ·{' '}
                      {viewModel.browser.fileCount} files
                    </p>
                  </div>
                </div>
                <div className="min-h-[260px] overflow-hidden rounded-lg border border-border p-1">
                  {viewModel.browser.loading ? (
                    <div className="p-4 text-sm">Loading folder...</div>
                  ) : viewModel.browser.error ? (
                    <div className="p-4 text-sm text-red-600">
                      {viewModel.browser.error}
                    </div>
                  ) : (
                    <KnowledgeTreeNode
                      entry={viewModel.browser.treeRoot}
                      depth={0}
                      expanded={expandedTreePaths}
                      selectedPath={viewModel.browser.currentPath}
                      onToggle={toggleTreePath}
                      onSelectFolder={onBrowse}
                    />
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2 rounded-lg border border-border p-3">
                  <h3 className="text-sm font-semibold">Create folder</h3>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newFolderName}
                      onChange={(event) => setNewFolderName(event.target.value)}
                      placeholder="Folder name"
                      className="min-w-0 flex-1 rounded-lg border border-border px-3 py-2 text-sm outline-none"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        const nextName = newFolderName.trim()
                        if (!nextName) return
                        await onCreateFolder(nextName)
                        setNewFolderName('')
                      }}
                      disabled={!newFolderName.trim()}
                      className="rounded-lg border border-border px-3 py-2 text-sm font-medium disabled:opacity-50"
                    >
                      Create
                    </button>
                  </div>
                  <p
                    className="text-xs"
                    style={{ color: 'var(--theme-muted)' }}
                  >
                    New folders are created under{' '}
                    {viewModel.browser.uploadTargetPath || 'wiki'}.
                  </p>
                </div>

                <div className="space-y-3 rounded-lg border border-border p-3">
                  <div>
                    <h3 className="text-sm font-semibold">Upload files</h3>
                    <p
                      className="text-xs"
                      style={{ color: 'var(--theme-muted)' }}
                    >
                      Target: {viewModel.browser.uploadTargetPath || 'wiki'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium">
                      <HugeiconsIcon
                        icon={Upload01Icon}
                        size={16}
                        strokeWidth={1.7}
                      />
                      Choose files
                      <input
                        type="file"
                        multiple
                        className="hidden"
                        accept={viewModel.upload.acceptedExtensions.join(',')}
                        disabled={viewModel.upload.pending}
                        onChange={(event) => {
                          const files = Array.from(event.target.files ?? [])
                          event.target.value = ''
                          if (files.length > 0) onQueueUploadFiles(files)
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => void onUploadQueued()}
                      disabled={
                        viewModel.upload.pending ||
                        viewModel.upload.queuedFiles.length === 0
                      }
                      className="rounded-lg bg-accent-500 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                    >
                      {viewModel.upload.pending ? 'Uploading...' : 'Upload'}
                    </button>
                  </div>
                  {viewModel.upload.queuedFiles.length > 0 ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span style={{ color: 'var(--theme-muted)' }}>
                          {viewModel.upload.queuedFiles.length} files ready
                        </span>
                        <button
                          type="button"
                          onClick={onClearUploadQueue}
                          className="font-medium"
                        >
                          Clear
                        </button>
                      </div>
                      <div className="max-h-28 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                        {viewModel.upload.queuedFiles.map((file) => (
                          <div
                            key={`${file.name}:${file.size}`}
                            className="flex items-center justify-between gap-3 text-xs"
                          >
                            <span className="min-w-0 truncate">
                              {file.name}
                            </span>
                            <span
                              className="shrink-0"
                              style={{ color: 'var(--theme-muted)' }}
                            >
                              {formatBytes(file.size)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {viewModel.reviewRows.length > 0 ? (
              <div className="space-y-2">
                {viewModel.reviewRows.map((row) => (
                  <div
                    key={row.retryUploadRef}
                    className="rounded-lg border border-border px-3 py-2 text-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium">
                          {row.originalName}
                        </div>
                        <div
                          className="text-xs"
                          style={{ color: 'var(--theme-muted)' }}
                        >
                          {row.ingestKind} · {row.canonicalArtifactKind} ·{' '}
                          {formatBytes(row.size)}
                        </div>
                        {row.targetWikiPath ? (
                          <div className="mt-1 truncate text-xs">
                            {row.targetWikiPath}
                          </div>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={() => void onIngest(row.retryUploadRef)}
                          className="rounded-lg bg-accent-500 px-3 py-1.5 text-xs font-medium text-white"
                        >
                          Review and import
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemoveReviewRow(row.retryUploadRef)}
                          className="rounded-lg border border-border px-2 py-1.5 text-xs"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
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
