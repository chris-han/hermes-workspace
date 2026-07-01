import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { searchMemoryFiles } from '../../../server/memory-browser'
import { resolveWorkspaceHermesHomeFromBackend } from '../../../server/hermes-home'

export const Route = createFileRoute('/api/memory/search')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // Memory is local fs, but the root is the authenticated workspace
        // Hermes home resolved from the backend context.
        const url = new URL(request.url)
        const query = url.searchParams.get('q') || ''
        try {
          const workspaceRoot = await resolveWorkspaceHermesHomeFromBackend(
            request.headers,
          )
          return json({ results: searchMemoryFiles(query, { workspaceRoot }) })
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
