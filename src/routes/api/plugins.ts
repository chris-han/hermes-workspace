import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { fetchSemantierPlugins } from '../../server/semantier-plugins-api'

export const Route = createFileRoute('/api/plugins')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const payload = await fetchSemantierPlugins(request.headers)
          return json(payload)
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Failed to load plugins'
          return json({ error: message }, { status: 502 })
        }
      },
    },
  },
})
