import { beforeEach, describe, expect, it, vi } from 'vitest'

const readFileSync = vi.fn()
const existsSync = vi.fn()
const resolveHermesConfigPath = vi.fn()
const resolveHermesConfigPathFromBackend = vi.fn()

vi.mock('node:fs', () => ({
  default: {
    readFileSync,
    existsSync,
  },
}))

vi.mock('./hermes-home', () => ({
  resolveHermesConfigPath,
  resolveHermesConfigPathFromBackend,
}))

describe('local-provider-discovery', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('does not throw when no default Hermes home is configured', async () => {
    resolveHermesConfigPath.mockImplementation(() => {
      throw new Error('Hermes home is not configured')
    })

    const mod = await import('./local-provider-discovery')

    await expect(mod.isProviderConfigured('ollama')).resolves.toBe(false)
  })

  it('uses the active backend workspace config when request headers are provided', async () => {
    resolveHermesConfigPathFromBackend.mockResolvedValue(
      '/tmp/workspace/config.yaml',
    )
    readFileSync.mockReturnValue(
      'custom_providers:\n  - name: ollama\n    base_url: http://127.0.0.1:11434/v1\n',
    )

    const mod = await import('./local-provider-discovery')

    await expect(
      mod.isProviderConfigured('ollama', new Headers({ 'x-test': '1' })),
    ).resolves.toBe(true)
    expect(resolveHermesConfigPathFromBackend).toHaveBeenCalled()
  })
})
