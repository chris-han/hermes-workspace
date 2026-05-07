import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import {
  isAuthenticated,
  isPasswordProtectionEnabled,
} from '../../server/auth-middleware'
import { ensureGatewayProbed } from '../../server/gateway-capabilities'

export const Route = createFileRoute('/api/auth-check')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const caps = ensureGatewayProbed()
          const reachable = caps.semantier.available || caps.health

          if (!reachable) {
            return json(
              {
                authenticated: false,
                authRequired: false,
                error: 'hermes_agent_unreachable',
              },
              { status: 503 },
            )
          }
        } catch (error) {
          return json(
            {
              authenticated: false,
              authRequired: false,
              error:
                error instanceof DOMException && error.name === 'AbortError'
                  ? 'hermes_agent_timeout'
                  : 'hermes_agent_unreachable',
            },
            { status: 503 },
          )
        }

        const authRequired = isPasswordProtectionEnabled()
        const authenticated = isAuthenticated(request)

        return json({
          authenticated,
          authRequired,
        })
      },
    },
  },
})
