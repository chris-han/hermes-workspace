import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { requireLocalOrAuth } from '../../server/auth-middleware'
import {
  HERMES_API,
  dashboardFetch,
  ensureGatewayProbed,
  getCapabilities,
} from '../../server/gateway-capabilities'

export const Route = createFileRoute('/api/memory')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!requireLocalOrAuth(request)) {
          return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        }

        ensureGatewayProbed()
        if (!getCapabilities().memory) {
          return json(
            {
              ok: false,
              error: `Gateway does not support /api/memory on ${HERMES_API}`,
            },
            { status: 503 },
          )
        }

        try {
          const response = await dashboardFetch('/api/memory', undefined, {
            requestHeaders: request.headers,
          })
          if (!response.ok) {
            const body = await response.text().catch(() => '')
            throw new Error(`Hermes API /api/memory: ${response.status} ${body}`)
          }
          return json(await response.json())
        } catch (err) {
          return json(
            { error: err instanceof Error ? err.message : String(err) },
            { status: 500 },
          )
        }
      },
    },
  },
})
