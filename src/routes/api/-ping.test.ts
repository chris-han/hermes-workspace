import { describe, expect, it, vi } from 'vitest'

vi.mock('../../server/auth-middleware', () => ({
  requireLocalOrAuth: vi.fn(),
}))

import { requireLocalOrAuth } from '../../server/auth-middleware'
import { shouldAllowPingRequest } from './ping'

describe('shouldAllowPingRequest', () => {
  it('allows semantier-unicell requests without local workspace auth', () => {
    const allowed = shouldAllowPingRequest(
      new Request('https://app.semantier.com/api/ping'),
      'semantier-unicell',
    )
    expect(allowed).toBe(true)
    expect(requireLocalOrAuth).not.toHaveBeenCalled()
  })

  it('uses local auth rules outside semantier-unicell mode', () => {
    vi.mocked(requireLocalOrAuth).mockReturnValueOnce(false)
    const denied = shouldAllowPingRequest(
      new Request('https://app.semantier.com/api/ping'),
      'portable',
    )
    expect(denied).toBe(false)
    expect(requireLocalOrAuth).toHaveBeenCalledTimes(1)
  })
})
