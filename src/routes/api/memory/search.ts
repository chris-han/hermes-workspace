import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { searchMemory } from '../../../server/hermes-api'

export const Route = createFileRoute('/api/memory/search')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const query = url.searchParams.get('q') || ''
        try {
          return json(await searchMemory(query))
        } catch (error) {
          return json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to search memory files',
            },
            { status: 500 },
          )
        }
      },
    },
  },
})
