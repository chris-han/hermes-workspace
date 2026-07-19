import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { readMemoryFile, resolveMemoryFilePath } from '../../../server/memory-browser'
import {
  resolveActiveWorkspaceRoot,
  WorkspaceAuthRequiredError,
} from '../../../server/workspace-root'

export const Route = createFileRoute('/api/memory/read')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const pathParam = url.searchParams.get('path') || ''
        try {
          const activeWorkspace = await resolveActiveWorkspaceRoot(
            request.headers,
          )
          const { relativePath } = resolveMemoryFilePath(pathParam, {
            workspaceRoot: activeWorkspace.path,
          })
          const content = readMemoryFile(relativePath, {
            workspaceRoot: activeWorkspace.path,
          })
          return json({ path: relativePath, content })
        } catch (error) {
          if (error instanceof WorkspaceAuthRequiredError) {
            return json({ error: error.message }, { status: 401 })
          }
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
