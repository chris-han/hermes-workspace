import { describe, expect, it } from 'vitest'
import {
  PROVIDER_CATALOG,
  getProviderDisplayName,
  getProviderInfo,
} from './provider-catalog'

describe('provider catalog', () => {
  it('exposes DashScope as the Qwen Cloud API-key provider', () => {
    const provider = getProviderInfo('alibaba')

    expect(provider).toBeTruthy()
    expect(provider?.name).toBe('Qwen Cloud / DashScope')
    expect(provider?.authTypes).toContain('api-key')
    expect(provider?.configExample).toContain('alibaba:default')
  })

  it('uses the DashScope display name for alibaba provider ids', () => {
    expect(getProviderDisplayName('alibaba')).toBe('Qwen Cloud / DashScope')
    expect(PROVIDER_CATALOG.some((provider) => provider.id === 'alibaba')).toBe(
      true,
    )
  })
})
