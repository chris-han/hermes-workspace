import {
  SEMANTIER_AGENT_AUTH_COOKIE,
  buildSemantierAgentProxyHeaders,
  semantierAgentAuthHeaders,
  withSemantierAgentBase,
} from './semantier-agent-api'

export type SemantierSkillInventoryItem = {
  id: string
  name: string
  description: string
  category?: string
  tags?: Array<string>
  triggers?: Array<string>
  sourcePath?: string
  installed?: boolean
  enabled?: boolean
  builtin?: boolean
  sourceTier?: string
  sourceLabel?: string
  canEdit?: boolean
  canUninstall?: boolean
  canModify?: boolean
  icon?: string
  fileCount?: number
  content?: string
  author?: string
  homepage?: string | null
  security?: {
    level?: 'safe' | 'low' | 'medium' | 'high'
    flags?: Array<string>
    score?: number
  }
}

export type SemantierSkillInventoryResponse = {
  skills: Array<SemantierSkillInventoryItem>
  total: number
  page: number
  categories: Array<string>
  workspaceId?: string
  workspaceSlug?: string
}

export async function fetchSemantierSkillsInventory(
  requestHeaders?: HeadersInit | Headers,
): Promise<SemantierSkillInventoryResponse> {
  const headers = buildSemantierAgentProxyHeaders(requestHeaders ?? {}, {
    authHeaders: semantierAgentAuthHeaders(),
    forwardBrowserCookies: true,
    allowedCookieNames: [SEMANTIER_AGENT_AUTH_COOKIE],
  })

  const response = await fetch(withSemantierAgentBase('/system/skills'), {
    headers,
    signal: AbortSignal.timeout(10_000),
  })

  const payload = (await response.json().catch(() => ({}))) as
    | SemantierSkillInventoryResponse
    | { error?: string; detail?: string }

  if (!response.ok) {
    throw new Error(
      ('error' in payload && payload.error) ||
        ('detail' in payload && payload.detail) ||
        `Semantier skills inventory request failed (${response.status})`,
    )
  }

  return {
    skills: Array.isArray((payload as SemantierSkillInventoryResponse).skills)
      ? (payload as SemantierSkillInventoryResponse).skills
      : [],
    total:
      typeof (payload as SemantierSkillInventoryResponse).total === 'number'
        ? (payload as SemantierSkillInventoryResponse).total
        : 0,
    page:
      typeof (payload as SemantierSkillInventoryResponse).page === 'number'
        ? (payload as SemantierSkillInventoryResponse).page
        : 1,
    categories: Array.isArray(
      (payload as SemantierSkillInventoryResponse).categories,
    )
      ? (payload as SemantierSkillInventoryResponse).categories
      : [],
    workspaceId: (payload as SemantierSkillInventoryResponse).workspaceId,
    workspaceSlug: (payload as SemantierSkillInventoryResponse).workspaceSlug,
  }
}

export async function installSemantierSkill(
  requestHeaders: HeadersInit | Headers,
  payload: {
    identifier: string
    category?: string
    force?: boolean
  },
): Promise<Record<string, unknown>> {
  const headers = buildSemantierAgentProxyHeaders(requestHeaders, {
    authHeaders: semantierAgentAuthHeaders(),
    forwardBrowserCookies: true,
    allowedCookieNames: [SEMANTIER_AGENT_AUTH_COOKIE],
  })
  headers.set('Content-Type', 'application/json')

  const response = await fetch(
    withSemantierAgentBase('/system/skills/install'),
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        identifier: payload.identifier,
        category: payload.category || '',
        force: Boolean(payload.force),
      }),
      signal: AbortSignal.timeout(120_000),
    },
  )

  const result = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >
  if (!response.ok) {
    const error =
      (typeof result.error === 'string' && result.error) ||
      (typeof result.detail === 'string' && result.detail) ||
      `Semantier skill install failed (${response.status})`
    throw new Error(error)
  }
  return result
}

export async function toggleSemantierSkill(
  requestHeaders: HeadersInit | Headers,
  payload: {
    name: string
    enabled: boolean
  },
): Promise<Record<string, unknown>> {
  const headers = buildSemantierAgentProxyHeaders(requestHeaders, {
    authHeaders: semantierAgentAuthHeaders(),
    forwardBrowserCookies: true,
    allowedCookieNames: [SEMANTIER_AGENT_AUTH_COOKIE],
  })
  headers.set('Content-Type', 'application/json')

  const response = await fetch(
    withSemantierAgentBase('/system/skills/toggle'),
    {
      method: 'PUT',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    },
  )

  const result = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >
  if (!response.ok) {
    const error =
      (typeof result.error === 'string' && result.error) ||
      (typeof result.detail === 'string' && result.detail) ||
      `Semantier skill toggle failed (${response.status})`
    throw new Error(error)
  }
  return result
}

export async function uninstallSemantierSkill(
  requestHeaders: HeadersInit | Headers,
  payload: {
    name: string
  },
): Promise<Record<string, unknown>> {
  const headers = buildSemantierAgentProxyHeaders(requestHeaders, {
    authHeaders: semantierAgentAuthHeaders(),
    forwardBrowserCookies: true,
    allowedCookieNames: [SEMANTIER_AGENT_AUTH_COOKIE],
  })
  headers.set('Content-Type', 'application/json')

  const response = await fetch(
    withSemantierAgentBase('/system/skills/uninstall'),
    {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    },
  )

  const result = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >
  if (!response.ok) {
    const error =
      (typeof result.error === 'string' && result.error) ||
      (typeof result.detail === 'string' && result.detail) ||
      `Semantier skill uninstall failed (${response.status})`
    throw new Error(error)
  }
  return result
}
