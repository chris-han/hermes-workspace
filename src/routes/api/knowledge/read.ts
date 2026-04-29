import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { readKnowledgePage } from '../../../server/knowledge-browser'
import {
  resolveActiveWorkspaceRoot,
  WorkspaceAuthRequiredError,
} from '../../../server/workspace-root'

export const Route = createFileRoute('/api/knowledge/read')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const pathParam = url.searchParams.get('path') || ''

        try {
          const activeWorkspace = await resolveActiveWorkspaceRoot(
            request.headers,
          )
          const { meta, content, backlinks } = readKnowledgePage(
            pathParam,
            activeWorkspace.path,
          )
          return json({ page: meta, content, backlinks })
        } catch (error) {
          if (error instanceof WorkspaceAuthRequiredError) {
            return json({ error: error.message }, { status: 401 })
          }
          const message =
            error instanceof Error
              ? error.message
              : 'Failed to read knowledge page'
          const status =
            /not allowed|outside knowledge root|required|traversal/i.test(
              message,
            )
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
