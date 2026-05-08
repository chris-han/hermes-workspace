import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import QRCode from 'qrcode'

type WeixinLoginStartResponse = {
  state: string
  status: string
  qrcode: string
  qrcode_url?: string
  qr_scan_data: string
  base_url: string
  bot_type: string
}

type WeixinLoginStatusResponse = {
  state: string
  status: string
  redirect_base_url?: string
  authenticated?: boolean
  user?: {
    user_id: string
    name: string
    workspace_slug: string
    weixin_user_id?: string | null
    auth_provider?: string | null
  }
}

type LoginScreenProps = {
  showPasswordLogin?: boolean
}

export function shouldPollWeixinLoginStatus(status: string): boolean {
  return ['wait', 'scaned', 'scaned_but_redirect'].includes(status)
}

export function LoginScreen({
  showPasswordLogin = false,
}: LoginScreenProps = {}) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [weixinLoading, setWeixinLoading] = useState(false)
  const [weixinState, setWeixinState] = useState('')
  const [weixinStatus, setWeixinStatus] = useState('')
  const [weixinQrUrl, setWeixinQrUrl] = useState('')
  const [weixinQrScanData, setWeixinQrScanData] = useState('')
  const [weixinMessage, setWeixinMessage] = useState('')
  const [weixinQrDataUrl, setWeixinQrDataUrl] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      const data = await res.json()

      if (data.ok) {
        // Success! Reload to trigger auth check
        window.location.reload()
      } else {
        setError(data.error || 'Invalid password')
        setLoading(false)
      }
    } catch (err) {
      setError('Authentication failed. Please try again.')
      setLoading(false)
    }
  }

  async function startWeixinLogin() {
    setWeixinLoading(true)
    setError('')
    setWeixinMessage('')
    try {
      const res = await fetch('/auth/weixin/login/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = (await res.json()) as WeixinLoginStartResponse & {
        detail?: string
      }
      if (!res.ok) {
        throw new Error(data.detail || `HTTP ${res.status}`)
      }
      setWeixinState(data.state)
      setWeixinStatus(data.status)
      setWeixinQrUrl(data.qrcode_url || '')
      setWeixinQrScanData(data.qr_scan_data)
      setWeixinMessage('Scan this QR code with Weixin and confirm on your phone.')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to start Weixin sign-in.',
      )
    } finally {
      setWeixinLoading(false)
    }
  }

  async function pollWeixinLogin(state: string) {
    try {
      const res = await fetch(
        `/auth/weixin/login/status?state=${encodeURIComponent(state)}`,
      )
      const data = (await res.json()) as WeixinLoginStatusResponse & {
        detail?: string
      }
      if (!res.ok) {
        throw new Error(data.detail || `HTTP ${res.status}`)
      }
      setWeixinStatus(data.status)
      if (data.redirect_base_url) {
        setWeixinMessage('QR scanned. Confirm login in Weixin.')
      } else if (data.status === 'scaned') {
        setWeixinMessage('QR scanned. Confirm login in Weixin.')
      } else if (data.status === 'expired') {
        setWeixinMessage('QR code expired. Start a new Weixin sign-in.')
      }
      if (data.authenticated) {
        window.location.reload()
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to check Weixin sign-in status.',
      )
    }
  }

  useEffect(() => {
    if (!weixinState) return
    if (!shouldPollWeixinLoginStatus(weixinStatus)) {
      return
    }
    const timer = window.setTimeout(() => {
      void pollWeixinLogin(weixinState)
    }, 1500)
    return () => window.clearTimeout(timer)
  }, [weixinState, weixinStatus])

  useEffect(() => {
    let cancelled = false

    async function buildQrDataUrl() {
      if (!weixinQrScanData) {
        setWeixinQrDataUrl('')
        return
      }
      try {
        const dataUrl = await QRCode.toDataURL(weixinQrScanData, {
          width: 320,
          margin: 1,
          errorCorrectionLevel: 'M',
        })
        if (!cancelled) {
          setWeixinQrDataUrl(dataUrl)
        }
      } catch {
        if (!cancelled) {
          setWeixinQrDataUrl('')
        }
      }
    }

    void buildQrDataUrl()
    return () => {
      cancelled = true
    }
  }, [weixinQrScanData])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 px-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl bg-white px-8 py-10 shadow-xl shadow-primary-900/5 ring-1 ring-primary-900/5">
          {/* Logo */}
          <div className="mb-8 flex justify-center">
            <div className="flex items-center gap-2.5">
              <img src="/logo.svg" alt="" className="size-8 rounded-lg" />
              <h1 className="brand-wordmark text-2xl font-bold tracking-tight text-primary-900">
                semantier
              </h1>
            </div>
          </div>

          {/* Title */}
          <h2 className="mb-2 text-center text-lg font-semibold text-primary-900">
            Sign In
          </h2>
          <p className="mb-6 text-center text-sm text-primary-600">
            Use your Weixin account to open the correlated Semantier workspace.
          </p>

          <div className="space-y-4">
            <button
              type="button"
              onClick={() => void startWeixinLogin()}
              disabled={weixinLoading}
              className="w-full rounded-lg bg-[#07C160] px-4 py-2.5 font-medium text-white transition-all hover:bg-[#06AE56] focus:outline-none focus:ring-2 focus:ring-[#07C160]/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {weixinLoading ? 'Preparing Weixin QR...' : 'Sign In With Weixin'}
            </button>

            {weixinMessage ? (
              <div className="rounded-lg bg-primary-50 px-4 py-2.5 text-sm text-primary-700 ring-1 ring-primary-100">
                {weixinMessage}
              </div>
            ) : null}

            {weixinQrScanData ? (
              <div className="rounded-xl border border-primary-200 bg-primary-50/40 p-4">
                <div className="flex flex-col items-center gap-3">
                  <img
                    src={weixinQrDataUrl || weixinQrUrl || ''}
                    alt="Weixin sign-in QR code"
                    className="h-48 w-48 rounded-md border border-primary-200 bg-white object-contain"
                  />
                  <div className="text-xs text-primary-600">
                    Status: {weixinStatus || 'wait'}
                  </div>
                  {weixinQrUrl ? (
                    <a
                      href={weixinQrUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-accent-600 underline"
                    >
                      Open QR link
                    </a>
                  ) : null}
                </div>
              </div>
            ) : null}

            {showPasswordLogin ? (
              <>
                <div className="flex items-center gap-3 py-1">
                  <div className="h-px flex-1 bg-primary-100" />
                  <span className="text-xs uppercase tracking-[0.18em] text-primary-400">
                    Or
                  </span>
                  <div className="h-px flex-1 bg-primary-100" />
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password"
                      className="w-full rounded-lg border border-primary-200 bg-white px-4 py-2.5 text-primary-900 placeholder-primary-400 outline-none transition-all focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20"
                      disabled={loading}
                      autoFocus
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !password}
                    className="w-full rounded-lg bg-accent-500 px-4 py-2.5 font-medium text-white transition-all hover:bg-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading ? 'Authenticating...' : 'Continue With Password'}
                  </button>
                </form>
              </>
            ) : null}

            {error && (
              <div className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700 ring-1 ring-red-200">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-primary-500">
          Powered by{' '}
          <a
            href="https://github.com/NousResearch/hermes-agent"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-500 hover:text-accent-600 transition-colors"
          >
            Hermes
          </a>
        </p>
      </div>
    </div>
  )
}
