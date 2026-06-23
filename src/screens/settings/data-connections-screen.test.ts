import { describe, expect, it } from 'vitest'

import { DATA_CONNECTIONS_PAGE_COPY } from './data-connections-screen'
import { KIND_LABELS } from './components/data-connection-status-card'
import {
  COMPANY_DATASET_FILTER_DEBOUNCE_MS,
  COMPANY_DATASET_SHEET_COMBOBOX_ROLE,
  canValidateImport,
  getOrganizationSetupStatus,
  getRealSetupStatusLabel,
  getHighlightedHeaderRow,
  isPromotingStale,
  realSetupStatusUsesAuthorityState,
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

  it('debounces dataset explorer filtering so typing is not interrupted by refreshes', () => {
    expect(COMPANY_DATASET_FILTER_DEBOUNCE_MS).toBeGreaterThanOrEqual(200)
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
    expect(
      canValidateImport({ ...baseImport, status: 'validation_failed' }),
    ).toBe(true)
    expect(canValidateImport({ ...baseImport, status: 'validating' })).toBe(
      false,
    )
    expect(canValidateImport({ ...baseImport, status: 'staged' })).toBe(false)
  })

  it('uses setup_status as the real-company readiness source', () => {
    expect(
      getOrganizationSetupStatus({
        dataset_type: 'REAL',
        setup_status: 'REAL_REA_ADMISSION_REQUIRED',
        authority_state: 'REAL_PROMOTED',
      }),
    ).toBe('REAL_REA_ADMISSION_REQUIRED')
    expect(
      realSetupStatusUsesAuthorityState({
        dataset_type: 'REAL',
        setup_status: 'REAL_REA_ADMISSION_REQUIRED',
        authority_state: 'REAL_PROMOTED',
      }),
    ).toBe(false)
  })

  it('labels promoted real sources as setup blockers until admission is complete', () => {
    expect(getRealSetupStatusLabel('REAL_IMPORTED')).toBe(
      'Source promoted, setup not started',
    )
    expect(getRealSetupStatusLabel('REAL_REA_ADMISSION_REQUIRED')).toBe(
      'REA admission required',
    )
    expect(getRealSetupStatusLabel('REAL_COA_REQUIRED')).toBe(
      'Chart of accounts required',
    )
    expect(getRealSetupStatusLabel('REAL_PROJECTION_REQUIRED')).toBe(
      'Projection required',
    )
  })
})
