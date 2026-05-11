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
}

type WeixinReconnectResponse = PlatformState & {
  reconnect_applied?: boolean
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
  let payload: (T & { detail?: string; error?: string }) | null = null

  if (text && isJson) {
    try {
      payload = JSON.parse(text) as T & { detail?: string; error?: string }
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
      <header className="rounded-2xl border theme-border theme-card2 p-5 shadow-sm">
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
    <section className="rounded-2xl border theme-border theme-card2 p-5 shadow-sm">
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
      className="inline-flex items-center rounded-lg border theme-border px-3 py-2 text-sm font-medium theme-text transition-colors hover:bg-muted"
    >
      {label}
    </Link>
  )
}

function useMessagingSettingsModel() {
  const [platforms, setPlatforms] = useState<Record<PlatformId, PlatformState>>({
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
  })
  const [loading, setLoading] = useState(true)
  const [savingPlatform, setSavingPlatform] = useState<PlatformId | null>(null)
  const [validatingPlatform, setValidatingPlatform] = useState<PlatformId | null>(
    null,
  )
  const [authMe, setAuthMe] = useState<AuthContextResponse | null>(null)
  const [startingFeishuLink, setStartingFeishuLink] = useState(false)
  const [feishuLinkState, setFeishuLinkState] = useState('')
  const [feishuLinkStatus, setFeishuLinkStatus] = useState<
    'pending' | 'linked' | 'expired' | 'failed' | ''
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
  const [validationMessage, setValidationMessage] = useState<Record<PlatformId, string>>({
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
            feishuConfig.connection_mode === 'webhook' ? 'webhook' : 'websocket',
        })

        const weixinConfig = next.weixin.config
        setWeixin({
          accountId: String(weixinConfig.account_id ?? ''),
          token: String(weixinConfig.token ?? ''),
          baseUrl: String(
            weixinConfig.base_url ?? 'https://ilinkai.weixin.qq.com',
          ),
          cdnBaseUrl: String(weixinConfig.cdn_base_url ?? ''),
          dmPolicy: (
            ['open', 'allowlist', 'disabled', 'pairing'].includes(
              String(weixinConfig.dm_policy),
            )
              ? String(weixinConfig.dm_policy)
              : 'pairing'
          ) as WeixinDmPolicy,
          allowFrom: Array.isArray(weixinConfig.allow_from)
            ? (weixinConfig.allow_from as string[]).join(', ')
            : String(weixinConfig.allow_from ?? ''),
          groupPolicy: (
            ['open', 'allowlist', 'disabled'].includes(
              String(weixinConfig.group_policy),
            )
              ? String(weixinConfig.group_policy)
              : 'disabled'
          ) as WeixinGroupPolicy,
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
        toast('This account is already linked with Feishu.', { type: 'success' })
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

  useEffect(() => {
    if (!feishuLinkState || feishuLinkStatus !== 'pending') {
      return
    }
    const timer = window.setTimeout(() => {
      void pollFeishuLinkStatus(feishuLinkState)
    }, 1500)
    return () => window.clearTimeout(timer)
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

  async function startWeixinPairingQr() {
    if (platforms.weixin.configured) {
      return
    }
    setStartingWeixinPairing(true)
    setWeixinPairingMessage('')
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
        setWeixinPairingMessage('QR code expired. Start a new pairing session.')
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
      setWeixinPairingStatus('failed')
      setWeixinPairingMessage(message)
    }
  }

  useEffect(() => {
    if (!weixinPairingState || !shouldPollWeixinPairingStatus(weixinPairingStatus)) {
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
      toast(`${platformTitle(platform)} validation passed.`, { type: 'success' })
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

      const result = await requestJson<PlatformState & { gateway_applied?: boolean }>(
        `/messaging/${platform}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      )

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
    try {
      const response = await requestJson<WeixinReconnectResponse>(
        '/messaging/weixin/reconnect',
        {
          method: 'POST',
        },
      )
      setPlatforms((current) => ({
        ...current,
        weixin: {
          ...current.weixin,
          ...response,
          platform: 'weixin',
        },
      }))
      toast('Weixin gateway reconnect applied.', { type: 'success' })
      await loadPlatforms()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to reconnect Weixin gateway.'
      toast(message, { type: 'error' })
    } finally {
      setReconnectingWeixin(false)
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
    validate,
    validatingPlatform,
    validationMessage,
    weixin,
    weixinPairingMessage,
    weixinPairingQrDataUrl,
    weixinPairingState,
    weixinPairingStatus,
  }
}

function readOnlyValue(value: string): string {
  return value.trim() || '-'
}

function LoadingState() {
  return (
    <div className="rounded-2xl border theme-border theme-card2 p-5 text-sm theme-text">
      Loading messaging configuration...
    </div>
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
      <div className="rounded-lg border theme-border theme-card p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={model.startingFeishuLink || Boolean(linkedOpenId)}
            onClick={() => void model.startFeishuLinkQr()}
          >
            {model.startingFeishuLink ? 'Preparing QR...' : 'Link Feishu Login'}
          </Button>
          {linkedOpenId ? (
            <span className="text-xs text-success">
              Linked open_id: {linkedOpenId}
            </span>
          ) : (
            <span className="text-xs theme-text">No Feishu account linked yet.</span>
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
            className="h-9 rounded-lg border theme-border theme-card px-3 text-sm theme-text"
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
            className="h-9 rounded-lg border theme-border theme-card px-3 text-sm theme-text"
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
  const shouldShowPairing = !state.configured
  const runtimeState = String(state.config?.runtime_session_state ?? '').trim()
  const runtimeError = String(
    state.config?.runtime_session_error ?? state.last_error ?? '',
  ).trim()
  const runtimeUpdatedAt = String(
    state.config?.runtime_session_updated_at ?? '',
  ).trim()

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
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border theme-border bg-muted px-3 py-2">
          <span className="text-xs theme-text">
            Runtime session: {runtimeState || 'unknown'}
          </span>
          {runtimeUpdatedAt ? (
            <span className="text-xs theme-muted">Updated: {runtimeUpdatedAt}</span>
          ) : null}
          {runtimeError ? (
            <span className="text-xs text-danger">Error: {runtimeError}</span>
          ) : null}
        </div>
      ) : null}

      {shouldShowPairing ? (
        <div className="space-y-3 rounded-lg border theme-border theme-card p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={model.startingWeixinPairing}
              onClick={() => void model.startWeixinPairingQr()}
            >
              {model.startingWeixinPairing ? 'Preparing QR...' : 'Start Weixin QR Pairing'}
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
                  <p className="mt-1 break-all">Session: {model.weixinPairingState}</p>
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

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-[0.12em] theme-muted">
            Account ID
          </span>
          <Input value={readOnlyValue(model.weixin.accountId)} readOnly disabled />
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
          <Input value={readOnlyValue(model.weixin.baseUrl)} readOnly disabled />
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-[0.12em] theme-muted">
            DM Policy
          </span>
          <Input value={readOnlyValue(model.weixin.dmPolicy)} readOnly disabled />
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
            value={readOnlyValue(normalizeConfigList(model.weixin.groupAllowFrom))}
            readOnly
            disabled
          />
        </label>
        <label className="space-y-1.5 md:col-span-2">
          <span className="text-xs font-medium uppercase tracking-[0.12em] theme-muted">
            Home Channel
          </span>
          <Input value={readOnlyValue(model.weixin.homeChannel)} readOnly disabled />
        </label>
        <label className="space-y-1.5 md:col-span-2">
          <span className="text-xs font-medium uppercase tracking-[0.12em] theme-muted">
            CDN Base URL
          </span>
          <Input value={readOnlyValue(model.weixin.cdnBaseUrl)} readOnly disabled />
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
      title="Messaging Setup"
      description="Login pairing and bot pairing are separated now. Choose the page that matches the job you are doing."
    >
      {model.loading ? <LoadingState /> : null}

      {!model.loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <SectionCard
            title="Feishu Login"
            description="Per-user sign-in pairing for Feishu login. This is not bot setup."
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 rounded-xl border theme-border theme-card p-3">
                <div>
                  <p className="text-sm font-medium theme-text">
                    Feishu login status
                  </p>
                  <p className="text-xs theme-text">
                    {model.authMe?.user?.feishu_open_id
                      ? `Linked: ${model.authMe.user.feishu_open_id}`
                      : 'Not linked'}
                  </p>
                </div>
                <StatusBadge
                  configured={Boolean(model.authMe?.user?.feishu_open_id)}
                />
              </div>
              <SettingsLink
                to="/settings/messaging-accounts"
                label="Open Feishu login"
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Platform Bot Pairing"
            description="Organization-scoped bot credentials for Feishu and transport status for Weixin."
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 rounded-xl border theme-border theme-card p-3">
                <div>
                  <p className="text-sm font-medium theme-text">
                    Feishu bot configuration
                  </p>
                  <p className="text-xs theme-text">
                    Shared across users in the same Feishu organization.
                  </p>
                </div>
                <StatusBadge configured={model.platforms.feishu.configured} />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl border theme-border theme-card p-3">
                <div>
                  <p className="text-sm font-medium theme-text">
                    Weixin gateway
                  </p>
                  <p className="text-xs theme-text">
                    Signup-resolved transport settings in read-only mode.
                  </p>
                </div>
                <StatusBadge configured={model.platforms.weixin.configured} />
              </div>
              <SettingsLink
                to="/settings/messaging-platforms"
                label="Open platform config"
              />
            </div>
          </SectionCard>
        </div>
      ) : null}
    </PageShell>
  )
}

export function MessagingAccountLinkingScreen() {
  const model = useMessagingSettingsModel()

  return (
    <PageShell
      title="Feishu Login"
      description="This page is only for Feishu sign-in pairing. Bot credentials and shared gateway setup live on a separate page."
    >
      <div className="flex justify-end">
        <SettingsLink
          to="/settings/messaging-platforms"
          label="Go to platform config"
        />
      </div>
      {model.loading ? <LoadingState /> : <FeishuAccountLinkCard model={model} />}
    </PageShell>
  )
}

export function MessagingPlatformSettingsScreen() {
  const model = useMessagingSettingsModel()

  return (
    <PageShell
      title="Messaging Platform Config"
      description="This page is for organization and gateway pairing. User login linking is kept separate."
    >
      <div className="flex justify-end">
        <SettingsLink
          to="/settings/messaging-accounts"
          label="Go to Feishu login"
        />
      </div>
      {model.loading ? (
        <LoadingState />
      ) : (
        <div className="grid gap-4">
          <FeishuBotConfigCard model={model} />
          <WeixinReadOnlyCard model={model} />
        </div>
      )}
    </PageShell>
  )
}
