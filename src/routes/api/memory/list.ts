import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { listMemoryFiles } from '../../../server/memory-browser'
import { resolveWorkspaceHermesHomeFromBackend } from '../../../server/hermes-home'

export const Route = createFileRoute('/api/memory/list')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // Memory is workspace-scoped local filesystem state. Resolve the active
        // workspace Hermes home from the authenticated backend context instead
        // of falling back to the server process' global HERMES_HOME.
        try {
          const workspaceRoot = await resolveWorkspaceHermesHomeFromBackend(
            request.headers,
          )
          return json({ files: listMemoryFiles({ workspaceRoot }) })
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
