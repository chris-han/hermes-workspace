import fs from 'node:fs'
import { createFileRoute } from '@tanstack/react-router'
import YAML from 'yaml'
import {
  ensureGatewayProbed,
  getCapabilities,
} from '../../server/gateway-capabilities'
import { createCapabilityUnavailablePayload } from '@/lib/feature-gates'
import { resolveHermesConfigPathFromBackend } from '../../server/hermes-home'
import { WorkspaceAuthRequiredError } from '../../server/workspace-root'

function readConfig(configPath: string): Record<string, unknown> {
  try {
    const raw = fs.readFileSync(configPath, 'utf-8')
    const parsed = YAML.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

export const Route = createFileRoute('/api/config-get')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          ensureGatewayProbed()
          if (!getCapabilities().config) {
            return Response.json(createCapabilityUnavailablePayload('config'), {
              status: 503,
            })
          }

          const configPath = await resolveHermesConfigPathFromBackend(
            request.headers,
          )

          return Response.json({
            ok: true,
            payload: readConfig(configPath),
          })
        } catch (err) {
          if (err instanceof WorkspaceAuthRequiredError) {
            return Response.json(
              { ok: false, error: err.message },
              { status: 401 },
            )
          }
          throw err
        }
      },
    },
  },
})
