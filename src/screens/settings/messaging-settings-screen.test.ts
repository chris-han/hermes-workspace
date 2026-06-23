import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  scheduleFeishuLinkStatusPolling,
  shouldAutoRefreshWeixinPairingQr,
} from './messaging-settings-screen'

describe('Feishu link status polling', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('continues polling after a pending response keeps status unchanged', async () => {
    vi.useFakeTimers()
    const poll = vi.fn().mockResolvedValue(undefined)

    const cleanup = scheduleFeishuLinkStatusPolling(poll, 100)

    await vi.advanceTimersByTimeAsync(100)
    expect(poll).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(100)
    expect(poll).toHaveBeenCalledTimes(2)

    cleanup()
    await vi.advanceTimersByTimeAsync(500)
    expect(poll).toHaveBeenCalledTimes(2)
  })
})

describe('Weixin pairing QR refresh', () => {
  it('refreshes expired or consumed QR sessions automatically', () => {
    expect(shouldAutoRefreshWeixinPairingQr('expired')).toBe(true)
    expect(shouldAutoRefreshWeixinPairingQr('replay_blocked')).toBe(true)
    expect(shouldAutoRefreshWeixinPairingQr('wait')).toBe(false)
    expect(shouldAutoRefreshWeixinPairingQr('confirmed')).toBe(false)
  })
})
