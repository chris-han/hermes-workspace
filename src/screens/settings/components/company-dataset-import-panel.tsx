import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { OrganizationContext } from '@/lib/organization-membership'
import {
  createImportIdempotencyKey,
  fetchActiveCompanyDataset,
  fetchCompanyDatasetImports,
  previewCompanyDatasetImport,
  promoteCompanyDatasetImport,
  uploadCompanyDatasetImport,
  validateCompanyDatasetImport,
  type CompanyDatasetImportPreview,
  type CompanyDatasetImportRecord,
} from '@/lib/company-dataset-imports'
import { toast } from '@/components/ui/toast'

export function isPromotingStale(
  record: CompanyDatasetImportRecord,
  now = Date.now(),
) {
  if (record.status !== 'promoting') return false
  const updatedAt = Date.parse(record.updated_at)
  if (Number.isNaN(updatedAt)) return false
  return now - updatedAt > 15 * 60 * 1000
}

export function canValidateImport(record: CompanyDatasetImportRecord | null) {
  return record?.status === 'uploaded' || record?.status === 'validation_failed'
}

export function getHighlightedHeaderRow(params: {
  autoHeader: boolean
  manualHeaderRow: number
  suggestedHeaderRow?: number | null
}): number {
  return params.autoHeader && params.suggestedHeaderRow
    ? params.suggestedHeaderRow
    : params.manualHeaderRow
}

export const COMPANY_DATASET_SHEET_COMBOBOX_ROLE = 'combobox'
export const COMPANY_DATASET_FILTER_DEBOUNCE_MS = 250

export function CompanyDatasetImportPanel({
  organization,
}: {
  organization: OrganizationContext | null
}) {
  const queryClient = useQueryClient()
  const [files, setFiles] = useState<Array<File>>([])
  const [sourcePath, setSourcePath] = useState('')
  const [selectedSheets, setSelectedSheets] = useState('Sheet1')
  const [allSheets, setAllSheets] = useState(false)
  const [headerRow, setHeaderRow] = useState(1)
  const [autoHeader, setAutoHeader] = useState(false)
  const [preview, setPreview] = useState<CompanyDatasetImportPreview | null>(
    null,
  )
  const [currentImport, setCurrentImport] =
    useState<CompanyDatasetImportRecord | null>(null)
  const [activePreviewSheet, setActivePreviewSheet] = useState('')
  const [explorerFileId, setExplorerFileId] = useState('all')
  const [explorerFilterDraft, setExplorerFilterDraft] = useState('')
  const [explorerFilter, setExplorerFilter] = useState('')
  const [explorerPage, setExplorerPage] = useState(1)
  const explorerPageSize = 25
  const sheetDatalistId = 'company-dataset-sheet-options'
  const [uploadKey] = useState(() => createImportIdempotencyKey('upload'))
  const [validateKey] = useState(() => createImportIdempotencyKey('validate'))
  const [promoteKey] = useState(() => createImportIdempotencyKey('promote'))

  const importsQuery = useQuery({
    queryKey: ['company-dataset-imports'],
    queryFn: fetchCompanyDatasetImports,
    enabled: Boolean(organization?.organization_id),
    retry: false,
  })
  const datasetQuery = useQuery({
    queryKey: [
      'company-dataset-active',
      explorerFileId,
      explorerFilter,
      explorerPage,
      explorerPageSize,
    ],
    queryFn: () =>
      fetchActiveCompanyDataset({
        fileId: explorerFileId,
        filter: explorerFilter,
        page: explorerPage,
        pageSize: explorerPageSize,
      }),
    enabled: organization?.dataset_type === 'REAL',
    placeholderData: (previousData) => previousData,
    retry: false,
  })

  useEffect(() => {
    if (explorerFilterDraft === explorerFilter) return undefined
    const timeout = window.setTimeout(() => {
      setExplorerFilter(explorerFilterDraft)
      setExplorerPage(1)
    }, COMPANY_DATASET_FILTER_DEBOUNCE_MS)
    return () => window.clearTimeout(timeout)
  }, [explorerFilter, explorerFilterDraft])

  const latestImport = importsQuery.data?.[0] ?? null
  const activeImport = currentImport ?? latestImport
  const canImport =
    organization?.dataset_type === 'REAL' &&
    organization?.membership_status === 'active'
  const canPromote = canImport && Boolean(organization?.can_change_settings)
  const hasImportSource = files.length > 0 || Boolean(sourcePath.trim())
  const selectedSheetNames = useMemo(
    () =>
      selectedSheets
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    [selectedSheets],
  )
  const detectedEncodings = useMemo(
    () =>
      Array.from(
        new Set(
          (preview?.files ?? [])
            .map((filePreview) => filePreview.encoding?.trim())
            .filter(Boolean) as Array<string>,
        ),
      ),
    [preview?.files],
  )
  const parserEncoding =
    detectedEncodings.length === 1 ? detectedEncodings[0] : 'auto'

  const parserProfile = useMemo(() => {
    const headerSheets =
      allSheets && preview?.sheet_names?.length
        ? preview.sheet_names
        : selectedSheetNames
    return {
      locale: 'zh-CN',
      timezone: 'UTC',
      encoding: parserEncoding,
      all_sheets: allSheets,
      auto_header: autoHeader,
      selected_sheets: allSheets ? [] : selectedSheetNames,
      header_rows: autoHeader
        ? {}
        : Object.fromEntries(headerSheets.map((sheet) => [sheet, headerRow])),
      required_column_profile: 'company_dataset_v1',
    }
  }, [
    allSheets,
    autoHeader,
    headerRow,
    parserEncoding,
    preview?.sheet_names,
    selectedSheetNames,
  ])

  const previewMutation = useMutation({
    mutationFn: () => previewCompanyDatasetImport({ files, sourcePath }),
    onSuccess: (result) => {
      const sheetNames = Array.isArray(result.sheet_names)
        ? result.sheet_names
        : []
      setPreview({
        files: Array.isArray(result.files) ? result.files : [],
        sheet_names: sheetNames,
        suggested_header_rows: result.suggested_header_rows ?? {},
      })
      const firstSheet = sheetNames[0] ?? ''
      if (firstSheet) {
        setActivePreviewSheet(firstSheet)
        if (selectedSheets.trim() === 'Sheet1') {
          setSelectedSheets(firstSheet)
        }
        const suggested = result.suggested_header_rows?.[firstSheet]
        if (suggested) setHeaderRow(suggested)
      }
      toast(
        firstSheet ? 'Dataset preview ready' : 'No sheets found in preview',
        { type: firstSheet ? 'success' : 'warning' },
      )
    },
    onError: (error) =>
      toast(error instanceof Error ? error.message : 'Preview failed', {
        type: 'warning',
      }),
  })

  const uploadMutation = useMutation({
    mutationFn: () =>
      uploadCompanyDatasetImport({
        idempotencyKey: uploadKey,
        files,
        sourcePath,
        parserProfile,
      }),
    onSuccess: async (record) => {
      setCurrentImport(record)
      await queryClient.invalidateQueries({
        queryKey: ['company-dataset-imports'],
      })
      toast('Dataset files uploaded', { type: 'success' })
    },
    onError: (error) =>
      toast(error instanceof Error ? error.message : 'Upload failed', {
        type: 'warning',
      }),
  })

  const validateMutation = useMutation({
    mutationFn: () =>
      validateCompanyDatasetImport({
        importId: activeImport?.import_id ?? '',
        idempotencyKey: validateKey,
      }),
    onSuccess: async (record) => {
      setCurrentImport(record)
      await queryClient.invalidateQueries({
        queryKey: ['company-dataset-imports'],
      })
      toast('Validation completed', { type: 'success' })
    },
    onError: (error) =>
      toast(error instanceof Error ? error.message : 'Validation failed', {
        type: 'warning',
      }),
  })

  const promoteMutation = useMutation({
    mutationFn: () =>
      promoteCompanyDatasetImport({
        importId: activeImport?.import_id ?? '',
        idempotencyKey: promoteKey,
      }),
    onSuccess: async (record) => {
      setCurrentImport(record)
      await queryClient.invalidateQueries({
        queryKey: ['company-dataset-imports'],
      })
      await queryClient.invalidateQueries({
        queryKey: ['company-dataset-active'],
      })
      await queryClient.invalidateQueries({
        queryKey: ['organizations', 'me'],
      })
      toast(
        record.status === 'promoted'
          ? 'Promotion completed'
          : 'Promotion started',
        {
          type: record.status === 'promoted' ? 'success' : 'warning',
        },
      )
    },
    onError: (error) =>
      toast(error instanceof Error ? error.message : 'Promotion failed', {
        type: 'warning',
      }),
  })

  const activePreview = preview?.files
    .flatMap((filePreview) => filePreview.sheets)
    .find((sheet) => sheet.sheet_name === activePreviewSheet)
  const activeDatasetFile =
    explorerFileId === 'all'
      ? undefined
      : datasetQuery.data?.files.find(
          (file) => file.file_id === datasetQuery.data?.selected_file_id,
        )
  const activeDatasetRows = datasetQuery.data?.rows ?? []
  const activeDatasetColumns = datasetQuery.data?.columns ?? []
  const activeDatasetStats =
    datasetQuery.data?.selected_file_stats ?? datasetQuery.data?.stats
  const activeDatasetPagination = datasetQuery.data?.pagination
  const highlightedHeaderRow = getHighlightedHeaderRow({
    autoHeader,
    manualHeaderRow: headerRow,
    suggestedHeaderRow: activePreview?.suggested_header_row,
  })

  return (
    <section className="min-w-0 rounded-2xl border border-primary-200 bg-white/80 p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/70">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-primary-900 dark:text-neutral-100">
            Company Dataset Import
          </h2>
          <p className="mt-1 text-sm text-primary-600 dark:text-neutral-400">
            {organization?.organization_name || 'No active organization'} ·{' '}
            <span className="font-mono">
              {organization?.organization_id || 'unassigned'}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-primary-200 px-2 py-1 font-semibold dark:border-neutral-700">
            {organization?.dataset_type || 'NO_ORG'}
          </span>
          <span className="rounded-full border border-primary-200 px-2 py-1 font-semibold dark:border-neutral-700">
            {organization?.authority_state || 'REAL_EMPTY'}
          </span>
          {organization?.active_dataset_version_id ? (
            <span className="rounded-full border border-emerald-200 px-2 py-1 font-mono text-emerald-700 dark:border-emerald-900 dark:text-emerald-300">
              {organization.active_dataset_version_id}
            </span>
          ) : (
            <span className="rounded-full border border-amber-200 px-2 py-1 text-amber-700 dark:border-amber-900 dark:text-amber-300">
              No promoted real dataset yet
            </span>
          )}
        </div>
      </div>

      <div className="mt-5 grid min-w-0 gap-4 xl:grid-cols-[minmax(360px,0.95fr)_minmax(420px,1.05fr)]">
        <div className="min-w-0 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="min-w-0 text-sm text-primary-700 dark:text-neutral-300">
              Spreadsheet files
              <input
                type="file"
                multiple
                accept=".xlsx,.xls,.csv"
                disabled={!canImport}
                onChange={(event) => {
                  setFiles(Array.from(event.currentTarget.files ?? []))
                  setPreview(null)
                  setCurrentImport(null)
                }}
                className="mt-1 w-full rounded-xl border border-primary-200 bg-white px-3 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-950"
              />
            </label>
            <label className="min-w-0 text-sm text-primary-700 dark:text-neutral-300">
              Folder or file path
              <input
                value={sourcePath}
                disabled={!canImport}
                placeholder="D:\\ChrisH\\Documents\\soyon-data"
                onChange={(event) => {
                  setSourcePath(event.target.value)
                  setPreview(null)
                  setCurrentImport(null)
                }}
                className="mt-1 w-full rounded-xl border border-primary-200 bg-white px-3 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-950"
              />
            </label>
          </div>
          <p className="text-xs text-primary-600 dark:text-neutral-400">
            {files.length
              ? `${files.length} selected file${files.length === 1 ? '' : 's'}`
              : sourcePath.trim()
                ? 'Path import will be resolved on the local server'
                : 'No files or path selected'}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={
                !canImport || !hasImportSource || previewMutation.isPending
              }
              onClick={() => previewMutation.mutate()}
              className="rounded-xl border border-primary-300 px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700"
            >
              Preview
            </button>
            <button
              type="button"
              disabled={
                !canImport || !hasImportSource || uploadMutation.isPending
              }
              onClick={() => uploadMutation.mutate()}
              className="rounded-xl bg-primary-900 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-950"
            >
              Upload
            </button>
            <button
              type="button"
              disabled={
                !canValidateImport(activeImport) || validateMutation.isPending
              }
              onClick={() => validateMutation.mutate()}
              className="rounded-xl border border-primary-300 px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700"
            >
              {activeImport?.status === 'validating'
                ? 'Validating...'
                : 'Validate'}
            </button>
            <button
              type="button"
              disabled={
                !canPromote ||
                activeImport?.status !== 'staged' ||
                promoteMutation.isPending
              }
              onClick={() => promoteMutation.mutate()}
              className="rounded-xl border border-emerald-300 px-3 py-2 text-sm font-semibold text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-800 dark:text-emerald-300"
            >
              Promote to governed dataset
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="min-w-0 text-sm text-primary-700 dark:text-neutral-300">
              <div className="mb-1 flex items-center justify-between gap-3">
                <label htmlFor="company-dataset-sheets">Sheets</label>
                <label className="inline-flex items-center gap-2 text-xs font-medium text-primary-600 dark:text-neutral-400">
                  <input
                    type="checkbox"
                    checked={allSheets}
                    disabled={!canImport}
                    onChange={(event) => setAllSheets(event.target.checked)}
                  />
                  All sheets
                </label>
              </div>
              <input
                id="company-dataset-sheets"
                role="combobox"
                list={sheetDatalistId}
                value={selectedSheets}
                onChange={(event) => {
                  const nextValue = event.target.value
                  setSelectedSheets(nextValue)
                  const nextSheet = nextValue
                    .split(',')
                    .map((item) => item.trim())
                    .filter(Boolean)[0]
                  if (nextSheet) {
                    setActivePreviewSheet(nextSheet)
                    const suggested = preview?.suggested_header_rows[nextSheet]
                    if (suggested) setHeaderRow(suggested)
                  }
                }}
                disabled={!canImport || allSheets}
                placeholder="Sheet1, Sheet2"
                className="w-full rounded-xl border border-primary-200 bg-white px-3 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-950"
              />
              <datalist id={sheetDatalistId}>
                {(preview?.sheet_names ?? []).map((sheetName) => (
                  <option key={sheetName} value={sheetName} />
                ))}
              </datalist>
            </div>
            <div className="min-w-0 text-sm text-primary-700 dark:text-neutral-300">
              <div className="mb-1 flex items-center justify-between gap-3">
                <label htmlFor="company-dataset-header-row">
                  Header row <span className="font-normal">(0 = none)</span>
                </label>
                <label className="inline-flex items-center gap-2 text-xs font-medium text-primary-600 dark:text-neutral-400">
                  <input
                    type="checkbox"
                    checked={autoHeader}
                    disabled={!canImport}
                    onChange={(event) => setAutoHeader(event.target.checked)}
                  />
                  Auto header
                </label>
              </div>
              <input
                id="company-dataset-header-row"
                type="number"
                min={0}
                value={headerRow}
                disabled={!canImport || autoHeader}
                onChange={(event) => {
                  const value = Number(event.target.value)
                  setHeaderRow(Number.isFinite(value) && value >= 0 ? value : 0)
                }}
                className="w-full rounded-xl border border-primary-200 bg-white px-3 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-950"
              />
            </div>
          </div>
          {preview?.sheet_names?.length ? (
            <div className="rounded-xl border border-primary-200 bg-primary-50/70 p-3 text-sm dark:border-neutral-800 dark:bg-neutral-950/60">
              {detectedEncodings.length ? (
                <p className="mb-2 text-xs text-primary-600 dark:text-neutral-400">
                  Detected encoding: {detectedEncodings.join(', ')}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {preview.sheet_names.map((sheetName) => {
                  const selected = selectedSheetNames.includes(sheetName)
                  return (
                    <button
                      type="button"
                      key={sheetName}
                      onClick={() => {
                        setActivePreviewSheet(sheetName)
                        if (!allSheets) setSelectedSheets(sheetName)
                        const suggested =
                          preview.suggested_header_rows[sheetName]
                        if (suggested) setHeaderRow(suggested)
                      }}
                      className={`rounded-lg border px-2 py-1 text-xs font-semibold ${
                        activePreviewSheet === sheetName ||
                        selected ||
                        allSheets
                          ? 'border-primary-500 bg-white text-primary-900 dark:border-neutral-500 dark:bg-neutral-900 dark:text-neutral-100'
                          : 'border-primary-200 text-primary-600 dark:border-neutral-800 dark:text-neutral-400'
                      }`}
                    >
                      {sheetName}
                    </button>
                  )
                })}
              </div>
              {activePreviewSheet ? (
                <div className="mt-3 overflow-auto">
                  <table className="min-w-full border-collapse text-xs">
                    <tbody>
                      {activePreview?.rows.slice(0, 8).map((row, rowIndex) => (
                        <tr
                          key={`${activePreviewSheet}-${rowIndex}`}
                          className={
                            rowIndex + 1 === highlightedHeaderRow
                              ? 'bg-emerald-50 dark:bg-emerald-950/40'
                              : ''
                          }
                        >
                          <th className="sticky left-0 border border-primary-200 bg-white px-2 py-1 text-left font-mono dark:border-neutral-800 dark:bg-neutral-900">
                            <button
                              type="button"
                              onClick={() => {
                                setAutoHeader(false)
                                setHeaderRow(rowIndex + 1)
                              }}
                            >
                              {rowIndex + 1}
                            </button>
                          </th>
                          {row.slice(0, 8).map((cell, cellIndex) => (
                            <td
                              key={`${activePreviewSheet}-${rowIndex}-${cellIndex}`}
                              className="max-w-40 truncate border border-primary-200 px-2 py-1 dark:border-neutral-800"
                            >
                              {cell || ' '}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="min-w-0 rounded-xl border border-primary-200 bg-primary-50/70 p-4 text-sm dark:border-neutral-800 dark:bg-neutral-950/60">
          {importsQuery.isLoading ? (
            <p className="text-primary-600 dark:text-neutral-400">
              Loading imports...
            </p>
          ) : activeImport ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 break-all font-mono text-xs">
                  {activeImport.import_id}
                </span>
                <span className="rounded-full border border-primary-200 px-2 py-1 text-xs font-semibold dark:border-neutral-700">
                  {activeImport.status}
                </span>
              </div>
              <p className="text-primary-600 dark:text-neutral-400">
                {activeImport.files?.length ?? 0} source file(s), parser hash{' '}
                <span className="break-all font-mono">
                  {activeImport.parser_profile_hash}
                </span>
              </p>
              {activeImport.validation_result ? (
                <p className="text-primary-600 dark:text-neutral-400">
                  Blocking errors:{' '}
                  {activeImport.validation_result.blocking_errors?.length ?? 0}
                </p>
              ) : null}
              {activeImport.error_category ? (
                <p className="text-amber-700 dark:text-amber-300">
                  {activeImport.error_category}
                </p>
              ) : null}
              {isPromotingStale(activeImport) ? (
                <p className="text-amber-700 dark:text-amber-300">
                  Promotion has not moved for more than 15 minutes. Operator
                  review is required.
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-primary-600 dark:text-neutral-400">
              Upload spreadsheet files after switching to a real company. Staged
              rows are not chat authority.
            </p>
          )}
        </div>
      </div>

      {activeImport?.status === 'promoted' && datasetQuery.data ? (
        <div className="mt-4 min-w-0 rounded-xl border border-primary-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
          <div className="flex flex-col gap-1 border-b border-primary-200 px-4 py-3 text-xs dark:border-neutral-800 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <span className="font-semibold">Promoted dataset</span>{' '}
              <span className="break-all font-mono">
                {datasetQuery.data.dataset_version_id}
              </span>
            </div>
            {activeDatasetFile?.original_filename ? (
              <span className="font-mono text-primary-600 dark:text-neutral-400">
                {activeDatasetFile.original_filename}
              </span>
            ) : null}
          </div>
          <div className="grid gap-2 border-b border-primary-200 p-3 text-xs dark:border-neutral-800 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-lg border border-primary-200 px-3 py-2 dark:border-neutral-800">
              <div className="text-primary-600 dark:text-neutral-400">
                Rows promoted
              </div>
              <div className="mt-1 font-mono text-sm font-semibold">
                {activeDatasetStats?.rows_promoted ?? 0}
              </div>
            </div>
            <div className="rounded-lg border border-primary-200 px-3 py-2 dark:border-neutral-800">
              <div className="text-primary-600 dark:text-neutral-400">
                Files promoted
              </div>
              <div className="mt-1 font-mono text-sm font-semibold">
                {activeDatasetStats?.files_promoted ?? 0}
              </div>
            </div>
            <div className="rounded-lg border border-primary-200 px-3 py-2 dark:border-neutral-800">
              <div className="text-primary-600 dark:text-neutral-400">
                Deduped
              </div>
              <div className="mt-1 font-mono text-sm font-semibold">
                {activeDatasetStats?.deduped_rows ?? 0}
              </div>
            </div>
            <div className="rounded-lg border border-primary-200 px-3 py-2 dark:border-neutral-800">
              <div className="text-primary-600 dark:text-neutral-400">
                Error rows
              </div>
              <div className="mt-1 font-mono text-sm font-semibold">
                {activeDatasetStats?.error_rows ?? 0}
              </div>
            </div>
            <div className="rounded-lg border border-primary-200 px-3 py-2 dark:border-neutral-800">
              <div className="text-primary-600 dark:text-neutral-400">
                Fixed rows
              </div>
              <div className="mt-1 font-mono text-sm font-semibold">
                {activeDatasetStats?.fixed_rows ?? 0}
              </div>
            </div>
          </div>
          <div className="grid gap-3 border-b border-primary-200 p-3 dark:border-neutral-800 lg:grid-cols-[1fr_18rem]">
            <label className="min-w-0 text-xs font-semibold text-primary-700 dark:text-neutral-300">
              Source file
              <select
                value={explorerFileId}
                onChange={(event) => {
                  setExplorerFileId(event.target.value)
                  setExplorerPage(1)
                }}
                className="mt-2 w-full rounded-lg border border-primary-200 bg-white px-3 py-2 text-xs font-normal dark:border-neutral-800 dark:bg-neutral-950"
              >
                <option value="all">All files</option>
                {datasetQuery.data.files.map((file) => (
                  <option
                    key={file.file_id || file.original_filename}
                    value={String(file.file_id || '')}
                  >
                    {file.original_filename || file.file_id}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-0 text-xs font-semibold text-primary-700 dark:text-neutral-300">
              Filter rows
              <input
                value={explorerFilterDraft}
                onChange={(event) => setExplorerFilterDraft(event.target.value)}
                placeholder="Search any visible value"
                className="mt-2 w-full rounded-lg border border-primary-200 bg-white px-3 py-2 text-xs font-normal dark:border-neutral-800 dark:bg-neutral-950"
              />
            </label>
          </div>
          {activeDatasetRows.length > 0 ? (
            <div className="max-h-[420px] overflow-auto">
              <table className="w-max min-w-full border-collapse text-xs">
                <thead className="sticky top-0 z-10 bg-primary-50 dark:bg-neutral-900">
                  <tr>
                    {activeDatasetColumns.map((column) => (
                      <th
                        key={column}
                        className="whitespace-nowrap border border-primary-200 px-2 py-2 text-left font-semibold dark:border-neutral-800"
                      >
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activeDatasetRows.slice(0, 12).map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {activeDatasetColumns.map((column) => (
                        <td
                          key={`${rowIndex}-${column}`}
                          className="max-w-56 truncate whitespace-nowrap border border-primary-200 px-2 py-1.5 dark:border-neutral-800"
                        >
                          {row[column] || ' '}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-4 py-3 text-xs text-primary-600 dark:text-neutral-400">
              No rows match the current file and filter.
            </p>
          )}
          <div className="flex flex-col gap-2 border-t border-primary-200 px-4 py-3 text-xs dark:border-neutral-800 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-primary-600 dark:text-neutral-400">
              Page {activeDatasetPagination?.page ?? 1} of{' '}
              {activeDatasetPagination?.total_pages ?? 1} ·{' '}
              {activeDatasetPagination?.total_rows ?? 0} matching rows
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={(activeDatasetPagination?.page ?? 1) <= 1}
                onClick={() => setExplorerPage((page) => Math.max(1, page - 1))}
                className="rounded-lg border border-primary-200 px-3 py-1 font-semibold disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-800"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={
                  (activeDatasetPagination?.page ?? 1) >=
                  (activeDatasetPagination?.total_pages ?? 1)
                }
                onClick={() =>
                  setExplorerPage((page) =>
                    Math.min(
                      activeDatasetPagination?.total_pages ?? page,
                      page + 1,
                    ),
                  )
                }
                className="rounded-lg border border-primary-200 px-3 py-1 font-semibold disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-800"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
