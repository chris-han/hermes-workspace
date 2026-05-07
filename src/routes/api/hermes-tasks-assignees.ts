/**
 * Proxy endpoint — returns available task assignees.
 * Reads agent profiles from the Hermes gateway and combines with the
 * configured human reviewer name (tasks.human_reviewer in config.yaml).
 * Falls back to profile directory listing if the gateway doesn't have
 * a /api/tasks/assignees endpoint.
 */
import fs from 'node:fs'
import path from 'node:path'
import { createFileRoute } from '@tanstack/react-router'
import YAML from 'yaml'
import { BEARER_TOKEN, HERMES_API } from '../../server/gateway-capabilities'
import {
  resolveHermesConfigPathFromBackend,
  resolveHermesProfilesPathFromBackend,
} from '../../server/hermes-home'
import { WorkspaceAuthRequiredError } from '../../server/workspace-root'

function readConfig(configPath: string): Record<string, unknown> {
  try {
    return (
      (YAML.parse(fs.readFileSync(configPath, 'utf-8')) as Record<
        string,
        unknown
      >) ?? {}
    )
  } catch {
    return {}
  }
}

function getProfileNames(profilesPath: string): Array<string> {
  try {
    return fs.readdirSync(profilesPath).filter((name) => {
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
        try {
          const configPath = await resolveHermesConfigPathFromBackend(
            request.headers,
          )
          const profilesPath = await resolveHermesProfilesPathFromBackend(
            request.headers,
          )
          const config = readConfig(configPath)
          const tasksConfig = (config.tasks ?? {}) as Record<string, unknown>
          const humanReviewer = (tasksConfig.human_reviewer as string) || null
          const profiles = getProfileNames(profilesPath)

          const assignees = profiles.map((id) => ({
            id,
            label: id,
            isHuman: id === humanReviewer,
          }))
          if (humanReviewer && !profiles.includes(humanReviewer)) {
            assignees.unshift({
              id: humanReviewer,
              label: humanReviewer,
              isHuman: true,
            })
          }

          return new Response(JSON.stringify({ assignees, humanReviewer }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (err) {
          if (err instanceof WorkspaceAuthRequiredError) {
            return new Response(
              JSON.stringify({ error: err.message }),
              { status: 401, headers: { 'Content-Type': 'application/json' } },
            )
          }
          throw err
        }
      },
    },
  },
})
