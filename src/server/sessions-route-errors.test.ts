import { describe, expect, it } from 'vitest'

import {
  SemantierSessionApiError,
} from './semantier-session-api'
import { mapSessionApiErrorToStatus } from '../routes/api/sessions'

describe('mapSessionApiErrorToStatus', () => {
  it('preserves 401 and 403 from Semantier session API', () => {
    expect(
      mapSessionApiErrorToStatus(
        new SemantierSessionApiError('/sessions', 401, 'Authentication required'),
      ),
    ).toBe(401)
    expect(
      mapSessionApiErrorToStatus(
        new SemantierSessionApiError('/sessions', 403, 'Forbidden'),
      ),
    ).toBe(403)
  })

  it('maps other upstream session API errors to 502', () => {
    expect(
      mapSessionApiErrorToStatus(
        new SemantierSessionApiError('/sessions', 404, 'Not found'),
      ),
    ).toBe(502)
    expect(
      mapSessionApiErrorToStatus(
        new SemantierSessionApiError('/sessions', 500, 'Internal error'),
      ),
    ).toBe(502)
  })

  it('maps non-session errors to 500', () => {
    expect(mapSessionApiErrorToStatus(new Error('boom'))).toBe(500)
  })
})
