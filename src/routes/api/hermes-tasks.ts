import { createFileRoute } from '@tanstack/react-router'
import {
  createKanbanTask,
  jsonResponse,
  listKanbanTasks,
} from '../../server/kanban-tasks-adapter'
import type { TaskColumn, TaskPriority } from '../../server/tasks-store'

export const Route = createFileRoute('/api/hermes-tasks')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url)
          const tasks = await listKanbanTasks(request.url, request.headers, {
            column: url.searchParams.get('column'),
            assignee: url.searchParams.get('assignee'),
            priority: url.searchParams.get('priority'),
            includeDone: url.searchParams.get('include_done') === 'true',
          })

          return jsonResponse({ tasks })
        } catch (err) {
          const message =
            err instanceof Error ? err.message : 'Failed to load Kanban tasks'
          return jsonResponse({ error: message }, 502)
        }
      },

      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as Record<string, unknown>
          if (!body.title || typeof body.title !== 'string') {
            return jsonResponse({ error: 'title is required' }, 400)
          }

          const task = await createKanbanTask(
            {
              title: body.title,
              description:
                typeof body.description === 'string' ? body.description : '',
              column:
                typeof body.column === 'string'
                  ? (body.column as TaskColumn)
                  : undefined,
              priority:
                typeof body.priority === 'string'
                  ? (body.priority as TaskPriority)
                  : undefined,
              assignee:
                typeof body.assignee === 'string' ? body.assignee : null,
              tags: Array.isArray(body.tags)
                ? body.tags.filter(
                    (tag): tag is string => typeof tag === 'string',
                  )
                : [],
              due_date:
                typeof body.due_date === 'string' ? body.due_date : null,
              position: typeof body.position === 'number' ? body.position : 0,
              created_by:
                typeof body.created_by === 'string' ? body.created_by : 'user',
            },
            request.url,
            request.headers,
          )

          return jsonResponse({ task }, 201)
        } catch (err) {
          const message =
            err instanceof Error ? err.message : 'Invalid Kanban task request'
          return jsonResponse({ error: message }, 400)
        }
      },
    },
  },
})
