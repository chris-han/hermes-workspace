import { json } from '@tanstack/react-start'
import { createFileRoute } from '@tanstack/react-router'
import {
  ensureDiscovery,
  forceDiscovery,
  getDiscoveredModels,
  getDiscoveryStatus,
  isProviderConfigured,
} from '../../server/local-provider-discovery'

export const Route = createFileRoute('/api/local-providers')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const refresh = url.searchParams.get('refresh') === 'true'

        if (refresh) {
          await forceDiscovery()
        } else {
          await ensureDiscovery()
        }

        const status = getDiscoveryStatus()
        const models = getDiscoveredModels()
        const configuredById = new Map<string, boolean>(
          await Promise.all(
            status.map(
              async (provider): Promise<readonly [string, boolean]> => [
                provider.id,
                await isProviderConfigured(provider.id, request.headers),
              ],
            ),
          ),
        )

        return json({
          ok: true,
          providers: status.map((p) => ({
            ...p,
            configured: configuredById.get(p.id) ?? false,
            needsRestart: (configuredById.get(p.id) ?? false) ? false : p.online,
          })),
          models,
          totalLocalModels: models.length,
        })
      },
    },
  },
})
