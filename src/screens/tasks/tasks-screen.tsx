'use client'

import { useCallback, useMemo, useState } from 'react'
import { useSearch } from '@tanstack/react-router'
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  CheckListIcon,
  RefreshIcon,
} from '@hugeicons/core-free-icons'
import { TaskCard } from './task-card'
import { TaskDialog } from './task-dialog'
import {
  matchingPluginUiExtension,
  pluginActionPath,
  pluginUiComponent,
  pluginUiNegotiationId,
  type PluginUiExtensionManifest,
  type PluginUiExtensionRegistration,
} from '@/lib/plugin-ui-extensions'
import type {
  CreateTaskInput,
  HermesTask,
  TaskAssignee,
  TaskColumn,
} from '@/lib/tasks-api'
import { toast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import {
  COLUMN_COLORS,
  COLUMN_LABELS,
  COLUMN_ORDER,
  createTask,
  deleteTask,
  fetchAssignees,
  fetchTasks,
  isOverdue,
  moveTask,
  updateTask,
} from '@/lib/tasks-api'

const QUERY_KEY = ['hermes', 'tasks'] as const
const ASSIGNEES_KEY = ['hermes', 'tasks', 'assignees'] as const
const PLUGINS_KEY = ['hermes', 'tasks', 'plugins'] as const

export const TASKS_BOARD_HELP_TEXT =
  'Drag cards to change status. Open a card to set assignee and due date.'

type PluginsResponse = {
  plugins?: Array<{
    name?: string
    uiExtensions?: Array<PluginUiExtensionManifest>
  }>
}

function SkeletonCard() {
  return (
    <div className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card)] p-3 animate-pulse">
      <div className="h-3.5 bg-[var(--theme-hover)] rounded w-3/4 mb-2" />
      <div className="h-2.5 bg-[var(--theme-hover)] rounded w-full mb-1" />
      <div className="h-2.5 bg-[var(--theme-hover)] rounded w-2/3 mb-3" />
      <div className="flex gap-1.5">
        <div className="h-4 w-12 bg-[var(--theme-hover)] rounded" />
        <div className="h-4 w-10 bg-[var(--theme-hover)] rounded" />
      </div>
    </div>
  )
}

export function TasksScreen() {
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [createColumn, setCreateColumn] = useState<TaskColumn>('backlog')
  const [editingTask, setEditingTask] = useState<HermesTask | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<TaskColumn | null>(null)
  const [showDone, setShowDone] = useState(false)

  const search = useSearch({ from: '/tasks' })
  const initialAssignee =
    typeof search.assignee === 'string' ? search.assignee : null
  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(
    initialAssignee,
  )

  const tasksQuery = useQuery({
    queryKey: [...QUERY_KEY, showDone],
    queryFn: () => fetchTasks({ include_done: showDone }),
    refetchInterval: 30_000,
    placeholderData: keepPreviousData,
  })

  // Load assignees dynamically from profiles + config
  const assigneesQuery = useQuery({
    queryKey: ASSIGNEES_KEY,
    queryFn: fetchAssignees,
    staleTime: 5 * 60_000, // profiles don't change often
  })

  const pluginsQuery = useQuery({
    queryKey: PLUGINS_KEY,
    queryFn: async function fetchPluginUiExtensions(): Promise<
      Array<PluginUiExtensionRegistration>
    > {
      const response = await fetch('/api/plugins')
      const payload = (await response
        .json()
        .catch(() => ({}))) as PluginsResponse
      if (!response.ok) return []

      return (payload.plugins ?? []).flatMap((plugin) => {
        if (!plugin.name || !Array.isArray(plugin.uiExtensions)) return []
        return plugin.uiExtensions.map((extension) => ({
          pluginName: plugin.name as string,
          extension,
        }))
      })
    },
    staleTime: 5 * 60_000,
  })

  const assignees: Array<TaskAssignee> = assigneesQuery.data?.assignees ?? []
  const humanReviewer = assigneesQuery.data?.humanReviewer ?? null
  const pluginUiExtensions = pluginsQuery.data ?? []

  // Build a label map from dynamic assignees for TaskCard display
  const assigneeLabels = useMemo(() => {
    const map: Record<string, string> = {}
    for (const a of assignees) map[a.id] = a.label
    return map
  }, [assignees])

  const tasks = tasksQuery.data ?? []
  const editingPluginRegistration = matchingPluginUiExtension(
    pluginUiExtensions,
    editingTask?.metadata,
  )
  const EditingPluginDetail =
    editingPluginRegistration && editingTask
      ? pluginUiComponent(editingPluginRegistration, 'detail_drawer')
      : null

  const tasksByColumn = useMemo(() => {
    const map: Record<TaskColumn, Array<HermesTask>> = {
      backlog: [],
      todo: [],
      in_progress: [],
      review: [],
      done: [],
    }
    for (const t of tasks) {
      if (assigneeFilter && t.assignee !== assigneeFilter) continue
      if (map[t.column]) map[t.column].push(t)
    }
    for (const col of COLUMN_ORDER) {
      map[col].sort((a, b) => a.position - b.position)
    }
    return map
  }, [tasks, assigneeFilter])

  const stats = useMemo(() => {
    const total = tasks.length
    const inProgress = tasks.filter((t) => t.column === 'in_progress').length
    const done = tasks.filter((t) => t.column === 'done').length
    const overdue = tasks.filter(
      (t) => isOverdue(t) && t.column !== 'done',
    ).length
    const completion = total > 0 ? Math.round((done / total) * 100) : 0
    return { total, inProgress, done, overdue, completion }
  }, [tasks])

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: QUERY_KEY })
  }, [queryClient])

  const createMutation = useMutation({
    mutationFn: createTask,
    onSuccess: () => {
      invalidate()
      toast('Task created')
      setShowCreate(false)
    },
    onError: (e) =>
      toast(e instanceof Error ? e.message : 'Failed to create task', {
        type: 'error',
      }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: CreateTaskInput }) =>
      updateTask(id, input),
    onSuccess: () => {
      invalidate()
      toast('Task updated')
      setEditingTask(null)
    },
    onError: (e) =>
      toast(e instanceof Error ? e.message : 'Failed to update task', {
        type: 'error',
      }),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteTask,
    onSuccess: () => {
      invalidate()
      toast('Task deleted')
    },
    onError: (e) =>
      toast(e instanceof Error ? e.message : 'Failed to delete task', {
        type: 'error',
      }),
  })

  const moveMutation = useMutation({
    mutationFn: ({ id, column }: { id: string; column: TaskColumn }) =>
      moveTask(id, column, 'user'),
    onSuccess: () => invalidate(),
    onError: (e) =>
      toast(e instanceof Error ? e.message : 'Failed to move task', {
        type: 'error',
      }),
  })

  const pluginActionMutation = useMutation({
    mutationFn: async ({
      task,
      registration,
      actionId,
      payload,
    }: {
      task: HermesTask
      registration: PluginUiExtensionRegistration
      actionId: string
      payload?: Record<string, unknown>
    }) => {
      const path = pluginActionPath(registration, actionId, task.metadata)
      if (!path) throw new Error(`No plugin action path for ${actionId}`)
      const response = await fetch(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload ?? {}),
      })
      const body = (await response.json().catch(() => ({}))) as {
        error?: string
        detail?: string
      }
      if (!response.ok) {
        throw new Error(
          body.error || body.detail || `Action failed: ${actionId}`,
        )
      }
    },
    onSuccess: () => {
      invalidate()
      toast('Task action completed')
    },
    onError: (e) =>
      toast(e instanceof Error ? e.message : 'Task action failed', {
        type: 'error',
      }),
  })

  function handleDragStart(e: React.DragEvent, taskId: string) {
    e.dataTransfer.setData('text/plain', taskId)
    setDraggingId(taskId)
  }

  function handleDragOver(e: React.DragEvent, col: TaskColumn) {
    e.preventDefault()
    setDragOverColumn(col)
  }

  function handleDrop(e: React.DragEvent, targetColumn: TaskColumn) {
    e.preventDefault()
    const taskId = e.dataTransfer.getData('text/plain')
    const task = tasks.find((t) => t.id === taskId)
    if (!task || task.column === targetColumn) {
      setDraggingId(null)
      setDragOverColumn(null)
      return
    }
    // Hybrid autonomy: if a human reviewer is configured, only they can move
    // tasks into the 'done' column — agents may move to 'review' at most.
    if (targetColumn === 'done' && humanReviewer) {
      toast(`Only ${humanReviewer} can mark tasks as done`, { type: 'error' })
      setDraggingId(null)
      setDragOverColumn(null)
      return
    }
    moveMutation.mutate({ id: taskId, column: targetColumn })
    setDraggingId(null)
    setDragOverColumn(null)
  }

  function handleDragEnd() {
    setDraggingId(null)
    setDragOverColumn(null)
  }

  const visibleColumns = showDone
    ? COLUMN_ORDER
    : COLUMN_ORDER.filter((c) => c !== 'done')
  const colMaxWidth = Math.floor(1200 / visibleColumns.length)

  return (
    <div className="min-h-full overflow-y-auto bg-surface text-ink">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 px-4 py-6 pb-[calc(var(--tabbar-h,80px)+1.5rem)] sm:px-6 lg:px-8">
        {/* Header */}
        <header className="rounded-2xl border border-primary-200 bg-primary-50/85 p-4 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <h1 className="text-2xl font-medium text-ink">Tasks</h1>
              {assigneeFilter && (
                <div className="flex items-center gap-2 text-xs text-[var(--theme-muted)]">
                  <span>
                    Filtered by:{' '}
                    <span className="capitalize" style={{ color: '#f59e0b' }}>
                      {assigneeFilter}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setAssigneeFilter(null)}
                    className="text-[var(--theme-muted)] hover:text-[var(--theme-text)] transition-colors"
                  >
                    ✕ Clear
                  </button>
                </div>
              )}
              {/* Stats */}
              <div className="flex items-center gap-2 text-xs text-[var(--theme-muted)] flex-wrap">
                <span>{stats.total} total</span>
                <span className="hidden sm:inline">·</span>
                <span className="hidden sm:inline">
                  {stats.inProgress} in progress
                </span>
                {stats.overdue > 0 && (
                  <>
                    <span>·</span>
                    <span className="text-red-400">
                      {stats.overdue} overdue
                    </span>
                  </>
                )}
                <span className="hidden sm:inline">·</span>
                <span className="hidden sm:inline">
                  {stats.completion}% done
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setShowDone((v) => !v)}
                className={cn(
                  'text-xs px-2.5 py-1 rounded-lg border transition-colors',
                  showDone
                    ? 'border-[var(--theme-accent)] text-[var(--theme-accent)] bg-[var(--theme-hover)]'
                    : 'border-[var(--theme-border)] text-[var(--theme-muted)] hover:text-[var(--theme-text)] hover:border-[var(--theme-accent)]',
                )}
              >
                {showDone ? 'Hide Done' : 'Show Done'}
              </button>
              <button
                onClick={invalidate}
                className="rounded-lg p-1.5 transition-colors hover:bg-[var(--theme-hover)]"
                title="Refresh"
              >
                <HugeiconsIcon
                  icon={RefreshIcon}
                  size={16}
                  className="text-[var(--theme-muted)]"
                />
              </button>
              <button
                onClick={() => {
                  setCreateColumn('backlog')
                  setShowCreate(true)
                }}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
                style={{ background: 'var(--theme-accent)' }}
              >
                <HugeiconsIcon icon={Add01Icon} size={14} />
                New Task
              </button>
            </div>
          </div>
          <p className="mt-3 text-xs text-[var(--theme-muted)]">
            {TASKS_BOARD_HELP_TEXT}
          </p>
        </header>

        {/* Board */}
        <div
          className="mx-auto flex w-full max-w-[1200px] flex-1 gap-3 overflow-x-auto overflow-y-hidden p-4 min-h-0"
          style={{ boxShadow: 'inset 0 8px 24px rgba(0,0,0,0.2)' }}
        >
          {visibleColumns.map((col) => {
            const colTasks = tasksByColumn[col]
            const colColor = COLUMN_COLORS[col]
            const isDragOver = dragOverColumn === col

            return (
              <div
                key={col}
                className={cn(
                  'flex flex-col rounded-xl border min-w-[180px] w-full shrink-0 flex-1',
                  'bg-[var(--theme-card)] border-[var(--theme-border)]',
                  'transition-colors shadow-[0_2px_12px_rgba(0,0,0,0.25)]',
                  isDragOver &&
                    'border-[var(--theme-accent)] bg-[var(--theme-hover)]',
                )}
                style={{ maxWidth: colMaxWidth }}
                onDragOver={(e) => handleDragOver(e, col)}
                onDrop={(e) => handleDrop(e, col)}
                onDragLeave={() => setDragOverColumn(null)}
              >
                {/* Column header */}
                <div
                  className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--theme-border)] rounded-t-xl"
                  style={{
                    borderTopWidth: 2,
                    borderTopColor: colColor,
                    borderTopStyle: 'solid',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: colColor }}
                    />
                    <span className="text-xs font-semibold text-[var(--theme-text)]">
                      {COLUMN_LABELS[col]}
                    </span>
                    <span className="text-xs text-[var(--theme-muted)]">
                      (
                      {tasksQuery.isFetching && tasksQuery.data === undefined
                        ? '…'
                        : colTasks.length}
                      )
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setCreateColumn(col)
                      setShowCreate(true)
                    }}
                    className="rounded p-0.5 hover:bg-[var(--theme-hover)] transition-colors"
                    title={`Add to ${COLUMN_LABELS[col]}`}
                  >
                    <HugeiconsIcon
                      icon={Add01Icon}
                      size={14}
                      className="text-[var(--theme-muted)]"
                    />
                  </button>
                </div>

                {/* Cards */}
                <div className="flex flex-col gap-2 p-2 flex-1 overflow-y-auto">
                  {tasksQuery.isError ? (
                    <motion.div
                      key="error"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex flex-col items-center justify-center py-8 gap-2 text-red-400"
                    >
                      <p className="text-xs font-medium">
                        Failed to load tasks
                      </p>
                      <button
                        onClick={() => tasksQuery.refetch()}
                        className="text-xs text-[var(--theme-accent)] hover:underline"
                      >
                        Retry
                      </button>
                    </motion.div>
                  ) : tasksQuery.isLoading ? (
                    <>
                      <SkeletonCard />
                      <SkeletonCard />
                      <SkeletonCard />
                    </>
                  ) : (
                    <AnimatePresence initial={false}>
                      {colTasks.length === 0 ? (
                        <motion.div
                          key="empty"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="flex flex-col items-center justify-center py-8 gap-2 text-[var(--theme-muted)] opacity-60"
                        >
                          <HugeiconsIcon icon={CheckListIcon} size={22} />
                          <p className="text-xs font-medium">No tasks</p>
                          <p className="text-[10px]">
                            Drop here or click + to add
                          </p>
                        </motion.div>
                      ) : (
                        colTasks.map((task) => (
                          <motion.div
                            key={task.id}
                            layout
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            onDragEnd={handleDragEnd}
                          >
                            <TaskCard
                              task={task}
                              assigneeLabels={assigneeLabels}
                              isDragging={draggingId === task.id}
                              pluginUiExtensions={pluginUiExtensions}
                              onPluginAction={(
                                currentTask,
                                registration,
                                actionId,
                                payload,
                              ) =>
                                pluginActionMutation.mutate({
                                  task: currentTask,
                                  registration,
                                  actionId,
                                  payload,
                                })
                              }
                              onDragStart={(e) => handleDragStart(e, task.id)}
                              onClick={() => setEditingTask(task)}
                            />
                          </motion.div>
                        ))
                      )}
                    </AnimatePresence>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Create dialog */}
        <TaskDialog
          open={showCreate}
          onOpenChange={setShowCreate}
          defaultColumn={createColumn}
          assignees={assignees}
          isSubmitting={createMutation.isPending}
          onSubmit={async (input) => {
            await createMutation.mutateAsync(input)
          }}
        />

        {editingTask && editingPluginRegistration && EditingPluginDetail ? (
          <div
            className="fixed inset-0 z-50 flex justify-end bg-black/45"
            onClick={() => setEditingTask(null)}
          >
            <div
              className="h-full w-full max-w-lg overflow-y-auto border-l border-[var(--theme-border)] bg-[var(--theme-card)] p-5 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <EditingPluginDetail
                taskId={editingTask.id}
                extensionId={editingPluginRegistration.extension.id}
                negotiationId={pluginUiNegotiationId(editingTask.metadata)}
                metadata={editingTask.metadata ?? {}}
                onClose={() => setEditingTask(null)}
                onAction={(actionId, payload) =>
                  pluginActionMutation.mutate({
                    task: editingTask,
                    registration: editingPluginRegistration,
                    actionId,
                    payload,
                  })
                }
              />
            </div>
          </div>
        ) : (
          <TaskDialog
            open={editingTask !== null}
            onOpenChange={(open) => {
              if (!open) setEditingTask(null)
            }}
            task={editingTask}
            assignees={assignees}
            isSubmitting={updateMutation.isPending}
            onSubmit={async (input) => {
              if (!editingTask) return
              await updateMutation.mutateAsync({ id: editingTask.id, input })
            }}
          />
        )}
      </div>
    </div>
  )
}
