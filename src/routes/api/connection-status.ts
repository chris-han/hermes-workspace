/**
 * Connection status endpoint — returns a summary of portable chat readiness
 * plus whether Hermes gateway enhancements are available.
 */
import fs from 'node:fs'
import { createFileRoute } from '@tanstack/react-router'
import YAML from 'yaml'
import {
  HERMES_API,
  ensureGatewayProbed,
  getChatMode,
  getGatewayMode,
  getGatewayModeLabel,
} from '../../server/gateway-capabilities'
import { resolveHermesConfigPathFromBackend } from '../../server/hermes-home'
import { WorkspaceAuthRequiredError } from '../../server/workspace-root'

function readActiveModel(configPath: string): string {
  try {
    const raw = fs.readFileSync(configPath, 'utf-8')
    const config = (YAML.parse(raw) as Record<string, unknown>) || {}
    const modelField = config.model
    if (typeof modelField === 'string') return modelField
    if (modelField && typeof modelField === 'object') {
      const obj = modelField as Record<string, unknown>
      return (obj.default as string) || ''
    }
  } catch {
    // config missing or unreadable
  }
  return ''
}

type ConnectionStatus = {
  status: 'connected' | 'enhanced' | 'partial' | 'disconnected'
  label: 'Connected' | 'Enhanced' | 'Partial' | 'Disconnected'
  detail: string
  gatewayMode: string
  gatewayModeLabel: string
  health: boolean
  chatReady: boolean
  modelConfigured: boolean
  activeModel: string
  chatMode: 'enhanced-hermes' | 'portable' | 'disconnected'
  capabilities: Record<string, boolean>
  hermesUrl: string
}

export const Route = createFileRoute('/api/connection-status')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const caps = ensureGatewayProbed()
          const gatewayMode = getGatewayMode()
          const configPath = await resolveHermesConfigPathFromBackend(
            request.headers,
          )
          const activeModel = readActiveModel(configPath)
          const modelConfigured = Boolean(activeModel)

        const chatReady = caps.semantier.available

        let status: ConnectionStatus['status']
        let label: ConnectionStatus['label']
        let detail: string

        if (caps.semantier.available) {
          status = 'enhanced'
          label = 'Enhanced'
          detail = 'Semantier Unicell backend connected.'
        } else {
          status = 'disconnected'
          label = 'Disconnected'
          detail = 'No compatible backend detected.'
        }

        const body: ConnectionStatus = {
          status,
          label,
          detail,
          gatewayMode,
          gatewayModeLabel: getGatewayModeLabel(gatewayMode),
          health: caps.health,
          chatReady,
          modelConfigured,
          activeModel,
          chatMode: getChatMode(),
          capabilities: {
            health: caps.health,
            semantier: caps.semantier.available,
          },
          hermesUrl: HERMES_API,
        }

          return Response.json(body)
        } catch (err) {
          if (err instanceof WorkspaceAuthRequiredError) {
            return Response.json(
              { status: 'disconnected', label: 'Disconnected', detail: err.message },
              { status: 401 },
            )
          }
          throw err
        }
      },
    },
  },
})
