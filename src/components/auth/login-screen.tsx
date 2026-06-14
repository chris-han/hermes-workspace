import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import QRCode from 'qrcode'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

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
export type LoginMethod = 'weixin' | 'password'

type LoginScreenProps = {
  showPasswordLogin?: boolean
  showWeixinLogin?: boolean
  passwordMode?: PasswordLoginMode
}

type AuthLocale = 'zh' | 'en'

type LoginScreenCopy = {
  titleOpenWorkspace: string
  titleUnlockWorkspace: string
  subtitleWeixin: string
  subtitlePasswordOnly: string
  weixinLoading: string
  weixinSignIn: string
  weixinQrAlt: string
  statusLabel: string
  statusWait: string
  openQrLink: string
  or: string
  loginNamePlaceholder: string
  passwordPlaceholder: string
  authenticating: string
  continueWithPassword: string
  invalidPassword: string
  authFailed: string
  preparingQrMessage: string
  qrScannedMessage: string
  qrExpiredMessage: string
  signInSessionExpiredMessage: string
  startWeixinFailed: string
  checkWeixinFailed: string
  renewQrButton: string
  poweredBy: string
}

const LOGIN_SCREEN_COPY: Record<AuthLocale, LoginScreenCopy> = {
  zh: {
    titleOpenWorkspace: '打开你的工作区',
    titleUnlockWorkspace: '解锁工作区',
    subtitleWeixin: '使用微信扫码创建 Semantier 工作区，或返回同一用户档案。',
    subtitlePasswordOnly: '输入本地工作区密码以继续。',
    weixinLoading: '正在准备微信二维码...',
    weixinSignIn: '使用微信登录',
    weixinQrAlt: '微信登录二维码',
    statusLabel: '状态',
    statusWait: '等待扫码',
    openQrLink: '打开二维码链接',
    or: '或',
    loginNamePlaceholder: '登录名',
    passwordPlaceholder: '密码',
    authenticating: '正在验证...',
    continueWithPassword: '使用密码继续',
    invalidPassword: '密码无效',
    authFailed: '认证失败，请重试。',
    preparingQrMessage: '请使用微信扫描二维码，并在手机上确认登录。',
    qrScannedMessage: '已扫码，请在微信中确认登录。',
    qrExpiredMessage: '二维码已过期，请重新发起微信登录。',
    signInSessionExpiredMessage: '本次微信登录会话已失效，请重新登录。',
    startWeixinFailed: '发起微信登录失败。',
    checkWeixinFailed: '检查微信登录状态失败。',
    renewQrButton: '点击刷新二维码',
    poweredBy: '技术支持',
  },
  en: {
    titleOpenWorkspace: 'Open Your Workspace',
    titleUnlockWorkspace: 'Unlock Workspace',
    subtitleWeixin:
      'Scan with Weixin to create a Semantier workspace or return to the same profile.',
    subtitlePasswordOnly: 'Enter the local workspace password to continue.',
    weixinLoading: 'Preparing Weixin QR...',
    weixinSignIn: 'Sign In With Weixin',
    weixinQrAlt: 'Weixin sign-in QR code',
    statusLabel: 'Status',
    statusWait: 'wait',
    openQrLink: 'Open QR link',
    or: 'Or',
    loginNamePlaceholder: 'Login name',
    passwordPlaceholder: 'Password',
    authenticating: 'Authenticating...',
    continueWithPassword: 'Continue With Password',
    invalidPassword: 'Invalid password',
    authFailed: 'Authentication failed. Please try again.',
    preparingQrMessage: 'Scan this QR code with Weixin and confirm on your phone.',
    qrScannedMessage: 'QR scanned. Confirm login in Weixin.',
    qrExpiredMessage: 'QR code expired. Start a new Weixin sign-in.',
    signInSessionExpiredMessage:
      'This Weixin sign-in session can no longer be used. Start a new sign-in.',
    startWeixinFailed: 'Failed to start Weixin sign-in.',
    checkWeixinFailed: 'Failed to check Weixin sign-in status.',
    renewQrButton: 'Click to renew the QR code',
    poweredBy: 'Powered by',
  },
}

export function resolveAuthLocale(locale?: string | null): AuthLocale {
  return locale === 'en' ? 'en' : 'zh'
}

export function getLoginScreenCopy(locale?: string | null): LoginScreenCopy {
  return LOGIN_SCREEN_COPY[resolveAuthLocale(locale)]
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

export function resolveDefaultLoginMethod(
  showWeixinLogin: boolean,
  showPasswordLogin: boolean,
): LoginMethod {
  if (showWeixinLogin) return 'weixin'
  return 'password'
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
  const [locale, setLocale] = useState<AuthLocale>(resolveAuthLocale())
  const [activeMethod, setActiveMethod] = useState<LoginMethod>(
    resolveDefaultLoginMethod(showWeixinLogin, showPasswordLogin),
  )
  const copy = getLoginScreenCopy(locale)
  const showMethodTabs = showWeixinLogin && showPasswordLogin

  useEffect(() => {
    setActiveMethod(resolveDefaultLoginMethod(showWeixinLogin, showPasswordLogin))
  }, [showPasswordLogin, showWeixinLogin])

  useEffect(() => {
    if (!showWeixinQr || activeMethod !== 'weixin') return
    if (weixinLoading || weixinState || weixinQrScanData) return
    void startWeixinLogin()
  }, [activeMethod, showWeixinQr, weixinLoading, weixinQrScanData, weixinState])

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
        setError(data.error || copy.invalidPassword)
        setLoading(false)
      }
    } catch (err) {
      setError(copy.authFailed)
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
      setWeixinMessage(copy.preparingQrMessage)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : copy.startWeixinFailed,
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
        setWeixinMessage(copy.qrScannedMessage)
      } else if (data.status === 'scaned') {
        setWeixinMessage(copy.qrScannedMessage)
      } else if (data.status === 'expired') {
        setWeixinMessage(copy.qrExpiredMessage)
      } else if (
        data.status === 'binding_mismatch' ||
        data.status === 'replay_blocked' ||
        data.status === 'failed'
      ) {
        setWeixinMessage(
          data.message || copy.signInSessionExpiredMessage,
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
          : copy.checkWeixinFailed,
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
  const weixinQrExpired = weixinStatus === 'expired'

  function handleMethodChange(value: string) {
    if (value !== 'weixin' && value !== 'password') return
    setActiveMethod(value)
    setError('')
  }

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

          <div className="mb-4 flex justify-center">
            <div className="inline-flex rounded-button border border-border bg-background p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setLocale('zh')}
                className={`rounded-button px-2.5 py-1 transition-colors ${
                  locale === 'zh'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                aria-pressed={locale === 'zh'}
              >
                中文
              </button>
              <button
                type="button"
                onClick={() => setLocale('en')}
                className={`rounded-button px-2.5 py-1 transition-colors ${
                  locale === 'en'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                aria-pressed={locale === 'en'}
              >
                English
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {showMethodTabs ? (
              <Tabs value={activeMethod} onValueChange={handleMethodChange} className="gap-4">
                <TabsList
                  variant="line"
                  className="flex w-full justify-center gap-8 bg-transparent p-0"
                >
                  <TabsTrigger
                    value="weixin"
                    className="rounded-none border-none px-0 py-3 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground data-[state=active]:text-foreground"
                  >
                    {copy.weixinSignIn}
                  </TabsTrigger>
                  <TabsTrigger
                    value="password"
                    className="rounded-none border-none px-0 py-3 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground data-[state=active]:text-foreground"
                  >
                    {copy.continueWithPassword}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="weixin" className="space-y-4">
                  {weixinLoading && !weixinQrScanData ? (
                    <div className="flex min-h-64 items-center justify-center rounded-card border border-border bg-muted/50 p-4">
                      <div className="flex items-center gap-2.5 text-sm font-medium text-muted-foreground">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground" />
                        <span>{copy.weixinLoading}</span>
                      </div>
                    </div>
                  ) : null}

                  {weixinQrScanData ? (
                    <div className="rounded-card border border-border bg-muted/50 p-4">
                      <div className="flex flex-col items-center gap-3">
                        <div className="relative">
                          <img
                            src={weixinQrDataUrl || weixinQrUrl || ''}
                            alt={copy.weixinQrAlt}
                            className={`h-48 w-48 rounded-md border border-border bg-card object-contain transition-opacity ${
                              weixinQrExpired ? 'opacity-30' : 'opacity-100'
                            }`}
                          />
                          {weixinQrExpired ? (
                            <button
                              type="button"
                              onClick={() => void startWeixinLogin()}
                              className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-md bg-background/55 px-6 text-center text-sm font-medium text-foreground transition-colors hover:bg-background/65"
                            >
                              {copy.renewQrButton}
                            </button>
                          ) : null}
                        </div>
                        {weixinMessage ? (
                          weixinTerminalError ? (
                            <button
                              type="button"
                              onClick={() => void startWeixinLogin()}
                              className="cursor-pointer text-sm font-medium text-foreground underline-offset-2 hover:underline"
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
                            {copy.statusLabel}: {weixinStatus || copy.statusWait}
                          </p>
                        )}
                        {weixinQrUrl ? (
                          <a
                            href={weixinQrUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                          >
                            {copy.openQrLink}
                          </a>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {weixinTerminalError && !weixinLoading && !weixinQrScanData ? (
                    <button
                      type="button"
                      onClick={() => void startWeixinLogin()}
                      className="w-full cursor-pointer rounded-button bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 hover:scale-105 active:scale-95"
                    >
                      {copy.weixinSignIn}
                    </button>
                  ) : null}
                </TabsContent>

                <TabsContent value="password">
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {isSemantierPasswordMode ? (
                      <div>
                        <input
                          type="text"
                          value={loginName}
                          onChange={(e) => setLoginName(e.target.value)}
                          placeholder={copy.loginNamePlaceholder}
                          className="w-full rounded-md border border-border bg-background px-4 py-3 text-foreground placeholder-muted-foreground outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
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
                        placeholder={copy.passwordPlaceholder}
                        className="w-full rounded-md border border-border bg-background px-4 py-3 text-foreground placeholder-muted-foreground outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
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
                      className="w-full cursor-pointer rounded-button bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {loading ? copy.authenticating : copy.continueWithPassword}
                    </button>
                  </form>
                </TabsContent>
              </Tabs>
            ) : null}

            {!showMethodTabs && showWeixinQr ? (
              <>
                <button
                  type="button"
                  onClick={() => void startWeixinLogin()}
                  disabled={weixinLoading}
                  className="group flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-button bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {weixinLoading ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                      <span>{copy.weixinLoading}</span>
                    </>
                  ) : (
                    <span>{copy.weixinSignIn}</span>
                  )}
                </button>

                {weixinQrScanData ? (
                  <div className="rounded-card border border-border bg-muted/50 p-4">
                    <div className="flex flex-col items-center gap-3">
                      <img
                        src={weixinQrDataUrl || weixinQrUrl || ''}
                        alt={copy.weixinQrAlt}
                        className="h-48 w-48 rounded-md border border-border bg-card object-contain"
                      />
                      {weixinMessage ? (
                        weixinTerminalError ? (
                          <button
                            type="button"
                            onClick={() => void startWeixinLogin()}
                            className="cursor-pointer text-sm font-medium text-foreground underline-offset-2 hover:underline"
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
                          {copy.statusLabel}: {weixinStatus || copy.statusWait}
                        </p>
                      )}
                      {weixinQrUrl ? (
                        <a
                          href={weixinQrUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                        >
                          {copy.openQrLink}
                        </a>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}

            {!showMethodTabs && showPasswordLogin ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                {isSemantierPasswordMode ? (
                  <div>
                    <input
                      type="text"
                      value={loginName}
                      onChange={(e) => setLoginName(e.target.value)}
                      placeholder={copy.loginNamePlaceholder}
                      className="w-full rounded-md border border-border bg-background px-4 py-3 text-foreground placeholder-muted-foreground outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
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
                    placeholder={copy.passwordPlaceholder}
                    className="w-full rounded-md border border-border bg-background px-4 py-3 text-foreground placeholder-muted-foreground outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
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
                  className="w-full cursor-pointer rounded-button bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? copy.authenticating : copy.continueWithPassword}
                </button>
              </form>
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
          {copy.poweredBy}{' '}
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
