import { dashboardFetch } from './gateway-capabilities'
import type { TaskColumn, TaskPriority, TaskRecord } from './tasks-store'

type KanbanStatus =
  | 'triage'
  | 'todo'
  | 'scheduled'
  | 'ready'
  | 'running'
  | 'blocked'
  | 'review'
  | 'done'
  | 'archived'

type KanbanTask = {
  id: string
  title: string
  body?: string | null
  assignee?: string | null
  status: KanbanStatus
  priority?: number | null
  created_by?: string | null
  created_at?: number | null
  completed_at?: number | null
  skills?: Array<string> | null
}

type KanbanBoardResponse = {
  columns?: Array<{ name: string; tasks: Array<KanbanTask> }>
}

type KanbanTaskResponse = {
  task?: KanbanTask | null
}

type WorkspaceTaskMeta = {
  tags?: Array<string>
  due_date?: string | null
}

type TaskFilters = {
  column?: string | null
  assignee?: string | null
  priority?: string | null
  includeDone?: boolean
}

type CreateTaskInput = Partial<TaskRecord> & { title: string }
type UpdateTaskInput = Partial<
  Omit<TaskRecord, 'id' | 'created_at' | 'created_by'>
>

const META_PREFIX = '<!-- hermes-workspace-task-meta '
const META_SUFFIX = ' -->'

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function kanbanJson<T>(
  path: string,
  init: RequestInit = {},
  requestHeaders?: HeadersInit | Headers,
): Promise<T> {
  const response = await dashboardFetch(path, init, { requestHeaders })
  const data = (await response.json().catch(() => ({}))) as T & {
    detail?: string
    error?: string
  }
  if (!response.ok) {
    throw new Error(
      data.detail || data.error || `Kanban API ${path}: ${response.status}`,
    )
  }
  return data
}

function boardQuery(requestUrl: string): string {
  const url = new URL(requestUrl)
  const board = url.searchParams.get('board')
  return board ? `?board=${encodeURIComponent(board)}` : ''
}

function bodyWithMeta(description?: string, meta: WorkspaceTaskMeta = {}) {
  const cleanDescription = (description ?? '').trim()
  const cleanMeta: WorkspaceTaskMeta = {}
  if (Array.isArray(meta.tags) && meta.tags.length > 0) {
    cleanMeta.tags = meta.tags.filter((tag) => typeof tag === 'string')
  }
  if (meta.due_date) cleanMeta.due_date = meta.due_date

  if (!cleanMeta.tags && !cleanMeta.due_date) return cleanDescription || null
  const encoded = `${META_PREFIX}${JSON.stringify(cleanMeta)}${META_SUFFIX}`
  return cleanDescription ? `${cleanDescription}\n\n${encoded}` : encoded
}

function splitBodyAndMeta(body?: string | null): {
  description: string
  meta: WorkspaceTaskMeta
} {
  if (!body) return { description: '', meta: {} }
  const trimmed = body.trimEnd()
  const markerStart = trimmed.lastIndexOf(META_PREFIX)
  if (markerStart === -1 || !trimmed.endsWith(META_SUFFIX)) {
    return { description: body, meta: {} }
  }

  const raw = trimmed.slice(
    markerStart + META_PREFIX.length,
    trimmed.length - META_SUFFIX.length,
  )
  try {
    const parsed = JSON.parse(raw) as WorkspaceTaskMeta
    return {
      description: trimmed.slice(0, markerStart).trimEnd(),
      meta: {
        tags: Array.isArray(parsed.tags)
          ? parsed.tags.filter((tag): tag is string => typeof tag === 'string')
          : undefined,
        due_date: typeof parsed.due_date === 'string' ? parsed.due_date : null,
      },
    }
  } catch {
    return { description: body, meta: {} }
  }
}

function kanbanStatusToColumn(status: KanbanStatus): TaskColumn {
  if (status === 'triage') return 'backlog'
  if (status === 'todo' || status === 'scheduled') return 'todo'
  if (status === 'ready' || status === 'running') return 'in_progress'
  if (status === 'blocked' || status === 'review') return 'review'
  return 'done'
}

function columnToKanbanStatus(
  column?: string | null,
): KanbanStatus | undefined {
  if (column === 'backlog') return 'triage'
  if (column === 'todo') return 'todo'
  if (column === 'in_progress') return 'ready'
  if (column === 'review') return 'blocked'
  if (column === 'done') return 'done'
  return undefined
}

function kanbanPriorityToTaskPriority(priority?: number | null): TaskPriority {
  if (typeof priority === 'number' && priority > 0) return 'high'
  if (typeof priority === 'number' && priority < 0) return 'low'
  return 'medium'
}

function taskPriorityToKanbanPriority(priority?: string | null): number {
  if (priority === 'high') return 1
  if (priority === 'low') return -1
  return 0
}

function isoFromEpochSeconds(value?: number | null): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return new Date(0).toISOString()
  }
  return new Date(value * 1000).toISOString()
}

function normalizeKanbanTask(task: KanbanTask): TaskRecord {
  const { description, meta } = splitBodyAndMeta(task.body)
  const createdAt = isoFromEpochSeconds(task.created_at)
  const completedAt = isoFromEpochSeconds(task.completed_at ?? task.created_at)
  return {
    id: task.id,
    title: task.title,
    description,
    column: kanbanStatusToColumn(task.status),
    priority: kanbanPriorityToTaskPriority(task.priority),
    assignee: task.assignee ?? null,
    tags: meta.tags ?? task.skills ?? [],
    due_date: meta.due_date ?? null,
    position: typeof task.created_at === 'number' ? task.created_at : 0,
    created_by: task.created_by ?? 'kanban',
    created_at: createdAt,
    updated_at: completedAt,
  }
}

function filterTasks(
  tasks: Array<TaskRecord>,
  filters: TaskFilters = {},
): Array<TaskRecord> {
  return tasks.filter((task) => {
    if (!filters.includeDone && task.column === 'done') return false
    if (filters.column && task.column !== filters.column) return false
    if (filters.assignee && task.assignee !== filters.assignee) return false
    if (filters.priority && task.priority !== filters.priority) return false
    return true
  })
}

function taskPayload(input: CreateTaskInput | UpdateTaskInput) {
  const payload: Record<string, unknown> = {}
  if (typeof input.title === 'string') payload.title = input.title
  if ('description' in input || 'tags' in input || 'due_date' in input) {
    payload.body = bodyWithMeta(input.description, {
      tags: input.tags,
      due_date: input.due_date,
    })
  }
  if ('assignee' in input) payload.assignee = input.assignee ?? null
  if (typeof input.priority === 'string') {
    payload.priority = taskPriorityToKanbanPriority(input.priority)
  }
  const status = columnToKanbanStatus(input.column)
  if (status) {
    payload.status = status
    if (status === 'blocked') {
      payload.block_reason = 'Moved to review from Hermes Workspace'
    }
    if (status === 'done') {
      payload.summary = 'Marked done from Hermes Workspace'
    }
  }
  return payload
}

export async function listKanbanTasks(
  requestUrl: string,
  requestHeaders: HeadersInit | Headers,
  filters: TaskFilters = {},
): Promise<Array<TaskRecord>> {
  const separator = boardQuery(requestUrl) ? '&' : '?'
  const board = boardQuery(requestUrl)
  const data = await kanbanJson<KanbanBoardResponse>(
    `/api/plugins/kanban/board${board}${separator}include_archived=false`,
    undefined,
    requestHeaders,
  )
  const tasks = (data.columns ?? [])
    .flatMap((column) => column.tasks ?? [])
    .filter((task) => task.status !== 'archived')
    .map(normalizeKanbanTask)
    .sort(
      (a, b) =>
        a.position - b.position || a.created_at.localeCompare(b.created_at),
    )
  return filterTasks(tasks, filters)
}

export async function getKanbanTask(
  taskId: string,
  requestUrl: string,
  requestHeaders: HeadersInit | Headers,
): Promise<TaskRecord | null> {
  const data = await kanbanJson<KanbanTaskResponse>(
    `/api/plugins/kanban/tasks/${encodeURIComponent(taskId)}${boardQuery(
      requestUrl,
    )}`,
    undefined,
    requestHeaders,
  )
  return data.task ? normalizeKanbanTask(data.task) : null
}

export async function createKanbanTask(
  input: CreateTaskInput,
  requestUrl: string,
  requestHeaders: HeadersInit | Headers,
): Promise<TaskRecord> {
  const status = columnToKanbanStatus(input.column)
  const payload = {
    title: input.title,
    body: bodyWithMeta(input.description, {
      tags: input.tags,
      due_date: input.due_date,
    }),
    assignee: input.assignee ?? null,
    priority: taskPriorityToKanbanPriority(input.priority),
    triage: status === 'triage',
  }
  const data = await kanbanJson<KanbanTaskResponse>(
    `/api/plugins/kanban/tasks${boardQuery(requestUrl)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    requestHeaders,
  )
  if (!data.task) throw new Error('Kanban task create returned no task')

  if (status && status !== 'triage' && status !== data.task.status) {
    return updateKanbanTask(
      data.task.id,
      { column: input.column },
      requestUrl,
      requestHeaders,
    )
  }
  return normalizeKanbanTask(data.task)
}

export async function updateKanbanTask(
  taskId: string,
  input: UpdateTaskInput,
  requestUrl: string,
  requestHeaders: HeadersInit | Headers,
): Promise<TaskRecord> {
  const data = await kanbanJson<KanbanTaskResponse>(
    `/api/plugins/kanban/tasks/${encodeURIComponent(taskId)}${boardQuery(
      requestUrl,
    )}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(taskPayload(input)),
    },
    requestHeaders,
  )
  if (!data.task) throw new Error('Kanban task update returned no task')
  return normalizeKanbanTask(data.task)
}

export async function moveKanbanTask(
  taskId: string,
  column: TaskColumn,
  requestUrl: string,
  requestHeaders: HeadersInit | Headers,
): Promise<TaskRecord> {
  return updateKanbanTask(taskId, { column }, requestUrl, requestHeaders)
}

export async function deleteKanbanTask(
  taskId: string,
  requestUrl: string,
  requestHeaders: HeadersInit | Headers,
): Promise<void> {
  await kanbanJson(
    `/api/plugins/kanban/tasks/${encodeURIComponent(taskId)}${boardQuery(
      requestUrl,
    )}`,
    { method: 'DELETE' },
    requestHeaders,
  )
}

export async function fetchKanbanAssignees(
  requestUrl: string,
  requestHeaders: HeadersInit | Headers,
) {
  const data = await kanbanJson<{
    assignees?: Array<{ name?: string; label?: string; on_disk?: boolean }>
  }>(
    `/api/plugins/kanban/assignees${boardQuery(requestUrl)}`,
    undefined,
    requestHeaders,
  )
  return {
    assignees: (data.assignees ?? [])
      .map((assignee) => {
        const id = assignee.name ?? assignee.label
        if (!id) return null
        return { id, label: assignee.label ?? id, isHuman: false }
      })
      .filter((assignee): assignee is NonNullable<typeof assignee> =>
        Boolean(assignee),
      ),
    humanReviewer: null,
  }
}

export { jsonResponse }
