import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchCurrentModelFromStatus } from './chat-current-model'

describe('fetchCurrentModelFromStatus', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('falls back to hermes config when session status has no model', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          payload: {
            model: '',
            modelProvider: '',
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          activeModel: 'gpt-5.4',
          activeProvider: 'openai-codex',
        }),
      } as Response)

    await expect(fetchCurrentModelFromStatus()).resolves.toBe(
      'openai-codex/gpt-5.4',
    )

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/session-status',
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/hermes-config',
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    )
  })

  it('prefers the live session-status model when present', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        payload: {
          resolved: {
            model: 'claude-sonnet-4-6',
            modelProvider: 'anthropic',
          },
        },
      }),
    } as Response)

    await expect(fetchCurrentModelFromStatus()).resolves.toBe(
      'anthropic/claude-sonnet-4-6',
    )

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
