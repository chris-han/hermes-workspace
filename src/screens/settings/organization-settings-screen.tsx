import { useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  Building02Icon,
  CheckmarkCircle02Icon,
  Plug01Icon,
  UserMultipleIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useEffect, useState } from 'react'
import type { OrganizationMembership } from '@/lib/organization-membership'
import { usePageTitle } from '@/hooks/use-page-title'
import {
  DEFAULT_SMB_ORGANIZATION_ID,
  DEFAULT_SMB_ORGANIZATION_NAME,
  ensureDefaultSmbOrganization,
  organizationSettingsQueryKey,
  upsertOrganizationAssociation,
  useOrganizationSettings,
} from '@/lib/organization-membership'
import {
  semantierAuthQueryKey,
  useSemantierAuthStatus,
} from '@/lib/semantier-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/components/ui/toast'

export const ORGANIZATION_SETTINGS_COPY = {
  title: 'Organization Context',
  subtitle:
    'Associate your user with an organization and set the active organization_id used as the default SMB analytics context.',
}

function membershipTone(status: string): string {
  if (status === 'active') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300'
  }
  if (status === 'pending') {
    return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300'
  }
  return 'border-primary-200 bg-primary-100/80 text-primary-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300'
}

function OrganizationMembershipCard({
  membership,
  active,
  switching,
  onActivate,
}: {
  membership: OrganizationMembership
  active: boolean
  switching: boolean
  onActivate: (organizationId: string) => void
}) {
  return (
    <div className="rounded-2xl border border-primary-200 bg-white/80 p-4 dark:border-neutral-800 dark:bg-neutral-900/70">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-primary-900 dark:text-neutral-100">
            {membership.organization_name || membership.organization_id}
          </div>
          <div className="mt-1 text-xs text-primary-500 dark:text-neutral-400">
            <span className="font-mono">{membership.organization_id}</span>
            {membership.member_role ? ` · ${membership.member_role}` : ''}
          </div>
        </div>
        <span
          className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide ${membershipTone(
            membership.membership_status,
          )}`}
        >
          {active ? 'Active' : membership.membership_status}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-primary-600 dark:text-neutral-400">
          {active
            ? 'This organization is currently attached to your session context.'
            : 'Switching makes this organization the active default context for SMB dataset questions.'}
        </p>
        <Button
          type="button"
          variant={active ? 'outline' : 'default'}
          size="sm"
          disabled={active || switching || membership.membership_status !== 'active'}
          onClick={() => onActivate(membership.organization_id)}
        >
          {active ? 'Current' : 'Make Active'}
        </Button>
      </div>
    </div>
  )
}

export function OrganizationSettingsScreen() {
  usePageTitle('Organization Context')

  const queryClient = useQueryClient()
  const authQuery = useSemantierAuthStatus()
  const organizationQuery = useOrganizationSettings()
  const [organizationId, setOrganizationId] = useState(
    DEFAULT_SMB_ORGANIZATION_ID,
  )
  const [organizationName, setOrganizationName] = useState(
    DEFAULT_SMB_ORGANIZATION_NAME,
  )
  const [createIfMissing, setCreateIfMissing] = useState(true)
  const [savePending, setSavePending] = useState(false)
  const [defaultPending, setDefaultPending] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (organizationId === DEFAULT_SMB_ORGANIZATION_ID && !organizationName.trim()) {
      setOrganizationName(DEFAULT_SMB_ORGANIZATION_NAME)
    }
  }, [organizationId, organizationName])

  async function refreshOrganizationContext() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: semantierAuthQueryKey }),
      queryClient.invalidateQueries({ queryKey: organizationSettingsQueryKey }),
    ])
  }

  async function handleAssociate() {
    setSavePending(true)
    setErrorMessage(null)
    try {
      const payload = await upsertOrganizationAssociation({
        organizationId,
        organizationName,
        createIfMissing,
      })
      await refreshOrganizationContext()
      toast(
        payload.organization?.membership_status === 'pending'
          ? 'Organization association submitted for approval'
          : 'Organization context updated',
        {
          type:
            payload.organization?.membership_status === 'pending'
              ? 'warning'
              : 'success',
        },
      )
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to update organization'
      setErrorMessage(message)
      toast(message, { type: 'warning' })
    } finally {
      setSavePending(false)
    }
  }

  async function handleActivate(organizationIdToActivate: string) {
    setSavePending(true)
    setErrorMessage(null)
    try {
      await upsertOrganizationAssociation({
        organizationId: organizationIdToActivate,
        createIfMissing: false,
      })
      await refreshOrganizationContext()
      toast('Organization context updated', { type: 'success' })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to switch organization'
      setErrorMessage(message)
      toast(message, { type: 'warning' })
    } finally {
      setSavePending(false)
    }
  }

  async function handleUseSmbDefault() {
    setDefaultPending(true)
    setErrorMessage(null)
    setOrganizationId(DEFAULT_SMB_ORGANIZATION_ID)
    setOrganizationName(DEFAULT_SMB_ORGANIZATION_NAME)
    setCreateIfMissing(true)
    try {
      const payload = await ensureDefaultSmbOrganization()
      await refreshOrganizationContext()
      toast(
        payload.organization?.membership_status === 'pending'
          ? 'SMB default organization requested'
          : 'SMB default organization connected',
        {
          type:
            payload.organization?.membership_status === 'pending'
              ? 'warning'
              : 'success',
        },
      )
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to connect SMB default organization'
      setErrorMessage(message)
      toast(message, { type: 'warning' })
    } finally {
      setDefaultPending(false)
    }
  }

  const activeOrganization = authQuery.data?.organization_id
  const memberships = organizationQuery.data?.memberships ?? []

  return (
    <div className="min-h-screen bg-surface text-primary-900">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
        <header className="rounded-3xl border border-primary-200 bg-primary-50/80 p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/60">
          <div className="flex items-start gap-3">
            <span className="inline-flex size-10 items-center justify-center rounded-2xl border border-primary-200 bg-primary-100/70 dark:border-neutral-800 dark:bg-neutral-900">
              <HugeiconsIcon icon={Building02Icon} size={20} strokeWidth={1.5} />
            </span>
            <div className="space-y-1">
              <h1 className="text-xl font-semibold text-primary-900 dark:text-neutral-100">
                {ORGANIZATION_SETTINGS_COPY.title}
              </h1>
              <p className="max-w-3xl text-sm text-primary-600 dark:text-neutral-400">
                {ORGANIZATION_SETTINGS_COPY.subtitle}
              </p>
            </div>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <div className="rounded-3xl border border-primary-200 bg-primary-50/80 p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/60">
            <div className="mb-4 flex items-start gap-3">
              <HugeiconsIcon icon={Plug01Icon} size={20} strokeWidth={1.5} />
              <div>
                <h2 className="text-base font-semibold text-primary-900 dark:text-neutral-100">
                  Associate Organization
                </h2>
                <p className="mt-1 text-sm text-primary-600 dark:text-neutral-400">
                  The active organization becomes the default organization_id for
                  SMB analytics context. Use the SMB dataset default or connect a
                  different organization explicitly.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label
                  className="text-sm font-medium text-primary-900 dark:text-neutral-100"
                  htmlFor="organization-id"
                >
                  Organization ID
                </label>
                <Input
                  id="organization-id"
                  value={organizationId}
                  onChange={(event) => setOrganizationId(event.target.value)}
                  placeholder="org_smb_cn"
                />
                <p className="text-xs text-primary-500 dark:text-neutral-400">
                  `org_smb_cn` is the seeded SMB analytics dataset organization.
                </p>
              </div>
              <div className="space-y-2">
                <label
                  className="text-sm font-medium text-primary-900 dark:text-neutral-100"
                  htmlFor="organization-name"
                >
                  Organization Name
                </label>
                <Input
                  id="organization-name"
                  value={organizationName}
                  onChange={(event) => setOrganizationName(event.target.value)}
                  placeholder="SMB Analytics Dataset"
                />
                <p className="text-xs text-primary-500 dark:text-neutral-400">
                  Only used when you create an organization that does not exist yet.
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-primary-200 bg-white/80 p-4 dark:border-neutral-800 dark:bg-neutral-900/70">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-primary-900 dark:text-neutral-100">
                    Create if missing
                  </div>
                  <p className="text-xs text-primary-600 dark:text-neutral-400">
                    When enabled, Hermes will create the organization locally if it
                    is not already registered.
                  </p>
                </div>
                <Switch
                  checked={createIfMissing}
                  onCheckedChange={setCreateIfMissing}
                  aria-label="Create organization if missing"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  onClick={handleAssociate}
                  disabled={savePending || defaultPending}
                >
                  Save Organization Context
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleUseSmbDefault}
                  disabled={savePending || defaultPending}
                >
                  Use SMB Dataset Default
                </Button>
                <Link
                  to="/settings/data-connections"
                  className="text-sm text-primary-600 underline-offset-4 hover:underline dark:text-neutral-300"
                >
                  Review data connections
                </Link>
              </div>

              {errorMessage ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
                  {errorMessage}
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-3xl border border-primary-200 bg-primary-50/80 p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/60">
            <div className="mb-4 flex items-start gap-3">
              <HugeiconsIcon
                icon={CheckmarkCircle02Icon}
                size={20}
                strokeWidth={1.5}
              />
              <div>
                <h2 className="text-base font-semibold text-primary-900 dark:text-neutral-100">
                  Current Session Context
                </h2>
                <p className="mt-1 text-sm text-primary-600 dark:text-neutral-400">
                  This is the active organization attached to the authenticated user.
                </p>
              </div>
            </div>

            {authQuery.isLoading ? (
              <div className="text-sm text-primary-600 dark:text-neutral-400">
                Loading organization context...
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-2xl border border-primary-200 bg-white/80 p-4 dark:border-neutral-800 dark:bg-neutral-900/70">
                  <div className="text-sm font-semibold text-primary-900 dark:text-neutral-100">
                    {authQuery.data?.organization_name || 'No organization selected'}
                  </div>
                  <div className="mt-1 text-xs text-primary-500 dark:text-neutral-400">
                    <span className="font-mono">
                      {authQuery.data?.organization_id || 'unassigned'}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 font-medium uppercase tracking-wide ${membershipTone(
                        authQuery.data?.membership_status || 'unassigned',
                      )}`}
                    >
                      {authQuery.data?.membership_status || 'unassigned'}
                    </span>
                    {authQuery.data?.member_role ? (
                      <span className="inline-flex rounded-full border border-primary-200 bg-primary-100/80 px-2.5 py-1 font-medium text-primary-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
                        {authQuery.data.member_role}
                      </span>
                    ) : null}
                  </div>
                </div>
                <p className="text-xs text-primary-600 dark:text-neutral-400">
                  If chat routing is org-aware, this active organization is the
                  context it should read first before asking for a company name.
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-primary-200 bg-primary-50/80 p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/60">
          <div className="mb-4 flex items-start gap-3">
            <HugeiconsIcon icon={UserMultipleIcon} size={20} strokeWidth={1.5} />
            <div>
              <h2 className="text-base font-semibold text-primary-900 dark:text-neutral-100">
                Known Memberships
              </h2>
              <p className="mt-1 text-sm text-primary-600 dark:text-neutral-400">
                Switch between active memberships without editing auth records manually.
              </p>
            </div>
          </div>

          {organizationQuery.isLoading ? (
            <div className="text-sm text-primary-600 dark:text-neutral-400">
              Loading memberships...
            </div>
          ) : organizationQuery.error instanceof Error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-6 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
              {organizationQuery.error.message}
            </div>
          ) : memberships.length > 0 ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {memberships.map((membership) => (
                <OrganizationMembershipCard
                  key={membership.organization_id}
                  membership={membership}
                  active={membership.organization_id === activeOrganization}
                  switching={savePending || defaultPending}
                  onActivate={handleActivate}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-primary-200 bg-white/80 px-4 py-6 text-sm text-primary-600 dark:border-neutral-800 dark:bg-neutral-900/70 dark:text-neutral-400">
              No organization memberships exist yet. Use the SMB dataset default
              to create `org_smb_cn` locally and attach it to this user.
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
