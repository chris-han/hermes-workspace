import { useQuery } from '@tanstack/react-query'

export const DEFAULT_SMB_ORGANIZATION_ID = 'org_smb_cn'
export const DEFAULT_SMB_ORGANIZATION_NAME = '北京索阳科技有限公司'

export interface OrganizationMembership {
  organization_id: string
  organization_name?: string | null
  membership_status: string
  member_role?: string | null
  sharing_enabled?: boolean
  joined_at?: string | null
  updated_at?: string | null
}

export interface OrganizationContext {
  organization_id?: string | null
  organization_name?: string | null
  membership_status?: string | null
  member_role?: string | null
  sharing_enabled?: boolean
  can_invite_members?: boolean
  can_change_settings?: boolean
}

export interface OrganizationMember {
  user_id: string
  name: string
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
export const knowledgeAccessQueryKey = ['organizations', 'knowledge-access'] as const

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
    if (!(error instanceof Error) || error.message !== 'organization not found') {
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
