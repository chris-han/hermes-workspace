import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

import {
  SEMANTIER_AGENT_AUTH_COOKIE,
  buildSemantierAgentProxyResponse,
  buildSemantierAgentProxyHeaders,
  semantierAgentAuthHeaders,
  withSemantierAgentBase,
} from '../../server/semantier-agent-api'

async function proxyUserSettings(request: Request): Promise<Response> {
  const headers = buildSemantierAgentProxyHeaders(request.headers, {
    authHeaders: semantierAgentAuthHeaders(),
    forwardBrowserCookies: true,
    allowedCookieNames: [SEMANTIER_AGENT_AUTH_COOKIE],
  })
  const response = await fetch(withSemantierAgentBase('/auth/settings'), {
    method: request.method,
    headers,
    body: request.method === 'PATCH' ? await request.text() : undefined,
    signal: AbortSignal.timeout(5_000),
  })
  const body = await response.text().catch(() => '')
  return buildSemantierAgentProxyResponse(body, response)
}

export const Route = createFileRoute('/api/user-settings')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          return proxyUserSettings(request)
        } catch (err) {
          return json(
            {
              ok: false,
              error: err instanceof Error ? err.message : 'Failed to load settings',
            },
            { status: 401 },
          )
        }
      },
      PATCH: async ({ request }) => {
        try {
          return proxyUserSettings(request)
        } catch (err) {
          return json(
            {
              ok: false,
              error: err instanceof Error ? err.message : 'Failed to save settings',
            },
            { status: 401 },
          )
        }
      },
    },
  },
})