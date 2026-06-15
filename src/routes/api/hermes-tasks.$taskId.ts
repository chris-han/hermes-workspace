import { createFileRoute } from '@tanstack/react-router'
import {
  deleteKanbanTask,
  getKanbanTask,
  jsonResponse,
  moveKanbanTask,
  updateKanbanTask,
} from '../../server/kanban-tasks-adapter'
import type { TaskColumn, TaskPriority } from '../../server/tasks-store'

export const Route = createFileRoute('/api/hermes-tasks/$taskId')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const task = await getKanbanTask(
            params.taskId,
            request.url,
            request.headers,
          )
          if (!task) return jsonResponse({ error: 'Task not found' }, 404)
          return jsonResponse({ task })
        } catch (err) {
          const message =
            err instanceof Error ? err.message : 'Failed to load Kanban task'
          return jsonResponse({ error: message }, 502)
        }
      },

      PATCH: async ({ request, params }) => {
        try {
          const body = (await request.json()) as Record<string, unknown>
          const task = await updateKanbanTask(
            params.taskId,
            {
              title: typeof body.title === 'string' ? body.title : undefined,
              description:
                typeof body.description === 'string'
                  ? body.description
                  : undefined,
              column:
                typeof body.column === 'string'
                  ? (body.column as TaskColumn)
                  : undefined,
              priority:
                typeof body.priority === 'string'
                  ? (body.priority as TaskPriority)
                  : undefined,
              assignee:
                body.assignee === null || typeof body.assignee === 'string'
                  ? body.assignee
                  : undefined,
              tags: Array.isArray(body.tags)
                ? body.tags.filter(
                    (tag): tag is string => typeof tag === 'string',
                  )
                : undefined,
              due_date:
                body.due_date === null || typeof body.due_date === 'string'
                  ? body.due_date
                  : undefined,
              position:
                typeof body.position === 'number' ? body.position : undefined,
            },
            request.url,
            request.headers,
          )

          if (!task) return jsonResponse({ error: 'Task not found' }, 404)
          return jsonResponse({ task })
        } catch (err) {
          const message =
            err instanceof Error ? err.message : 'Invalid Kanban task request'
          return jsonResponse({ error: message }, 400)
        }
      },

      DELETE: async ({ request, params }) => {
        try {
          await deleteKanbanTask(params.taskId, request.url, request.headers)
          return jsonResponse({ ok: true })
        } catch (err) {
          const message =
            err instanceof Error ? err.message : 'Failed to delete Kanban task'
          return jsonResponse({ error: message }, 502)
        }
      },

      POST: async ({ request, params }) => {
        const url = new URL(request.url)
        const action = url.searchParams.get('action') || 'move'
        if (action !== 'move') {
          return jsonResponse({ error: `Unsupported action: ${action}` }, 400)
        }

        try {
          const body = (await request.json()) as Record<string, unknown>
          if (typeof body.column !== 'string') {
            return jsonResponse({ error: 'column is required' }, 400)
          }
          const task = await moveKanbanTask(
            params.taskId,
            body.column as TaskColumn,
            request.url,
            request.headers,
          )
          if (!task) return jsonResponse({ error: 'Task not found' }, 404)
          return jsonResponse({ task })
        } catch (err) {
          const message =
            err instanceof Error ? err.message : 'Invalid Kanban task request'
          return jsonResponse({ error: message }, 400)
        }
      },
    },
  },
})
