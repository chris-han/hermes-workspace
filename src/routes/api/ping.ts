import { createFileRoute } from '@tanstack/react-router'
import {
  HERMES_API,
  ensureGatewayProbed,
  getGatewayMode,
} from '../../server/gateway-capabilities'
import { requireLocalOrAuth } from '../../server/auth-middleware'

type PingResponse = {
  ok: boolean
  error?: string
  status?: number
  hermesUrl: string
}

export function shouldAllowPingRequest(request: Request, gatewayMode: string) {
  if (gatewayMode === 'semantier-unicell') {
    return true
  }
  return requireLocalOrAuth(request)
}

export const Route = createFileRoute('/api/ping')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const gatewayMode = getGatewayMode()
        if (!shouldAllowPingRequest(request, gatewayMode)) {
          return Response.json(
            {
              ok: false,
              error: 'Authentication required',
              status: 401,
              hermesUrl: HERMES_API,
            } satisfies PingResponse,
            { status: 401 },
          )
        }

        const caps = ensureGatewayProbed()
        if (!caps.health) {
          return Response.json(
            {
              ok: false,
              error: 'Hermes unavailable',
              status: 503,
              hermesUrl: HERMES_API,
            } satisfies PingResponse,
            { status: 503 },
          )
        }

        return Response.json(
          {
            ok: true,
            status: 200,
            hermesUrl: HERMES_API,
          } satisfies PingResponse,
          { status: 200 },
        )
      },
    },
  },
})
