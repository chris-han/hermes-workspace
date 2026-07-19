import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { listMemory } from '../../../server/hermes-api'

export const Route = createFileRoute('/api/memory/list')({
  server: {
    handlers: {
      GET: async () => {
        try {
          return json(await listMemory())
        } catch (error) {
          return json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to list memory files',
            },
            { status: 500 },
          )
        }
      },
    },
  },
})
