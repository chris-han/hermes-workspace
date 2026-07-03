import type { HermesTask } from '@/lib/tasks-api'
import type { PluginUiExtensionRegistration } from '@/lib/plugin-ui-extensions'
import { cn } from '@/lib/utils'
import {
  matchingPluginUiExtension,
  pluginUiComponent,
  pluginUiNegotiationId,
} from '@/lib/plugin-ui-extensions'
import { PRIORITY_COLORS, isOverdue } from '@/lib/tasks-api'

type Props = {
  task: HermesTask
  assigneeLabels?: Record<string, string>
  onClick: () => void
  onDragStart: (e: React.DragEvent) => void
  isDragging?: boolean
  pluginUiExtensions?: Array<PluginUiExtensionRegistration>
  onPluginAction?: (
    task: HermesTask,
    registration: PluginUiExtensionRegistration,
    actionId: string,
    payload?: Record<string, unknown>,
  ) => void
}

export function formatTaskAssigneeLabel(
  assignee: string | null,
  assigneeLabels: Record<string, string>,
): string {
  const resolvedLabel = assignee
    ? (assigneeLabels[assignee] ?? assignee)
    : 'Unassigned'
  return `Assignee: ${resolvedLabel}`
}

export function TaskCard({
  task,
  assigneeLabels = {},
  onClick,
  onDragStart,
  isDragging,
  pluginUiExtensions = [],
  onPluginAction,
}: Props) {
  const overdue = isOverdue(task)
  const priorityColor = PRIORITY_COLORS[task.priority]
  const visibleTags = task.tags.slice(0, 2)
  const extraTagCount = task.tags.length - 2
  const assigneeLabel = formatTaskAssigneeLabel(task.assignee, assigneeLabels)
  const pluginRegistration = matchingPluginUiExtension(
    pluginUiExtensions,
    task.metadata,
  )
  const PluginCard = pluginRegistration
    ? pluginUiComponent(pluginRegistration, 'card_renderer')
    : null

  if (pluginRegistration && PluginCard) {
    return (
      <div
        draggable
        onDragStart={onDragStart}
        className={cn(
          'relative rounded-card border p-3 transition-colors select-none',
          'bg-[var(--theme-card)] border-[var(--theme-border)]',
          isDragging ? 'opacity-50' : 'hover:border-[var(--theme-accent)]',
        )}
      >
        <span
          className="absolute right-3 top-3 h-2 w-2 rounded-full"
          style={{ background: priorityColor }}
          aria-hidden="true"
        />
        <PluginCard
          taskId={task.id}
          extensionId={pluginRegistration.extension.id}
          negotiationId={pluginUiNegotiationId(task.metadata)}
          metadata={task.metadata ?? {}}
          onOpenDetail={onClick}
          onAction={(actionId, payload) =>
            onPluginAction?.(task, pluginRegistration, actionId, payload)
          }
        />
      </div>
    )
  }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onClick()
        }
      }}
      role="button"
      tabIndex={0}
      className={cn(
        'relative rounded-card border p-3 cursor-pointer transition-colors select-none outline-none',
        'bg-[var(--theme-card)] border-[var(--theme-border)]',
        'hover:border-[var(--theme-accent)] focus-visible:ring-2 focus-visible:ring-[var(--theme-accent)]',
        isDragging && 'opacity-50',
      )}
    >
      <span
        className="absolute right-3 top-3 h-2 w-2 shrink-0 rounded-full"
        style={{ background: priorityColor }}
        title={`Priority: ${task.priority}`}
      />

      <p className="mb-1 pr-5 text-sm font-semibold leading-snug text-[var(--theme-text)] line-clamp-2">
        {task.title}
      </p>

      {task.description && (
        <p className="mb-3 text-xs leading-relaxed text-[var(--theme-muted)] line-clamp-2">
          {task.description}
        </p>
      )}

      <div className="mt-3 flex items-end justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="rounded-md bg-[var(--theme-hover)] px-2 py-1 text-[10px] font-medium text-[var(--theme-muted)]">
            {assigneeLabel}
          </span>
          {visibleTags.map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-[var(--theme-hover)] px-2 py-1 text-[10px] font-medium text-[var(--theme-muted)]"
            >
              {tag}
            </span>
          ))}
          {extraTagCount > 0 && (
            <span className="rounded-md bg-[var(--theme-hover)] px-2 py-1 text-[10px] font-medium text-[var(--theme-muted)]">
              +{extraTagCount} more
            </span>
          )}
        </div>

        {task.due_date && (
          <div className="flex shrink-0 items-center gap-1 text-[10px] tabular-nums">
            {overdue && (
              <>
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: 'var(--theme-danger)' }}
                />
                <span
                  className="font-semibold"
                  style={{ color: 'var(--theme-danger)' }}
                >
                  Overdue
                </span>
                <span className="mx-0.5 text-[var(--theme-muted)]">·</span>
              </>
            )}
            <span
              className={
                overdue ? 'font-semibold' : 'text-[var(--theme-muted)]'
              }
              style={overdue ? { color: 'var(--theme-danger)' } : undefined}
            >
              {(() => {
                const [y, m, d] = task.due_date.split('-').map(Number)
                return new Date(y, m - 1, d).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })
              })()}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
