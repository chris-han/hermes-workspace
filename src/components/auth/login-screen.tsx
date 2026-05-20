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
                className="group flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-button bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {weixinLoading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                    <span>Preparing Weixin QR...</span>
                  </>
                ) : (
                  <>
                    {/* WeChat icon */}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="size-5 shrink-0"
                    >
                      <path d="M8.69 2.36c-4.15 0-7.53 2.87-7.53 6.41 0 1.95 1.05 3.73 2.75 4.94l-.92 2.47 3.06-1.47c.75.19 1.55.3 2.38.3.25 0 .5-.01.74-.03-.14-.54-.22-1.1-.22-1.68 0-3.68 3.63-6.67 8.1-6.67.3 0 .59.02.88.05C17.1 4.61 13.26 2.36 8.69 2.36zM5.9 7.03c-.66 0-1.2-.54-1.2-1.2s.54-1.2 1.2-1.2 1.2.54 1.2 1.2-.54 1.2-1.2 1.2zm5.57 0c-.66 0-1.2-.54-1.2-1.2s.54-1.2 1.2-1.2 1.2.54 1.2 1.2-.54 1.2-1.2 1.2zm4.76 3.66c-3.93 0-7.12 2.58-7.12 5.76 0 3.18 3.19 5.76 7.12 5.76.67 0 1.32-.08 1.94-.22l2.48 1.2-.75-1.97c1.42-1.04 2.33-2.54 2.33-4.22 0-3.18-3.2-5.76-7.13-5.76zm-2.5 2.88c-.52 0-.95-.43-.95-.95s.43-.95.95-.95.95.43.95.95-.43.95-.95.95zm5 0c-.52 0-.95-.43-.95-.95s.43-.95.95-.95.95.43.95.95-.43.95-.95.95z" />
                    </svg>
                    <span>Sign In With Weixin</span>
                    {/* Arrow icon */}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5"
                    >
                      <path
                        fillRule="evenodd"
                        d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </>
                )}
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
