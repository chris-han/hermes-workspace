import { useState, useRef, type ChangeEvent, type DragEvent } from 'react'
import type { DocumentEnvelope } from '@/contracts/source-document'

type IngestStatus = 'idle' | 'uploading' | 'previewing' | 'building' | 'done' | 'error'

type IngestProgress = {
  status: IngestStatus
  message: string
  filename?: string
  sourceHash?: string
  nodes?: number
  edges?: number
}

type Props = {
  sessionId: string
  onIngested: (payload: {
    relativePath: string
    sourceHash: string
    envelope: DocumentEnvelope | null
    nodes: number
    edges: number
  }) => void
  onGraphRefresh: () => Promise<unknown> | unknown
}

const ACCEPT = '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document'

export function IngestPanel({ sessionId, onIngested, onGraphRefresh }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [progress, setProgress] = useState<IngestProgress>({ status: 'idle', message: 'Drop a tender DOCX here, or pick one to ingest.' })
  const [dragging, setDragging] = useState(false)

  const reset = () => setProgress({ status: 'idle', message: 'Drop a tender DOCX here, or pick one to ingest.' })

  const ingest = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.docx')) {
      setProgress({ status: 'error', message: 'Only DOCX is supported in this MVL.' })
      return
    }
    setProgress({ status: 'uploading', message: `Uploading ${file.name}…`, filename: file.name })
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('session_id', sessionId)
      const uploadResp = await fetch('/api/contextgraph/builder/upload', { method: 'POST', body: fd })
      if (!uploadResp.ok) throw new Error(`upload ${uploadResp.status}: ${await uploadResp.text()}`)
      const uploadBody = (await uploadResp.json()) as { relativePath: string; sourceHash: string }

      setProgress({ status: 'previewing', message: 'Parsing DOCX and grounding evidence…', filename: file.name, sourceHash: uploadBody.sourceHash })
      const previewResp = await fetch('/api/contextgraph/builder/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ relativePath: uploadBody.relativePath }),
      })
      if (!previewResp.ok) throw new Error(`preview ${previewResp.status}: ${await previewResp.text()}`)
      await previewResp.json()

      setProgress({ status: 'building', message: 'Building candidate ContextGraph…', filename: file.name, sourceHash: uploadBody.sourceHash })
      const buildResp = await fetch('/api/contextgraph/builder/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'fixed-docx' }),
      })
      if (!buildResp.ok) throw new Error(`build ${buildResp.status}: ${await buildResp.text()}`)
      const buildBody = (await buildResp.json()) as { counts: { nodes: number; edges: number } }

      setProgress({
        status: 'done',
        message: `Built ${buildBody.counts.nodes} nodes / ${buildBody.counts.edges} edges from ${file.name}`,
        filename: file.name,
        sourceHash: uploadBody.sourceHash,
        nodes: buildBody.counts.nodes,
        edges: buildBody.counts.edges,
      })
      await onGraphRefresh()
      onIngested({
        relativePath: uploadBody.relativePath,
        sourceHash: uploadBody.sourceHash,
        envelope: null,
        nodes: buildBody.counts.nodes,
        edges: buildBody.counts.edges,
      })
    } catch (err) {
      setProgress({ status: 'error', message: err instanceof Error ? err.message : String(err) })
    }
  }

  const onPick = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) void ingest(file)
    event.target.value = ''
  }

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    setDragging(false)
    const file = event.dataTransfer.files?.[0]
    if (file) void ingest(file)
  }

  const busy = progress.status !== 'idle' && progress.status !== 'done' && progress.status !== 'error'

  return (
    <section
      data-testid="ingest-panel"
      aria-label="Ingest tender DOCX"
      className="rounded-xl border border-border bg-card p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Ingest tender DOCX</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Upload a tender DOCX into the governed session upload root, parse it with AnyDoc, and build the candidate ContextGraph.
          </p>
        </div>
        <span
          aria-live="polite"
          className={
            'rounded-full border px-2 py-1 text-[11px] ' +
            (progress.status === 'error'
              ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
              : progress.status === 'done'
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                : 'border-border text-muted-foreground')
          }
        >
          {progress.status}
        </span>
      </div>

      <label
        htmlFor="ingest-file"
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={
          'mt-3 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-6 text-center text-xs transition-colors ' +
          (dragging
            ? 'border-primary bg-primary/10 text-foreground'
            : busy
              ? 'border-border bg-muted/40 text-muted-foreground'
              : 'border-border bg-background text-muted-foreground hover:border-primary hover:text-foreground')
        }
      >
        <input
          ref={inputRef}
          id="ingest-file"
          type="file"
          accept={ACCEPT}
          className="sr-only"
          onChange={onPick}
          disabled={busy}
          data-testid="ingest-file-input"
        />
        <span className="text-sm font-medium">
          {busy ? progress.message : 'Drop a tender DOCX here, or click to choose a file'}
        </span>
        <span className="text-[11px] text-muted-foreground">
          AnyDoc-backed parser · session-scoped upload · candidate graph is reversible
        </span>
      </label>

      {progress.sourceHash ? (
        <p className="mt-3 break-all font-mono text-[10px] text-muted-foreground">
          sourceHash: {progress.sourceHash}
        </p>
      ) : null}

      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground" data-testid="ingest-message">
          {progress.message}
        </span>
        {progress.status === 'done' || progress.status === 'error' ? (
          <button
            type="button"
            onClick={reset}
            className="rounded-full border border-border px-3 py-1 text-[11px] text-muted-foreground hover:bg-muted"
          >
            Reset
          </button>
        ) : null}
      </div>
    </section>
  )
}