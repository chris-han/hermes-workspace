import {
  SEMANTIER_AGENT_AUTH_COOKIE,
  buildSemantierAgentProxyHeaders,
  semantierAgentAuthHeaders,
  withSemantierAgentBase,
} from './semantier-agent-api'

export type SemantierPluginInfo = {
  id: string
  name: string
  label: string
  description: string
  sourceTier?: string
  sourceLabel?: string
  platformCompatibility?: Array<string>
  enabled: boolean
  category: string
  toolsets: Array<string>
  tools: Array<string>
  providesHooks: Array<string>
  sourcePath: string
  canModify?: boolean
  version?: string | null
  installedVersion?: string | null
  latestVersion?: string | null
  contentHash?: string | null
  latestHash?: string | null
  updateStatus?: 'up_to_date' | 'update_available' | 'unavailable'
  hubIdentifier?: string | null
  hubSource?: string | null
  hubUpdatedAt?: string | null
  packageType?: string | null
  packagePath?: string | null
  canUpdate?: boolean
}

export async function fetchSemantierPlugins(
  requestHeaders?: HeadersInit | Headers,
): Promise<{
  plugins: Array<SemantierPluginInfo>
  total: number
  categories: Array<string>
}> {
  const headers = buildSemantierAgentProxyHeaders(requestHeaders ?? {}, {
    authHeaders: semantierAgentAuthHeaders(),
    forwardBrowserCookies: true,
    allowedCookieNames: [SEMANTIER_AGENT_AUTH_COOKIE],
  })

  const response = await fetch(withSemantierAgentBase('/system/plugins'), {
    headers,
    signal: AbortSignal.timeout(10_000),
  })

  const payload = (await response.json().catch(() => ({}))) as
    | {
        plugins?: Array<SemantierPluginInfo>
        total?: number
        categories?: Array<string>
        error?: string
        detail?: string
      }
    | Array<SemantierPluginInfo>

  if (!response.ok) {
    const record =
      !Array.isArray(payload)
        ? (payload as { error?: string; detail?: string })
        : {}
    throw new Error(
      record.error ||
        record.detail ||
        `Semantier plugins request failed (${response.status})`,
    )
  }

  if (Array.isArray(payload)) {
    return {
      plugins: payload,
      total: payload.length,
      categories: ['All'],
    }
  }

  return {
    plugins: Array.isArray(payload.plugins) ? payload.plugins : [],
    total: typeof payload.total === 'number' ? payload.total : 0,
    categories: Array.isArray(payload.categories) ? payload.categories : ['All'],
  }
}
