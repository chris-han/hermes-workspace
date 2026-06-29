import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  previewCompanyDatasetImport,
  uploadCompanyDatasetImport,
} from './company-dataset-imports'

describe('uploadCompanyDatasetImport', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sends multiple files and a source path in the multipart request', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          import: {
            import_id: 'import_1',
            organization_id: 'Soyon_Real',
            actor_user_id: 'user_1',
            idempotency_key: 'upload-key',
            status: 'uploaded',
            created_at: '2026-06-23T00:00:00+00:00',
            updated_at: '2026-06-23T00:00:00+00:00',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    await uploadCompanyDatasetImport({
      idempotencyKey: 'upload-key',
      files: [
        new File(['a,b\n1,2\n'], 'historydetail439.csv', {
          type: 'text/csv',
        }),
        new File(['a,b\n3,4\n'], 'historydetail441.csv', {
          type: 'text/csv',
        }),
      ],
      sourcePath: 'D:\\ChrisH\\Documents\\soyon-data',
      parserProfile: { selected_sheets: ['Sheet1'] },
    })

    const [, init] = fetchMock.mock.calls[0]
    const body = init?.body
    expect(body).toBeInstanceOf(FormData)
    const form = body as FormData
    expect(form.get('idempotency_key')).toBe('upload-key')
    expect(form.get('source_path')).toBe('D:\\ChrisH\\Documents\\soyon-data')
    expect(form.getAll('files')).toHaveLength(2)
    expect(fetchMock.mock.calls[0][0]).toBe(
      '/api/semantier-proxy/company-dataset-imports/upload',
    )
  })

  it('sends selected files and source path to the preview endpoint', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          preview: {
            files: [],
            sheet_names: ['Sheet1'],
            suggested_header_rows: { Sheet1: 2 },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    await previewCompanyDatasetImport({
      files: [
        new File(['a,b\n1,2\n'], 'historydetail439.csv', {
          type: 'text/csv',
        }),
      ],
      sourcePath: 'D:\\ChrisH\\Documents\\soyon-data',
    })

    const [url, init] = fetchMock.mock.calls[0]
    const body = init?.body
    expect(url).toBe('/api/semantier-proxy/company-dataset-imports/preview')
    expect(body).toBeInstanceOf(FormData)
    const form = body as FormData
    expect(form.get('source_path')).toBe('D:\\ChrisH\\Documents\\soyon-data')
    expect(form.getAll('files')).toHaveLength(1)
  })

  it('accepts an unwrapped preview payload', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            files: [],
            sheet_names: ['Sheet1'],
            suggested_header_rows: { Sheet1: 2 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    )

    const preview = await previewCompanyDatasetImport({
      files: [],
      sourcePath: 'D:\\ChrisH\\Documents\\soyon-data',
    })

    expect(preview.sheet_names).toEqual(['Sheet1'])
    expect(preview.suggested_header_rows.Sheet1).toBe(2)
  })

  it('normalizes a missing preview payload', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )

    const preview = await previewCompanyDatasetImport({
      files: [],
      sourcePath: 'D:\\ChrisH\\Documents\\soyon-data',
    })

    expect(preview).toEqual({
      files: [],
      sheet_names: [],
      suggested_header_rows: {},
    })
  })
})
