import fs from 'node:fs'
import { createFileRoute } from '@tanstack/react-router'
import YAML from 'yaml'
import {
  ensureGatewayProbed,
  getCapabilities,
} from '../../server/gateway-capabilities'
import { createCapabilityUnavailablePayload } from '@/lib/feature-gates'
import {
  resolveHermesConfigPathFromBackend,
  resolveHermesHomeFromBackend,
} from '../../server/hermes-home'
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

function writeConfig(
  config: Record<string, unknown>,
  hermesHome: string,
  configPath: string,
): void {
  fs.mkdirSync(hermesHome, { recursive: true })
  fs.writeFileSync(configPath, YAML.stringify(config), 'utf-8')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): void {
  for (const [key, value] of Object.entries(source)) {
    if (isRecord(value) && isRecord(target[key])) {
      deepMerge(target[key] as Record<string, unknown>, value)
      continue
    }
    target[key] = value
  }
}

function setPathValue(
  target: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  const segments = path
    .split('.')
    .map((segment) => segment.trim())
    .filter(Boolean)

  if (segments.length === 0) {
    throw new Error('Config path is required')
  }

  let cursor = target
  for (const segment of segments.slice(0, -1)) {
    const current = cursor[segment]
    if (!isRecord(current)) {
      cursor[segment] = {}
    }
    cursor = cursor[segment] as Record<string, unknown>
  }

  cursor[segments[segments.length - 1]] = value
}

export const Route = createFileRoute('/api/config-patch')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          ensureGatewayProbed()
          if (!getCapabilities().config) {
            return Response.json(createCapabilityUnavailablePayload('config'), {
              status: 503,
            })
          }

          const body = (await request.json()) as {
            path?: unknown
            value?: unknown
            raw?: unknown
          }

          const hermesHome = await resolveHermesHomeFromBackend(request.headers)
          const configPath = await resolveHermesConfigPathFromBackend(
            request.headers,
          )
          const current = readConfig(configPath)

          if (typeof body.raw === 'string' && body.raw.trim()) {
            const parsed = JSON.parse(body.raw) as unknown
            if (!isRecord(parsed)) {
              throw new Error('Config patch payload must be a JSON object')
            }
            deepMerge(current, parsed)
          } else if (typeof body.path === 'string' && body.path.trim()) {
            setPathValue(current, body.path, body.value)
          } else {
            throw new Error('Config patch requires either raw or path/value')
          }

          writeConfig(current, hermesHome, configPath)

          return Response.json({ ok: true, payload: current })
        } catch (err) {
          if (err instanceof WorkspaceAuthRequiredError) {
            return Response.json(
              { ok: false, error: err.message },
              { status: 401 },
            )
          }
          return Response.json(
            {
              ok: false,
              error: err instanceof Error ? err.message : 'Failed to update config',
            },
            { status: 400 },
          )
        }
      },
    },
  },
})
