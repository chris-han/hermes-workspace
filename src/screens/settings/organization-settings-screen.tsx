import { useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  Building02Icon,
  CheckmarkCircle02Icon,
  Plug01Icon,
  Search01Icon,
  UserMultipleIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useEffect, useMemo, useState } from 'react'
import type {
  DemoOrganizationProfile,
  EntitlementDecision,
  KnowledgeTier,
  OrganizationMembership,
  T6MaterializationMode,
} from '@/lib/organization-membership'
import {
  DEFAULT_SMB_ORGANIZATION_ID,
  DEFAULT_SMB_ORGANIZATION_NAME,
  createRealCompanyOrganization,
  ensureDefaultSmbOrganization,
  findRealCompanyMembership,
  isRealOrganizationContext,
  knowledgeAccessQueryKey,
  organizationSettingsQueryKey,
  updateOrganizationMaterializationPolicy,
  updateOrganizationMemberRole,
  upsertOrganizationAssociation,
  useDemoOrganizationProfiles,
  useKnowledgeEntitlementContract,
  useOrganizationSettings,
} from '@/lib/organization-membership'
import { usePageTitle } from '@/hooks/use-page-title'
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
    'Start from the governed bootstrap demo organization, then switch to a real company when you are ready to stage company data.',
}

const KNOWLEDGE_TIERS: Array<KnowledgeTier> = [
  'T1',
  'T2',
  'T3',
  'T4',
  'T5',
  'T6',
]
const KNOWLEDGE_UI_ACTIONS = ['view', 'propose', 'review'] as const

export interface OrganizationSearchOption {
  organization_id: string
  organization_name: string
  dataset_type?: string | null
  industry_code?: string | null
  dataset_key?: string | null
  dataset_version?: string | null
  bootstrap_source?: string | null
  demo_prompt_profile?: string | null
  membership_status?: string | null
  member_role?: string | null
  seeded?: boolean
}

export function buildOrganizationSearchOptions(
  memberships: Array<OrganizationMembership>,
  demoProfiles: Array<DemoOrganizationProfile>,
): Array<OrganizationSearchOption> {
  const options = new Map<string, OrganizationSearchOption>()

  for (const profile of demoProfiles) {
    options.set(profile.organization_id, {
      ...profile,
      organization_name: profile.organization_name || profile.organization_id,
    })
  }

  for (const membership of memberships) {
    const existing = options.get(membership.organization_id)
    options.set(membership.organization_id, {
      ...existing,
      ...membership,
      organization_name:
        membership.organization_name ||
        existing?.organization_name ||
        membership.organization_id,
      dataset_key: existing?.dataset_key,
      dataset_version: existing?.dataset_version,
      bootstrap_source: existing?.bootstrap_source,
      demo_prompt_profile: existing?.demo_prompt_profile,
      seeded: existing?.seeded,
    })
  }

  return Array.from(options.values()).sort((left, right) =>
    left.organization_name.localeCompare(right.organization_name, undefined, {
      sensitivity: 'base',
    }),
  )
}

export function filterOrganizationSearchOptions(
  options: Array<OrganizationSearchOption>,
  query: string,
): Array<OrganizationSearchOption> {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) {
    return options.slice(0, 6)
  }

  return options
    .filter((option) =>
      [
        option.organization_name,
        option.organization_id,
        option.industry_code,
        option.dataset_type,
        option.dataset_key,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery)),
    )
    .slice(0, 8)
}

function entitlementTone(decision: EntitlementDecision): string {
  if (decision === 'allow') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300'
  }
  if (decision === 'allow_with_review') {
    return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300'
  }
  return 'border-primary-200 bg-primary-100/80 text-primary-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300'
}

function entitlementLabel(decision: EntitlementDecision): string {
  if (decision === 'allow') return 'Allow'
  if (decision === 'allow_with_review') return 'Review'
  return 'Deny'
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

function organizationOptionTags(
  option: OrganizationSearchOption,
): Array<string> {
  return [
    option.membership_status ? `membership: ${option.membership_status}` : null,
    option.member_role ? `role: ${option.member_role}` : null,
    option.dataset_type,
    option.industry_code,
    option.seeded ? 'seeded' : null,
  ].filter(Boolean) as Array<string>
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
          disabled={
            active || switching || membership.membership_status !== 'active'
          }
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
  const demoProfilesQuery = useDemoOrganizationProfiles()
  const [organizationId, setOrganizationId] = useState(
    DEFAULT_SMB_ORGANIZATION_ID,
  )
  const [organizationName, setOrganizationName] = useState(
    DEFAULT_SMB_ORGANIZATION_NAME,
  )
  const [organizationSearch, setOrganizationSearch] = useState('')
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<
    string | null
  >(DEFAULT_SMB_ORGANIZATION_ID)
  const [createIfMissing, setCreateIfMissing] = useState(true)
  const [savePending, setSavePending] = useState(false)
  const [defaultPending, setDefaultPending] = useState(false)
  const [realCompanyOpen, setRealCompanyOpen] = useState(false)
  const [realCompanyPending, setRealCompanyPending] = useState(false)
  const [realCompanyName, setRealCompanyName] = useState('')
  const [realCompanySlug, setRealCompanySlug] = useState('')
  const [realCompanyIndustryCode, setRealCompanyIndustryCode] = useState('')
  const [realCompanyFiscalMonth, setRealCompanyFiscalMonth] = useState(1)
  const [realCompanyCurrency, setRealCompanyCurrency] = useState('CNY')
  const [policyPending, setPolicyPending] = useState(false)
  const [rolePendingUserId, setRolePendingUserId] = useState<string | null>(
    null,
  )
  const [policyDefaultMode, setPolicyDefaultMode] =
    useState<T6MaterializationMode>('AUTO')
  const [autoAllowedClaimClassesText, setAutoAllowedClaimClassesText] =
    useState('')
  const [
    approvalRequiredClaimClassesText,
    setApprovalRequiredClaimClassesText,
  ] = useState('')
  const [memberRoleDrafts, setMemberRoleDrafts] = useState<
    Record<string, 'owner' | 'member'>
  >({})
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const entitlementQuery = useKnowledgeEntitlementContract()

  useEffect(() => {
    if (
      organizationId === DEFAULT_SMB_ORGANIZATION_ID &&
      !organizationName.trim()
    ) {
      setOrganizationName(DEFAULT_SMB_ORGANIZATION_NAME)
    }
  }, [organizationId, organizationName])

  useEffect(() => {
    const policy =
      organizationQuery.data?.organization?.t6_materialization_policy ?? null
    if (!policy) {
      setPolicyDefaultMode('AUTO')
      setAutoAllowedClaimClassesText('')
      setApprovalRequiredClaimClassesText('')
      return
    }
    setPolicyDefaultMode(policy.default_mode || 'AUTO')
    setAutoAllowedClaimClassesText(
      (policy.auto_allowed_claim_classes ?? []).join(', '),
    )
    setApprovalRequiredClaimClassesText(
      (policy.approval_required_claim_classes ?? []).join(', '),
    )
  }, [organizationQuery.data?.organization?.t6_materialization_policy])

  useEffect(() => {
    const members = organizationQuery.data?.members ?? []
    if (!Array.isArray(members) || members.length === 0) {
      setMemberRoleDrafts({})
      return
    }
    const nextDrafts: Record<string, 'owner' | 'member'> = {}
    for (const member of members) {
      const role =
        member.member_role === 'owner' || member.member_role === 'member'
          ? member.member_role
          : 'member'
      nextDrafts[member.user_id] = role
    }
    setMemberRoleDrafts(nextDrafts)
  }, [organizationQuery.data?.members])

  function parseCommaSeparatedValues(raw: string): Array<string> {
    return Array.from(
      new Set(
        raw
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    )
  }

  async function refreshOrganizationContext() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: semantierAuthQueryKey }),
      queryClient.invalidateQueries({ queryKey: organizationSettingsQueryKey }),
      queryClient.invalidateQueries({ queryKey: knowledgeAccessQueryKey }),
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

  function handleSelectOrganization(option: OrganizationSearchOption) {
    setOrganizationId(option.organization_id)
    setOrganizationName(option.organization_name)
    setSelectedOrganizationId(option.organization_id)
    setCreateIfMissing(false)
    setErrorMessage(null)
  }

  async function handleUseSmbDefault() {
    setDefaultPending(true)
    setErrorMessage(null)
    setOrganizationId(DEFAULT_SMB_ORGANIZATION_ID)
    setOrganizationName(DEFAULT_SMB_ORGANIZATION_NAME)
    setSelectedOrganizationId(DEFAULT_SMB_ORGANIZATION_ID)
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

  async function handleCreateRealCompany() {
    setRealCompanyPending(true)
    setErrorMessage(null)
    try {
      const payload = await createRealCompanyOrganization({
        companyDisplayName: realCompanyName,
        organizationId: realCompanySlug,
        industryCode: realCompanyIndustryCode,
        fiscalYearStartMonth: realCompanyFiscalMonth,
        localCurrency: realCompanyCurrency,
      })
      await refreshOrganizationContext()
      setRealCompanyOpen(false)
      toast('Real company context activated', { type: 'success' })
      window.location.assign(
        payload.landing_route ||
          '/settings/data-connections?import=company-dataset',
      )
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to create real company'
      setErrorMessage(message)
      toast(message, { type: 'warning' })
    } finally {
      setRealCompanyPending(false)
    }
  }

  async function handleSaveMaterializationPolicy() {
    setPolicyPending(true)
    setErrorMessage(null)
    try {
      await updateOrganizationMaterializationPolicy({
        default_mode: policyDefaultMode,
        auto_allowed_claim_classes: parseCommaSeparatedValues(
          autoAllowedClaimClassesText,
        ),
        approval_required_claim_classes: parseCommaSeparatedValues(
          approvalRequiredClaimClassesText,
        ),
      })
      await refreshOrganizationContext()
      toast('Materialization policy updated', { type: 'success' })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to update policy'
      setErrorMessage(message)
      toast(message, { type: 'warning' })
    } finally {
      setPolicyPending(false)
    }
  }

  async function handleUpdateMemberRole(
    userId: string,
    memberRole: 'owner' | 'member',
  ) {
    setRolePendingUserId(userId)
    setErrorMessage(null)
    try {
      await updateOrganizationMemberRole({ userId, memberRole })
      await refreshOrganizationContext()
      toast('Member role updated', { type: 'success' })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to update role'
      setErrorMessage(message)
      toast(message, { type: 'warning' })
    } finally {
      setRolePendingUserId(null)
    }
  }

  const activeOrganization = authQuery.data?.organization_id
  const memberships = organizationQuery.data?.memberships ?? []
  const activeOrganizationContext = organizationQuery.data?.organization ?? null
  const realCompanyMembership = findRealCompanyMembership(
    memberships,
    activeOrganizationContext?.organization_id || activeOrganization,
  )
  const members = organizationQuery.data?.members ?? []
  const currentUserId = authQuery.data?.user?.user_id || null
  const currentMemberRole = authQuery.data?.member_role || null
  const canChangeSettings = Boolean(authQuery.data?.can_change_settings)
  const canEditRoles = authQuery.data?.membership_status === 'active'
  const policy =
    organizationQuery.data?.organization?.t6_materialization_policy ?? null
  const adminContacts = members.filter(
    (member) =>
      member.membership_status === 'active' &&
      (member.member_role === 'owner' || member.member_role === 'admin'),
  )
  const organizationSearchOptions = useMemo(
    () =>
      buildOrganizationSearchOptions(memberships, demoProfilesQuery.data ?? []),
    [memberships, demoProfilesQuery.data],
  )
  const visibleOrganizationOptions = useMemo(
    () =>
      filterOrganizationSearchOptions(
        organizationSearchOptions,
        organizationSearch,
      ),
    [organizationSearchOptions, organizationSearch],
  )

  return (
    <div className="min-h-screen bg-surface text-primary-900">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
        <header className="rounded-3xl border border-primary-200 bg-primary-50/80 p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/60">
          <div className="flex items-start gap-3">
            <span className="inline-flex size-10 items-center justify-center rounded-2xl border border-primary-200 bg-primary-100/70 dark:border-neutral-800 dark:bg-neutral-900">
              <HugeiconsIcon
                icon={Building02Icon}
                size={20}
                strokeWidth={1.5}
              />
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

        <section className="rounded-3xl border border-primary-200 bg-white/80 p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/70">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-primary-500 dark:text-neutral-400">
                Active Company
              </div>
              <h2 className="mt-1 text-lg font-semibold text-primary-900 dark:text-neutral-100">
                {organizationQuery.data?.organization?.organization_name ||
                  authQuery.data?.organization_name ||
                  'No organization selected'}
              </h2>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border border-primary-200 px-2 py-1 font-mono dark:border-neutral-700">
                  {organizationQuery.data?.organization?.organization_id ||
                    authQuery.data?.organization_id ||
                    'unassigned'}
                </span>
                <span className="rounded-full border border-primary-200 px-2 py-1 font-semibold dark:border-neutral-700">
                  {organizationQuery.data?.organization?.dataset_type ||
                    'NO_DATASET'}
                </span>
                <span className="rounded-full border border-primary-200 px-2 py-1 font-semibold dark:border-neutral-700">
                  {organizationQuery.data?.organization?.authority_state ||
                    'REAL_EMPTY'}
                </span>
                {organizationQuery.data?.organization
                  ?.active_dataset_version_id ? (
                  <span className="rounded-full border border-emerald-200 px-2 py-1 font-mono text-emerald-700 dark:border-emerald-900 dark:text-emerald-300">
                    {
                      organizationQuery.data.organization
                        .active_dataset_version_id
                    }
                  </span>
                ) : null}
              </div>
            </div>
            {isRealOrganizationContext(activeOrganizationContext) ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleUseSmbDefault}
                  disabled={defaultPending || savePending}
                >
                  Switch to demo company
                </Button>
                <Link
                  to="/settings/data-connections"
                  search={{ import: 'company-dataset' }}
                  className="rounded-xl border border-primary-300 px-3 py-2 text-sm font-semibold text-primary-700 dark:border-neutral-700 dark:text-neutral-200"
                >
                  Open dataset import
                </Link>
              </div>
            ) : realCompanyMembership ? (
              <Button
                type="button"
                onClick={() =>
                  handleActivate(realCompanyMembership.organization_id)
                }
                disabled={savePending || defaultPending}
              >
                Switch to real company
              </Button>
            ) : (
              <Button type="button" onClick={() => setRealCompanyOpen(true)}>
                Switch to real company
              </Button>
            )}
          </div>

          {realCompanyOpen ? (
            <div className="mt-5 grid gap-3 rounded-2xl border border-primary-200 bg-primary-50/70 p-4 dark:border-neutral-800 dark:bg-neutral-950/60 md:grid-cols-2">
              <label className="text-sm font-medium text-primary-900 dark:text-neutral-100">
                Company display name
                <Input
                  value={realCompanyName}
                  onChange={(event) => setRealCompanyName(event.target.value)}
                  placeholder="Soyon Technology"
                  className="mt-1"
                />
              </label>
              <label className="text-sm font-medium text-primary-900 dark:text-neutral-100">
                Organization slug
                <Input
                  value={realCompanySlug}
                  onChange={(event) => setRealCompanySlug(event.target.value)}
                  placeholder="soyon"
                  className="mt-1"
                />
              </label>
              <label className="text-sm font-medium text-primary-900 dark:text-neutral-100">
                Industry code
                <Input
                  value={realCompanyIndustryCode}
                  onChange={(event) =>
                    setRealCompanyIndustryCode(event.target.value)
                  }
                  placeholder="software_services"
                  className="mt-1"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm font-medium text-primary-900 dark:text-neutral-100">
                  Fiscal month
                  <Input
                    type="number"
                    min={1}
                    max={12}
                    value={realCompanyFiscalMonth}
                    onChange={(event) =>
                      setRealCompanyFiscalMonth(Number(event.target.value) || 1)
                    }
                    className="mt-1"
                  />
                </label>
                <label className="text-sm font-medium text-primary-900 dark:text-neutral-100">
                  Currency
                  <Input
                    value={realCompanyCurrency}
                    onChange={(event) =>
                      setRealCompanyCurrency(event.target.value)
                    }
                    className="mt-1"
                  />
                </label>
              </div>
              <div className="flex flex-wrap gap-2 md:col-span-2">
                <Button
                  type="button"
                  onClick={handleCreateRealCompany}
                  disabled={realCompanyPending}
                >
                  Create and switch
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRealCompanyOpen(false)}
                  disabled={realCompanyPending}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <div className="rounded-3xl border border-primary-200 bg-primary-50/80 p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/60">
            <div className="mb-4 flex items-start gap-3">
              <HugeiconsIcon icon={Plug01Icon} size={20} strokeWidth={1.5} />
              <div>
                <h2 className="text-base font-semibold text-primary-900 dark:text-neutral-100">
                  Associate Organization
                </h2>
                <p className="mt-1 text-sm text-primary-600 dark:text-neutral-400">
                  The active organization becomes the default organization_id
                  for governed chat and analytics context. Use the bootstrap
                  demo organization or connect a different organization
                  explicitly.
                </p>
              </div>
            </div>

            <div className="mb-4 rounded-2xl border border-primary-200 bg-white/80 p-4 dark:border-neutral-800 dark:bg-neutral-900/70">
              <label
                className="text-sm font-medium text-primary-900 dark:text-neutral-100"
                htmlFor="organization-search"
              >
                Search Organization Name
              </label>
              <div className="relative mt-2">
                <HugeiconsIcon
                  icon={Search01Icon}
                  size={18}
                  strokeWidth={1.5}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-primary-500 dark:text-neutral-400"
                />
                <Input
                  id="organization-search"
                  value={organizationSearch}
                  onChange={(event) =>
                    setOrganizationSearch(event.target.value)
                  }
                  placeholder="Search by organization name, ID, or dataset"
                  className="pl-10"
                />
              </div>
              <div className="mt-3 grid gap-2">
                {demoProfilesQuery.isLoading || organizationQuery.isLoading ? (
                  <div className="rounded-2xl border border-primary-100 bg-primary-50/70 px-3 py-3 text-sm text-primary-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400">
                    Loading organizations...
                  </div>
                ) : visibleOrganizationOptions.length > 0 ? (
                  visibleOrganizationOptions.map((option) => {
                    const selected =
                      selectedOrganizationId === option.organization_id ||
                      organizationId === option.organization_id
                    return (
                      <button
                        key={option.organization_id}
                        type="button"
                        className={`flex w-full items-start justify-between gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                          selected
                            ? 'border-primary-400 bg-primary-100/80 dark:border-neutral-600 dark:bg-neutral-800'
                            : 'border-primary-100 bg-primary-50/70 hover:border-primary-300 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:border-neutral-600'
                        }`}
                        onClick={() => handleSelectOrganization(option)}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-primary-900 dark:text-neutral-100">
                            {option.organization_name}
                          </span>
                          <span className="mt-1 block truncate font-mono text-xs text-primary-500 dark:text-neutral-400">
                            {option.organization_id}
                          </span>
                          <span className="mt-2 flex flex-wrap gap-1.5">
                            {organizationOptionTags(option).map((tag) => (
                              <span
                                key={tag}
                                className="rounded-full border border-primary-200 bg-white/80 px-2 py-0.5 text-[11px] font-medium text-primary-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
                              >
                                {tag}
                              </span>
                            ))}
                          </span>
                        </span>
                        <span className="shrink-0 rounded-full border border-primary-200 bg-white px-2.5 py-1 text-xs font-medium text-primary-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200">
                          {selected ? 'Selected' : 'Select'}
                        </span>
                      </button>
                    )
                  })
                ) : (
                  <div className="rounded-2xl border border-primary-100 bg-primary-50/70 px-3 py-3 text-sm text-primary-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400">
                    No governed organization profile matched this search. Enter
                    an organization ID and name below to request or create one.
                  </div>
                )}
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
                  onChange={(event) => {
                    setOrganizationId(event.target.value)
                    setSelectedOrganizationId(null)
                  }}
                  placeholder={DEFAULT_SMB_ORGANIZATION_ID}
                />
                <p className="text-xs text-primary-500 dark:text-neutral-400">
                  `{DEFAULT_SMB_ORGANIZATION_ID}` is the seeded
                  北京索阳科技有限公司 bootstrap organization.
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
                  onChange={(event) => {
                    setOrganizationName(event.target.value)
                    setSelectedOrganizationId(null)
                  }}
                  placeholder={DEFAULT_SMB_ORGANIZATION_NAME}
                />
                <p className="text-xs text-primary-500 dark:text-neutral-400">
                  Only used when you create an organization that does not exist
                  yet.
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
                    When enabled, Hermes will create the organization locally if
                    it is not already registered.
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
                  This is the active organization attached to the authenticated
                  user.
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
                    {authQuery.data?.organization_name ||
                      'No organization selected'}
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
            <HugeiconsIcon
              icon={CheckmarkCircle02Icon}
              size={20}
              strokeWidth={1.5}
            />
            <div>
              <h2 className="text-base font-semibold text-primary-900 dark:text-neutral-100">
                Materialization Governance
              </h2>
              <p className="mt-1 text-sm text-primary-600 dark:text-neutral-400">
                Organization-level policy controls how T6 candidates route by
                default. The default mode is auto-approve unless your policy
                requires approval for specific claim classes.
              </p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="rounded-2xl border border-primary-200 bg-white/80 p-4 dark:border-neutral-800 dark:bg-neutral-900/70">
              <div className="space-y-3">
                {!canChangeSettings ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
                    Mode editing requires an active organization membership with
                    member role owner or admin. Current status: role=
                    {currentMemberRole || 'none'}, membership=
                    {authQuery.data?.membership_status || 'unassigned'}. Access
                    Control "administrator" mode does not grant organization
                    governance permissions.
                  </div>
                ) : null}
                <label className="text-sm font-medium text-primary-900 dark:text-neutral-100">
                  Default Mode
                </label>
                <select
                  value={policyDefaultMode}
                  onChange={(event) =>
                    setPolicyDefaultMode(
                      event.target.value as T6MaterializationMode,
                    )
                  }
                  disabled={!canChangeSettings || policyPending}
                  className="h-10 w-full rounded-md border border-primary-200 bg-white px-3 text-sm text-primary-900 outline-none ring-primary-200 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                >
                  <option value="AUTO">AUTO (Auto-approve)</option>
                  <option value="APPROVAL">APPROVAL (Human in the loop)</option>
                </select>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-primary-900 dark:text-neutral-100">
                    Auto-Allowed Claim Classes
                  </label>
                  <Input
                    value={autoAllowedClaimClassesText}
                    onChange={(event) =>
                      setAutoAllowedClaimClassesText(event.target.value)
                    }
                    placeholder="invoice.validation.low_risk, reconciliation.match"
                    disabled={!canChangeSettings || policyPending}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-primary-900 dark:text-neutral-100">
                    Approval-Required Claim Classes
                  </label>
                  <Input
                    value={approvalRequiredClaimClassesText}
                    onChange={(event) =>
                      setApprovalRequiredClaimClassesText(event.target.value)
                    }
                    placeholder="voucher.adjustment.high_impact"
                    disabled={!canChangeSettings || policyPending}
                  />
                </div>

                <Button
                  type="button"
                  onClick={handleSaveMaterializationPolicy}
                  disabled={!canChangeSettings || policyPending}
                >
                  {policyPending ? 'Saving Policy...' : 'Save Policy'}
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-primary-200 bg-white/80 p-4 dark:border-neutral-800 dark:bg-neutral-900/70">
              <div className="space-y-2 text-sm text-primary-700 dark:text-neutral-300">
                <div>
                  <span className="font-semibold text-primary-900 dark:text-neutral-100">
                    Effective mode:
                  </span>{' '}
                  {policy?.default_mode || 'AUTO'}
                </div>
                <div className="break-all">
                  <span className="font-semibold text-primary-900 dark:text-neutral-100">
                    Policy hash:
                  </span>{' '}
                  <span className="font-mono text-xs">
                    {policy?.policy_version_hash || 'pending'}
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-primary-900 dark:text-neutral-100">
                    Updated at:
                  </span>{' '}
                  {policy?.updated_at || 'n/a'}
                </div>
                <p className="pt-2 text-xs text-primary-600 dark:text-neutral-400">
                  Auto-approve applies first unless a claim class is explicitly
                  constrained by approval-required rules.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-primary-200 bg-primary-50/80 p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/60">
          <div className="mb-4 flex items-start gap-3">
            <HugeiconsIcon
              icon={UserMultipleIcon}
              size={20}
              strokeWidth={1.5}
            />
            <div>
              <h2 className="text-base font-semibold text-primary-900 dark:text-neutral-100">
                Organization Roles
              </h2>
              <p className="mt-1 text-sm text-primary-600 dark:text-neutral-400">
                Manage roles for members in this organization. Owners can assign
                owner/member.
              </p>
            </div>
          </div>

          {organizationQuery.isLoading ? (
            <div className="text-sm text-primary-600 dark:text-neutral-400">
              Loading members...
            </div>
          ) : members.length === 0 ? (
            <div className="rounded-2xl border border-primary-200 bg-white/80 px-4 py-6 text-sm text-primary-600 dark:border-neutral-800 dark:bg-neutral-900/70 dark:text-neutral-400">
              No members found for the active organization.
            </div>
          ) : (
            <div className="space-y-3">
              {adminContacts.length > 0 ? (
                <div className="rounded-2xl border border-primary-200 bg-white/80 px-4 py-3 text-sm text-primary-700 dark:border-neutral-800 dark:bg-neutral-900/70 dark:text-neutral-300">
                  Ask these org admins:{' '}
                  {adminContacts.map((member) => member.name).join(', ')}
                </div>
              ) : (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
                  No active owner/admin is assigned yet. Any active member can
                  assign one owner.
                </div>
              )}

              {!canEditRoles ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
                  Role editing requires active membership in the selected
                  organization.
                </div>
              ) : null}

              <div className="overflow-x-auto rounded-2xl border border-primary-200 bg-white/80 dark:border-neutral-800 dark:bg-neutral-900/70">
                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-primary-200 dark:border-neutral-800">
                      <th className="px-4 py-3 text-left font-semibold text-primary-900 dark:text-neutral-100">
                        Member
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-primary-900 dark:text-neutral-100">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-primary-900 dark:text-neutral-100">
                        Role
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-primary-900 dark:text-neutral-100">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((member) => {
                      const currentRole =
                        member.member_role === 'owner' ||
                        member.member_role === 'member'
                          ? member.member_role
                          : 'member'
                      const draftRole =
                        memberRoleDrafts[member.user_id] || currentRole
                      const roleChoices: Array<'owner' | 'member'> = [
                        'owner',
                        'member',
                      ]
                      const roleChanged = draftRole !== currentRole
                      const roleActionDisabled =
                        !canEditRoles ||
                        !roleChanged ||
                        member.membership_status !== 'active' ||
                        rolePendingUserId === member.user_id

                      return (
                        <tr
                          key={member.user_id}
                          className="border-b border-primary-100 last:border-b-0 dark:border-neutral-800"
                        >
                          <td className="px-4 py-3">
                            <div className="text-sm font-semibold text-primary-900 dark:text-neutral-100">
                              {member.name}
                              {member.user_id === currentUserId ? ' (you)' : ''}
                            </div>
                            <div className="mt-1 font-mono text-xs text-primary-500 dark:text-neutral-400">
                              {member.user_id}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide ${membershipTone(
                                member.membership_status,
                              )}`}
                            >
                              {member.membership_status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={draftRole}
                              onChange={(event) =>
                                setMemberRoleDrafts((current) => ({
                                  ...current,
                                  [member.user_id]: event.target.value as
                                    | 'owner'
                                    | 'member',
                                }))
                              }
                              disabled={
                                !canEditRoles ||
                                rolePendingUserId === member.user_id
                              }
                              className="h-9 w-full rounded-md border border-primary-200 bg-white px-2 text-sm text-primary-900 outline-none ring-primary-200 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                            >
                              {roleChoices.map((role) => (
                                <option key={role} value={role}>
                                  {role}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-3">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={roleActionDisabled}
                              onClick={() =>
                                handleUpdateMemberRole(
                                  member.user_id,
                                  draftRole,
                                )
                              }
                            >
                              {rolePendingUserId === member.user_id
                                ? 'Saving...'
                                : 'Apply'}
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-primary-200 bg-primary-50/80 p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/60">
          <div className="mb-4 flex items-start gap-3">
            <HugeiconsIcon
              icon={UserMultipleIcon}
              size={20}
              strokeWidth={1.5}
            />
            <div>
              <h2 className="text-base font-semibold text-primary-900 dark:text-neutral-100">
                Known Memberships
              </h2>
              <p className="mt-1 text-sm text-primary-600 dark:text-neutral-400">
                Switch between active memberships without editing auth records
                manually.
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
              to create `{DEFAULT_SMB_ORGANIZATION_ID}` locally and attach it to
              this user.
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-primary-200 bg-primary-50/80 p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/60">
          <div className="mb-4 flex items-start gap-3">
            <HugeiconsIcon
              icon={CheckmarkCircle02Icon}
              size={20}
              strokeWidth={1.5}
            />
            <div>
              <h2 className="text-base font-semibold text-primary-900 dark:text-neutral-100">
                Knowledge Access
              </h2>
              <p className="mt-1 text-sm text-primary-600 dark:text-neutral-400">
                Live entitlement projection from the Semantier backend contract.
                This page shows `view / propose / review` only and does not
                expose direct activate or execute controls.
              </p>
            </div>
          </div>

          {entitlementQuery.isLoading ? (
            <div className="text-sm text-primary-600 dark:text-neutral-400">
              Loading knowledge access contract...
            </div>
          ) : entitlementQuery.error instanceof Error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-6 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
              {entitlementQuery.error.message}
            </div>
          ) : entitlementQuery.data ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {entitlementQuery.data.principal.assigned_bundles.map(
                  (bundle) => (
                    <span
                      key={bundle}
                      className="inline-flex rounded-full border border-primary-200 bg-white/80 px-2.5 py-1 font-medium uppercase tracking-wide text-primary-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300"
                    >
                      {bundle}
                    </span>
                  ),
                )}
                <span className="inline-flex rounded-full border border-primary-200 bg-white/80 px-2.5 py-1 text-primary-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
                  {entitlementQuery.data.organization_context
                    .official_display_name ||
                    entitlementQuery.data.organization_context.organization_id}
                </span>
                <span className="inline-flex rounded-full border border-primary-200 bg-white/80 px-2.5 py-1 text-primary-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
                  {entitlementQuery.data.schema_version}
                </span>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-primary-200 bg-white/80 dark:border-neutral-800 dark:bg-neutral-900/70">
                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-primary-200 dark:border-neutral-800">
                      <th className="px-4 py-3 text-left font-semibold text-primary-900 dark:text-neutral-100">
                        Tier
                      </th>
                      {KNOWLEDGE_UI_ACTIONS.map((action) => (
                        <th
                          key={action}
                          className="px-4 py-3 text-left font-semibold capitalize text-primary-900 dark:text-neutral-100"
                        >
                          {action}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {KNOWLEDGE_TIERS.map((tier) => {
                      const tierProjection =
                        entitlementQuery.data.ui_projection.tiers[tier]
                      return (
                        <tr
                          key={tier}
                          className="border-b border-primary-100 last:border-b-0 dark:border-neutral-800"
                        >
                          <td className="px-4 py-3 font-mono text-xs text-primary-700 dark:text-neutral-300">
                            {tier}
                          </td>
                          {KNOWLEDGE_UI_ACTIONS.map((action) => {
                            const decision = tierProjection[action]
                            return (
                              <td key={action} className="px-4 py-3">
                                <span
                                  className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide ${entitlementTone(
                                    decision,
                                  )}`}
                                >
                                  {entitlementLabel(decision)}
                                </span>
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-3 lg:grid-cols-3">
                {Object.entries(entitlementQuery.data.bundle_preview).map(
                  ([bundle, preview]) => (
                    <div
                      key={bundle}
                      className="rounded-2xl border border-primary-200 bg-white/80 p-4 dark:border-neutral-800 dark:bg-neutral-900/70"
                    >
                      <div className="text-sm font-semibold uppercase tracking-wide text-primary-900 dark:text-neutral-100">
                        {bundle}
                      </div>
                      <div className="mt-3 space-y-2">
                        {KNOWLEDGE_TIERS.map((tier) => (
                          <div
                            key={tier}
                            className="flex items-center justify-between gap-3 text-xs"
                          >
                            <span className="font-mono text-primary-600 dark:text-neutral-400">
                              {tier}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {KNOWLEDGE_UI_ACTIONS.map((action) => (
                                <span
                                  key={action}
                                  className={`inline-flex rounded-full border px-2 py-0.5 ${entitlementTone(
                                    preview.tiers[tier][action],
                                  )}`}
                                  title={`${action}: ${preview.tiers[tier][action]}`}
                                >
                                  {action[0].toUpperCase()}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ),
                )}
              </div>

              <p className="text-xs text-primary-600 dark:text-neutral-400">
                `allow_with_review` means you may initiate the path but cannot
                complete it alone. Final authority still depends on governance
                conditions in the backend contract.
              </p>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  )
}
