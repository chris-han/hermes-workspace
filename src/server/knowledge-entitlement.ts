import {
  SEMANTIER_AGENT_AUTH_COOKIE,
  buildSemantierAgentProxyHeaders,
  semantierAgentAuthHeaders,
  withSemantierAgentBase,
} from './semantier-agent-api'
import type { ActiveWorkspaceRoot } from './workspace-root'

export type KnowledgeOperation = 'read' | 'write' | 'ingest'

type EntitlementDecision = 'allow' | 'allow_with_review' | 'deny'

type KnowledgeEntitlementContract = {
  principal?: {
    organization_id?: string | null
    membership_status?: string | null
  }
  organization_context?: {
    organization_id?: string | null
    workspace_id?: string | null
  }
  effective_capabilities?: Array<{
    capability?: string
    decision?: EntitlementDecision
    scope?: {
      organization_id?: string | null
      resource_classes?: Array<string>
    }
  }>
}

export class KnowledgeEntitlementRequiredError extends Error {
  constructor(message = 'Knowledge entitlement required') {
    super(message)
    this.name = 'KnowledgeEntitlementRequiredError'
  }
}

function requiredCapability(operation: KnowledgeOperation): string {
  return operation === 'read' ? 'context.read' : 'knowledge.propose'
}

function requestHeadersForEntitlement(
  requestHeaders?: HeadersInit | Headers,
): Headers {
  const headers = buildSemantierAgentProxyHeaders(requestHeaders ?? {}, {
    authHeaders: semantierAgentAuthHeaders(),
    forwardBrowserCookies: true,
    allowedCookieNames: [SEMANTIER_AGENT_AUTH_COOKIE],
  })
  return headers
}

async function fetchKnowledgeEntitlementContract(
  requestHeaders?: HeadersInit | Headers,
): Promise<KnowledgeEntitlementContract> {
  const response = await fetch(
    withSemantierAgentBase('/organizations/knowledge-access'),
    {
      headers: requestHeadersForEntitlement(requestHeaders),
      signal: AbortSignal.timeout(5_000),
    },
  )
  if (!response.ok) {
    throw new KnowledgeEntitlementRequiredError()
  }
  return (await response.json()) as KnowledgeEntitlementContract
}

export async function requireKnowledgeEntitlement(
  activeWorkspace: ActiveWorkspaceRoot,
  operation: KnowledgeOperation,
  requestHeaders?: HeadersInit | Headers,
): Promise<void> {
  if (!activeWorkspace.authenticated || !activeWorkspace.workspaceId) {
    throw new KnowledgeEntitlementRequiredError()
  }
  if (activeWorkspace.workspaceId === 'public') {
    throw new KnowledgeEntitlementRequiredError()
  }
  const contract = await fetchKnowledgeEntitlementContract(requestHeaders)
  const contractOrganization =
    contract.organization_context?.organization_id ||
    contract.principal?.organization_id ||
    null
  if (
    activeWorkspace.organizationId &&
    contractOrganization &&
    activeWorkspace.organizationId !== contractOrganization
  ) {
    throw new KnowledgeEntitlementRequiredError()
  }
  if (
    contract.organization_context?.workspace_id &&
    contract.organization_context.workspace_id !== activeWorkspace.workspaceId
  ) {
    throw new KnowledgeEntitlementRequiredError()
  }
  if (contract.principal?.membership_status !== 'active') {
    throw new KnowledgeEntitlementRequiredError()
  }

  const capability = requiredCapability(operation)
  const allowed = (contract.effective_capabilities ?? []).some((grant) => {
    if (grant.capability !== capability) return false
    if (grant.decision !== 'allow' && grant.decision !== 'allow_with_review') {
      return false
    }
    const scopeOrganization = grant.scope?.organization_id
    if (
      activeWorkspace.organizationId &&
      scopeOrganization &&
      scopeOrganization !== activeWorkspace.organizationId
    ) {
      return false
    }
    return true
  })
  if (!allowed) {
    throw new KnowledgeEntitlementRequiredError()
  }
}
