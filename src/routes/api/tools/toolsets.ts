import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { fetchSemantierToolsets } from '../../../server/semantier-tools-api'

export const Route = createFileRoute('/api/tools/toolsets')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const tools = await fetchSemantierToolsets(request.headers)
          return json(tools)
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Failed to load toolsets'
          return json({ error: message }, { status: 502 })
        }
      },
    },
  },
})
