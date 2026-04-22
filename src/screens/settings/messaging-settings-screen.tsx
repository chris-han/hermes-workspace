import { useEffect, useMemo, useState } from 'react'
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

type FeishuDraft = {
  appId: string
  appSecret: string
  domain: 'feishu' | 'lark'
  connectionMode: 'websocket' | 'webhook'
}

type WeixinDraft = {
  accountId: string
  token: string
  baseUrl: string
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
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/semantier-proxy${path}`, init)
  const text = await response.text()
  const payload = text ? (JSON.parse(text) as T & { detail?: string }) : ({} as T & { detail?: string })
  if (!response.ok) {
    const detail = typeof payload.detail === 'string' ? payload.detail : `Request failed (${response.status})`
    throw new Error(detail)
  }
  return payload
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

  const [feishu, setFeishu] = useState<FeishuDraft>(EMPTY_FEISHU)
  const [weixin, setWeixin] = useState<WeixinDraft>(EMPTY_WEIXIN)

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
        token: '',
        baseUrl: String(weixinConfig.base_url ?? 'https://ilinkai.weixin.qq.com'),
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load messaging settings.'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadPlatforms()
  }, [])

  const canValidateFeishu = useMemo(() => {
    return feishu.appId.trim() !== '' && feishu.appSecret.trim() !== ''
  }, [feishu])

  const canValidateWeixin = useMemo(() => {
    return weixin.accountId.trim() !== '' && weixin.token.trim() !== ''
  }, [weixin])

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
      toast.success(`${platformTitle(platform)} validation passed.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Validation failed.'
      setValidationMessage((current) => ({
        ...current,
        [platform]: message,
      }))
      toast.error(message)
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
              },
            }

      await requestJson<PlatformState>(`/messaging/${platform}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      toast.success(`${platformTitle(platform)} configuration saved.`)
      await loadPlatforms()
      setValidationMessage((current) => ({
        ...current,
        [platform]: '',
      }))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Save failed.'
      toast.error(message)
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
      toast.success(`${platformTitle(platform)} configuration removed.`)
      await loadPlatforms()
      setValidationMessage((current) => ({
        ...current,
        [platform]: '',
      }))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Delete failed.'
      toast.error(message)
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
            const canSave = canValidate

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
                      <Input
                        type="password"
                        value={weixin.token}
                        placeholder={state.configured ? 'Re-enter to update' : 'bot-token'}
                        onChange={(event) =>
                          setWeixin((current) => ({
                            ...current,
                            token: event.target.value,
                          }))
                        }
                      />
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
                  </div>
                )}

                {state.configured ? (
                  <p className="mt-3 text-xs text-primary-600">
                    Existing credentials are masked. Re-enter the secret value before validating or saving updates.
                  </p>
                ) : null}

                {validationMessage[platform] ? (
                  <p className="mt-3 text-xs text-primary-700">{validationMessage[platform]}</p>
                ) : null}

                <div className="mt-4 flex flex-wrap items-center gap-2">
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
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
