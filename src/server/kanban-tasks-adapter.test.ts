import { beforeEach, describe, expect, it, vi } from 'vitest'

import { dashboardFetch } from './gateway-capabilities'
import { createKanbanTask, listKanbanTasks } from './kanban-tasks-adapter'

vi.mock('./gateway-capabilities', () => ({
  dashboardFetch: vi.fn(),
}))

const dashboardFetchMock = vi.mocked(dashboardFetch)

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  dashboardFetchMock.mockReset()
})

describe('kanban-tasks-adapter', () => {
  it('normalizes Kanban board tasks into the workspace task schema', async () => {
    dashboardFetchMock.mockResolvedValueOnce(
      jsonResponse({
        columns: [
          {
            name: 'running',
            tasks: [
              {
                id: 't_1',
                title: 'Implement search',
                body:
                  'Build the feature\n\n' +
                  '<!-- hermes-workspace-task-meta {"tags":["frontend"],"due_date":"2026-06-20"} -->',
                assignee: 'coder',
                status: 'running',
                priority: 1,
                created_by: 'dashboard',
                created_at: 1781913600,
              },
            ],
          },
          {
            name: 'blocked',
            tasks: [
              {
                id: 't_2',
                title: 'Review changes',
                body: 'Needs human review',
                assignee: 'reviewer',
                status: 'blocked',
                priority: -1,
                created_by: 'worker',
                created_at: 1782000000,
              },
            ],
          },
        ],
      }),
    )

    const tasks = await listKanbanTasks(
      'http://workspace.local/api/hermes-tasks?include_done=true',
      {},
      { includeDone: true },
    )

    expect(tasks).toMatchObject([
      {
        id: 't_1',
        description: 'Build the feature',
        column: 'in_progress',
        priority: 'high',
        tags: ['frontend'],
        due_date: '2026-06-20',
      },
      {
        id: 't_2',
        description: 'Needs human review',
        column: 'review',
        priority: 'low',
      },
    ])
  })

  it('creates through Kanban and patches status when the UI column is not the Kanban default', async () => {
    dashboardFetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          task: {
            id: 't_3',
            title: 'Backlog item',
            body: 'Details',
            assignee: null,
            status: 'ready',
            priority: 0,
            created_by: 'dashboard',
            created_at: 1781913600,
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          task: {
            id: 't_3',
            title: 'Backlog item',
            body: 'Details',
            assignee: null,
            status: 'todo',
            priority: 0,
            created_by: 'dashboard',
            created_at: 1781913600,
          },
        }),
      )

    const task = await createKanbanTask(
      {
        title: 'Backlog item',
        description: 'Details',
        column: 'todo',
        priority: 'medium',
      },
      'http://workspace.local/api/hermes-tasks',
      {},
    )

    expect(task.column).toBe('todo')
    expect(dashboardFetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/plugins/kanban/tasks',
      expect.objectContaining({ method: 'POST' }),
      expect.any(Object),
    )
    expect(dashboardFetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/plugins/kanban/tasks/t_3',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ status: 'todo' }),
      }),
      expect.any(Object),
    )
  })
})
