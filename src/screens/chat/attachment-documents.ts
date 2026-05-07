export const DOCX_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
export const PDF_MIME_TYPE = 'application/pdf'
export const XLS_MIME_TYPE = 'application/vnd.ms-excel'
export const XLSX_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export const ATTACHMENT_ACCEPT =
  'image/*,.md,.txt,.json,.csv,.ts,.tsx,.js,.py,.docx,.pdf,.xls,.xlsx'

const DOCUMENT_EXTENSION_TO_MIME: Record<string, string> = {
  docx: DOCX_MIME_TYPE,
  pdf: PDF_MIME_TYPE,
  xls: XLS_MIME_TYPE,
  xlsx: XLSX_MIME_TYPE,
}

const UPLOAD_API_DOCUMENT_MIME_TYPES = new Set(Object.values(DOCUMENT_EXTENSION_TO_MIME))

function normalizeMimeType(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim().toLowerCase()
}

export function inferUploadApiDocumentMimeTypeFromFileName(name: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(name.trim())
  if (!match?.[1]) return ''
  return DOCUMENT_EXTENSION_TO_MIME[match[1].toLowerCase()] || ''
}

export function isUploadApiDocumentMimeType(value: unknown): boolean {
  return UPLOAD_API_DOCUMENT_MIME_TYPES.has(normalizeMimeType(value))
}

export function fallbackUploadApiDocumentName(value: unknown): string {
  const mimeType = normalizeMimeType(value)
  if (mimeType === DOCX_MIME_TYPE) return 'document.docx'
  if (mimeType === XLS_MIME_TYPE) return 'document.xls'
  if (mimeType === XLSX_MIME_TYPE) return 'document.xlsx'
  return 'document.pdf'
}