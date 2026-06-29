import { createFileRoute } from '@tanstack/react-router'
import {
  fetchKanbanAssignees,
  jsonResponse,
} from '../../server/kanban-tasks-adapter'

export const Route = createFileRoute('/api/hermes-tasks-assignees')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const payload = await fetchKanbanAssignees(
            request.url,
            request.headers,
          )
          return jsonResponse(payload)
        } catch (err) {
          const message =
            err instanceof Error
              ? err.message
              : 'Failed to load Kanban assignees'
          return jsonResponse({ error: message }, 502)
        }
      },
    },
  },
})
