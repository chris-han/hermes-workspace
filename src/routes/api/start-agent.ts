import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import {
  SEMANTIER_AGENT_AUTH_COOKIE,
  buildSemantierAgentProxyHeaders,
  semantierAgentAuthHeaders,
  withSemantierAgentBase,
} from '../../server/semantier-agent-api'

export const Route = createFileRoute('/api/start-agent')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const upstream = await fetch(withSemantierAgentBase('/api/start-hermes'), {
            method: 'POST',
            headers: buildSemantierAgentProxyHeaders(request.headers, {
              authHeaders: semantierAgentAuthHeaders(),
              forwardBrowserCookies: true,
              allowedCookieNames: [SEMANTIER_AGENT_AUTH_COOKIE],
            }),
          })
          const payload = (await upstream.json()) as Record<string, unknown>
          return json(payload, { status: upstream.status })
        } catch (error) {
          return json(
            {
              ok: false,
              error: error instanceof Error ? error.message : String(error),
            },
            { status: 500 },
          )
        }
      },
    },
  },
})
