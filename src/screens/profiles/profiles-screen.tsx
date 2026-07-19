import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  ArrowRight01Icon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  Copy01Icon,
  Delete02Icon,
  Edit02Icon,
  Folder01Icon,
  Key01Icon,
  SparklesIcon,
  UserGroupIcon,
} from '@hugeicons/core-free-icons'
import { Button } from '@/components/ui/button'
import { DialogContent, DialogRoot, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'

type ProfileSummary = {
  name: string
  displayName?: string
  avatarDataUrl?: string
  path: string
  active: boolean
  exists: boolean
  model?: string
  provider?: string
  skillCount: number
  sessionCount: number
  hasEnv: boolean
  updatedAt?: string
}

type ProfileDetail = {
  name: string
  displayName?: string
  avatarDataUrl?: string
  path: string
  active: boolean
  config: Record<string, unknown>
  envPath?: string
  hasEnv: boolean
  sessionsDir?: string
  skillsDir?: string
  soulPath?: string
  soul?: string
}

type ModelOption = {
  id: string
  name?: string
  provider?: string
}

async function readJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(text || `Request failed (${response.status})`)
  }
  return (await response.json()) as T
}

function formatDate(value?: string): string {
  if (!value) return '—'
  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) return value
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(parsed)
}

const PROFILE_IMAGE_MAX_DIMENSION = 128
const PROFILE_IMAGE_MAX_FILE_SIZE = 10 * 1024 * 1024

function readOptionalString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function resolveDisplayName(profile: {
  name: string
  displayName?: string
}): string {
  return (profile.displayName?.trim() || profile.name).trim()
}

function resolveProfileProvider(profile: {
  provider?: string
  model?: string
}): string {
  const configured = profile.provider?.trim()
  if (configured) return configured

  const model = profile.model?.trim()
  if (!model) return 'no provider'
  const slashIndex = model.indexOf('/')
  if (slashIndex > 0) return model.slice(0, slashIndex)

  return 'no provider'
}

function inferProviderFromModel(model: string): string {
  const slashIndex = model.indexOf('/')
  if (slashIndex <= 0) return ''
  return model.slice(0, slashIndex)
}

function ProfileStat({
  label,
  value,
  truncate,
}: {
  label: string
  value: string | number
  truncate?: boolean
}) {
  return (
    <div className="flex flex-col items-center py-2.5 px-1">
      <div
        className={cn(
          'text-sm font-bold text-foreground',
          truncate && 'max-w-[72px] truncate text-xs',
        )}
      >
        {value}
      </div>
      <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
    </div>
  )
}

export function ProfilesScreen() {
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [detailsName, setDetailsName] = useState<string | null>(null)
  const [renameTarget, setRenameTarget] = useState<ProfileSummary | null>(null)
  const [newProfileName, setNewProfileName] = useState('')
  const [wizardStep, setWizardStep] = useState(1)
  const [cloneFrom, setCloneFrom] = useState('')
  const [wizardProvider, setWizardProvider] = useState('')
  const [wizardModel, setWizardModel] = useState('')
  const [allModels, setAllModels] = useState<Array<ModelOption>>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [busyName, setBusyName] = useState<string | null>(null)
  const [detailDisplayName, setDetailDisplayName] = useState('')
  const [detailProvider, setDetailProvider] = useState('')
  const [detailModel, setDetailModel] = useState('')
  const [detailSoul, setDetailSoul] = useState('')
  const [detailAvatarDataUrl, setDetailAvatarDataUrl] = useState<string | null>(
    null,
  )
  const [detailErrorMessage, setDetailErrorMessage] = useState<string | null>(
    null,
  )
  const [detailSaving, setDetailSaving] = useState(false)

  const profilesQuery = useQuery({
    queryKey: ['profiles', 'list'],
    queryFn: () =>
      readJson<{ profiles: Array<ProfileSummary>; activeProfile: string }>(
        '/api/profiles/list',
      ),
  })

  const detailQuery = useQuery({
    queryKey: ['profiles', 'read', detailsName],
    queryFn: () =>
      readJson<{ profile: ProfileDetail }>(
        `/api/profiles/read?name=${encodeURIComponent(detailsName || '')}`,
      ),
    enabled: Boolean(detailsName),
  })

  const profiles = profilesQuery.data?.profiles ?? []
  const activeProfile = profilesQuery.data?.activeProfile ?? 'default'

  const sorted = useMemo(() => profiles, [profiles])

  async function refreshProfiles() {
    await queryClient.invalidateQueries({ queryKey: ['profiles'] })
  }

  async function postJson(url: string, body: Record<string, unknown>) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok || payload?.error) {
      throw new Error(payload?.error || `Request failed (${response.status})`)
    }
    return payload
  }

  async function handleProfileAvatarUpload(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setDetailErrorMessage('Unsupported file type.')
      return
    }
    if (file.size > PROFILE_IMAGE_MAX_FILE_SIZE) {
      setDetailErrorMessage('Image too large (max 10MB).')
      return
    }
    setDetailErrorMessage(null)
    setDetailSaving(true)
    try {
      const url = URL.createObjectURL(file)
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const imageInstance = new Image()
        imageInstance.onload = () => resolve(imageInstance)
        imageInstance.onerror = () => reject(new Error('Failed to load image'))
        imageInstance.src = url
      })
      const scale = Math.min(
        1,
        PROFILE_IMAGE_MAX_DIMENSION / Math.max(image.width, image.height),
      )
      const width = Math.round(image.width * scale)
      const height = Math.round(image.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      if (!context) {
        throw new Error('Failed to process image.')
      }
      context.imageSmoothingQuality = 'high'
      context.drawImage(image, 0, 0, width, height)
      URL.revokeObjectURL(url)
      const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
      setDetailAvatarDataUrl(canvas.toDataURL(outputType, 0.82))
    } catch {
      setDetailErrorMessage('Failed to process image.')
    } finally {
      setDetailSaving(false)
    }
  }

  async function handleSaveProfileDetails() {
    const targetProfileName =
      detailsName || detailQuery.data?.profile?.name || 'default'
    setDetailSaving(true)
    setDetailErrorMessage(null)
    try {
      const patchPayload = {
        name: targetProfileName,
        patch: undefined as Record<string, unknown> | undefined,
      }
      const sanitizedModel = detailModel.trim()
      const patch: Record<string, unknown> = {
        display_name: detailDisplayName.trim() || null,
        soul: detailSoul || null,
      }
      const normalizedProvider = detailProvider.trim()
      if (normalizedProvider) {
        patch.provider = normalizedProvider
      }
      if (sanitizedModel) {
        patch.model = sanitizedModel
      }
      if (detailAvatarDataUrl === null) {
        patch.avatar_data_url = null
      } else if (detailAvatarDataUrl) {
        patch.avatar_data_url = detailAvatarDataUrl
      }
      patchPayload.patch = patch

      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.debug('[profiles.save] posting', patchPayload)
      }

      const response = (await postJson(
        '/api/profiles/update',
        patchPayload,
      )) as {
        ok?: boolean
        profile?: Record<string, unknown>
      }
      if (response.ok === false) {
        throw new Error('Failed to save profile details')
      }
      await refreshProfiles()
      await detailQuery.refetch()
      toast('Profile identity saved', { type: 'success' })
    } catch (error) {
      setDetailErrorMessage(
        error instanceof Error
          ? error.message
          : 'Failed to save profile details',
      )
    } finally {
      setDetailSaving(false)
    }
  }

  const fetchAllModels = useCallback(async () => {
    setLoadingModels(true)
    try {
      const res = await fetch('/api/models')
      if (res.ok) {
        const result = (await res.json()) as { models?: Array<ModelOption> }
        setAllModels(result.models || [])
      }
    } catch {
      /* ignore */
    }
    setLoadingModels(false)
  }, [])

  useEffect(() => {
    if (createOpen && wizardStep === 2 && allModels.length === 0) {
      void fetchAllModels()
    }
  }, [createOpen, wizardStep, allModels.length, fetchAllModels])

  useEffect(() => {
    const profile = detailQuery.data?.profile
    if (!detailsName || !profile) return
    setDetailDisplayName(profile.displayName || '')
    const configuredProvider = readOptionalString(
      profile.config?.provider as unknown,
    )
    const configuredModel = readOptionalString(profile.config?.model as unknown)
    setDetailProvider(
      configuredProvider || inferProviderFromModel(configuredModel) || '',
    )
    setDetailModel(configuredModel)
    setDetailSoul(profile.soul || '')
    setDetailAvatarDataUrl(profile.avatarDataUrl ?? null)
    setDetailErrorMessage(null)
  }, [
    detailsName,
    detailQuery.data?.profile?.displayName,
    detailQuery.data?.profile?.avatarDataUrl,
    detailQuery.data?.profile?.name,
    detailQuery.data?.profile?.config?.provider,
    detailQuery.data?.profile?.config?.model,
    detailQuery.data?.profile?.soul,
  ])

  const nameValid =
    /^[A-Za-z0-9_-]+$/.test(newProfileName.trim()) &&
    newProfileName.trim() !== 'default'

  const detailProviderOptions = useMemo(() => {
    const providers = new Set<string>()
    for (const model of allModels) {
      const provider = (model.provider || '').trim()
      if (provider) providers.add(provider)
    }
    if (detailProvider && !providers.has(detailProvider)) {
      providers.add(detailProvider)
    }
    return Array.from(providers).sort((a, b) => a.localeCompare(b))
  }, [allModels, detailProvider])

  const detailModelOptions = useMemo(() => {
    const selectedProviderModels = allModels
      .filter((m) => (m.provider || '').trim() === detailProvider)
      .map((m) => ({ id: m.id, name: m.name || m.id }))

    if (!selectedProviderModels.length && detailModel) {
      return [{ id: detailModel, name: detailModel }]
    }
    if (
      detailModel &&
      !selectedProviderModels.some((model) => model.id === detailModel)
    ) {
      return [{ id: detailModel, name: detailModel }, ...selectedProviderModels]
    }
    return selectedProviderModels
  }, [allModels, detailProvider, detailModel])

  useEffect(() => {
    if (detailsName && allModels.length === 0) {
      void fetchAllModels()
    }
  }, [detailsName, allModels.length, fetchAllModels])

  useEffect(() => {
    if (!detailProvider) return
    const hasProviderModel = detailModelOptions.some(
      (m) => m.id === detailModel,
    )
    if (!hasProviderModel && detailModelOptions.length > 0) {
      setDetailModel(detailModelOptions[0].id)
    }
  }, [detailProvider, detailModelOptions, detailModel])

  function resetWizard() {
    setNewProfileName('')
    setCloneFrom('')
    setWizardProvider('')
    setWizardModel('')
    setWizardStep(1)
    setAllModels([])
  }

  async function handleCreate() {
    if (!newProfileName.trim()) return
    setBusyName('__create__')
    try {
      await postJson('/api/profiles/create', {
        name: newProfileName.trim(),
        ...(cloneFrom ? { cloneFrom } : {}),
        ...(wizardModel ? { model: wizardModel } : {}),
        ...(wizardProvider ? { provider: wizardProvider } : {}),
      })
      toast(`Created profile ${newProfileName.trim()}`, { type: 'success' })
      setCreateOpen(false)
      resetWizard()
      await refreshProfiles()
    } catch (error) {
      toast(
        error instanceof Error ? error.message : 'Failed to create profile',
        { type: 'error' },
      )
    } finally {
      setBusyName(null)
    }
  }

  async function handleActivate(name: string) {
    setBusyName(name)
    try {
      await postJson('/api/profiles/activate', { name })
      toast(`Activated profile ${name}`, { type: 'success' })
      await refreshProfiles()
    } catch (error) {
      toast(
        error instanceof Error ? error.message : 'Failed to activate profile',
        { type: 'error' },
      )
    } finally {
      setBusyName(null)
    }
  }

  async function handleDelete(name: string) {
    if (
      typeof window !== 'undefined' &&
      !window.confirm(`Delete profile ${name}?`)
    )
      return
    setBusyName(name)
    try {
      await postJson('/api/profiles/delete', { name })
      toast(`Deleted profile ${name}`, { type: 'success' })
      await refreshProfiles()
    } catch (error) {
      toast(
        error instanceof Error ? error.message : 'Failed to delete profile',
        { type: 'error' },
      )
    } finally {
      setBusyName(null)
    }
  }

  async function handleRename() {
    if (!renameTarget || !renameValue.trim()) return
    setBusyName(renameTarget.name)
    try {
      await postJson('/api/profiles/rename', {
        oldName: renameTarget.name,
        newName: renameValue.trim(),
      })
      toast(`Renamed ${renameTarget.name} → ${renameValue.trim()}`, {
        type: 'success',
      })
      setRenameTarget(null)
      setRenameValue('')
      await refreshProfiles()
    } catch (error) {
      toast(
        error instanceof Error ? error.message : 'Failed to rename profile',
        { type: 'error' },
      )
    } finally {
      setBusyName(null)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 md:px-6">
      <div className="flex flex-col gap-3 rounded-card border border-border bg-card p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <HugeiconsIcon icon={UserGroupIcon} size={22} strokeWidth={1.7} />
            <h1 className="text-lg font-semibold text-foreground">Profiles</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Browse and manage Hermes profiles for the active workspace.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <HugeiconsIcon icon={Add01Icon} size={16} strokeWidth={1.8} />
          Create profile
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sorted.map((profile) => {
          const busy = busyName === profile.name
          const provider = resolveProfileProvider(profile)
          return (
            <article
              key={profile.name}
              className="group relative overflow-hidden rounded-card border border-border bg-card shadow-sm"
            >
              {/* Active glow accent */}
              {profile.active && (
                <div className="absolute inset-x-0 top-0 h-1 bg-primary" />
              )}

              {/* Centered avatar hero */}
              <div className="flex flex-col items-center pt-6 pb-1">
                <div className="relative">
                  <div
                    className={cn(
                      'rounded-full p-1',
                      profile.active
                        ? 'bg-gradient-to-br from-primary to-primary shadow-lg shadow-primary/20'
                        : 'bg-muted',
                    )}
                  >
                    <img
                      src={profile.avatarDataUrl || '/logo.svg'}
                      alt={resolveDisplayName(profile)}
                      className={cn(
                        'size-20 rounded-full border-2 object-cover',
                        profile.active ? 'border-background' : 'border-card',
                      )}
                      style={{
                        filter: profile.active
                          ? 'none'
                          : 'grayscale(0.5) brightness(0.9)',
                      }}
                    />
                  </div>
                </div>

                {/* Name + provider */}
                <h2 className="mt-3 text-center text-lg font-bold text-foreground">
                  {resolveDisplayName(profile)}
                </h2>
                <span className="mt-1 inline-block rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {provider}
                </span>
                {profile.active ? (
                  <div className="mt-2 inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold border-[var(--theme-success)] bg-[color-mix(in_srgb,var(--theme-success)_18%,transparent)] text-[var(--theme-success)]">
                    Active
                  </div>
                ) : null}
              </div>

              {/* Stats ring */}
              <div className="mx-4 mt-4 grid grid-cols-4 divide-x divide-border rounded-md border border-border bg-muted/50">
                <ProfileStat label="Skills" value={profile.skillCount} />
                <ProfileStat label="Sessions" value={profile.sessionCount} />
                <ProfileStat
                  label="Model"
                  value={profile.model || '\u2014'}
                  truncate
                />
                <ProfileStat
                  label="Env"
                  value={profile.hasEnv ? '\u2713' : '\u2014'}
                />
              </div>

              {/* Updated timestamp */}
              <div className="mx-4 mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <HugeiconsIcon icon={Clock01Icon} size={12} strokeWidth={1.7} />
                {formatDate(profile.updatedAt)}
              </div>

              {/* Actions */}
              <div className="mt-4 flex border-t border-border">
                <button
                  type="button"
                  onClick={() => void handleActivate(profile.name)}
                  disabled={profile.active || busy}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-1.5 border-r border-border py-2.5 text-xs font-semibold transition-colors',
                    profile.active
                      ? 'cursor-default text-muted-foreground/50'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <HugeiconsIcon
                    icon={SparklesIcon}
                    size={13}
                    strokeWidth={1.8}
                  />{' '}
                  Activate
                </button>
                <button
                  type="button"
                  onClick={() => setDetailsName(profile.name)}
                  className="flex flex-1 items-center justify-center gap-1.5 border-r border-border py-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <HugeiconsIcon
                    icon={Folder01Icon}
                    size={13}
                    strokeWidth={1.8}
                  />{' '}
                  Details
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRenameTarget(profile)
                    setRenameValue(profile.name)
                  }}
                  className="flex flex-1 items-center justify-center gap-1.5 border-r border-border py-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <HugeiconsIcon
                    icon={Edit02Icon}
                    size={13}
                    strokeWidth={1.8}
                  />{' '}
                  Rename
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(profile.name)}
                  disabled={profile.active || busy}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors',
                    profile.active
                      ? 'cursor-default text-muted-foreground/50'
                      : 'text-destructive hover:bg-destructive/10',
                  )}
                >
                  <HugeiconsIcon
                    icon={Delete02Icon}
                    size={13}
                    strokeWidth={1.8}
                  />{' '}
                  Delete
                </button>
              </div>
            </article>
          )
        })}
      </div>

      {sorted.length === 0 && !profilesQuery.isLoading ? (
        <div className="rounded-card border border-dashed border-border bg-muted p-8 text-center text-sm text-muted-foreground">
          No named profiles found yet. The active profile is{' '}
          <span className="font-semibold">{activeProfile}</span>.
        </div>
      ) : null}

      <DialogRoot
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open)
          if (!open) resetWizard()
        }}
      >
        <DialogContent className="w-[min(560px,94vw)] max-w-none p-0">
          {/* ── Header ─────────────────────────────────── */}
          <div className="border-b border-border px-6 pb-4 pt-5">
            <div className="flex items-center gap-3">
              <div className="inline-flex size-10 items-center justify-center rounded-lg border border-border bg-muted">
                <HugeiconsIcon icon={Add01Icon} size={20} strokeWidth={1.7} />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold">
                  Create profile
                </DialogTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {wizardStep === 1
                    ? 'Name & template'
                    : wizardStep === 2
                      ? 'Choose model'
                      : 'Review & create'}
                </p>
              </div>
            </div>

            {/* Step indicator */}
            <div className="mt-4 flex items-center gap-2">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex flex-1 items-center gap-2">
                  <div
                    className={cn(
                      'flex size-7 items-center justify-center rounded-full text-xs font-bold transition-colors',
                      wizardStep > step
                        ? 'bg-primary text-primary-foreground'
                        : wizardStep === step
                          ? 'bg-primary text-primary-foreground'
                          : 'border border-border bg-muted text-muted-foreground',
                    )}
                  >
                    {wizardStep > step ? (
                      <HugeiconsIcon
                        icon={CheckmarkCircle02Icon}
                        size={16}
                        strokeWidth={2}
                      />
                    ) : (
                      step
                    )}
                  </div>
                  {step < 3 && (
                    <div
                      className={cn(
                        'h-0.5 flex-1 rounded-full transition-colors',
                        wizardStep > step ? 'bg-primary' : 'bg-border',
                      )}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ── Body ──────────────────────────────────── */}
          <div className="px-6 py-5">
            {wizardStep === 1 && (
              <div className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Profile name
                  </label>
                  <Input
                    value={newProfileName}
                    onChange={(e) => setNewProfileName(e.target.value)}
                    placeholder="e.g. builder, researcher, ops"
                    className="h-11 text-sm"
                    autoFocus
                  />
                  {newProfileName.trim() && !nameValid ? (
                    <p className="text-xs text-destructive">
                      Use letters, numbers, underscores, or hyphens. Cannot be
                      &quot;default&quot;.
                    </p>
                  ) : newProfileName.trim() && nameValid ? (
                    <p className="text-xs text-success">✓ Valid name</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Choose a short, memorable identifier
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <HugeiconsIcon
                        icon={Copy01Icon}
                        size={13}
                        strokeWidth={1.8}
                      />
                      Clone from existing
                    </span>
                  </label>
                  <select
                    value={cloneFrom}
                    onChange={(e) => setCloneFrom(e.target.value)}
                    className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-primary"
                  >
                    <option value="">Start fresh — empty config</option>
                    {profiles.map((p) => (
                      <option key={p.name} value={p.name}>
                        {resolveDisplayName(p)} {p.model ? `(${p.model})` : ''}{' '}
                        {p.active ? '• active' : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Copies config, skills path, and env from the selected
                    profile
                  </p>
                </div>

                <div className="rounded-md border border-border bg-muted p-3">
                  <p className="text-xs text-muted-foreground">
                    Profiles are stored under the active workspace&apos;s
                    configured Hermes root with each profile directory under{' '}
                    <code className="rounded bg-muted/50 px-1 py-0.5 font-mono text-[11px]">
                      /profiles/
                    </code>{' '}
                    with their own config, skills, sessions, and env.
                  </p>
                </div>
              </div>
            )}

            {wizardStep === 2 && (
              <div className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Default model
                  </label>
                  {loadingModels ? (
                    <div className="flex h-11 items-center rounded-md border border-border bg-background px-3 text-sm text-muted-foreground">
                      Loading configured models…
                    </div>
                  ) : allModels.length === 0 ? (
                    <div className="rounded-md border border-border bg-muted p-3 text-xs text-muted-foreground">
                      No models found. Make sure Project Agent is running and
                      has models configured.
                    </div>
                  ) : (
                    <select
                      value={wizardModel}
                      onChange={(e) => {
                        const modelId = e.target.value
                        setWizardModel(modelId)
                        const matched = allModels.find((m) => m.id === modelId)
                        setWizardProvider(matched?.provider || '')
                      }}
                      className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-primary"
                    >
                      <option value="">Skip — configure later</option>
                      {allModels.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name || m.id}
                          {m.provider ? ` (${m.provider})` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                  {wizardModel && (
                    <p className="text-xs text-success">
                      ✓ {wizardModel}
                      {wizardProvider ? ` via ${wizardProvider}` : ''}
                    </p>
                  )}
                </div>

                {!wizardModel && !loadingModels && allModels.length > 0 && (
                  <div className="rounded-md border border-border bg-muted p-3">
                    <p className="text-xs text-muted-foreground">
                      Select a model or skip to configure later from profile
                      details or config.yaml.
                    </p>
                  </div>
                )}
              </div>
            )}

            {wizardStep === 3 && (
              <div className="space-y-4">
                <div className="rounded-card border border-border bg-card p-4">
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Profile summary
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <SummaryField label="Name" value={newProfileName.trim()} />
                    <SummaryField
                      label="Template"
                      value={cloneFrom || 'Fresh start'}
                    />
                    <SummaryField
                      label="Model"
                      value={
                        wizardModel
                          ? `${wizardModel}${wizardProvider ? ` (${wizardProvider})` : ''}`
                          : 'Not set'
                      }
                      muted={!wizardModel}
                    />
                  </div>
                </div>

                <div className="rounded-md border border-success/30 bg-success/10 p-3">
                  <p className="text-xs text-success-foreground">
                    This will create{' '}
                    <code className="rounded bg-success/20 px-1 py-0.5 font-mono text-[11px]">
                      profiles/{newProfileName.trim()}/
                    </code>{' '}
                    with config.yaml
                    {cloneFrom ? ` cloned from ${cloneFrom}` : ''}, skills/, and
                    sessions/ directories.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ── Footer ─────────────────────────────────── */}
          <div className="flex items-center justify-between border-t border-border px-6 py-4">
            <div>
              {wizardStep > 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setWizardStep((s) => (s - 1) as 1 | 2 | 3)}
                >
                  Back
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setCreateOpen(false)
                  resetWizard()
                }}
              >
                Cancel
              </Button>
              {wizardStep < 3 ? (
                <Button
                  size="sm"
                  onClick={() => setWizardStep((s) => (s + 1) as 1 | 2 | 3)}
                  disabled={wizardStep === 1 && !nameValid}
                  className="gap-1.5"
                >
                  Next
                  <HugeiconsIcon
                    icon={ArrowRight01Icon}
                    size={14}
                    strokeWidth={1.8}
                  />
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => void handleCreate()}
                  disabled={busyName === '__create__'}
                  className="gap-1.5"
                >
                  <HugeiconsIcon
                    icon={SparklesIcon}
                    size={14}
                    strokeWidth={1.8}
                  />
                  Create Profile
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </DialogRoot>

      <DialogRoot
        open={Boolean(renameTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setRenameTarget(null)
            setRenameValue('')
          }
        }}
      >
        <DialogContent className="w-[min(440px,94vw)] max-w-none p-0">
          <div className="border-b border-border px-6 pb-4 pt-5">
            <div className="flex items-center gap-3">
              <div className="inline-flex size-10 items-center justify-center rounded-lg border border-border bg-muted">
                <HugeiconsIcon icon={Edit02Icon} size={20} strokeWidth={1.7} />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold">
                  Rename profile
                </DialogTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Renaming{' '}
                  <span className="font-semibold text-foreground">
                    {renameTarget?.name}
                  </span>
                </p>
              </div>
            </div>
          </div>
          <div className="px-6 py-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                New name
              </label>
              <Input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                placeholder="new-profile-name"
                className="h-11 text-sm"
                autoFocus
              />
              {renameValue.trim() &&
                !/^[A-Za-z0-9_-]+$/.test(renameValue.trim()) && (
                  <p className="text-xs text-destructive">
                    Use letters, numbers, underscores, or hyphens.
                  </p>
                )}
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-border px-6 py-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setRenameTarget(null)
                setRenameValue('')
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => void handleRename()}
              disabled={
                !renameTarget ||
                !renameValue.trim() ||
                !/^[A-Za-z0-9_-]+$/.test(renameValue.trim())
              }
            >
              Rename
            </Button>
          </div>
        </DialogContent>
      </DialogRoot>

      <DialogRoot
        open={Boolean(detailsName)}
        onOpenChange={(open) => {
          if (!open) {
            setDetailErrorMessage(null)
            setDetailSaving(false)
            setDetailsName(null)
          }
        }}
      >
        <DialogContent className="w-[min(640px,94vw)] max-w-none p-0 max-h-[85vh] flex flex-col">
          {/* Header */}
          <div className="shrink-0 border-b border-border px-6 pb-4 pt-5">
            <div className="flex items-center gap-3">
              <img
                src={detailAvatarDataUrl || '/logo.svg'}
                alt={detailDisplayName || detailsName || ''}
                className="size-12 rounded-full border-2 border-border object-cover"
              />
              <div className="min-w-0">
                <DialogTitle className="text-base font-semibold">
                  {resolveDisplayName(
                    detailQuery.data?.profile ?? {
                      name: detailsName || '',
                      displayName: detailDisplayName,
                    },
                  )}
                </DialogTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Profile details &amp; configuration
                </p>
              </div>
            </div>
          </div>

          {/* Body — scrollable */}
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            {detailQuery.data?.profile ? (
              <div className="space-y-4 text-sm">
                <div className="grid gap-3 rounded-lg border border-border bg-muted/50 p-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <label className="space-y-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Display name
                    </span>
                    <Input
                      value={detailDisplayName}
                      onChange={(event) =>
                        setDetailDisplayName(event.target.value)
                      }
                      placeholder={detailQuery.data.profile.name}
                      className="h-10"
                    />
                  </label>
                  <div className="space-y-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Avatar
                    </span>
                    <div className="flex items-center gap-2">
                      <label className="block">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleProfileAvatarUpload}
                          disabled={detailSaving}
                          aria-label="Upload profile avatar"
                          className="block w-full cursor-pointer text-xs text-foreground md:max-w-xs file:mr-2 file:cursor-pointer file:rounded-md file:border file:border-border file:bg-muted file:px-2.5 file:py-1.5 file:text-xs file:font-medium file:text-foreground file:transition-colors hover:file:bg-muted/80 disabled:cursor-not-allowed disabled:opacity-50"
                        />
                      </label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDetailAvatarDataUrl(null)}
                        disabled={detailSaving || !detailAvatarDataUrl}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Provider
                    </span>
                    <select
                      value={detailProvider}
                      onChange={(event) => {
                        setDetailProvider(event.target.value)
                        setDetailModel('')
                      }}
                      className="role-config-select h-10 w-full rounded-md border px-3 text-sm outline-none transition-colors"
                    >
                      <option value="">Select provider</option>
                      {detailProviderOptions.map((provider) => (
                        <option key={provider} value={provider}>
                          {provider}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Model
                    </span>
                    <select
                      value={detailModel}
                      onChange={(event) => setDetailModel(event.target.value)}
                      disabled={!detailProvider}
                      className="role-config-select h-10 w-full rounded-md border px-3 text-sm outline-none transition-colors disabled:opacity-60"
                    >
                      {!detailProvider ? (
                        <option value="">Select provider first</option>
                      ) : detailModelOptions.length === 0 ? (
                        <option value="">No models available</option>
                      ) : (
                        <>
                          <option value="">Select model</option>
                          {detailModelOptions.map((model) => (
                            <option key={model.id} value={model.id}>
                              {model.name || model.id}
                            </option>
                          ))}
                        </>
                      )}
                    </select>
                  </label>
                </div>
                <div className="rounded-lg border border-border bg-muted/50 p-3">
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    SOUL.md
                  </div>
                  <p className="mb-2 break-all text-xs text-muted-foreground">
                    {detailQuery.data.profile.soulPath || 'No SOUL.md file'}
                  </p>
                  <textarea
                    value={detailSoul}
                    onChange={(event) => setDetailSoul(event.target.value)}
                    placeholder="Paste or write SOUL.md content here..."
                    className="h-36 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-0"
                  />
                  <div className="mt-2 flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setDetailSoul('')}
                      disabled={detailSaving || !detailSoul}
                    >
                      Clear
                    </Button>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <DetailField
                    label="Profile ID"
                    value={detailQuery.data.profile.name}
                  />
                  <DetailField
                    label="Active"
                    value={detailQuery.data.profile.active ? 'Yes' : 'No'}
                    accent={detailQuery.data.profile.active}
                  />
                </div>
                <DetailField
                  label="Path"
                  value={detailQuery.data.profile.path}
                  mono
                />
                <div className="grid gap-3 sm:grid-cols-3">
                  <DetailField
                    label="Env file"
                    value={detailQuery.data.profile.envPath || 'Not set'}
                    mono
                    muted={!detailQuery.data.profile.envPath}
                  />
                  <DetailField
                    label="Sessions"
                    value={detailQuery.data.profile.sessionsDir || 'Not set'}
                    mono
                    muted={!detailQuery.data.profile.sessionsDir}
                  />
                  <DetailField
                    label="Skills"
                    value={detailQuery.data.profile.skillsDir || 'Not set'}
                    mono
                    muted={!detailQuery.data.profile.skillsDir}
                  />
                </div>
                {detailErrorMessage ? (
                  <p className="text-xs text-destructive" role="alert">
                    {detailErrorMessage}
                  </p>
                ) : null}
                <div className="rounded-lg border border-border bg-muted/50 p-4">
                  <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <HugeiconsIcon
                      icon={Key01Icon}
                      size={14}
                      strokeWidth={1.8}
                    />{' '}
                    Config
                  </div>
                  <pre className="max-h-48 overflow-auto rounded-md border border-border bg-muted p-3 text-xs leading-relaxed text-foreground">
                    {JSON.stringify(detailQuery.data.profile.config, null, 2)}
                  </pre>
                </div>
              </div>
            ) : detailQuery.isLoading ? (
              <div className="flex min-h-[120px] items-center justify-center text-sm text-muted-foreground">
                Loading profile\u2026
              </div>
            ) : (
              <div className="flex min-h-[120px] items-center justify-center text-sm text-destructive">
                Failed to load profile.
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="shrink-0 flex justify-end border-t border-border px-6 py-3">
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDetailsName(null)}
                disabled={detailSaving}
              >
                Close
              </Button>
              <Button
                size="sm"
                type="button"
                onClick={() => void handleSaveProfileDetails()}
                disabled={detailSaving}
              >
                {detailSaving ? 'Saving…' : 'Save identity'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </DialogRoot>
    </div>
  )
}

function SummaryField({
  label,
  value,
  muted,
}: {
  label: string
  value: string
  muted?: boolean
}) {
  return (
    <div className="rounded-md border border-border bg-muted p-2.5">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          'mt-0.5 text-sm font-medium',
          muted ? 'text-muted-foreground' : 'text-foreground',
        )}
      >
        {value}
      </div>
    </div>
  )
}

function DetailField({
  label,
  value,
  mono,
  muted,
  accent,
  full,
}: {
  label: string
  value: string
  mono?: boolean
  muted?: boolean
  accent?: boolean
  full?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-muted/50 p-3',
        full && 'sm:col-span-2',
      )}
    >
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          'mt-1 text-sm break-all',
          mono && 'font-mono text-xs',
          muted
            ? 'text-muted-foreground'
            : accent
              ? 'font-semibold text-success'
              : 'text-foreground',
        )}
      >
        {value}
      </div>
    </div>
  )
}
