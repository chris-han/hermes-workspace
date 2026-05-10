import { useEffect, useMemo, useState } from 'react'
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

type WeixinQrStartResponse = {
  qrcode: string
  qrcode_url?: string
  qr_scan_data: string
  base_url: string
  bot_type: string
}

type AuthMeResponse = {
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

type WeixinQrState = {
  qrcode: string
  qrcodeUrl: string
  scanData: string
  baseUrl: string
  status: string
  redirectBaseUrl: string
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
      throw new Error('API returned HTML instead of JSON. Please check auth session or proxy route handling.')
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

function platformDescription(id: PlatformId): string {
  if (id === 'feishu') {
    return 'Configure App ID/App Secret and connection mode for Feishu or Lark messaging.'
  }
  return 'View the resolved Weixin configuration that was completed during signup.'
}

function StatusBadge({ configured }: { configured: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide',
        configured
          ? 'bg-emerald-200/70 text-emerald-900'
          : 'bg-primary-200 text-primary-700',
      )}
    >
      {configured ? 'Configured' : 'Not configured'}
    </span>
  )
}

export function MessagingSettingsScreen() {
  const [platforms, setPlatforms] = useState<Record<PlatformId, PlatformState>>({
    feishu: {
      platform: 'feishu',
      configured: false,
      docs_url: 'https://hermes-agent.nousresearch.com/docs/user-guide/messaging/feishu',
      config: {},
    },
    weixin: {
      platform: 'weixin',
      configured: false,
      docs_url: 'https://hermes-agent.nousresearch.com/docs/user-guide/messaging/weixin',
      config: {},
    },
  })
  const [loading, setLoading] = useState(true)
  const [savingPlatform, setSavingPlatform] = useState<PlatformId | null>(null)
  const [validatingPlatform, setValidatingPlatform] = useState<PlatformId | null>(null)

  const [authMe, setAuthMe] = useState<AuthMeResponse | null>(null)
  const [startingFeishuLink, setStartingFeishuLink] = useState(false)
  const [feishuLinkState, setFeishuLinkState] = useState('')
  const [feishuLinkStatus, setFeishuLinkStatus] = useState<'pending' | 'linked' | 'expired' | 'failed' | ''>('')
  const [feishuLinkMessage, setFeishuLinkMessage] = useState('')
  const [feishuLinkAuthorizeUrl, setFeishuLinkAuthorizeUrl] = useState('')
  const [feishuLinkQrDataUrl, setFeishuLinkQrDataUrl] = useState('')

  const [feishu, setFeishu] = useState<FeishuDraft>(EMPTY_FEISHU)
  const [weixin, setWeixin] = useState<WeixinDraft>(EMPTY_WEIXIN)
  const [showWeixinToken, setShowWeixinToken] = useState(false)

  const [validationMessage, setValidationMessage] = useState<Record<PlatformId, string>>({
    feishu: '',
    weixin: '',
  })

  async function loadPlatforms() {
    setLoading(true)
    try {
      const data = await requestJson<PlatformsResponse>('/messaging/platforms')
      const next: Record<PlatformId, PlatformState> = {
        feishu:
          data.platforms.find((item) => item.platform === 'feishu') ??
          platforms.feishu,
        weixin:
          data.platforms.find((item) => item.platform === 'weixin') ??
          platforms.weixin,
      }
      setPlatforms(next)

      const feishuConfig = next.feishu.config
      setFeishu({
        appId: String(feishuConfig.app_id ?? ''),
        appSecret: '',
        domain:
          feishuConfig.domain === 'lark' ? 'lark' : 'feishu',
        connectionMode:
          feishuConfig.connection_mode === 'webhook'
            ? 'webhook'
            : 'websocket',
      })

      const weixinConfig = next.weixin.config
      setWeixin({
        accountId: String(weixinConfig.account_id ?? ''),
        token: String(weixinConfig.token ?? ''),
        baseUrl: String(weixinConfig.base_url ?? 'https://ilinkai.weixin.qq.com'),
        cdnBaseUrl: String(weixinConfig.cdn_base_url ?? ''),
        dmPolicy: (['open', 'allowlist', 'disabled', 'pairing'].includes(String(weixinConfig.dm_policy))
          ? String(weixinConfig.dm_policy)
          : 'pairing') as WeixinDmPolicy,
        allowFrom: Array.isArray(weixinConfig.allow_from)
          ? (weixinConfig.allow_from as string[]).join(', ')
          : String(weixinConfig.allow_from ?? ''),
        groupPolicy: (['open', 'allowlist', 'disabled'].includes(String(weixinConfig.group_policy))
          ? String(weixinConfig.group_policy)
          : 'disabled') as WeixinGroupPolicy,
        groupAllowFrom: Array.isArray(weixinConfig.group_allow_from)
          ? (weixinConfig.group_allow_from as string[]).join(', ')
          : String(weixinConfig.group_allow_from ?? ''),
        homeChannel: String(weixinConfig.home_channel ?? ''),
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load messaging settings.'
      toast(message, { type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  async function loadAuthMe() {
    try {
      const data = await requestJson<AuthMeResponse>('/auth/me')
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
      const response = await requestJson<FeishuLinkStartResponse>('/auth/feishu/link/start', {
        method: 'POST',
      })

      if (response.status === 'already_linked') {
        setFeishuLinkState('')
        setFeishuLinkStatus('linked')
        setFeishuLinkAuthorizeUrl('')
        setFeishuLinkMessage('This account is already linked with Feishu.')
        toast('This account is already linked with Feishu.', { type: 'success' })
        await loadAuthMe()
        return
      }

      if (!response.state || !response.authorize_url) {
        throw new Error('Failed to start Feishu link session.')
      }

      setFeishuLinkState(response.state)
      setFeishuLinkAuthorizeUrl(response.authorize_url)
      setFeishuLinkStatus('pending')
      setFeishuLinkMessage('Scan this QR code with Feishu to link your account.')
      toast('Feishu link QR generated.', { type: 'success' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start Feishu link flow.'
      toast(message, { type: 'error' })
    } finally {
      setStartingFeishuLink(false)
    }
  }

  async function pollFeishuLinkStatus(state: string) {
    try {
      const response = await requestJson<FeishuLinkStatusResponse>(`/auth/feishu/link/status?state=${encodeURIComponent(state)}`)
      setFeishuLinkStatus(response.status)
      setFeishuLinkMessage(response.message || '')

      if (response.status === 'linked') {
        toast('Feishu account linked successfully.', { type: 'success' })
        await loadAuthMe()
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to check Feishu link status.'
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

  async function validate(platform: PlatformId) {
    setValidatingPlatform(platform)
    try {
      const payload =
        platform === 'feishu'
          ? {
              config: {
                app_id: feishu.appId.trim(),
                app_secret: feishu.appSecret.trim(),
                domain: feishu.domain,
                connection_mode: feishu.connectionMode,
              },
            }
          : {
              config: {
                account_id: weixin.accountId.trim(),
                token: weixin.token.trim(),
                base_url: weixin.baseUrl.trim() || 'https://ilinkai.weixin.qq.com',
                ...(weixin.cdnBaseUrl.trim() ? { cdn_base_url: weixin.cdnBaseUrl.trim() } : {}),
                dm_policy: weixin.dmPolicy,
                ...(weixin.dmPolicy === 'allowlist' && weixin.allowFrom.trim()
                  ? { allow_from: weixin.allowFrom.split(',').map((s) => s.trim()).filter(Boolean) }
                  : {}),
                group_policy: weixin.groupPolicy,
                ...(weixin.groupPolicy === 'allowlist' && weixin.groupAllowFrom.trim()
                  ? { group_allow_from: weixin.groupAllowFrom.split(',').map((s) => s.trim()).filter(Boolean) }
                  : {}),
                ...(weixin.homeChannel.trim() ? { home_channel: weixin.homeChannel.trim() } : {}),
              },
            }

      const response = await requestJson<ValidateResponse>(`/messaging/${platform}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      setValidationMessage((current) => ({
        ...current,
        [platform]: response.summary,
      }))
      toast(`${platformTitle(platform)} validation passed.`, { type: 'success' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Validation failed.'
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
      const payload =
        platform === 'feishu'
          ? {
              config: {
                app_id: feishu.appId.trim(),
                app_secret: feishu.appSecret.trim(),
                domain: feishu.domain,
                connection_mode: feishu.connectionMode,
              },
            }
          : {
              config: {
                account_id: weixin.accountId.trim(),
                token: weixin.token.trim(),
                base_url: weixin.baseUrl.trim() || 'https://ilinkai.weixin.qq.com',
                ...(weixin.cdnBaseUrl.trim() ? { cdn_base_url: weixin.cdnBaseUrl.trim() } : {}),
                dm_policy: weixin.dmPolicy,
                ...(weixin.dmPolicy === 'allowlist' && weixin.allowFrom.trim()
                  ? { allow_from: weixin.allowFrom.split(',').map((s) => s.trim()).filter(Boolean) }
                  : {}),
                group_policy: weixin.groupPolicy,
                ...(weixin.groupPolicy === 'allowlist' && weixin.groupAllowFrom.trim()
                  ? { group_allow_from: weixin.groupAllowFrom.split(',').map((s) => s.trim()).filter(Boolean) }
                  : {}),
                ...(weixin.homeChannel.trim() ? { home_channel: weixin.homeChannel.trim() } : {}),
              },
            }

      const result = await requestJson<PlatformState & { gateway_applied?: boolean }>(`/messaging/${platform}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const gatewayNote = result.gateway_applied
        ? ' Gateway config updated — restart gateway to activate changes.'
        : ''
      toast(`${platformTitle(platform)} configuration saved.${gatewayNote}`, { type: 'success' })
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
      toast(`${platformTitle(platform)} configuration removed.`, { type: 'success' })
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

  function readOnlyValue(value: string): string {
    return value.trim() || '-'
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 pt-6 pb-10 sm:px-6">
      <header className="rounded-2xl border border-primary-200 bg-primary-50/80 p-5 shadow-sm">
        <h1 className="text-xl font-semibold text-primary-900">Messaging Gateway Setup</h1>
        <p className="mt-1 text-sm text-primary-700">
          Configure per-user messaging credentials for Feishu/Lark and review the resolved Weixin configuration.
        </p>
      </header>

      {loading ? (
        <div className="rounded-2xl border border-primary-200 bg-primary-50/70 p-5 text-sm text-primary-700">
          Loading messaging configuration...
        </div>
      ) : (
        <div className="grid gap-4">
          {(Object.keys(platforms) as Array<PlatformId>).map((platform) => {
            const state = platforms[platform]
            const isFeishu = platform === 'feishu'
            const validating = validatingPlatform === platform
            const saving = savingPlatform === platform
            const canValidate = canValidateFeishu
            const canSave = canValidateFeishu

            return (
              <section key={platform} className="rounded-2xl border border-primary-200 bg-primary-50/70 p-5 shadow-sm">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-semibold text-primary-900">{platformTitle(platform)}</h2>
                    <p className="text-sm text-primary-700">{platformDescription(platform)}</p>
                  </div>
                  <StatusBadge configured={state.configured} />
                </div>

                {isFeishu ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-1.5">
                      <span className="text-xs font-medium uppercase tracking-[0.12em] text-primary-600">App ID</span>
                      <Input
                        value={feishu.appId}
                        placeholder="cli_xxx"
                        onChange={(event) =>
                          setFeishu((current) => ({
                            ...current,
                            appId: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-xs font-medium uppercase tracking-[0.12em] text-primary-600">App Secret</span>
                      <Input
                        type="password"
                        value={feishu.appSecret}
                        placeholder={state.configured ? 'Re-enter to update' : 'secret_xxx'}
                        onChange={(event) =>
                          setFeishu((current) => ({
                            ...current,
                            appSecret: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-xs font-medium uppercase tracking-[0.12em] text-primary-600">Domain</span>
                      <select
                        value={feishu.domain}
                        onChange={(event) =>
                          setFeishu((current) => ({
                            ...current,
                            domain: event.target.value as 'feishu' | 'lark',
                          }))
                        }
                        className="h-9 rounded-lg border border-primary-200 bg-surface px-3 text-sm text-primary-900"
                      >
                        <option value="feishu">Feishu</option>
                        <option value="lark">Lark</option>
                      </select>
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-xs font-medium uppercase tracking-[0.12em] text-primary-600">
                        Connection Mode
                      </span>
                      <select
                        value={feishu.connectionMode}
                        onChange={(event) =>
                          setFeishu((current) => ({
                            ...current,
                            connectionMode: event.target.value as 'websocket' | 'webhook',
                          }))
                        }
                        className="h-9 rounded-lg border border-primary-200 bg-surface px-3 text-sm text-primary-900"
                      >
                        <option value="websocket">WebSocket</option>
                        <option value="webhook">Webhook</option>
                      </select>
                    </label>

                    <div className="md:col-span-2 rounded-lg border border-primary-200 bg-surface p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={startingFeishuLink || Boolean(authMe?.user?.feishu_open_id)}
                          onClick={() => void startFeishuLinkQr()}
                        >
                          {startingFeishuLink ? 'Preparing QR...' : 'Link Feishu Account (QR)'}
                        </Button>
                        {authMe?.user?.feishu_open_id ? (
                          <span className="text-xs text-emerald-700">Linked open_id: {authMe.user.feishu_open_id}</span>
                        ) : null}
                        {feishuLinkStatus ? <span className="text-xs text-primary-700">Link status: {feishuLinkStatus}</span> : null}
                      </div>

                      {feishuLinkAuthorizeUrl && !authMe?.user?.feishu_open_id ? (
                        <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-start md:gap-4">
                          <img
                            src={feishuLinkQrDataUrl || ''}
                            alt="Feishu account linking QR code"
                            className="h-40 w-40 rounded-md border border-primary-200 bg-white object-contain"
                          />
                          <div className="min-w-0 text-xs text-primary-700">
                            <p>Scan this QR with Feishu and approve authorization.</p>
                            <p className="mt-1 break-all">
                              OAuth URL:{' '}
                              <a className="underline" href={feishuLinkAuthorizeUrl} target="_blank" rel="noreferrer">
                                Open link
                              </a>
                            </p>
                          </div>
                        </div>
                      ) : null}

                      {feishuLinkMessage ? <p className="mt-2 text-xs text-primary-700">{feishuLinkMessage}</p> : null}
                    </div>

                    {state.configured ? (
                      <p className="mt-1 text-xs text-primary-600 md:col-span-2">
                        Existing credentials are masked. Re-enter the secret value before validating or saving updates.
                      </p>
                    ) : null}

                    {validationMessage[platform] ? (
                      <p className="mt-1 text-xs text-primary-700 md:col-span-2">{validationMessage[platform]}</p>
                    ) : null}

                    <div className="md:col-span-2 flex flex-wrap items-center gap-2">
                      <Button type="button" variant="outline" disabled={!canValidate || validating || saving} onClick={() => void validate(platform)}>
                        {validating ? 'Validating...' : 'Validate'}
                      </Button>
                      <Button type="button" disabled={!canSave || saving || validating} onClick={() => void save(platform)}>
                        {saving ? 'Saving...' : 'Save'}
                      </Button>
                      <Button type="button" variant="ghost" disabled={saving || validating || !state.configured} onClick={() => void remove(platform)}>
                        Remove
                      </Button>
                      <a href={state.docs_url} target="_blank" rel="noreferrer" className="ml-auto text-xs font-medium text-primary-700 underline underline-offset-2">
                        Open setup docs
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-lg border border-primary-200 bg-surface p-3">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-primary-700">
                        Weixin configuration is resolved during signup and shown here in read-only form.
                      </p>
                      <span className="text-xs font-medium uppercase tracking-[0.12em] text-primary-500">Read only</span>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="space-y-1.5">
                        <span className="text-xs font-medium uppercase tracking-[0.12em] text-primary-600">Account ID</span>
                        <Input value={readOnlyValue(weixin.accountId)} readOnly disabled />
                      </label>
                      <label className="space-y-1.5">
                        <span className="text-xs font-medium uppercase tracking-[0.12em] text-primary-600">Token</span>
                        <div className="relative">
                          <Input
                            type={showWeixinToken ? 'text' : 'password'}
                            value={weixin.token || '-'}
                            readOnly
                            className="pr-10"
                          />
                          {weixin.token ? (
                            <button
                              type="button"
                              onClick={() => setShowWeixinToken((current) => !current)}
                              className="absolute right-1 top-1 inline-flex size-8 items-center justify-center rounded-md text-primary-400 hover:text-primary-600"
                              title={showWeixinToken ? 'Hide token' : 'Show token'}
                            >
                              <HugeiconsIcon
                                icon={showWeixinToken ? ViewOffIcon : ViewIcon}
                                size={16}
                                strokeWidth={1.5}
                              />
                            </button>
                          ) : null}
                        </div>
                      </label>
                      <label className="space-y-1.5 md:col-span-2">
                        <span className="text-xs font-medium uppercase tracking-[0.12em] text-primary-600">Base URL</span>
                        <Input value={readOnlyValue(weixin.baseUrl)} readOnly disabled />
                      </label>
                      <label className="space-y-1.5">
                        <span className="text-xs font-medium uppercase tracking-[0.12em] text-primary-600">DM Policy</span>
                        <Input value={readOnlyValue(weixin.dmPolicy)} readOnly disabled />
                      </label>
                      <label className="space-y-1.5">
                        <span className="text-xs font-medium uppercase tracking-[0.12em] text-primary-600">Group Policy</span>
                        <Input value={readOnlyValue(weixin.groupPolicy)} readOnly disabled />
                      </label>
                      <label className="space-y-1.5 md:col-span-2">
                        <span className="text-xs font-medium uppercase tracking-[0.12em] text-primary-600">Allowed Users (DM)</span>
                        <Input value={readOnlyValue(normalizeConfigList(weixin.allowFrom))} readOnly disabled />
                      </label>
                      <label className="space-y-1.5 md:col-span-2">
                        <span className="text-xs font-medium uppercase tracking-[0.12em] text-primary-600">Allowed Groups</span>
                        <Input value={readOnlyValue(normalizeConfigList(weixin.groupAllowFrom))} readOnly disabled />
                      </label>
                      <label className="space-y-1.5 md:col-span-2">
                        <span className="text-xs font-medium uppercase tracking-[0.12em] text-primary-600">Home Channel</span>
                        <Input value={readOnlyValue(weixin.homeChannel)} readOnly disabled />
                      </label>
                      <label className="space-y-1.5 md:col-span-2">
                        <span className="text-xs font-medium uppercase tracking-[0.12em] text-primary-600">CDN Base URL</span>
                        <Input value={readOnlyValue(weixin.cdnBaseUrl)} readOnly disabled />
                      </label>
                    </div>

                    {validationMessage[platform] ? <p className="mt-3 text-xs text-primary-700">{validationMessage[platform]}</p> : null}

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <a href={state.docs_url} target="_blank" rel="noreferrer" className="text-xs font-medium text-primary-700 underline underline-offset-2">
                        Open setup docs
                      </a>
                    </div>
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
