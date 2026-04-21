import {
  SEMANTIER_AGENT_AUTH_COOKIE,
  buildSemantierAgentProxyHeaders,
  semantierAgentAuthHeaders,
  withSemantierAgentBase,
} from './semantier-agent-api'

export type SemantierToolsetInfo = {
  id: string
  name: string
  label: string
  description: string
  tools: Array<string>
  enabled: boolean
  available: boolean
  configured: boolean
  sourceTier?: string
  sourceLabel?: string
  builtin?: boolean
  canModify?: boolean
}

export async function fetchSemantierToolsets(
  requestHeaders?: HeadersInit | Headers,
): Promise<Array<SemantierToolsetInfo>> {
  const headers = buildSemantierAgentProxyHeaders(requestHeaders ?? {}, {
    authHeaders: semantierAgentAuthHeaders(),
    forwardBrowserCookies: true,
    allowedCookieNames: [SEMANTIER_AGENT_AUTH_COOKIE],
  })

  const response = await fetch(withSemantierAgentBase('/system/tools'), {
    headers,
    signal: AbortSignal.timeout(10_000),
  })

  const payload = (await response.json().catch(() => ({}))) as
    | { tools?: Array<SemantierToolsetInfo>; error?: string; detail?: string }
    | Array<SemantierToolsetInfo>

  if (!response.ok) {
    const record =
      payload && !Array.isArray(payload)
        ? (payload as { error?: string; detail?: string })
        : {}
    throw new Error(
      record.error ||
        record.detail ||
        `Semantier toolsets request failed (${response.status})`,
    )
  }

  if (Array.isArray(payload)) return payload
  return Array.isArray(payload.tools) ? payload.tools : []
}