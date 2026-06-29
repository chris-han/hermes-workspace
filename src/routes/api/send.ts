import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import {
  ensureGatewayProbed,
  getGatewayCapabilities,
} from '../../server/hermes-api'
import { requireJsonContentType } from '../../server/rate-limit'

export const Route = createFileRoute('/api/send')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const csrfCheck = requireJsonContentType(request)
        if (csrfCheck) return csrfCheck
        ensureGatewayProbed()
        if (!getGatewayCapabilities().sessions) {
          return json(
            { ok: false, error: 'Sessions API is not available in semantier-unicell mode.' },
            { status: 503 },
          )
        }
        return json(
          {
            ok: false,
            error: 'Legacy send is not available in Hermes Workspace.',
          },
          { status: 501 },
        )
      },
    },
  },
})
