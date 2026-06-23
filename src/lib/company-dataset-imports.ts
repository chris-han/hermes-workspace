export type CompanyDatasetImportStatus =
  | 'uploaded'
  | 'validating'
  | 'validation_failed'
  | 'staged'
  | 'promoting'
  | 'promoted'
  | 'promotion_failed'
  | 'superseded'

export interface CompanyDatasetImportRecord {
  import_id: string
  organization_id: string
  actor_user_id: string
  idempotency_key: string
  status: CompanyDatasetImportStatus
  authority_state?: string | null
  parser_profile_hash?: string | null
  parser_profile?: Record<string, unknown>
  validation_result?: {
    blocking_errors?: Array<Record<string, unknown>>
    normalized_files?: Array<Record<string, unknown>>
    file_results?: Array<Record<string, unknown>>
  } | null
  promotion_result?: Record<string, unknown> | null
  error_category?: string | null
  created_at: string
  updated_at: string
  files?: Array<{
    file_id: string
    original_filename?: string | null
    source_file_hash?: string | null
    byte_size?: number
  }>
}

export interface CompanyDatasetSheetPreview {
  sheet_name: string
  suggested_header_row: number
  encoding?: string | null
  rows: Array<Array<string>>
}

export interface CompanyDatasetFilePreview {
  filename: string
  byte_size: number
  encoding?: string | null
  sheets: Array<CompanyDatasetSheetPreview>
}

export interface CompanyDatasetImportPreview {
  files: Array<CompanyDatasetFilePreview>
  sheet_names: Array<string>
  suggested_header_rows: Record<string, number>
}

export interface CompanyDatasetExplorer {
  dataset_version_id: string
  organization_id: string
  import_id: string
  activated_at?: string | null
  parser_profile_hash?: string | null
  stats: {
    files_promoted: number
    rows_promoted: number
    deduped_rows: number
    error_rows: number
    fixed_rows: number
  }
  files: Array<{
    file_id?: string | null
    original_filename?: string | null
    source_file_hash?: string | null
    normalized_file_hash?: string | null
    row_count: number
    promoted_rows: number
    deduped_rows: number
    error_rows: number
    fixed_rows: number
  }>
  selected_file_id?: string | null
  selected_file_stats: {
    files_promoted: number
    rows_promoted: number
    deduped_rows: number
    error_rows: number
    fixed_rows: number
  }
  columns: Array<string>
  rows: Array<Record<string, string>>
  pagination: {
    page: number
    page_size: number
    total_rows: number
    total_pages: number
    filter?: string | null
  }
}

const COMPANY_DATASET_IMPORTS_API =
  '/api/semantier-proxy/company-dataset-imports'

type CompanyDatasetPreviewPayload =
  | { preview?: Partial<CompanyDatasetImportPreview> | null }
  | Partial<CompanyDatasetImportPreview>

async function readJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(input, init)
  const contentType = response.headers.get('content-type') || ''
  if (response.ok && contentType.includes('text/html')) {
    throw new Error(
      'API returned HTML instead of JSON. Restart the Hermes Workspace dev server so proxy routes are loaded.',
    )
  }
  const payload = (await response.json().catch(() => ({}))) as
    | T
    | { detail?: unknown; error?: unknown }
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'detail' in payload
        ? String((payload as { detail?: unknown }).detail || '')
        : `Request failed (${response.status})`
    throw new Error(message || `Request failed (${response.status})`)
  }
  return payload as T
}

function createDatasetImportForm(params: {
  files: Array<File>
  sourcePath?: string
  parserProfile?: Record<string, unknown>
  idempotencyKey?: string
}): FormData {
  const form = new FormData()
  if (params.idempotencyKey) {
    form.append('idempotency_key', params.idempotencyKey)
  }
  if (params.parserProfile) {
    form.append('parser_profile', JSON.stringify(params.parserProfile))
  }
  if (params.sourcePath?.trim()) {
    form.append('source_path', params.sourcePath.trim())
  }
  for (const file of params.files) form.append('files', file)
  return form
}

export async function fetchCompanyDatasetImports(): Promise<
  Array<CompanyDatasetImportRecord>
> {
  const payload = await readJson<{
    imports?: Array<CompanyDatasetImportRecord>
  }>(COMPANY_DATASET_IMPORTS_API)
  return Array.isArray(payload.imports) ? payload.imports : []
}

export async function fetchActiveCompanyDataset(params?: {
  fileId?: string
  page?: number
  pageSize?: number
  filter?: string
}): Promise<CompanyDatasetExplorer | null> {
  const query = new URLSearchParams()
  if (params?.fileId) query.set('file_id', params.fileId)
  if (params?.page) query.set('page', String(params.page))
  if (params?.pageSize) query.set('page_size', String(params.pageSize))
  if (params?.filter?.trim()) query.set('filter', params.filter.trim())
  const suffix = query.toString() ? `?${query.toString()}` : ''
  const payload = await readJson<{
    dataset?: CompanyDatasetExplorer | null
  }>(`${COMPANY_DATASET_IMPORTS_API}/active-dataset${suffix}`)
  return payload.dataset ?? null
}

export async function uploadCompanyDatasetImport(params: {
  idempotencyKey: string
  files: Array<File>
  sourcePath?: string
  parserProfile: Record<string, unknown>
}): Promise<CompanyDatasetImportRecord> {
  const form = createDatasetImportForm({
    idempotencyKey: params.idempotencyKey,
    files: params.files,
    sourcePath: params.sourcePath,
    parserProfile: params.parserProfile,
  })
  const payload = await readJson<{ import: CompanyDatasetImportRecord }>(
    `${COMPANY_DATASET_IMPORTS_API}/upload`,
    { method: 'POST', body: form },
  )
  return payload.import
}

export async function previewCompanyDatasetImport(params: {
  files: Array<File>
  sourcePath?: string
}): Promise<CompanyDatasetImportPreview> {
  const payload = await readJson<CompanyDatasetPreviewPayload>(
    `${COMPANY_DATASET_IMPORTS_API}/preview`,
    {
      method: 'POST',
      body: createDatasetImportForm({
        files: params.files,
        sourcePath: params.sourcePath,
      }),
    },
  )
  const preview: Partial<CompanyDatasetImportPreview> | null | undefined =
    payload && typeof payload === 'object' && 'preview' in payload
      ? payload.preview
      : (payload as Partial<CompanyDatasetImportPreview>)
  return {
    files: Array.isArray(preview?.files) ? preview.files : [],
    sheet_names: Array.isArray(preview?.sheet_names) ? preview.sheet_names : [],
    suggested_header_rows:
      preview?.suggested_header_rows &&
      typeof preview.suggested_header_rows === 'object' &&
      !Array.isArray(preview.suggested_header_rows)
        ? preview.suggested_header_rows
        : {},
  }
}

export async function validateCompanyDatasetImport(params: {
  importId: string
  idempotencyKey: string
}): Promise<CompanyDatasetImportRecord> {
  const payload = await readJson<{ import: CompanyDatasetImportRecord }>(
    `${COMPANY_DATASET_IMPORTS_API}/${encodeURIComponent(params.importId)}/validate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idempotency_key: params.idempotencyKey }),
    },
  )
  return payload.import
}

export async function promoteCompanyDatasetImport(params: {
  importId: string
  idempotencyKey: string
}): Promise<CompanyDatasetImportRecord> {
  const payload = await readJson<{ import: CompanyDatasetImportRecord }>(
    `${COMPANY_DATASET_IMPORTS_API}/${encodeURIComponent(params.importId)}/promote`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idempotency_key: params.idempotencyKey }),
    },
  )
  return payload.import
}

export function createImportIdempotencyKey(prefix: string): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`
  return `${prefix}-${random}`
}
