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
  authenticated?: boolean
  profile_completed?: boolean
}

type WeixinLoginStatusResponse = {
  state: string
  status: string
  redirect_base_url?: string
  message?: string
  authenticated?: boolean
  profile_completed?: boolean
  user?: {
    user_id: string
    name: string
    workspace_slug: string
    weixin_user_id?: string | null
    auth_provider?: string | null
    password_login_name?: string | null
    profile_completed?: boolean
  }
}

export type PasswordLoginMode = 'local' | 'semantier'

type LoginScreenProps = {
  showPasswordLogin?: boolean
  showWeixinLogin?: boolean
  passwordMode?: PasswordLoginMode
}

export function shouldPollWeixinLoginStatus(status: string): boolean {
  return ['wait', 'scaned', 'scaned_but_redirect'].includes(status)
}

export const WEIXIN_LOGIN_POLL_INTERVAL_MS = 1500

export function resolvePasswordLoginEndpoint(
  mode: PasswordLoginMode,
): '/api/auth' | '/auth/password/login' {
  return mode === 'local' ? '/api/auth' : '/auth/password/login'
}

export function LoginScreen({
  showPasswordLogin = false,
  showWeixinLogin = true,
  passwordMode = 'semantier',
}: LoginScreenProps = {}) {
  const passwordEndpoint = resolvePasswordLoginEndpoint(passwordMode)
  const isSemantierPasswordMode = passwordMode === 'semantier'
  const showWeixinQr = showWeixinLogin
  const [password, setPassword] = useState('')
  const [loginName, setLoginName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [weixinLoading, setWeixinLoading] = useState(false)
  const [weixinState, setWeixinState] = useState('')
  const [weixinStatus, setWeixinStatus] = useState('')
  const [weixinQrUrl, setWeixinQrUrl] = useState('')
  const [weixinQrScanData, setWeixinQrScanData] = useState('')
  const [weixinMessage, setWeixinMessage] = useState('')
  const [weixinQrDataUrl, setWeixinQrDataUrl] = useState('')
  const [weixinPollTick, setWeixinPollTick] = useState(0)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const body = isSemantierPasswordMode
        ? { login: loginName, password }
        : { password }
      const res = await fetch(passwordEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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
      setError('')
      setWeixinStatus(data.status)
      if (data.redirect_base_url) {
        setWeixinMessage('QR scanned. Confirm login in Weixin.')
      } else if (data.status === 'scaned') {
        setWeixinMessage('QR scanned. Confirm login in Weixin.')
      } else if (data.status === 'expired') {
        setWeixinMessage('QR code expired. Start a new Weixin sign-in.')
      } else if (
        data.status === 'binding_mismatch' ||
        data.status === 'replay_blocked' ||
        data.status === 'failed'
      ) {
        setWeixinMessage(
          data.message || 'This Weixin sign-in session can no longer be used. Start a new sign-in.',
        )
      }
      if (data.authenticated) {
        setWeixinState('')
        setWeixinStatus('confirmed')
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
      void pollWeixinLogin(weixinState).finally(() => {
        setWeixinPollTick((current) => current + 1)
      })
    }, WEIXIN_LOGIN_POLL_INTERVAL_MS)
    return () => window.clearTimeout(timer)
  }, [weixinState, weixinStatus, weixinPollTick])

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

  const weixinTerminalError = ['expired', 'binding_mismatch', 'replay_blocked', 'failed'].includes(weixinStatus)

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="rounded-card border border-border bg-card p-6 shadow-sm">
          {/* Logo */}
          <div className="mb-8 flex justify-center">
            <div className="flex items-center gap-2.5">
              <img
                src="/logo.svg"
                alt="semantier logo"
                className="size-8 rounded-button object-contain shrink-0 bg-transparent"
              />
              <h1 className="brand-wordmark text-xl font-bold tracking-tight text-foreground">
                semantier
              </h1>
            </div>
          </div>

          {/* Title */}
          <h2 className="mb-2 text-center text-base font-semibold text-foreground">
            {showWeixinQr ? 'Open Your Workspace' : 'Unlock Workspace'}
          </h2>
          <p className="mb-6 text-center text-sm text-muted-foreground">
            {showWeixinQr
              ? 'Scan with Weixin to create a Semantier workspace or return to the same profile.'
              : 'Enter the local workspace password to continue.'}
          </p>

          <div className="space-y-4">
            {showWeixinQr ? (
              <button
                type="button"
                onClick={() => void startWeixinLogin()}
                disabled={weixinLoading}
                className="w-full cursor-pointer rounded-button bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {weixinLoading ? 'Preparing Weixin QR...' : 'Sign In With Weixin'}
              </button>
            ) : null}

            {showWeixinQr && weixinQrScanData ? (
              <div className="rounded-card border border-border bg-muted/50 p-4">
                <div className="flex flex-col items-center gap-3">
                  <img
                    src={weixinQrDataUrl || weixinQrUrl || ''}
                    alt="Weixin sign-in QR code"
                    className="h-48 w-48 rounded-md border border-border bg-card object-contain"
                  />
                  {weixinMessage ? (
                    weixinTerminalError ? (
                      <button
                        type="button"
                        onClick={() => void startWeixinLogin()}
                        className="text-sm font-medium text-foreground underline-offset-2 hover:underline"
                      >
                        {weixinMessage}
                      </button>
                    ) : (
                      <p className="text-center text-sm text-muted-foreground">
                        {weixinMessage}
                      </p>
                    )
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Status: {weixinStatus || 'wait'}
                    </p>
                  )}
                  {weixinQrUrl ? (
                    <a
                      href={weixinQrUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                    >
                      Open QR link
                    </a>
                  ) : null}
                </div>
              </div>
            ) : null}

            {showPasswordLogin ? (
              <>
                {showWeixinQr ? (
                  <div className="flex items-center gap-3 py-1">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      Or
                    </span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                ) : null}
                <form onSubmit={handleSubmit} className="space-y-4">
                  {isSemantierPasswordMode ? (
                    <div>
                      <input
                        type="text"
                        value={loginName}
                        onChange={(e) => setLoginName(e.target.value)}
                        placeholder="Login name"
                        className="w-full rounded-md border border-border bg-background px-4 py-2.5 text-foreground placeholder-muted-foreground outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                        disabled={loading}
                        autoCapitalize="off"
                        autoCorrect="off"
                      />
                    </div>
                  ) : null}
                  <div>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password"
                      className="w-full rounded-md border border-border bg-background px-4 py-2.5 text-foreground placeholder-muted-foreground outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                      disabled={loading}
                      autoFocus
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={
                      loading ||
                      !password ||
                      (isSemantierPasswordMode && !loginName.trim())
                    }
                    className="w-full cursor-pointer rounded-button bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading ? 'Authenticating...' : 'Continue With Password'}
                  </button>
                </form>
              </>
            ) : null}

            {error && (
              <div className="rounded-card border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Powered by{' '}
          <a
            href="https://semantier.com"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Semantier
          </a>
        </p>
      </div>
    </div>
  )
}
