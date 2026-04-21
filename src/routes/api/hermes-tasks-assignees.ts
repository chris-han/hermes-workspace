/**
 * Proxy endpoint — returns available task assignees.
 * Reads agent profiles from the Hermes gateway and combines with the
 * configured human reviewer name (tasks.human_reviewer in config.yaml).
 * Falls back to profile directory listing if the gateway doesn't have
 * a /api/tasks/assignees endpoint.
 */
import { createFileRoute } from '@tanstack/react-router'
import { isAuthenticated } from '../../server/auth-middleware'
import { BEARER_TOKEN, HERMES_API } from '../../server/gateway-capabilities'
import fs from 'node:fs'
import path from 'node:path'
import YAML from 'yaml'
import {
  resolveHermesConfigPathFromBackend,
  resolveHermesProfilesPathFromBackend,
} from '../../server/hermes-home'

function readConfig(configPath: string): Record<string, unknown> {
  try {
    return (YAML.parse(fs.readFileSync(configPath, 'utf-8')) as Record<string, unknown>) ?? {}
  } catch {
    return {}
  }
}

function getProfileNames(profilesPath: string): string[] {
  try {
    return fs.readdirSync(profilesPath).filter(name => {
      try {
        return fs.statSync(path.join(profilesPath, name)).isDirectory()
      } catch {
        return false
      }
    })
  } catch {
    return []
  }
}

function authHeaders(): Record<string, string> {
  return BEARER_TOKEN ? { Authorization: `Bearer ${BEARER_TOKEN}` } : {}
}

export const Route = createFileRoute('/api/hermes-tasks-assignees')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
        }

        // Try gateway first — it may have a richer endpoint
        try {
          const res = await fetch(`${HERMES_API}/api/tasks/assignees`, {
            signal: AbortSignal.timeout(2000),
            headers: authHeaders(),
          })
          if (res.ok) {
            return new Response(await res.text(), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            })
          }
        } catch {
          // fall through to local profile discovery
        }

        // Fall back: derive from profile directories + config
        const configPath = await resolveHermesConfigPathFromBackend()
        const profilesPath = await resolveHermesProfilesPathFromBackend()
        const config = readConfig(configPath)
        const tasksConfig = (config.tasks ?? {}) as Record<string, unknown>
        const humanReviewer = (tasksConfig.human_reviewer as string) || null
        const profiles = getProfileNames(profilesPath)

        const assignees = profiles.map(id => ({ id, label: id, isHuman: id === humanReviewer }))
        if (humanReviewer && !profiles.includes(humanReviewer)) {
          assignees.unshift({ id: humanReviewer, label: humanReviewer, isHuman: true })
        }

        return new Response(
          JSON.stringify({ assignees, humanReviewer }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      },
    },
  },
})
