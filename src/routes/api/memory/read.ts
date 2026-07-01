import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { readMemoryFile } from '../../../server/memory-browser'
import { resolveWorkspaceHermesHomeFromBackend } from '../../../server/hermes-home'

export const Route = createFileRoute('/api/memory/read')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // Memory is local fs, but the root is the authenticated workspace
        // Hermes home resolved from the backend context.
        const url = new URL(request.url)
        const pathParam = url.searchParams.get('path') || ''
        try {
          const workspaceRoot = await resolveWorkspaceHermesHomeFromBackend(
            request.headers,
          )
          const content = readMemoryFile(pathParam, { workspaceRoot })
          return json({ path: pathParam, content })
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : 'Failed to read memory file'
          const status = /not allowed|outside workspace|required/i.test(message)
            ? 400
            : /ENOENT/.test(message)
              ? 404
              : 500
          return json({ error: message }, { status })
        }
      },
    },
  },
})
