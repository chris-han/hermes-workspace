import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { writeMemoryFile } from '../../../server/memory-browser'
import { requireJsonContentType } from '../../../server/rate-limit'
import {
  resolveActiveWorkspaceRoot,
  WorkspaceAuthRequiredError,
} from '../../../server/workspace-root'

export const Route = createFileRoute('/api/memory/write')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const csrfCheck = requireJsonContentType(request)
        if (csrfCheck) return csrfCheck
        try {
          const body = (await request.json().catch(() => ({}))) as {
            path?: unknown
            content?: unknown
          }
          if (typeof body.path !== 'string') throw new Error('Path is required')
          const content = typeof body.content === 'string' ? body.content : ''
          const activeWorkspace = await resolveActiveWorkspaceRoot(
            request.headers,
          )
          const savedPath = writeMemoryFile(body.path, content, {
            workspaceRoot: activeWorkspace.path,
            writeMode: 'replace',
          })
          return json({ success: true, path: savedPath })
        } catch (error) {
          if (error instanceof WorkspaceAuthRequiredError) {
            return json({ error: error.message }, { status: 401 })
          }
          const message =
            error instanceof Error
              ? error.message
              : 'Failed to write memory file'
          const status =
            /required|absolute|traversal|outside workspace|\.md/i.test(message)
              ? 400
              : 500
          return json({ error: message }, { status })
        }
      },
    },
  },
})
