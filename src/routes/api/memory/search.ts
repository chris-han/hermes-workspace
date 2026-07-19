import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { searchMemoryFiles } from '../../../server/memory-browser'
import {
  resolveActiveWorkspaceRoot,
  WorkspaceAuthRequiredError,
} from '../../../server/workspace-root'

export const Route = createFileRoute('/api/memory/search')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const query = url.searchParams.get('q') || ''
        try {
          const activeWorkspace = await resolveActiveWorkspaceRoot(
            request.headers,
          )
          return json({
            results: searchMemoryFiles(query, {
              workspaceRoot: activeWorkspace.path,
            }),
          })
        } catch (error) {
          if (error instanceof WorkspaceAuthRequiredError) {
            return json({ error: error.message }, { status: 401 })
          }
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
