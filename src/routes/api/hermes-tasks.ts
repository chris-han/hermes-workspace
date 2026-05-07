import { createFileRoute } from '@tanstack/react-router'
import {
  createTask,
  listTasks,
  resolveWorkspaceTaskHermesHome,
} from '../../server/tasks-store'
import { WorkspaceAuthRequiredError } from '../../server/workspace-root'

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const Route = createFileRoute('/api/hermes-tasks')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url)
          const hermesHome = await resolveWorkspaceTaskHermesHome(request.headers)
          const tasks = listTasks(hermesHome, {
            column: url.searchParams.get('column'),
            assignee: url.searchParams.get('assignee'),
            priority: url.searchParams.get('priority'),
            includeDone: url.searchParams.get('include_done') === 'true',
          })

          return jsonResponse({ tasks })
        } catch (err) {
          if (err instanceof WorkspaceAuthRequiredError) {
            return jsonResponse({ error: err.message }, 401)
          }
          throw err
        }
      },

      POST: async ({ request }) => {
        try {
          const hermesHome = await resolveWorkspaceTaskHermesHome(
            request.headers,
          )
          const body = (await request.json()) as Record<string, unknown>
          if (!body.title || typeof body.title !== 'string') {
            return jsonResponse({ error: 'title is required' }, 400)
          }

          const task = createTask(hermesHome, {
            id: typeof body.id === 'string' ? body.id : undefined,
            title: body.title,
            description:
              typeof body.description === 'string' ? body.description : '',
            column: typeof body.column === 'string' ? body.column : undefined,
            priority:
              typeof body.priority === 'string' ? body.priority : undefined,
            assignee: typeof body.assignee === 'string' ? body.assignee : null,
            tags: Array.isArray(body.tags)
              ? body.tags.filter(
                  (tag): tag is string => typeof tag === 'string',
                )
              : [],
            due_date: typeof body.due_date === 'string' ? body.due_date : null,
            position: typeof body.position === 'number' ? body.position : 0,
            created_by:
              typeof body.created_by === 'string' ? body.created_by : 'user',
          })

          return jsonResponse({ task }, 201)
        } catch (err) {
          if (err instanceof WorkspaceAuthRequiredError) {
            return jsonResponse({ error: err.message }, 401)
          }
          return jsonResponse({ error: 'Invalid request body' }, 400)
        }
      },
    },
  },
})
