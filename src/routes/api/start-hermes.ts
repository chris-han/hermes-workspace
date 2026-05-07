import { json } from '@tanstack/react-start'
import { createFileRoute } from '@tanstack/react-router'
import {
  SEMANTIER_AGENT_AUTH_COOKIE,
  buildSemantierAgentProxyHeaders,
  semantierAgentAuthHeaders,
  withSemantierAgentBase,
} from '../../server/semantier-agent-api'

export const Route = createFileRoute('/api/start-hermes')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const targetUrl = withSemantierAgentBase('/api/start-hermes')
          const headers = buildSemantierAgentProxyHeaders(request.headers, {
            authHeaders: semantierAgentAuthHeaders(),
            forwardBrowserCookies: true,
            allowedCookieNames: [SEMANTIER_AGENT_AUTH_COOKIE],
          })

          const upstream = await fetch(targetUrl, {
            method: 'POST',
            headers,
            redirect: 'manual',
          })

          const contentType = upstream.headers.get('content-type') || ''
          if (!contentType.includes('application/json')) {
            const body = await upstream.text()
            return json(
              {
                ok: false,
                error: `Unexpected upstream response (${upstream.status})`,
                hint: body.slice(0, 200),
              },
              { status: 502 },
            )
          }

          const payload = (await upstream.json()) as Record<string, unknown>
          return json(payload, { status: upstream.status })
        } catch (err) {
          return json(
            {
              ok: false,
              error: err instanceof Error ? err.message : String(err),
            },
            { status: 500 },
          )
        }
      },
    },
  },
})
