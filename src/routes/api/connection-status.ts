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
import { isAuthenticated } from '../../server/auth-middleware'

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
        const authResult = isAuthenticated(request)
        if (authResult !== true) return authResult as unknown as Response

        const caps = await ensureGatewayProbed()
        const gatewayMode = getGatewayMode()
        const configPath = await resolveHermesConfigPathFromBackend(
          request.headers,
        )
        const activeModel = readActiveModel(configPath)
        const modelConfigured = Boolean(activeModel)

        const chatReady = caps.chatCompletions
        const enhancedReady =
          chatReady &&
          (caps.dashboard.available || caps.sessions) &&
          caps.skills &&
          caps.config

        let status: ConnectionStatus['status']
        let label: ConnectionStatus['label']
        let detail: string

        if (caps.semantier.available && !caps.health && !chatReady) {
          status = 'partial'
          label = 'Partial'
          detail =
            'Semantier Unicell backend is available. Hermes chat APIs are not connected yet.'
        } else if (!caps.health && !chatReady) {
          status = 'disconnected'
          label = 'Disconnected'
          detail = 'No compatible backend detected.'
        } else if (enhancedReady) {
          status = 'enhanced'
          label = 'Enhanced'
          detail = modelConfigured
            ? caps.dashboard.available
              ? 'Core chat works and the Hermes dashboard APIs are available.'
              : 'Core chat works and Hermes gateway APIs are available.'
            : caps.dashboard.available
              ? 'Hermes dashboard APIs are available. Choose a model to start chatting.'
              : 'Hermes gateway APIs are available. Choose a model to start chatting.'
        } else if (chatReady && modelConfigured) {
          status = 'connected'
          label = 'Connected'
          detail = 'Core chat is ready on this backend.'
        } else {
          status = 'partial'
          label = 'Partial'
          if (!chatReady) {
            detail = 'Backend reachable, but chat API is not ready yet.'
          } else if (!modelConfigured) {
            detail =
              'Backend connected. Choose a provider and model to test chat.'
          } else {
            detail =
              'Core chat works. Enhanced Hermes gateway APIs are optional and unlock automatically when available.'
          }
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
            chatCompletions: caps.chatCompletions,
            models: caps.models,
            streaming: caps.streaming,
            sessions: caps.sessions,
            skills: caps.skills,
            memory: caps.memory,
            config: caps.config,
            jobs: caps.jobs,
            dashboard: caps.dashboard.available,
            semantier: caps.semantier.available,
          },
          hermesUrl: HERMES_API,
        }

        return Response.json(body)
      },
    },
  },
})
