import { describe, expect, it } from 'vitest'

import {
  ATTACHMENT_ACCEPT,
  XLS_MIME_TYPE,
  XLSX_MIME_TYPE,
  fallbackUploadApiDocumentName,
  inferUploadApiDocumentMimeTypeFromFileName,
  isUploadApiDocumentMimeType,
} from './attachment-documents'

describe('attachment document helpers', () => {
  it('recognizes xls uploads by extension and MIME type', () => {
    expect(inferUploadApiDocumentMimeTypeFromFileName('legacy-model.xls')).toBe(
      XLS_MIME_TYPE,
    )
    expect(isUploadApiDocumentMimeType(XLS_MIME_TYPE)).toBe(true)
  })

  it('recognizes xlsx uploads by extension and MIME type', () => {
    expect(inferUploadApiDocumentMimeTypeFromFileName('model.xlsx')).toBe(
      XLSX_MIME_TYPE,
    )
    expect(isUploadApiDocumentMimeType(XLSX_MIME_TYPE)).toBe(true)
  })

  it('includes xls and xlsx in accepted picker types', () => {
    expect(ATTACHMENT_ACCEPT).toContain('.xls')
    expect(ATTACHMENT_ACCEPT).toContain('.xlsx')
  })

  it('builds an xls fallback filename for upload API documents', () => {
    expect(fallbackUploadApiDocumentName(XLS_MIME_TYPE)).toBe('document.xls')
  })

  it('builds an xlsx fallback filename for upload API documents', () => {
    expect(fallbackUploadApiDocumentName(XLSX_MIME_TYPE)).toBe('document.xlsx')
  })
})