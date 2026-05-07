import { useCallback, useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import {
  DialogClose,
  DialogContent,
  DialogRoot,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

const LANGUAGE_MAP: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  json: 'json',
  md: 'markdown',
  css: 'css',
  html: 'html',
  yml: 'yaml',
  yaml: 'yaml',
  env: 'dotenv',
}

function getExtension(path: string) {
  const parts = path.split('.')
  return parts.length > 1 ? parts.pop()!.toLowerCase() : ''
}

function isImageFile(path: string) {
  return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(
    getExtension(path),
  )
}

function isExcelFile(path: string) {
  return ['xls', 'xlsx', 'xlsm', 'xlsb'].includes(getExtension(path))
}

function isTextFile(path: string) {
  return !isImageFile(path) && !isExcelFile(path)
}

type FilePreviewDialogProps = {
  path: string | null
  onClose: () => void
  onSaved: () => void
}

export default function FilePreviewDialog({
  path,
  onClose,
  onSaved,
}: FilePreviewDialogProps) {
  const [loading, setLoading] = useState(false)
  const [content, setContent] = useState('')
  const [dataUrl, setDataUrl] = useState('')
  const [excelSheetNames, setExcelSheetNames] = useState<Array<string>>([])
  const [excelActiveSheet, setExcelActiveSheet] = useState('')
  const [excelRows, setExcelRows] = useState<Array<Array<string>>>([])
  const [excelTotalRows, setExcelTotalRows] = useState(0)
  const [excelWorkbook, setExcelWorkbook] = useState<XLSX.WorkBook | null>(null)
  const [excelHeaderEnabled, setExcelHeaderEnabled] = useState(true)
  const [excelHeaderRowIndex, setExcelHeaderRowIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  const language = useMemo(() => {
    if (!path) return 'plaintext'
    const ext = getExtension(path)
    return LANGUAGE_MAP[ext] || 'plaintext'
  }, [path])

  const loadExcelSheet = useCallback(
    (sheetName: string) => {
      if (!excelWorkbook) return
      const worksheet = excelWorkbook.Sheets[sheetName]
      if (!worksheet) {
        setExcelRows([])
        setExcelTotalRows(0)
        setExcelActiveSheet(sheetName)
        return
      }

      const rows = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        raw: false,
        defval: '',
      }) as Array<Array<unknown>>

      setExcelRows(rows.slice(0, 201).map((r) => r.map((cell) => String(cell ?? ''))))
      setExcelTotalRows(rows.length)
      setExcelActiveSheet(sheetName)
      setExcelHeaderEnabled(true)
      setExcelHeaderRowIndex(0)
    },
    [excelWorkbook],
  )

  const loadFile = useCallback(async () => {
    if (!path) return
    setLoading(true)
    setError(null)
    setExcelSheetNames([])
    setExcelActiveSheet('')
    setExcelRows([])
    setExcelTotalRows(0)
    setExcelWorkbook(null)
    setExcelHeaderEnabled(true)
    setExcelHeaderRowIndex(0)
    try {
      if (isExcelFile(path)) {
        const res = await fetch(
          `/api/files?action=download&path=${encodeURIComponent(path)}`,
        )
        if (!res.ok) throw new Error('Failed to download Excel file')
        const buffer = await res.arrayBuffer()
        const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
        if (!workbook.SheetNames.length) {
          throw new Error('Workbook has no sheets')
        }
        setExcelWorkbook(workbook)
        setExcelSheetNames(workbook.SheetNames)
        const firstSheet = workbook.SheetNames[0]
        const firstRows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], {
          header: 1,
          raw: false,
          defval: '',
        }) as Array<Array<unknown>>
        setExcelRows(firstRows.slice(0, 201).map((r) => r.map((cell) => String(cell ?? ''))))
        setExcelTotalRows(firstRows.length)
        setExcelActiveSheet(firstSheet)
        setExcelHeaderEnabled(true)
        setExcelHeaderRowIndex(0)
        setDataUrl('')
        setContent('')
        setDirty(false)
        return
      }

      const res = await fetch(
        `/api/files?action=read&path=${encodeURIComponent(path)}`,
      )
      if (!res.ok) throw new Error('Failed to read file')
      const data = (await res.json()) as {
        type: 'text' | 'image'
        content: string
      }
      if (data.type === 'image') {
        setDataUrl(data.content)
        setContent('')
      } else {
        setContent(data.content)
        setDataUrl('')
      }
      setDirty(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [path])

  useEffect(() => {
    if (path) void loadFile()
  }, [loadFile, path])

  const handleSave = useCallback(async () => {
    if (!path) return
    await fetch('/api/files', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'write',
        path,
        content,
      }),
    })
    setDirty(false)
    onSaved()
  }, [content, onSaved, path])

  const handleDownload = useCallback(async () => {
    if (!path) return
    const res = await fetch(
      `/api/files?action=download&path=${encodeURIComponent(path)}`,
    )
    if (!res.ok) {
      setError(`Download failed: HTTP ${res.status}`)
      return
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = path.split('/').pop() || 'download'
    anchor.click()
    URL.revokeObjectURL(url)
  }, [path])

  const excelColumnCount = useMemo(
    () =>
      excelRows.reduce(
        (max, row) => Math.max(max, row.length),
        0,
      ),
    [excelRows],
  )

  const excelTableModel = useMemo(() => {
    if (!excelRows.length || excelColumnCount === 0) {
      return { headerCells: [] as Array<string>, bodyRows: [] as Array<Array<string>> }
    }

    if (!excelHeaderEnabled) {
      return {
        headerCells: Array.from({ length: excelColumnCount }, (_, index) => `Column ${index + 1}`),
        bodyRows: excelRows,
      }
    }

    const safeHeaderRowIndex = Math.min(
      Math.max(excelHeaderRowIndex, 0),
      Math.max(excelRows.length - 1, 0),
    )
    const headerSource = excelRows[safeHeaderRowIndex] || []

    return {
      headerCells: Array.from(
        { length: excelColumnCount },
        (_, index) => headerSource[index] || `Column ${index + 1}`,
      ),
      bodyRows: excelRows.slice(safeHeaderRowIndex + 1),
    }
  }, [excelColumnCount, excelHeaderEnabled, excelHeaderRowIndex, excelRows])

  return (
    <DialogRoot
      open={Boolean(path)}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="w-[min(900px,96vw)]">
        <div className="p-5 border-b border-primary-200 flex items-center justify-between">
          <DialogTitle className="text-base font-semibold">
            {path || 'File'}
          </DialogTitle>
          <div className="flex gap-2">
            {isExcelFile(path || '') ? (
              <Button variant="outline" onClick={() => void handleDownload()}>
                Download
              </Button>
            ) : null}
            {isTextFile(path || '') ? (
              <Button onClick={handleSave} disabled={!dirty || loading}>
                Save
              </Button>
            ) : null}
            <DialogClose render={<Button variant="outline">Close</Button>} />
          </div>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="text-sm text-primary-500">Loading…</div>
          ) : error ? (
            <div className="text-sm text-red-600">{error}</div>
          ) : path && isImageFile(path) ? (
            <div className="flex items-center justify-center">
              {dataUrl ? (
                <img
                  src={dataUrl}
                  alt={path}
                  className="max-h-[60vh] max-w-full rounded-lg border border-primary-200"
                />
              ) : null}
            </div>
          ) : path && isExcelFile(path) ? (
            <div className="h-[60vh] flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-primary-500">Sheet</span>
                <select
                  value={excelActiveSheet}
                  onChange={(e) => loadExcelSheet(e.target.value)}
                  className="h-8 rounded-md border border-primary-200 bg-white px-2 text-xs text-primary-900"
                >
                  {excelSheetNames.map((sheet) => (
                    <option key={sheet} value={sheet}>
                      {sheet}
                    </option>
                  ))}
                </select>
                <span className="ml-auto text-xs text-primary-500">
                  {excelTotalRows.toLocaleString()} rows
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary-200 bg-primary-50 px-3 py-2">
                <label className="flex items-center gap-2 text-xs text-primary-700">
                  <input
                    type="checkbox"
                    checked={excelHeaderEnabled}
                    onChange={(e) => setExcelHeaderEnabled(e.target.checked)}
                  />
                  Use header row
                </label>
                <label className="flex items-center gap-2 text-xs text-primary-700">
                  Header row
                  <input
                    type="number"
                    min={1}
                    max={Math.max(excelRows.length, 1)}
                    value={excelHeaderRowIndex + 1}
                    disabled={!excelHeaderEnabled || excelRows.length === 0}
                    onChange={(e) => {
                      const nextRow = Number(e.target.value)
                      if (!Number.isFinite(nextRow)) return
                      setExcelHeaderRowIndex(
                        Math.min(
                          Math.max(Math.floor(nextRow) - 1, 0),
                          Math.max(excelRows.length - 1, 0),
                        ),
                      )
                    }}
                    className="h-7 w-20 rounded-md border border-primary-200 bg-white px-2 text-xs text-primary-900"
                  />
                </label>
                {!excelHeaderEnabled ? (
                  <span className="text-xs text-primary-500">
                    Header disabled. Generic column names are shown.
                  </span>
                ) : null}
              </div>

              <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-primary-200">
                {excelRows.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-primary-500">
                    This sheet has no rows.
                  </div>
                ) : (
                  <table className="w-full border-separate border-spacing-0 text-xs">
                    {excelHeaderEnabled && (
                    <thead>
                      <tr>
                        {excelTableModel.headerCells.map((cell, index) => (
                          <th
                            key={`h-${index}`}
                              className="sticky top-0 z-20 border-b border-r border-border bg-table-header px-2 py-1.5 text-left font-semibold text-card-foreground shadow-sm"
                          >
                            {cell || `Column ${index + 1}`}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    )}
                    <tbody>
                      {excelTableModel.bodyRows.map((row, rowIndex) => (
                        <tr
                          key={`r-${rowIndex}`}
                          className={rowIndex % 2 === 0 ? 'excel-preview-row-odd' : 'excel-preview-row-even'}
                        >
                          {excelTableModel.headerCells.map((_, colIndex) => (
                            <td
                              key={`c-${rowIndex}-${colIndex}`}
                              className="excel-preview-cell max-w-[260px] truncate border-r border-b border-border px-2 py-1.5"
                              title={row[colIndex] || ''}
                            >
                              {row[colIndex] || ''}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {excelTotalRows > 201 ? (
                <p className="text-xs text-primary-500">
                  Preview is limited to the first 200 data rows.
                </p>
              ) : null}
            </div>
          ) : (
            <div className="h-[60vh]">
              <textarea
                className="h-full w-full resize-none rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 font-mono text-xs leading-relaxed text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                value={content}
                onChange={(e) => {
                  setContent(e.target.value)
                  setDirty(true)
                }}
                spellCheck={false}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </DialogRoot>
  )
}
