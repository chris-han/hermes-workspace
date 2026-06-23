import { useQuery } from '@tanstack/react-query'

export const DEFAULT_SMB_ORGANIZATION_ID = 'org_smb_cn'
export const DEFAULT_SMB_ORGANIZATION_NAME = '北京索阳科技有限公司'

export interface OrganizationMembership {
  organization_id: string
  organization_name?: string | null
  dataset_type?: string | null
  industry_code?: string | null
  membership_status: string
  member_role?: string | null
  sharing_enabled?: boolean
  joined_at?: string | null
  updated_at?: string | null
}

export interface OrganizationContext {
  organization_id?: string | null
  organization_name?: string | null
  dataset_type?: string | null
  industry_code?: string | null
  setup_status?: string | null
  blocking_reasons?: Array<string>
  next_actions?: Array<string>
  setup_counts?: Record<string, number>
  authority_state?: string | null
  authority_state_deprecated?: boolean
  authority_state_remove_after?: string | null
  active_dataset_version_id?: string | null
  fiscal_year_start_month?: number | null
  local_currency?: string | null
  membership_status?: string | null
  member_role?: string | null
  sharing_enabled?: boolean
  can_invite_members?: boolean
  can_change_settings?: boolean
  t6_materialization_policy?: T6MaterializationPolicy | null
}

export type T6MaterializationMode = 'AUTO' | 'APPROVAL'

export interface T6MaterializationPolicy {
  default_mode: T6MaterializationMode
  auto_allowed_claim_classes: Array<string>
  approval_required_claim_classes: Array<string>
  confidence_thresholds: Record<string, number>
  escalation_rules: Record<string, unknown>
  policy_version_hash?: string
  updated_at?: string
}

export interface OrganizationMember {
  user_id: string
  name: string
  dataset_type?: string | null
  industry_code?: string | null
  membership_status: string
  member_role?: string | null
  sharing_enabled?: boolean
}

export interface OrganizationAuditEvent {
  organization_id: string
  event_type: string
  actor_user_id?: string | null
  subject_user_id?: string | null
  created_at?: string | null
  detail?: Record<string, unknown> | null
}

export interface OrganizationSettingsResponse {
  organization: OrganizationContext | null
  memberships: Array<OrganizationMembership>
  members: Array<OrganizationMember>
  audit_events: Array<OrganizationAuditEvent>
  pending_notifications?: Array<OrganizationAuditEvent>
}

export interface UpdateOrganizationMaterializationPolicyParams {
  default_mode?: T6MaterializationMode
  auto_allowed_claim_classes?: Array<string>
  approval_required_claim_classes?: Array<string>
  confidence_thresholds?: Record<string, number>
  escalation_rules?: Record<string, unknown>
}

export interface DemoOrganizationProfile {
  organization_id: string
  organization_name: string
  dataset_type?: string | null
  industry_code?: string | null
  dataset_key?: string | null
  dataset_version?: string | null
  bootstrap_source?: string | null
  demo_prompt_profile?: string | null
  seeded?: boolean
}

export type EntitlementDecision = 'allow' | 'allow_with_review' | 'deny'
export type KnowledgeTier = 'T1' | 'T2' | 'T3' | 'T4' | 'T5' | 'T6'
export type KnowledgeUiAction = 'view' | 'propose' | 'review'

export interface KnowledgeEntitlementCapabilityScope {
  organization_id?: string | null
  team_ids?: Array<string>
  authority_domains?: Array<string>
  workflow_set?: Array<string>
  semantic_tier_ceiling?: KnowledgeTier | null
  resource_classes?: Array<string>
}

export interface KnowledgeEntitlementGovernanceConditions {
  review_required?: boolean
  approver_roles?: Array<string>
  validator_required?: boolean
  replay_pin_required?: boolean
  activation_required?: boolean
}

export interface KnowledgeEntitlementCapability {
  capability: string
  decision: EntitlementDecision
  scope: KnowledgeEntitlementCapabilityScope
  governance_conditions?: KnowledgeEntitlementGovernanceConditions
  source?: {
    bundle_labels?: Array<string>
    direct_grant_ids?: Array<string>
  }
}

export interface KnowledgeEntitlementUiProjection {
  tiers: Record<KnowledgeTier, Record<KnowledgeUiAction, EntitlementDecision>>
  action_mapping: Record<KnowledgeUiAction, string>
  decision_legend: Record<EntitlementDecision, string>
}

export interface KnowledgeEntitlementBundlePreviewEntry {
  tiers: Record<KnowledgeTier, Record<KnowledgeUiAction, EntitlementDecision>>
}

export interface KnowledgeEntitlementContract {
  schema_version: string
  generated_at: string
  principal: {
    user_id: string
    organization_id: string
    assigned_bundles: Array<string>
    membership_status: string
  }
  organization_context: {
    organization_id: string
    official_display_name: string
    display_name_source: string
    workspace_id: string | null
  }
  effective_capabilities: Array<KnowledgeEntitlementCapability>
  ui_projection: KnowledgeEntitlementUiProjection
  bundle_preview: Record<string, KnowledgeEntitlementBundlePreviewEntry>
  evaluation_metadata: {
    resolver_version: string
    policy_mode: string
    derived_from: {
      assigned_bundle_labels: Array<string>
      direct_grants_present: boolean
    }
    warnings: Array<string>
  }
}

export const organizationSettingsQueryKey = ['organizations', 'me'] as const
export const knowledgeAccessQueryKey = [
  'organizations',
  'knowledge-access',
] as const
export const demoOrganizationProfilesQueryKey = [
  'organizations',
  'demo-profiles',
] as const

type JsonFetcher = typeof fetch

async function readJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
  fetchImpl: JsonFetcher = fetch,
): Promise<T> {
  const response = await fetchImpl(input, init)
  const payload = (await response.json().catch(() => ({}))) as
    | T
    | { detail?: unknown; error?: unknown }
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'detail' in payload
        ? String((payload as { detail?: unknown }).detail || '')
        : payload && typeof payload === 'object' && 'error' in payload
          ? String((payload as { error?: unknown }).error || '')
          : `Request failed (${response.status})`
    throw new Error(message || `Request failed (${response.status})`)
  }
  return payload as T
}

export async function fetchOrganizationSettings(
  fetchImpl: JsonFetcher = fetch,
): Promise<OrganizationSettingsResponse> {
  return readJson<OrganizationSettingsResponse>(
    '/organizations/me',
    {
      signal: AbortSignal.timeout(5000),
    },
    fetchImpl,
  )
}

export function useOrganizationSettings() {
  return useQuery({
    queryKey: organizationSettingsQueryKey,
    queryFn: () => fetchOrganizationSettings(),
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: false,
  })
}

export async function fetchKnowledgeEntitlementContract(
  fetchImpl: JsonFetcher = fetch,
): Promise<KnowledgeEntitlementContract> {
  return readJson<KnowledgeEntitlementContract>(
    '/organizations/knowledge-access',
    {
      signal: AbortSignal.timeout(5000),
    },
    fetchImpl,
  )
}

export function useKnowledgeEntitlementContract() {
  return useQuery({
    queryKey: knowledgeAccessQueryKey,
    queryFn: () => fetchKnowledgeEntitlementContract(),
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: false,
  })
}

export async function fetchDemoOrganizationProfiles(
  fetchImpl: JsonFetcher = fetch,
): Promise<Array<DemoOrganizationProfile>> {
  const payload = await readJson<{ profiles?: Array<DemoOrganizationProfile> }>(
    '/organizations/demo-profiles',
    {
      signal: AbortSignal.timeout(5000),
    },
    fetchImpl,
  )
  return Array.isArray(payload.profiles) ? payload.profiles : []
}

export function useDemoOrganizationProfiles() {
  return useQuery({
    queryKey: demoOrganizationProfilesQueryKey,
    queryFn: () => fetchDemoOrganizationProfiles(),
    staleTime: 60_000,
    retry: false,
  })
}

export async function upsertOrganizationAssociation(
  params: {
    organizationId: string
    organizationName?: string | null
    createIfMissing?: boolean
  },
  fetchImpl: JsonFetcher = fetch,
): Promise<OrganizationSettingsResponse> {
  const organizationId = params.organizationId.trim()
  if (!organizationId) {
    throw new Error('organization_id required')
  }
  const memberships = await fetchOrganizationSettings(fetchImpl)
  const knownMembership = memberships.memberships.find(
    (membership) => membership.organization_id === organizationId,
  )

  if (knownMembership) {
    return readJson<OrganizationSettingsResponse>(
      '/organizations/switch',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organization_id: organizationId }),
      },
      fetchImpl,
    )
  }

  return readJson<OrganizationSettingsResponse>(
    '/organizations/join',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organization_id: organizationId,
        organization_name: params.organizationName?.trim() || undefined,
        create: params.createIfMissing === true,
      }),
    },
    fetchImpl,
  )
}

export function isDemoOrganizationContext(
  organization:
    | Pick<OrganizationContext, 'dataset_type' | 'organization_id'>
    | null
    | undefined,
): boolean {
  const datasetType = String(organization?.dataset_type || '').toUpperCase()
  return (
    datasetType === 'DEMO' ||
    organization?.organization_id === DEFAULT_SMB_ORGANIZATION_ID
  )
}

export function isRealOrganizationContext(
  organization: Pick<OrganizationContext, 'dataset_type'> | null | undefined,
): boolean {
  return String(organization?.dataset_type || '').toUpperCase() === 'REAL'
}

export function findRealCompanyMembership(
  memberships: Array<OrganizationMembership>,
  activeOrganizationId?: string | null,
): OrganizationMembership | null {
  return (
    memberships.find(
      (membership) =>
        String(membership.dataset_type || '').toUpperCase() === 'REAL' &&
        membership.membership_status === 'active' &&
        membership.organization_id !== activeOrganizationId,
    ) || null
  )
}

export async function switchOrganization(
  organizationId: string,
  fetchImpl: JsonFetcher = fetch,
): Promise<OrganizationSettingsResponse> {
  const normalizedOrganizationId = organizationId.trim()
  if (!normalizedOrganizationId) {
    throw new Error('organization_id required')
  }
  return readJson<OrganizationSettingsResponse>(
    '/organizations/switch',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organization_id: normalizedOrganizationId }),
    },
    fetchImpl,
  )
}

export async function createRealCompanyOrganization(
  params: {
    companyDisplayName: string
    organizationId?: string | null
    industryCode?: string | null
    fiscalYearStartMonth?: number | null
    localCurrency?: string | null
  },
  fetchImpl: JsonFetcher = fetch,
): Promise<OrganizationSettingsResponse & { landing_route?: string }> {
  const companyDisplayName = params.companyDisplayName.trim()
  if (!companyDisplayName) {
    throw new Error('company_display_name required')
  }
  return readJson<OrganizationSettingsResponse & { landing_route?: string }>(
    '/organizations/real-company',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_display_name: companyDisplayName,
        organization_id: params.organizationId?.trim() || undefined,
        industry_code: params.industryCode?.trim() || undefined,
        fiscal_year_start_month: params.fiscalYearStartMonth || undefined,
        local_currency: params.localCurrency?.trim() || undefined,
      }),
    },
    fetchImpl,
  )
}

export async function ensureDefaultSmbOrganization(
  fetchImpl: JsonFetcher = fetch,
): Promise<OrganizationSettingsResponse> {
  const organizationId = DEFAULT_SMB_ORGANIZATION_ID
  const organizationName = DEFAULT_SMB_ORGANIZATION_NAME
  const current = await fetchOrganizationSettings(fetchImpl)
  const existingMembership = current.memberships.find(
    (membership) => membership.organization_id === organizationId,
  )

  if (existingMembership) {
    return readJson<OrganizationSettingsResponse>(
      '/organizations/switch',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organization_id: organizationId }),
      },
      fetchImpl,
    )
  }

  try {
    return await readJson<OrganizationSettingsResponse>(
      '/organizations/join',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organization_id: organizationId }),
      },
      fetchImpl,
    )
  } catch (error) {
    if (
      !(error instanceof Error) ||
      error.message !== 'organization not found'
    ) {
      throw error
    }
  }

  return readJson<OrganizationSettingsResponse>(
    '/organizations/join',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organization_id: organizationId,
        organization_name: organizationName,
        create: true,
      }),
    },
    fetchImpl,
  )
}

export async function updateOrganizationMaterializationPolicy(
  params: UpdateOrganizationMaterializationPolicyParams,
  fetchImpl: JsonFetcher = fetch,
): Promise<OrganizationSettingsResponse> {
  return readJson<OrganizationSettingsResponse>(
    '/organizations/materialization-policy',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    },
    fetchImpl,
  )
}

export async function updateOrganizationMemberRole(
  params: {
    userId: string
    memberRole: 'owner' | 'admin' | 'member'
  },
  fetchImpl: JsonFetcher = fetch,
): Promise<OrganizationSettingsResponse> {
  const userId = params.userId.trim()
  if (!userId) {
    throw new Error('user_id required')
  }
  return readJson<OrganizationSettingsResponse>(
    '/organizations/member-role',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        member_role: params.memberRole,
      }),
    },
    fetchImpl,
  )
}
