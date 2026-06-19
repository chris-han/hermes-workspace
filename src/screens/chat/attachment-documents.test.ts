import { describe, expect, it } from 'vitest'

import {
  ATTACHMENT_ACCEPT,
  DOCX_MIME_TYPE,
  MARKDOWN_MIME_TYPE,
  PDF_MIME_TYPE,
  TEXT_MIME_TYPE,
  XLSX_MIME_TYPE,
  XLS_MIME_TYPE,
  fallbackUploadApiDocumentName,
  inferUploadApiDocumentMimeTypeFromFileName,
  isUploadApiDocumentMimeType,
} from './attachment-documents'

describe('attachment document helpers', () => {
  it('recognizes resume document uploads by extension and MIME type', () => {
    expect(inferUploadApiDocumentMimeTypeFromFileName('resume.pdf')).toBe(
      PDF_MIME_TYPE,
    )
    expect(inferUploadApiDocumentMimeTypeFromFileName('resume.docx')).toBe(
      DOCX_MIME_TYPE,
    )
    expect(inferUploadApiDocumentMimeTypeFromFileName('resume.md')).toBe(
      MARKDOWN_MIME_TYPE,
    )
    expect(inferUploadApiDocumentMimeTypeFromFileName('resume.txt')).toBe(
      TEXT_MIME_TYPE,
    )
    expect(isUploadApiDocumentMimeType(PDF_MIME_TYPE)).toBe(true)
    expect(isUploadApiDocumentMimeType(DOCX_MIME_TYPE)).toBe(true)
    expect(isUploadApiDocumentMimeType(MARKDOWN_MIME_TYPE)).toBe(true)
    expect(isUploadApiDocumentMimeType(TEXT_MIME_TYPE)).toBe(true)
  })

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
    expect(ATTACHMENT_ACCEPT).toContain('.pdf')
    expect(ATTACHMENT_ACCEPT).toContain('.docx')
    expect(ATTACHMENT_ACCEPT).toContain('.md')
    expect(ATTACHMENT_ACCEPT).toContain('.txt')
    expect(ATTACHMENT_ACCEPT).toContain('.xls')
    expect(ATTACHMENT_ACCEPT).toContain('.xlsx')
  })

  it('builds fallback filenames for resume document upload API documents', () => {
    expect(fallbackUploadApiDocumentName(PDF_MIME_TYPE)).toBe('document.pdf')
    expect(fallbackUploadApiDocumentName(DOCX_MIME_TYPE)).toBe('document.docx')
    expect(fallbackUploadApiDocumentName(MARKDOWN_MIME_TYPE)).toBe(
      'document.md',
    )
    expect(fallbackUploadApiDocumentName(TEXT_MIME_TYPE)).toBe('document.txt')
  })

  it('builds an xls fallback filename for upload API documents', () => {
    expect(fallbackUploadApiDocumentName(XLS_MIME_TYPE)).toBe('document.xls')
  })

  it('builds an xlsx fallback filename for upload API documents', () => {
    expect(fallbackUploadApiDocumentName(XLSX_MIME_TYPE)).toBe('document.xlsx')
  })
})
