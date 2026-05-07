import { useEffect, useMemo, useState } from 'react'
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

type WeixinQrStatusResponse = {
  status: string
  base_url: string
  redirect_base_url?: string
  credentials?: {
    account_id: string
    token: string
    base_url: string
    user_id?: string
  }
  raw: Record<string, unknown>
}

type PairingPendingEntry = {
  code: string
  user_id: string
  user_name: string
  age_minutes: number
}

type PairingPendingResponse = {
  platform: PlatformId
  pending: PairingPendingEntry[]
}

type PairingApproveResponse = {
  ok: boolean
  platform: PlatformId
  user_id?: string
  user_name?: string
  message: string
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
  return 'Configure account ID and bot token for Weixin iLink messaging.'
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
  const [requestingWeixinQr, setRequestingWeixinQr] = useState(false)
  const [weixinQr, setWeixinQr] = useState<WeixinQrState | null>(null)
  const [weixinQrDataUrl, setWeixinQrDataUrl] = useState('')
  const [weixinPairingPending, setWeixinPairingPending] = useState<PairingPendingEntry[]>([])
  const [loadingWeixinPairing, setLoadingWeixinPairing] = useState(false)
  const [approvingWeixinPairing, setApprovingWeixinPairing] = useState(false)
  const [approvingWeixinPairingCode, setApprovingWeixinPairingCode] = useState('')

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
        token: '',
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

  const canValidateWeixin = useMemo(() => {
    return weixin.accountId.trim() !== '' && weixin.token.trim() !== ''
  }, [weixin])

  const isWeixinDirty = useMemo(() => {
    const saved = platforms.weixin.config
    const savedAccountId = String(saved.account_id ?? '').trim()
    const savedBaseUrl = String(saved.base_url ?? 'https://ilinkai.weixin.qq.com').trim()
    const savedCdnBaseUrl = String(saved.cdn_base_url ?? '').trim()
    const savedDmPolicy = (['open', 'allowlist', 'disabled', 'pairing'].includes(String(saved.dm_policy))
      ? String(saved.dm_policy)
      : 'pairing') as WeixinDmPolicy
    const savedGroupPolicy = (['open', 'allowlist', 'disabled'].includes(String(saved.group_policy))
      ? String(saved.group_policy)
      : 'disabled') as WeixinGroupPolicy
    const savedAllowFrom = normalizeConfigList(saved.allow_from)
    const savedGroupAllowFrom = normalizeConfigList(saved.group_allow_from)
    const savedHomeChannel = String(saved.home_channel ?? '').trim()

    if (weixin.token.trim() !== '') {
      return true
    }

    return (
      weixin.accountId.trim() !== savedAccountId ||
      (weixin.baseUrl.trim() || 'https://ilinkai.weixin.qq.com') !== savedBaseUrl ||
      weixin.cdnBaseUrl.trim() !== savedCdnBaseUrl ||
      weixin.dmPolicy !== savedDmPolicy ||
      normalizeCommaSeparated(weixin.allowFrom) !== savedAllowFrom ||
      weixin.groupPolicy !== savedGroupPolicy ||
      normalizeCommaSeparated(weixin.groupAllowFrom) !== savedGroupAllowFrom ||
      weixin.homeChannel.trim() !== savedHomeChannel
    )
  }, [platforms.weixin.config, weixin])

  const weixinQrPolling = useMemo(() => {
    if (!weixinQr) {
      return false
    }
    return ['wait', 'scaned', 'scaned_but_redirect'].includes(weixinQr.status)
  }, [weixinQr])

  async function requestWeixinQrCode() {
    setRequestingWeixinQr(true)
    try {
      const response = await requestJson<WeixinQrStartResponse>('/messaging/weixin/qrcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base_url: weixin.baseUrl.trim() || 'https://ilinkai.weixin.qq.com',
          bot_type: '3',
        }),
      })

      setWeixinQr({
        qrcode: response.qrcode,
        qrcodeUrl: response.qrcode_url ?? '',
        scanData: response.qr_scan_data,
        baseUrl: response.base_url,
        status: 'wait',
        redirectBaseUrl: '',
      })
      setValidationMessage((current) => ({
        ...current,
        weixin: 'QR code ready. Scan it with WeChat and confirm on your phone.',
      }))
      toast('Weixin QR code generated.', { type: 'success' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate Weixin QR code.'
      toast(message, { type: 'error' })
    } finally {
      setRequestingWeixinQr(false)
    }
  }

  async function loadWeixinPairingPending() {
    setLoadingWeixinPairing(true)
    try {
      const response = await requestJson<PairingPendingResponse>('/messaging/weixin/pairing/pending')
      setWeixinPairingPending(response.pending ?? [])
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load pairing requests.'
      toast(message, { type: 'error' })
    } finally {
      setLoadingWeixinPairing(false)
    }
  }

  async function approveWeixinPairingCode(code: string) {
    const normalizedCode = code.trim().toUpperCase()
    if (!normalizedCode) {
      toast('Pairing code is missing for this request.', { type: 'error' })
      return
    }

    setApprovingWeixinPairingCode(normalizedCode)
    setApprovingWeixinPairing(true)
    try {
      const result = await requestJson<PairingApproveResponse>('/messaging/weixin/pairing/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: normalizedCode }),
      })

      const who = result.user_name || result.user_id || 'user'
      toast(`Pairing approved for ${who}.`, { type: 'success' })
      await loadWeixinPairingPending()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to approve pairing code.'
      toast(message, { type: 'error' })
    } finally {
      setApprovingWeixinPairing(false)
      setApprovingWeixinPairingCode('')
    }
  }

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

  async function pollWeixinQrCode(currentQr: WeixinQrState) {
    try {
      const statusPath = new URLSearchParams({
        qrcode: currentQr.qrcode,
        base_url: currentQr.redirectBaseUrl || currentQr.baseUrl,
      })
      const response = await requestJson<WeixinQrStatusResponse>(`/messaging/weixin/qrcode/status?${statusPath.toString()}`)

      setWeixinQr((existing) => {
        if (!existing || existing.qrcode !== currentQr.qrcode) {
          return existing
        }
        return {
          ...existing,
          status: response.status,
          baseUrl: response.base_url || existing.baseUrl,
          redirectBaseUrl: response.redirect_base_url ?? existing.redirectBaseUrl,
        }
      })

      if (response.status === 'scaned') {
        setValidationMessage((current) => ({
          ...current,
          weixin: 'QR scanned. Confirm login in WeChat.',
        }))
      }

      if (response.status === 'confirmed' && response.credentials) {
        setWeixin((current) => ({
          ...current,
          accountId: response.credentials!.account_id ?? '',
          token: response.credentials!.token ?? '',
          baseUrl: response.credentials!.base_url ?? currentQr.baseUrl,
        }))
        setValidationMessage((current) => ({
          ...current,
          weixin: 'QR login confirmed. Credentials loaded. Save settings, then refresh pending requests and approve pairing codes.',
        }))
        toast('Weixin QR login confirmed. Credentials auto-filled.', { type: 'success' })
      }

      if (response.status === 'expired') {
        setValidationMessage((current) => ({
          ...current,
          weixin: 'QR code expired. Generate a new code to continue.',
        }))
        toast('Weixin QR code expired.', { type: 'error' })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to poll Weixin QR status.'
      setValidationMessage((current) => ({
        ...current,
        weixin: message,
      }))
    }
  }

  useEffect(() => {
    if (!weixinQrPolling || !weixinQr) {
      return
    }
    const timer = window.setTimeout(() => {
      void pollWeixinQrCode(weixinQr)
    }, 1500)
    return () => window.clearTimeout(timer)
  }, [weixinQr, weixinQrPolling])

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
    if (weixin.dmPolicy !== 'pairing') {
      setWeixinPairingPending([])
      return
    }
    void loadWeixinPairingPending()
  }, [weixin.dmPolicy])

  useEffect(() => {
    let cancelled = false

    async function buildWeixinQrDataUrl() {
      if (!weixinQr?.scanData) {
        setWeixinQrDataUrl('')
        return
      }
      try {
        const dataUrl = await QRCode.toDataURL(weixinQr.scanData, {
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

    void buildWeixinQrDataUrl()
    return () => {
      cancelled = true
    }
  }, [weixinQr?.scanData])

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

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 pt-6 pb-10 sm:px-6">
      <header className="rounded-2xl border border-primary-200 bg-primary-50/80 p-5 shadow-sm">
        <h1 className="text-xl font-semibold text-primary-900">Messaging Gateway Setup</h1>
        <p className="mt-1 text-sm text-primary-700">
          Configure per-user messaging credentials for Feishu/Lark and Weixin. Secrets are stored encrypted and
          returned masked.
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
            const canValidate = isFeishu ? canValidateFeishu : canValidateWeixin
            const canSave = isFeishu
              ? canValidateFeishu
              : (state.configured || canValidateWeixin) && isWeixinDirty

            return (
              <section
                key={platform}
                className="rounded-2xl border border-primary-200 bg-primary-50/70 p-5 shadow-sm"
              >
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
                      <span className="text-xs font-medium uppercase tracking-[0.12em] text-primary-600">
                        App Secret
                      </span>
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
                          <span className="text-xs text-emerald-700">
                            Linked open_id: {authMe.user.feishu_open_id}
                          </span>
                        ) : null}
                        {feishuLinkStatus ? (
                          <span className="text-xs text-primary-700">Link status: {feishuLinkStatus}</span>
                        ) : null}
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

                      {feishuLinkMessage ? (
                        <p className="mt-2 text-xs text-primary-700">{feishuLinkMessage}</p>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-1.5">
                      <span className="text-xs font-medium uppercase tracking-[0.12em] text-primary-600">
                        Account ID
                      </span>
                      <Input
                        value={weixin.accountId}
                        placeholder="your-account-id"
                        onChange={(event) =>
                          setWeixin((current) => ({
                            ...current,
                            accountId: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-xs font-medium uppercase tracking-[0.12em] text-primary-600">Token</span>
                      <div className="relative">
                        <Input
                          type={showWeixinToken ? 'text' : 'password'}
                          value={weixin.token}
                          placeholder={state.configured ? 'Re-enter to update' : 'bot-token'}
                          className="pr-10"
                          onChange={(event) =>
                            setWeixin((current) => ({
                              ...current,
                              token: event.target.value,
                            }))
                          }
                        />
                        <button
                          type="button"
                          onClick={() => setShowWeixinToken((value) => !value)}
                          aria-label={showWeixinToken ? 'Hide token' : 'Show token'}
                          title={showWeixinToken ? 'Hide token' : 'Show token'}
                          className="absolute inset-y-0 right-2 inline-flex items-center text-primary-500 hover:text-primary-700"
                        >
                          {showWeixinToken ? (
                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20C7 20 2.73 16.89 1 12c.77-2.17 2.06-4 3.63-5.35" />
                              <path d="M10.59 10.59A2 2 0 0 0 12 14a2 2 0 0 0 1.41-.59" />
                              <path d="M1 1l22 22" />
                              <path d="M9.88 4.24A10.94 10.94 0 0 1 12 4c5 0 9.27 3.11 11 8a11.94 11.94 0 0 1-4.06 5.94" />
                            </svg>
                          ) : (
                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12Z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </label>
                    <label className="space-y-1.5 md:col-span-2">
                      <span className="text-xs font-medium uppercase tracking-[0.12em] text-primary-600">Base URL</span>
                      <Input
                        value={weixin.baseUrl}
                        placeholder="https://ilinkai.weixin.qq.com"
                        onChange={(event) =>
                          setWeixin((current) => ({
                            ...current,
                            baseUrl: event.target.value,
                          }))
                        }
                      />
                    </label>

                    {/* ── Access Policies ── */}
                    <label className="space-y-1.5">
                      <span className="text-xs font-medium uppercase tracking-[0.12em] text-primary-600">DM Policy</span>
                      <select
                        value={weixin.dmPolicy}
                        onChange={(event) =>
                          setWeixin((current) => ({
                            ...current,
                            dmPolicy: event.target.value as WeixinDmPolicy,
                          }))
                        }
                        className="h-9 w-full rounded-lg border border-primary-200 bg-surface px-3 text-sm text-primary-900"
                      >
                        <option value="open">Open — anyone can DM</option>
                        <option value="allowlist">Allowlist — specified users only</option>
                        <option value="disabled">Disabled — ignore all DMs</option>
                        <option value="pairing">Pairing mode</option>
                      </select>
                    </label>

                    <label className="space-y-1.5">
                      <span className="text-xs font-medium uppercase tracking-[0.12em] text-primary-600">Group Policy</span>
                      <select
                        value={weixin.groupPolicy}
                        onChange={(event) =>
                          setWeixin((current) => ({
                            ...current,
                            groupPolicy: event.target.value as WeixinGroupPolicy,
                          }))
                        }
                        className="h-9 w-full rounded-lg border border-primary-200 bg-surface px-3 text-sm text-primary-900"
                      >
                        <option value="disabled">Disabled — ignore all groups (default)</option>
                        <option value="open">Open — respond in all groups</option>
                        <option value="allowlist">Allowlist — specified groups only</option>
                      </select>
                    </label>

                    {weixin.dmPolicy === 'allowlist' ? (
                      <label className="space-y-1.5 md:col-span-2">
                        <span className="text-xs font-medium uppercase tracking-[0.12em] text-primary-600">
                          Allowed Users (DM)
                        </span>
                        <Input
                          value={weixin.allowFrom}
                          placeholder="user_id_1, user_id_2, ..."
                          onChange={(event) =>
                            setWeixin((current) => ({
                              ...current,
                              allowFrom: event.target.value,
                            }))
                          }
                        />
                        <p className="text-[11px] text-primary-500">Comma-separated WeChat user IDs allowed to DM the bot.</p>
                      </label>
                    ) : null}

                    {weixin.groupPolicy === 'allowlist' ? (
                      <label className="space-y-1.5 md:col-span-2">
                        <span className="text-xs font-medium uppercase tracking-[0.12em] text-primary-600">
                          Allowed Groups
                        </span>
                        <Input
                          value={weixin.groupAllowFrom}
                          placeholder="group_id_1, group_id_2, ..."
                          onChange={(event) =>
                            setWeixin((current) => ({
                              ...current,
                              groupAllowFrom: event.target.value,
                            }))
                          }
                        />
                        <p className="text-[11px] text-primary-500">Comma-separated group IDs where the bot will respond.</p>
                      </label>
                    ) : null}

                    {/* ── Advanced ── */}
                    <label className="space-y-1.5">
                      <span className="text-xs font-medium uppercase tracking-[0.12em] text-primary-600">
                        Home Channel <span className="normal-case font-normal text-primary-400">(optional)</span>
                      </span>
                      <Input
                        value={weixin.homeChannel}
                        placeholder="chat_id for cron / notifications"
                        onChange={(event) =>
                          setWeixin((current) => ({
                            ...current,
                            homeChannel: event.target.value,
                          }))
                        }
                      />
                    </label>

                    <label className="space-y-1.5">
                      <span className="text-xs font-medium uppercase tracking-[0.12em] text-primary-600">
                        CDN Base URL <span className="normal-case font-normal text-primary-400">(optional)</span>
                      </span>
                      <Input
                        value={weixin.cdnBaseUrl}
                        placeholder="https://novac2c.cdn.weixin.qq.com/c2c"
                        onChange={(event) =>
                          setWeixin((current) => ({
                            ...current,
                            cdnBaseUrl: event.target.value,
                          }))
                        }
                      />
                    </label>

                    <div className="md:col-span-2 flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        disabled={!canSave || saving || validating}
                        onClick={() => void save(platform)}
                      >
                        {saving ? 'Saving...' : 'Save Settings'}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={saving || validating || !state.configured}
                        onClick={() => void remove(platform)}
                      >
                        Remove
                      </Button>
                      {isWeixinDirty ? (
                        <span className="text-xs text-primary-500">You have unsaved policy changes.</span>
                      ) : null}
                      <a
                        href={state.docs_url}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-auto text-xs font-medium text-primary-700 underline underline-offset-2"
                      >
                        Open setup docs
                      </a>
                    </div>

                    <div className="md:col-span-2 rounded-lg border border-primary-200 bg-surface p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={requestingWeixinQr || saving || validating}
                          onClick={() => void requestWeixinQrCode()}
                        >
                          {requestingWeixinQr ? 'Generating QR...' : 'Generate QR Login'}
                        </Button>
                        {weixinQr ? (
                          <span className="text-xs text-primary-700">
                            QR status: {weixinQr.status}
                          </span>
                        ) : null}
                      </div>
                      {weixinQr ? (
                        <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-start md:gap-4">
                          <img
                            src={weixinQrDataUrl || weixinQr.qrcodeUrl || ''}
                            alt="Weixin login QR code"
                            className="h-40 w-40 rounded-md border border-primary-200 bg-white object-contain"
                          />
                          <div className="min-w-0 text-xs text-primary-700">
                            <p>Scan with WeChat, then confirm login on your phone.</p>
                            {weixinQr.qrcodeUrl ? (
                              <p className="mt-1 break-all">
                                QR URL: <a className="underline" href={weixinQr.qrcodeUrl} target="_blank" rel="noreferrer">Open QR link</a>
                              </p>
                            ) : (
                              <p className="mt-1 break-all">
                                QR scan data: {weixinQr.scanData}
                              </p>
                            )}
                          </div>
                        </div>
                      ) : null}
                    </div>

                  </div>
                )}

                {state.configured && isFeishu ? (
                  <p className="mt-3 text-xs text-primary-600">
                    Existing credentials are masked. Re-enter the secret value before validating or saving updates.
                  </p>
                ) : null}

                {validationMessage[platform] ? (
                  <p className="mt-3 text-xs text-primary-700">{validationMessage[platform]}</p>
                ) : null}

                {isFeishu ? (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!canValidate || validating || saving}
                        onClick={() => void validate(platform)}
                      >
                        {validating ? 'Validating...' : 'Validate'}
                      </Button>
                      <Button
                        type="button"
                        disabled={!canSave || saving || validating}
                        onClick={() => void save(platform)}
                      >
                        {saving ? 'Saving...' : 'Save'}
                      </Button>
                    </>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={saving || validating || !state.configured}
                    onClick={() => void remove(platform)}
                  >
                    Remove
                  </Button>
                  <a
                    href={state.docs_url}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-auto text-xs font-medium text-primary-700 underline underline-offset-2"
                  >
                    Open setup docs
                  </a>
                </div>
                ) : null}

                {!isFeishu && weixin.dmPolicy === 'pairing' ? (
                  <div className="mt-4 rounded-lg border border-primary-200 bg-surface p-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-primary-700">
                        Ask user to DM the bot, then approve their request directly in the matching row.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={
                          loadingWeixinPairing ||
                          approvingWeixinPairing ||
                          saving ||
                          validating
                        }
                        onClick={() => void loadWeixinPairingPending()}
                      >
                        {loadingWeixinPairing ? 'Refreshing...' : 'Refresh Pending'}
                      </Button>
                    </div>

                    {isWeixinDirty && weixinPairingPending.length > 0 ? (
                      <p className="mb-2 text-xs text-amber-700">Unsaved Weixin changes — save to apply policy updates to queued requests.</p>
                    ) : null}

                    {weixinPairingPending.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-primary-800">
                          <thead>
                            <tr className="border-b border-primary-200 text-primary-600">
                              <th className="py-1 pr-3">Code</th>
                              <th className="py-1 pr-3">User ID</th>
                              <th className="py-1 pr-3">User Name</th>
                              <th className="py-1 pr-3">Age</th>
                              <th className="py-1 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {weixinPairingPending.map((entry) => (
                              <tr key={`${entry.code}:${entry.user_id}`} className="border-b border-primary-100">
                                <td className="py-1 pr-3 font-mono">{entry.code}</td>
                                <td className="py-1 pr-3">{entry.user_id}</td>
                                <td className="py-1 pr-3">{entry.user_name || '-'}</td>
                                <td className="py-1 pr-3">{entry.age_minutes}m</td>
                                <td className="py-1 text-right">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={
                                      approvingWeixinPairing ||
                                      loadingWeixinPairing ||
                                      saving ||
                                      validating
                                    }
                                    onClick={() => void approveWeixinPairingCode(entry.code)}
                                  >
                                    {approvingWeixinPairing && approvingWeixinPairingCode === entry.code
                                      ? 'Approving...'
                                      : 'Approve'}
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-xs text-primary-600">No pending pairing requests.</p>
                    )}
                  </div>
                ) : null}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
