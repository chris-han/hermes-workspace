import { describe, expect, it } from 'vitest'

import { DATA_CONNECTIONS_PAGE_COPY } from './data-connections-screen'
import { KIND_LABELS } from './components/data-connection-status-card'

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
})
