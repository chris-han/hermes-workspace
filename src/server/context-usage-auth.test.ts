import { describe, expect, it } from 'vitest'

import { hasSemantierSessionCookie } from '../routes/api/context-usage'

describe('hasSemantierSessionCookie', () => {
  it('returns true when vt_session is present in cookies', () => {
    const headers = new Headers({
      cookie: 'foo=1; vt_session=abc123; bar=2',
    })

    expect(hasSemantierSessionCookie(headers)).toBe(true)
  })

  it('returns false when vt_session is missing', () => {
    const headers = new Headers({
      cookie: 'foo=1; bar=2',
    })

    expect(hasSemantierSessionCookie(headers)).toBe(false)
  })

  it('returns false when cookie header is absent', () => {
    expect(hasSemantierSessionCookie(new Headers())).toBe(false)
  })
})
