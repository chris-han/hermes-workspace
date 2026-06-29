import { describe, expect, it } from 'vitest'
import { isSemantierBackendReady } from './hermes-onboarding'

describe('isSemantierBackendReady', () => {
  it('treats the Semantier backend mode as auto-connect ready', () => {
    expect(
      isSemantierBackendReady({
        mode: 'semantier-unicell',
      }),
    ).toBe(true)
  })

  it('keeps onboarding for non-Semantier or missing backend modes', () => {
    expect(
      isSemantierBackendReady({
        mode: 'hermes-gateway',
      }),
    ).toBe(false)
    expect(isSemantierBackendReady(null)).toBe(false)
  })
})
