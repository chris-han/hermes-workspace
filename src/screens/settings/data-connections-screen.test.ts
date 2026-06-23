import { describe, expect, it } from 'vitest'

import { DATA_CONNECTIONS_PAGE_COPY } from './data-connections-screen'
import { KIND_LABELS } from './components/data-connection-status-card'
import {
  COMPANY_DATASET_SHEET_COMBOBOX_ROLE,
  canValidateImport,
  getHighlightedHeaderRow,
  isPromotingStale,
} from './components/company-dataset-import-panel'

describe('data connections page copy', () => {
  it('uses the new page name and correct authority language', () => {
    expect(DATA_CONNECTIONS_PAGE_COPY.title).toBe('Data Connections')
    expect(DATA_CONNECTIONS_PAGE_COPY.subtitle).toContain('governed storage')
    expect(DATA_CONNECTIONS_PAGE_COPY.subtitle).toContain(
      'read-only query runtime',
    )
  })

  it('labels surfaces by authority role instead of storage engine shorthand', () => {
    expect(KIND_LABELS.authoritative).toBe('Authoritative')
    expect(KIND_LABELS.derived).toBe('Derived')
    expect(KIND_LABELS['read-only']).toBe('Read-only')
  })

  it('treats promoting imports as stale after fifteen minutes without movement', () => {
    expect(
      isPromotingStale(
        {
          import_id: 'import_1',
          organization_id: 'org_real',
          actor_user_id: 'user_1',
          idempotency_key: 'key_1',
          status: 'promoting',
          created_at: '2026-06-23T00:00:00+00:00',
          updated_at: '2026-06-23T00:00:00+00:00',
        },
        Date.parse('2026-06-23T00:16:00+00:00'),
      ),
    ).toBe(true)
  })

  it('highlights suggested header row while auto header is selected', () => {
    expect(
      getHighlightedHeaderRow({
        autoHeader: true,
        manualHeaderRow: 1,
        suggestedHeaderRow: 2,
      }),
    ).toBe(2)
    expect(
      getHighlightedHeaderRow({
        autoHeader: false,
        manualHeaderRow: 1,
        suggestedHeaderRow: 2,
      }),
    ).toBe(1)
  })

  it('uses an editable combo box for sheet selection', () => {
    expect(COMPANY_DATASET_SHEET_COMBOBOX_ROLE).toBe('combobox')
  })

  it('only enables validation for imports that can enter validating', () => {
    const baseImport = {
      import_id: 'import_1',
      organization_id: 'org_real',
      actor_user_id: 'user_1',
      idempotency_key: 'key_1',
      created_at: '2026-06-23T00:00:00+00:00',
      updated_at: '2026-06-23T00:00:00+00:00',
    }

    expect(canValidateImport({ ...baseImport, status: 'uploaded' })).toBe(true)
    expect(canValidateImport({ ...baseImport, status: 'validation_failed' })).toBe(
      true,
    )
    expect(canValidateImport({ ...baseImport, status: 'validating' })).toBe(false)
    expect(canValidateImport({ ...baseImport, status: 'staged' })).toBe(false)
  })
})
