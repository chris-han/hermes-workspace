import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import {
  HERMES_API,
  HERMES_DASHBOARD_URL,
  ensureGatewayProbed,
  getCapabilities,
  getConfiguredGatewayMode,
  getGatewayMode,
  getGatewayModeLabel,
  getGatewayModeSource,
} from '../../server/gateway-capabilities'

export const Route = createFileRoute('/api/gateway-status')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const capabilities = await ensureGatewayProbed()
        const mode = getGatewayMode()
        return json({
          capabilities,
          mode,
          modeLabel: getGatewayModeLabel(mode),
          modeSource: getGatewayModeSource(),
          configuredMode: getConfiguredGatewayMode(),
          hermesUrl: HERMES_API,
          dashboardUrl: HERMES_DASHBOARD_URL,
          semantierUrl: capabilities.semantier.url,
          gateway: {
            available: capabilities.health || capabilities.chatCompletions,
            url: HERMES_API,
          },
          dashboard: capabilities.dashboard,
          semantier: capabilities.semantier,
        })
      },
    },
  },
})
