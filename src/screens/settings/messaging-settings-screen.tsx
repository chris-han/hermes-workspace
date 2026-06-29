import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { ViewIcon, ViewOffIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import QRCode from 'qrcode'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'

type PlatformId = 'feishu' | 'weixin'

type PlatformState = {
  platform: PlatformId
  configured: boolean
  docs_url: string
  created_at?: string
  updated_at?: string
  validated_at?: string
  last_error?: string
  config: Record<string, unknown>
}

type PlatformsResponse = {
  platforms: Array<PlatformState>
  owner_id: string
  workspace_slug: string
}

type ValidateResponse = {
  platform: PlatformId
  valid: boolean
  summary: string
  details: Record<string, unknown>
}

type AuthContextResponse = {
  authenticated: boolean
  user?: {
    user_id: string
    name: string
    email?: string | null
    avatar_url?: string | null
    feishu_open_id?: string
    password_login_name?: string | null
    profile_completed?: boolean
    workspace_slug?: string
    home_dir_path?: string | null
  } | null
}

type FeishuLinkStartResponse = {
  status: 'pending' | 'already_linked'
  authorize_url?: string
  state?: string
  expires_at?: string
  feishu_open_id?: string
}

type FeishuLinkStatusResponse = {
  state: string
  status: 'pending' | 'linked' | 'expired' | 'failed'
  feishu_open_id?: string
  message?: string
}

type FeishuLinkDeleteResponse = {
  ok: boolean
  status: 'unlinked'
  feishu_open_id?: string
  message?: string
}

type WeixinPairingStartResponse = {
  state: string
  status: string
  qrcode: string
  qrcode_url?: string
  qr_scan_data: string
  base_url: string
  bot_type: string
}

type WeixinPairingStatusResponse = {
  state: string
  status: string
  redirect_base_url?: string
  message?: string
}

type WeixinReconnectResponse = {
  contract_version: string
  platform: PlatformId
  adapter_key: string
  adapter_state: string
  reconnect_scope: 'adapter'
  auth_level: 'seamless' | 'grace' | 'step_up'
  auth_reason:
    | 'session_valid'
    | 'grace_window'
    | 'expired'
    | 'binding_mismatch'
    | 'replay_blocked'
  requires_step_up: boolean
  grace_expires_at_utc: string | null
  reconnect_applied: boolean
  runtime_session_state?: string
}

type FeishuDraft = {
  appId: string
  appSecret: string
  domain: 'feishu' | 'lark'
  connectionMode: 'websocket' | 'webhook'
}

type WeixinDmPolicy = 'open' | 'allowlist' | 'disabled' | 'pairing'
type WeixinGroupPolicy = 'open' | 'allowlist' | 'disabled'

type WeixinDraft = {
  accountId: string
  token: string
  baseUrl: string
  cdnBaseUrl: string
  dmPolicy: WeixinDmPolicy
  allowFrom: string
  groupPolicy: WeixinGroupPolicy
  groupAllowFrom: string
  homeChannel: string
}

export function scheduleFeishuLinkStatusPolling(
  poll: () => Promise<void> | void,
  intervalMs = 1500,
): () => void {
  let cancelled = false
  let timer: ReturnType<typeof setTimeout> | undefined

  const schedulePoll = () => {
    timer = globalThis.setTimeout(async () => {
      if (cancelled) {
        return
      }
      await poll()
      if (!cancelled) {
        schedulePoll()
      }
    }, intervalMs)
  }

  schedulePoll()
  return () => {
    cancelled = true
    if (timer !== undefined) {
      globalThis.clearTimeout(timer)
    }
  }
}

const EMPTY_FEISHU: FeishuDraft = {
  appId: '',
  appSecret: '',
  domain: 'feishu',
  connectionMode: 'websocket',
}

const EMPTY_WEIXIN: WeixinDraft = {
  accountId: '',
  token: '',
  baseUrl: 'https://ilinkai.weixin.qq.com',
  cdnBaseUrl: '',
  dmPolicy: 'pairing',
  allowFrom: '',
  groupPolicy: 'disabled',
  groupAllowFrom: '',
  homeChannel: '',
}

const WEIXIN_PAIRING_POLL_INTERVAL_MS = 1500

function shouldPollWeixinPairingStatus(status: string): boolean {
  return ['wait', 'scaned', 'scaned_but_redirect'].includes(status)
}

export function shouldAutoRefreshWeixinPairingQr(status: string): boolean {
  return status === 'expired' || status === 'replay_blocked'
}

function normalizeCommaSeparated(value: string): string {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .join(',')
}

function normalizeConfigList(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
      .filter(Boolean)
      .join(',')
  }
  if (typeof value === 'string') {
    return normalizeCommaSeparated(value)
  }
  return ''
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/semantier-proxy${path}`, init)
  const contentType = response.headers.get('content-type')?.toLowerCase() || ''
  const text = await response.text()
  const isJson = contentType.includes('application/json')
  let payload:
    | (T & { detail?: string; error?: string; message?: string })
    | null = null

  if (text && isJson) {
    try {
      payload = JSON.parse(text) as T & {
        detail?: string
        error?: string
        message?: string
      }
    } catch {
      throw new Error('API returned malformed JSON response.')
    }
  }

  if (text && !isJson) {
    const maybeHtml = text.trim().startsWith('<')
    if (maybeHtml) {
      throw new Error(
        'API returned HTML instead of JSON. Please check auth session or proxy route handling.',
      )
    }
  }

  if (!response.ok) {
    const detail =
      (payload && typeof payload.detail === 'string' && payload.detail) ||
      (payload && typeof payload.error === 'string' && payload.error) ||
      (payload && typeof payload.message === 'string' && payload.message) ||
      `Request failed (${response.status})`
    throw new Error(detail)
  }
  return (payload ?? ({} as T)) as T
}

function platformTitle(id: PlatformId): string {
  return id === 'feishu' ? 'Feishu / Lark' : 'Weixin (WeChat)'
}

function StatusBadge({ configured }: { configured: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide',
        configured
          ? 'bg-emerald-200/70 text-success'
          : 'theme-card2 theme-text',
      )}
    >
      {configured ? 'Configured' : 'Not configured'}
    </span>
  )
}

function PageShell({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 pt-6 pb-10 sm:px-6">
      <header className="rounded-card border theme-border theme-card2 p-5 shadow-sm">
        <h1 className="text-xl font-semibold theme-text">{title}</h1>
        <p className="mt-1 text-sm theme-text">{description}</p>
      </header>
      {children}
    </div>
  )
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section className="rounded-card border theme-border theme-card2 p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-base font-semibold theme-text">{title}</h2>
        <p className="text-sm theme-text">{description}</p>
      </div>
      {children}
    </section>
  )
}

function SettingsLink({
  to,
  label,
}: {
  to: '/settings/messaging-accounts' | '/settings/messaging-platforms'
  label: string
}) {
  return (
    <Link
      to={to}
      className="inline-flex items-center rounded-button border theme-border px-3 py-2 text-sm font-medium theme-text transition-colors hover:bg-muted"
    >
      {label}
    </Link>
  )
}

function useMessagingSettingsModel() {
  const [platforms, setPlatforms] = useState<Record<PlatformId, PlatformState>>(
    {
      feishu: {
        platform: 'feishu',
        configured: false,
        docs_url:
          'https://hermes-agent.nousresearch.com/docs/user-guide/messaging/feishu',
        config: {},
      },
      weixin: {
        platform: 'weixin',
        configured: false,
        docs_url:
          'https://hermes-agent.nousresearch.com/docs/user-guide/messaging/weixin',
        config: {},
      },
    },
  )
  const [loading, setLoading] = useState(true)
  const [savingPlatform, setSavingPlatform] = useState<PlatformId | null>(null)
  const [validatingPlatform, setValidatingPlatform] =
    useState<PlatformId | null>(null)
  const [authMe, setAuthMe] = useState<AuthContextResponse | null>(null)
  const [startingFeishuLink, setStartingFeishuLink] = useState(false)
  const [unlinkingFeishu, setUnlinkingFeishu] = useState(false)
  const [feishuLinkState, setFeishuLinkState] = useState('')
  const [feishuLinkStatus, setFeishuLinkStatus] = useState<
    'pending' | 'linked' | 'expired' | 'failed' | 'unlinked' | ''
  >('')
  const [feishuLinkMessage, setFeishuLinkMessage] = useState('')
  const [feishuLinkAuthorizeUrl, setFeishuLinkAuthorizeUrl] = useState('')
  const [feishuLinkQrDataUrl, setFeishuLinkQrDataUrl] = useState('')
  const [feishu, setFeishu] = useState<FeishuDraft>(EMPTY_FEISHU)
  const [weixin, setWeixin] = useState<WeixinDraft>(EMPTY_WEIXIN)
  const [showWeixinToken, setShowWeixinToken] = useState(false)
  const [startingWeixinPairing, setStartingWeixinPairing] = useState(false)
  const [weixinPairingState, setWeixinPairingState] = useState('')
  const [weixinPairingStatus, setWeixinPairingStatus] = useState('')
  const [weixinPairingMessage, setWeixinPairingMessage] = useState('')
  const [weixinPairingQrScanData, setWeixinPairingQrScanData] = useState('')
  const [weixinPairingQrDataUrl, setWeixinPairingQrDataUrl] = useState('')
  const [reconnectingWeixin, setReconnectingWeixin] = useState(false)
  const [weixinReconnectOutcome, setWeixinReconnectOutcome] =
    useState<WeixinReconnectResponse | null>(null)
  const [approvingWeixinPairing, setApprovingWeixinPairing] = useState(false)
  const [weixinPairingApproveCode, setWeixinPairingApproveCode] = useState('')
  const [validationMessage, setValidationMessage] = useState<
    Record<PlatformId, string>
  >({
    feishu: '',
    weixin: '',
  })

  async function loadPlatforms() {
    setLoading(true)
    try {
      const data = await requestJson<PlatformsResponse>('/messaging/platforms')
      setPlatforms((current) => {
        const next: Record<PlatformId, PlatformState> = {
          feishu:
            data.platforms.find((item) => item.platform === 'feishu') ??
            current.feishu,
          weixin:
            data.platforms.find((item) => item.platform === 'weixin') ??
            current.weixin,
        }

        const feishuConfig = next.feishu.config
        setFeishu({
          appId: String(feishuConfig.app_id ?? ''),
          appSecret: '',
          domain: feishuConfig.domain === 'lark' ? 'lark' : 'feishu',
          connectionMode:
            feishuConfig.connection_mode === 'webhook'
              ? 'webhook'
              : 'websocket',
        })

        const weixinConfig = next.weixin.config
        setWeixin({
          accountId: String(weixinConfig.account_id ?? ''),
          token: String(weixinConfig.token ?? ''),
          baseUrl: String(
            weixinConfig.base_url ?? 'https://ilinkai.weixin.qq.com',
          ),
          cdnBaseUrl: String(weixinConfig.cdn_base_url ?? ''),
          dmPolicy: (['open', 'allowlist', 'disabled', 'pairing'].includes(
            String(weixinConfig.dm_policy),
          )
            ? String(weixinConfig.dm_policy)
            : 'pairing') as WeixinDmPolicy,
          allowFrom: Array.isArray(weixinConfig.allow_from)
            ? (weixinConfig.allow_from as string[]).join(', ')
            : String(weixinConfig.allow_from ?? ''),
          groupPolicy: (['open', 'allowlist', 'disabled'].includes(
            String(weixinConfig.group_policy),
          )
            ? String(weixinConfig.group_policy)
            : 'disabled') as WeixinGroupPolicy,
          groupAllowFrom: Array.isArray(weixinConfig.group_allow_from)
            ? (weixinConfig.group_allow_from as string[]).join(', ')
            : String(weixinConfig.group_allow_from ?? ''),
          homeChannel: String(weixinConfig.home_channel ?? ''),
        })

        if (next.weixin.configured) {
          setWeixinPairingState('')
          setWeixinPairingStatus('confirmed')
          setWeixinPairingMessage('Weixin gateway is configured.')
          setWeixinPairingQrScanData('')
          setWeixinPairingQrDataUrl('')
        }

        return next
      })
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to load messaging settings.'
      toast(message, { type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  async function loadAuthMe() {
    try {
      const data = await requestJson<AuthContextResponse>('/auth/context')
      setAuthMe(data)
    } catch {
      setAuthMe(null)
    }
  }

  useEffect(() => {
    void loadPlatforms()
    void loadAuthMe()
  }, [])

  const canValidateFeishu = useMemo(() => {
    return feishu.appId.trim() !== '' && feishu.appSecret.trim() !== ''
  }, [feishu])

  async function startFeishuLinkQr() {
    setStartingFeishuLink(true)
    try {
      const response = await requestJson<FeishuLinkStartResponse>(
        '/auth/feishu/link/start',
        {
          method: 'POST',
        },
      )

      if (response.status === 'already_linked') {
        setFeishuLinkState('')
        setFeishuLinkStatus('linked')
        setFeishuLinkAuthorizeUrl('')
        setFeishuLinkQrDataUrl('')
        setFeishuLinkMessage('This account is already linked with Feishu.')
        toast('This account is already linked with Feishu.', {
          type: 'success',
        })
        await loadAuthMe()
        await loadPlatforms()
        return
      }

      if (!response.state || !response.authorize_url) {
        throw new Error('Failed to start Feishu link session.')
      }

      setFeishuLinkState(response.state)
      setFeishuLinkAuthorizeUrl(response.authorize_url)
      setFeishuLinkStatus('pending')
      setFeishuLinkMessage(
        'Scan this QR code with Feishu to link your account.',
      )
      toast('Feishu link QR generated.', { type: 'success' })
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to start Feishu link flow.'
      toast(message, { type: 'error' })
    } finally {
      setStartingFeishuLink(false)
    }
  }

  async function pollFeishuLinkStatus(state: string) {
    try {
      const response = await requestJson<FeishuLinkStatusResponse>(
        `/auth/feishu/link/status?state=${encodeURIComponent(state)}`,
      )
      setFeishuLinkStatus(response.status)
      setFeishuLinkMessage(response.message || '')

      if (response.status === 'linked') {
        setFeishuLinkState('')
        setFeishuLinkAuthorizeUrl('')
        setFeishuLinkQrDataUrl('')
        toast('Feishu account linked successfully.', { type: 'success' })
        await loadAuthMe()
        await loadPlatforms()
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to check Feishu link status.'
      setFeishuLinkStatus('failed')
      setFeishuLinkMessage(message)
    }
  }

  async function unlinkFeishuLogin() {
    if (!window.confirm('Unlink this Feishu login account?')) {
      return
    }
    setUnlinkingFeishu(true)
    try {
      const response = await requestJson<FeishuLinkDeleteResponse>(
        '/auth/feishu/link',
        {
          method: 'DELETE',
        },
      )
      setFeishuLinkState('')
      setFeishuLinkStatus(response.status)
      setFeishuLinkAuthorizeUrl('')
      setFeishuLinkQrDataUrl('')
      setFeishuLinkMessage(response.message || 'Feishu account unlinked.')
      toast(response.message || 'Feishu account unlinked.', { type: 'success' })
      await loadAuthMe()
      await loadPlatforms()
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to unlink Feishu account.'
      toast(message, { type: 'error' })
    } finally {
      setUnlinkingFeishu(false)
    }
  }

  useEffect(() => {
    if (!feishuLinkState || feishuLinkStatus !== 'pending') {
      return
    }
    return scheduleFeishuLinkStatusPolling(() =>
      pollFeishuLinkStatus(feishuLinkState),
    )
  }, [feishuLinkState, feishuLinkStatus])

  useEffect(() => {
    let cancelled = false

    async function buildFeishuLinkQrDataUrl() {
      if (!feishuLinkAuthorizeUrl) {
        setFeishuLinkQrDataUrl('')
        return
      }
      try {
        const dataUrl = await QRCode.toDataURL(feishuLinkAuthorizeUrl, {
          width: 320,
          margin: 1,
          errorCorrectionLevel: 'M',
        })
        if (!cancelled) {
          setFeishuLinkQrDataUrl(dataUrl)
        }
      } catch {
        if (!cancelled) {
          setFeishuLinkQrDataUrl('')
        }
      }
    }

    void buildFeishuLinkQrDataUrl()
    return () => {
      cancelled = true
    }
  }, [feishuLinkAuthorizeUrl])

  async function startWeixinPairingQr(forceRefresh = false) {
    if (
      !forceRefresh &&
      platforms.weixin.configured &&
      weixinReconnectOutcome?.requires_step_up !== true
    ) {
      return
    }
    setStartingWeixinPairing(true)
    setWeixinPairingMessage('')
    setWeixinReconnectOutcome(null)
    try {
      const response = await requestJson<WeixinPairingStartResponse>(
        '/auth/weixin/login/start',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        },
      )

      if (!response.state || !response.qr_scan_data) {
        throw new Error('Failed to start Weixin QR pairing.')
      }

      setWeixinPairingState(response.state)
      setWeixinPairingStatus(response.status || 'wait')
      setWeixinPairingQrScanData(response.qr_scan_data)
      setWeixinPairingMessage(
        'Scan this QR code with Weixin and confirm on your phone.',
      )
      toast('Weixin QR pairing started.', { type: 'success' })
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to start Weixin QR pairing.'
      setWeixinPairingStatus('failed')
      setWeixinPairingMessage(message)
      toast(message, { type: 'error' })
    } finally {
      setStartingWeixinPairing(false)
    }
  }

  async function pollWeixinPairingStatus(state: string) {
    try {
      const response = await requestJson<WeixinPairingStatusResponse>(
        `/auth/weixin/login/status?state=${encodeURIComponent(state)}`,
      )
      const nextStatus = response.status || 'wait'
      setWeixinPairingStatus(nextStatus)

      if (response.redirect_base_url || nextStatus === 'scaned') {
        setWeixinPairingMessage('QR scanned. Confirm login in Weixin.')
      } else if (nextStatus === 'expired') {
        setWeixinPairingMessage(
          'QR code expired. Refreshing pairing session...',
        )
        if (shouldAutoRefreshWeixinPairingQr(nextStatus)) {
          await startWeixinPairingQr(true)
          return
        }
      } else if (
        nextStatus === 'binding_mismatch' ||
        nextStatus === 'replay_blocked' ||
        nextStatus === 'failed'
      ) {
        setWeixinPairingMessage(
          response.message ||
            'This QR session can no longer be used. Start a new pairing session.',
        )
      }

      if (nextStatus === 'confirmed') {
        setPlatforms((current) => ({
          ...current,
          weixin: {
            ...current.weixin,
            configured: true,
          },
        }))
        setWeixinPairingState('')
        setWeixinPairingQrScanData('')
        setWeixinPairingQrDataUrl('')
        setWeixinPairingMessage('Weixin gateway paired successfully.')
        toast('Weixin gateway paired successfully.', { type: 'success' })
        await loadPlatforms()
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to check Weixin pairing status.'
      if (message.includes('already been consumed')) {
        setWeixinPairingMessage(
          'QR session expired. Refreshing pairing session...',
        )
        await startWeixinPairingQr(true)
        return
      }
      setWeixinPairingStatus('failed')
      setWeixinPairingMessage(message)
    }
  }

  useEffect(() => {
    if (
      !weixinPairingState ||
      !shouldPollWeixinPairingStatus(weixinPairingStatus)
    ) {
      return
    }

    const timer = window.setTimeout(() => {
      void pollWeixinPairingStatus(weixinPairingState)
    }, WEIXIN_PAIRING_POLL_INTERVAL_MS)

    return () => window.clearTimeout(timer)
  }, [weixinPairingState, weixinPairingStatus])

  useEffect(() => {
    let cancelled = false

    async function buildWeixinPairingQrDataUrl() {
      if (!weixinPairingQrScanData) {
        setWeixinPairingQrDataUrl('')
        return
      }
      try {
        const dataUrl = await QRCode.toDataURL(weixinPairingQrScanData, {
          width: 320,
          margin: 1,
          errorCorrectionLevel: 'M',
        })
        if (!cancelled) {
          setWeixinPairingQrDataUrl(dataUrl)
        }
      } catch {
        if (!cancelled) {
          setWeixinPairingQrDataUrl('')
        }
      }
    }

    void buildWeixinPairingQrDataUrl()
    return () => {
      cancelled = true
    }
  }, [weixinPairingQrScanData])

  async function validate(platform: PlatformId) {
    setValidatingPlatform(platform)
    try {
      const payload = {
        config: {
          app_id: feishu.appId.trim(),
          app_secret: feishu.appSecret.trim(),
          domain: feishu.domain,
          connection_mode: feishu.connectionMode,
        },
      }

      const response = await requestJson<ValidateResponse>(
        `/messaging/${platform}/validate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      )

      setValidationMessage((current) => ({
        ...current,
        [platform]: response.summary,
      }))
      toast(`${platformTitle(platform)} validation passed.`, {
        type: 'success',
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Validation failed.'
      setValidationMessage((current) => ({
        ...current,
        [platform]: message,
      }))
      toast(message, { type: 'error' })
    } finally {
      setValidatingPlatform(null)
    }
  }

  async function save(platform: PlatformId) {
    setSavingPlatform(platform)
    try {
      const payload = {
        config: {
          app_id: feishu.appId.trim(),
          app_secret: feishu.appSecret.trim(),
          domain: feishu.domain,
          connection_mode: feishu.connectionMode,
        },
      }

      const result = await requestJson<
        PlatformState & { gateway_applied?: boolean }
      >(`/messaging/${platform}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const gatewayNote = result.gateway_applied
        ? ' Gateway config updated; restart gateway to activate changes.'
        : ''
      toast(`${platformTitle(platform)} configuration saved.${gatewayNote}`, {
        type: 'success',
      })
      await loadPlatforms()
      setValidationMessage((current) => ({
        ...current,
        [platform]: '',
      }))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Save failed.'
      toast(message, { type: 'error' })
    } finally {
      setSavingPlatform(null)
    }
  }

  async function remove(platform: PlatformId) {
    setSavingPlatform(platform)
    try {
      await requestJson<{ ok: boolean }>(`/messaging/${platform}`, {
        method: 'DELETE',
      })
      toast(`${platformTitle(platform)} configuration removed.`, {
        type: 'success',
      })
      await loadPlatforms()
      setValidationMessage((current) => ({
        ...current,
        [platform]: '',
      }))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Delete failed.'
      toast(message, { type: 'error' })
    } finally {
      setSavingPlatform(null)
    }
  }

  async function reconnectWeixinGateway() {
    if (!platforms.weixin.configured) {
      return
    }
    setReconnectingWeixin(true)
    setWeixinReconnectOutcome(null)
    try {
      const res = await fetch(
        '/api/semantier-proxy/messaging/weixin/reconnect',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        },
      )
      const response = (await res.json()) as WeixinReconnectResponse & {
        detail?: string
      }
      if (!res.ok) {
        if (
          response &&
          typeof response === 'object' &&
          'auth_level' in response
        ) {
          setWeixinReconnectOutcome(response)
          if (response.requires_step_up) {
            setWeixinPairingMessage(
              response.auth_reason === 'binding_mismatch'
                ? 'Session mismatch detected. Start a fresh QR verification.'
                : 'Session expired. Scan a new Weixin QR code to continue.',
            )
            await startWeixinPairingQr()
          }
          return
        }
        const errorDetail =
          typeof (response as { detail?: string }).detail === 'string'
            ? (response as { detail?: string }).detail
            : undefined
        throw new Error(errorDetail || `Request failed (${res.status})`)
      }
      setWeixinReconnectOutcome(response)
      setPlatforms((current) => ({
        ...current,
        weixin: {
          ...current.weixin,
          platform: 'weixin',
          configured: true,
          config: {
            ...current.weixin.config,
            runtime_session_state: response.runtime_session_state || 'active',
          },
        },
      }))
      toast(
        response.auth_level === 'grace'
          ? 'Weixin gateway reconnected inside the grace window.'
          : 'Weixin gateway reconnect applied.',
        { type: 'success' },
      )
      await loadPlatforms()
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to reconnect Weixin gateway.'
      toast(message, { type: 'error' })
    } finally {
      setReconnectingWeixin(false)
    }
  }

  async function approveWeixinPairingSelf() {
    const code = weixinPairingApproveCode.trim().toUpperCase()
    if (!code) {
      toast('Enter the Weixin pairing code first.', { type: 'error' })
      return
    }
    setApprovingWeixinPairing(true)
    try {
      const response = await requestJson<{
        ok: boolean
        message: string
      }>('/messaging/weixin/pairing/approve-self', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      setWeixinPairingApproveCode('')
      toast(response.message, { type: 'success' })
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to approve Weixin pairing.'
      toast(message, { type: 'error' })
    } finally {
      setApprovingWeixinPairing(false)
    }
  }

  return {
    authMe,
    canValidateFeishu,
    feishu,
    feishuLinkAuthorizeUrl,
    feishuLinkMessage,
    feishuLinkQrDataUrl,
    feishuLinkStatus,
    loadPlatforms,
    loading,
    platforms,
    reconnectWeixinGateway,
    reconnectingWeixin,
    approveWeixinPairingSelf,
    approvingWeixinPairing,
    remove,
    save,
    savingPlatform,
    setFeishu,
    setShowWeixinToken,
    showWeixinToken,
    startWeixinPairingQr,
    startingWeixinPairing,
    startFeishuLinkQr,
    startingFeishuLink,
    unlinkFeishuLogin,
    unlinkingFeishu,
    validate,
    validatingPlatform,
    validationMessage,
    weixin,
    weixinPairingApproveCode,
    setWeixinPairingApproveCode,
    weixinPairingMessage,
    weixinPairingQrDataUrl,
    weixinPairingState,
    weixinPairingStatus,
    weixinReconnectOutcome,
  }
}

function readOnlyValue(value: string): string {
  return value.trim() || '-'
}

function LoadingState() {
  return (
    <div className="rounded-card border theme-border theme-card2 p-5 text-sm theme-text">
      Loading messaging configuration...
    </div>
  )
}

function UserAccountCard({
  model,
}: {
  model: ReturnType<typeof useMessagingSettingsModel>
}) {
  const [displayName, setDisplayName] = useState('')
  const [loginName, setLoginName] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setDisplayName(model.authMe?.user?.name ?? '')
    setLoginName(model.authMe?.user?.password_login_name ?? '')
  }, [model.authMe?.user?.name, model.authMe?.user?.password_login_name])

  async function saveAccount() {
    const trimmedDisplayName = displayName.trim()
    const trimmedLoginName = loginName.trim()
    const trimmedPassword = password.trim()
    const trimmedPasswordConfirm = passwordConfirm.trim()

    setSaving(true)
    try {
      await requestJson<{
        ok: boolean
        profile_completed: boolean
      }>('/auth/profile/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: trimmedDisplayName,
          login_name: trimmedLoginName,
          ...(trimmedPassword
            ? {
                password: trimmedPassword,
                password_confirm: trimmedPasswordConfirm,
              }
            : {}),
        }),
      })
      setPassword('')
      setPasswordConfirm('')
      await model.loadPlatforms()
      toast('User account updated.', { type: 'success' })
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to update user account.'
      toast(message, { type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <SectionCard
      title="User Account"
      description="Manage the local username and password fallback for this Semantier user."
    >
      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1.5 md:col-span-2">
          <span className="text-xs font-medium uppercase tracking-[0.12em] theme-muted">
            Display Name
          </span>
          <Input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Alice Zhang"
          />
        </label>
        <label className="space-y-1.5 md:col-span-2">
          <span className="text-xs font-medium uppercase tracking-[0.12em] theme-muted">
            Username
          </span>
          <Input
            value={loginName}
            onChange={(event) => setLoginName(event.target.value)}
            placeholder="alice"
            autoCapitalize="off"
            autoCorrect="off"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-[0.12em] theme-muted">
            New Password
          </span>
          <Input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Leave blank to keep current password"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-[0.12em] theme-muted">
            Confirm Password
          </span>
          <Input
            type="password"
            value={passwordConfirm}
            onChange={(event) => setPasswordConfirm(event.target.value)}
            placeholder="Repeat new password"
          />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          disabled={saving}
          onClick={() => void saveAccount()}
        >
          {saving ? 'Saving...' : 'Save account changes'}
        </Button>
        <span className="text-xs theme-muted">
          Password updates are optional. If provided, the password must be at
          least 8 characters.
        </span>
      </div>
    </SectionCard>
  )
}

function FeishuAccountLinkCard({
  model,
}: {
  model: ReturnType<typeof useMessagingSettingsModel>
}) {
  const linkedOpenId = model.authMe?.user?.feishu_open_id?.trim() || ''

  return (
    <SectionCard
      title="Feishu Login"
      description="This is per-user Feishu sign-in pairing. It is only for login identity and is separate from bot configuration."
    >
      <div className="rounded-md border theme-border theme-card p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={
              model.startingFeishuLink ||
              model.unlinkingFeishu ||
              Boolean(linkedOpenId)
            }
            onClick={() => void model.startFeishuLinkQr()}
          >
            {model.startingFeishuLink ? 'Preparing QR...' : 'Link Feishu Login'}
          </Button>
          {linkedOpenId ? (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={model.unlinkingFeishu || model.startingFeishuLink}
                onClick={() => void model.unlinkFeishuLogin()}
              >
                {model.unlinkingFeishu ? 'Unlinking...' : 'Unlink'}
              </Button>
              <span className="text-xs text-success">
                Linked open_id: {linkedOpenId}
              </span>
            </>
          ) : (
            <span className="text-xs theme-text">
              No Feishu account linked yet.
            </span>
          )}
          {model.feishuLinkStatus ? (
            <span className="text-xs theme-text">
              Link status: {model.feishuLinkStatus}
            </span>
          ) : null}
        </div>

        {model.feishuLinkAuthorizeUrl && !linkedOpenId ? (
          <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-start md:gap-4">
            <img
              src={model.feishuLinkQrDataUrl || ''}
              alt="Feishu login QR code"
              className="h-40 w-40 rounded-md border theme-border theme-card object-contain"
            />
            <div className="min-w-0 text-xs theme-text">
              <p>Scan this QR with Feishu and approve authorization.</p>
              <p className="mt-1 break-all">
                OAuth URL:{' '}
                <a
                  className="underline"
                  href={model.feishuLinkAuthorizeUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open link
                </a>
              </p>
            </div>
          </div>
        ) : null}

        {model.feishuLinkMessage ? (
          <p className="mt-2 text-xs theme-text">{model.feishuLinkMessage}</p>
        ) : null}
      </div>
    </SectionCard>
  )
}

function FeishuBotConfigCard({
  model,
}: {
  model: ReturnType<typeof useMessagingSettingsModel>
}) {
  const state = model.platforms.feishu
  const validating = model.validatingPlatform === 'feishu'
  const saving = model.savingPlatform === 'feishu'
  const canValidate = model.canValidateFeishu
  const canSave = model.canValidateFeishu

  return (
    <SectionCard
      title="Feishu Bot Configuration"
      description="This pairing is organization-scoped. Configure the shared Feishu/Lark app that serves users in the same organization."
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <StatusBadge configured={state.configured} />
        <a
          href={state.docs_url}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-medium theme-text underline underline-offset-2"
        >
          Open setup docs
        </a>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-[0.12em] theme-muted">
            App ID
          </span>
          <Input
            value={model.feishu.appId}
            placeholder="cli_xxx"
            onChange={(event) =>
              model.setFeishu((current) => ({
                ...current,
                appId: event.target.value,
              }))
            }
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-[0.12em] theme-muted">
            App Secret
          </span>
          <Input
            type="password"
            value={model.feishu.appSecret}
            placeholder={state.configured ? 'Re-enter to update' : 'secret_xxx'}
            onChange={(event) =>
              model.setFeishu((current) => ({
                ...current,
                appSecret: event.target.value,
              }))
            }
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-[0.12em] theme-muted">
            Domain
          </span>
          <select
            value={model.feishu.domain}
            onChange={(event) =>
              model.setFeishu((current) => ({
                ...current,
                domain: event.target.value as 'feishu' | 'lark',
              }))
            }
            className="h-9 rounded-md border theme-border theme-card px-3 text-sm theme-text"
          >
            <option value="feishu">Feishu</option>
            <option value="lark">Lark</option>
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-[0.12em] theme-muted">
            Connection Mode
          </span>
          <select
            value={model.feishu.connectionMode}
            onChange={(event) =>
              model.setFeishu((current) => ({
                ...current,
                connectionMode: event.target.value as 'websocket' | 'webhook',
              }))
            }
            className="h-9 rounded-md border theme-border theme-card px-3 text-sm theme-text"
          >
            <option value="websocket">WebSocket</option>
            <option value="webhook">Webhook</option>
          </select>
        </label>

        {state.configured ? (
          <p className="mt-1 text-xs theme-muted md:col-span-2">
            Existing credentials are masked. Re-enter the secret value before
            validating or saving updates.
          </p>
        ) : null}

        {model.validationMessage.feishu ? (
          <p className="mt-1 text-xs theme-text md:col-span-2">
            {model.validationMessage.feishu}
          </p>
        ) : null}

        <div className="md:col-span-2 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!canValidate || validating || saving}
            onClick={() => void model.validate('feishu')}
          >
            {validating ? 'Validating...' : 'Validate'}
          </Button>
          <Button
            type="button"
            disabled={!canSave || saving || validating}
            onClick={() => void model.save('feishu')}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={saving || validating || !state.configured}
            onClick={() => void model.remove('feishu')}
          >
            Remove
          </Button>
        </div>
      </div>
    </SectionCard>
  )
}

function WeixinReadOnlyCard({
  model,
}: {
  model: ReturnType<typeof useMessagingSettingsModel>
}) {
  const state = model.platforms.weixin
  const shouldShowPairing =
    !state.configured ||
    Boolean(model.weixinPairingState) ||
    model.weixinReconnectOutcome?.requires_step_up === true
  const runtimeState = String(state.config?.runtime_session_state ?? '').trim()
  const runtimeError = String(
    state.config?.runtime_session_error ?? state.last_error ?? '',
  ).trim()
  const runtimeUpdatedAt = String(
    state.config?.runtime_session_updated_at ?? '',
  ).trim()
  const reconnectOutcome = model.weixinReconnectOutcome

  return (
    <SectionCard
      title="Weixin Gateway"
      description={
        shouldShowPairing
          ? 'Pair Weixin gateway by QR scan when no existing gateway config is available.'
          : 'Weixin is resolved during signup and remains a separate read-only transport view here.'
      }
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <StatusBadge configured={state.configured} />
        {shouldShowPairing ? (
          <span className="text-xs font-medium uppercase tracking-[0.12em] theme-muted">
            QR pairing enabled
          </span>
        ) : (
          <span className="text-xs font-medium uppercase tracking-[0.12em] theme-muted">
            Read only
          </span>
        )}
      </div>

      {!shouldShowPairing ? (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border theme-border bg-muted px-3 py-2">
          <span className="text-xs theme-text">
            Runtime session: {runtimeState || 'unknown'}
          </span>
          {runtimeUpdatedAt ? (
            <span className="text-xs theme-muted">
              Updated: {runtimeUpdatedAt}
            </span>
          ) : null}
          {runtimeError ? (
            <span className="text-xs text-danger">Error: {runtimeError}</span>
          ) : null}
        </div>
      ) : null}

      {shouldShowPairing ? (
        <div className="space-y-3 rounded-md border theme-border theme-card p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={model.startingWeixinPairing}
              onClick={() => void model.startWeixinPairingQr()}
            >
              {model.startingWeixinPairing
                ? 'Preparing QR...'
                : 'Start Weixin QR Pairing'}
            </Button>
            {model.weixinPairingStatus === 'expired' ? (
              <Button
                type="button"
                variant="ghost"
                disabled={model.startingWeixinPairing}
                onClick={() => void model.startWeixinPairingQr()}
              >
                Start new QR
              </Button>
            ) : null}
            {model.weixinPairingStatus ? (
              <span className="text-xs theme-text">
                Pairing status: {model.weixinPairingStatus}
              </span>
            ) : null}
          </div>

          {model.weixinPairingQrDataUrl ? (
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:gap-4">
              <img
                src={model.weixinPairingQrDataUrl}
                alt="Weixin gateway pairing QR code"
                className="h-40 w-40 rounded-md border theme-border theme-card object-contain"
              />
              <div className="min-w-0 text-xs theme-text">
                <p>Scan this QR with Weixin and confirm in the app.</p>
                {model.weixinPairingState ? (
                  <p className="mt-1 break-all">
                    Session: {model.weixinPairingState}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          {model.weixinPairingMessage ? (
            <p className="text-xs theme-text">{model.weixinPairingMessage}</p>
          ) : null}
        </div>
      ) : null}

      {!shouldShowPairing ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={model.reconnectingWeixin}
            onClick={() => void model.reconnectWeixinGateway()}
          >
            {model.reconnectingWeixin ? 'Reconnecting...' : 'Reconnect gateway'}
          </Button>
        </div>
      ) : null}

      {reconnectOutcome ? (
        <div className="mt-3 rounded-md border theme-border theme-card p-3 text-xs theme-text">
          <div className="flex flex-wrap items-center gap-2">
            <span>Reconnect: {reconnectOutcome.auth_level}</span>
            <span>Reason: {reconnectOutcome.auth_reason}</span>
            <span>Adapter: {reconnectOutcome.adapter_state}</span>
          </div>
          {reconnectOutcome.grace_expires_at_utc ? (
            <p className="mt-1 theme-muted">
              Grace window ends at {reconnectOutcome.grace_expires_at_utc}
            </p>
          ) : null}
          {reconnectOutcome.requires_step_up ? (
            <p className="mt-1 text-danger">
              Step-up required. Start a fresh Weixin QR verification.
            </p>
          ) : null}
        </div>
      ) : null}

      {!shouldShowPairing ? (
        <div className="mt-3 rounded-md border theme-border theme-card p-3">
          <p className="text-xs font-medium theme-text">
            Approve your own Weixin pairing code
          </p>
          <p className="mt-1 text-xs theme-muted">
            If the Weixin bot replied with `hermes pairing approve weixin
            &lt;CODE&gt;`, paste that code here to authorize your current Weixin
            identity without using the CLI.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Input
              value={model.weixinPairingApproveCode}
              placeholder="QCT7G75H"
              onChange={(event) =>
                model.setWeixinPairingApproveCode(
                  event.target.value.toUpperCase(),
                )
              }
              className="sm:max-w-[220px]"
            />
            <Button
              type="button"
              variant="outline"
              disabled={model.approvingWeixinPairing}
              onClick={() => void model.approveWeixinPairingSelf()}
            >
              {model.approvingWeixinPairing ? 'Approving...' : 'Approve code'}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-[0.12em] theme-muted">
            Account ID
          </span>
          <Input
            value={readOnlyValue(model.weixin.accountId)}
            readOnly
            disabled
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-[0.12em] theme-muted">
            Token
          </span>
          <div className="relative">
            <Input
              type={model.showWeixinToken ? 'text' : 'password'}
              value={model.weixin.token || '-'}
              readOnly
              className="pr-10"
            />
            {model.weixin.token ? (
              <button
                type="button"
                onClick={() =>
                  model.setShowWeixinToken((current: boolean) => !current)
                }
                className="absolute right-1 top-1 inline-flex size-8 items-center justify-center rounded-md theme-muted hover:text-foreground"
                title={model.showWeixinToken ? 'Hide token' : 'Show token'}
              >
                <HugeiconsIcon
                  icon={model.showWeixinToken ? ViewOffIcon : ViewIcon}
                  size={16}
                  strokeWidth={1.5}
                />
              </button>
            ) : null}
          </div>
        </label>
        <label className="space-y-1.5 md:col-span-2">
          <span className="text-xs font-medium uppercase tracking-[0.12em] theme-muted">
            Base URL
          </span>
          <Input
            value={readOnlyValue(model.weixin.baseUrl)}
            readOnly
            disabled
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-[0.12em] theme-muted">
            DM Policy
          </span>
          <Input
            value={readOnlyValue(model.weixin.dmPolicy)}
            readOnly
            disabled
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-[0.12em] theme-muted">
            Group Policy
          </span>
          <Input
            value={readOnlyValue(model.weixin.groupPolicy)}
            readOnly
            disabled
          />
        </label>
        <label className="space-y-1.5 md:col-span-2">
          <span className="text-xs font-medium uppercase tracking-[0.12em] theme-muted">
            Allowed Users (DM)
          </span>
          <Input
            value={readOnlyValue(normalizeConfigList(model.weixin.allowFrom))}
            readOnly
            disabled
          />
        </label>
        <label className="space-y-1.5 md:col-span-2">
          <span className="text-xs font-medium uppercase tracking-[0.12em] theme-muted">
            Allowed Groups
          </span>
          <Input
            value={readOnlyValue(
              normalizeConfigList(model.weixin.groupAllowFrom),
            )}
            readOnly
            disabled
          />
        </label>
        <label className="space-y-1.5 md:col-span-2">
          <span className="text-xs font-medium uppercase tracking-[0.12em] theme-muted">
            Home Channel
          </span>
          <Input
            value={readOnlyValue(model.weixin.homeChannel)}
            readOnly
            disabled
          />
        </label>
        <label className="space-y-1.5 md:col-span-2">
          <span className="text-xs font-medium uppercase tracking-[0.12em] theme-muted">
            CDN Base URL
          </span>
          <Input
            value={readOnlyValue(model.weixin.cdnBaseUrl)}
            readOnly
            disabled
          />
        </label>
      </div>

      <div className="mt-4">
        <a
          href={state.docs_url}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-medium theme-text underline underline-offset-2"
        >
          Open setup docs
        </a>
      </div>
    </SectionCard>
  )
}

export function MessagingSettingsScreen() {
  const model = useMessagingSettingsModel()

  return (
    <PageShell
      title="User Accounts"
      description="Manage your account profile, Feishu sign-in pairing, and platform bot pairing from one page."
    >
      {model.loading ? (
        <LoadingState />
      ) : (
        <div className="grid gap-4">
          <UserAccountCard model={model} />
          <WeixinReadOnlyCard model={model} />
          <FeishuAccountLinkCard model={model} />
          <FeishuBotConfigCard model={model} />
        </div>
      )}
    </PageShell>
  )
}

export function MessagingAccountLinkingScreen() {
  return <MessagingSettingsScreen />
}

export function MessagingPlatformSettingsScreen() {
  return <MessagingSettingsScreen />
}
