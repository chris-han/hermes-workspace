import { createFileRoute } from '@tanstack/react-router'
import {
  deleteTask,
  getTask,
  moveTask,
  resolveWorkspaceTaskHermesHome,
  updateTask,
} from '../../server/tasks-store'
import { WorkspaceAuthRequiredError } from '../../server/workspace-root'
import type { TaskColumn } from '../../server/tasks-store'

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const Route = createFileRoute('/api/hermes-tasks/$taskId')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const hermesHome = await resolveWorkspaceTaskHermesHome(request.headers)
          const task = getTask(hermesHome, params.taskId)
          if (!task) return jsonResponse({ error: 'Task not found' }, 404)
          return jsonResponse({ task })
        } catch (err) {
          if (err instanceof WorkspaceAuthRequiredError) {
            return jsonResponse({ error: err.message }, 401)
          }
          throw err
        }
      },

      PATCH: async ({ request, params }) => {
        try {
          const hermesHome = await resolveWorkspaceTaskHermesHome(
            request.headers,
          )
          const body = (await request.json()) as Record<string, unknown>
          const task = updateTask(hermesHome, params.taskId, {
            title: typeof body.title === 'string' ? body.title : undefined,
            description:
              typeof body.description === 'string'
                ? body.description
                : undefined,
            column: typeof body.column === 'string' ? body.column : undefined,
            priority:
              typeof body.priority === 'string' ? body.priority : undefined,
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
          })

          if (!task) return jsonResponse({ error: 'Task not found' }, 404)
          return jsonResponse({ task })
        } catch (err) {
          if (err instanceof WorkspaceAuthRequiredError) {
            return jsonResponse({ error: err.message }, 401)
          }
          return jsonResponse({ error: 'Invalid request body' }, 400)
        }
      },

      DELETE: async ({ request, params }) => {
        try {
          const hermesHome = await resolveWorkspaceTaskHermesHome(request.headers)
          const deleted = deleteTask(hermesHome, params.taskId)
          if (!deleted) return jsonResponse({ error: 'Task not found' }, 404)
          return jsonResponse({ ok: true })
        } catch (err) {
          if (err instanceof WorkspaceAuthRequiredError) {
            return jsonResponse({ error: err.message }, 401)
          }
          throw err
        }
      },

      POST: async ({ request, params }) => {
        const url = new URL(request.url)
        const action = url.searchParams.get('action') || 'move'
        if (action !== 'move') {
          return jsonResponse({ error: `Unsupported action: ${action}` }, 400)
        }

        try {
          const hermesHome = await resolveWorkspaceTaskHermesHome(
            request.headers,
          )
          const body = (await request.json()) as Record<string, unknown>
          if (typeof body.column !== 'string') {
            return jsonResponse({ error: 'column is required' }, 400)
          }
          const task = moveTask(
            hermesHome,
            params.taskId,
            body.column as TaskColumn,
          )
          if (!task) return jsonResponse({ error: 'Task not found' }, 404)
          return jsonResponse({ task })
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
