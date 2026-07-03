import { useEffect, useState } from 'react'
import type {
  CreateTaskInput,
  HermesTask,
  TaskAssignee,
  TaskColumn,
  TaskPriority,
} from '@/lib/tasks-api'
import {
  DialogContent,
  DialogDescription,
  DialogRoot,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { COLUMN_LABELS, COLUMN_ORDER } from '@/lib/tasks-api'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  task?: HermesTask | null
  defaultColumn?: TaskColumn
  assignees: Array<TaskAssignee>
  onSubmit: (input: CreateTaskInput) => Promise<void>
  isSubmitting: boolean
}

export function TaskDialog({
  open,
  onOpenChange,
  task,
  defaultColumn,
  assignees,
  onSubmit,
  isSubmitting,
}: Props) {
  const isEdit = Boolean(task)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [column, setColumn] = useState<TaskColumn>(defaultColumn ?? 'backlog')
  const [priority, setPriority] = useState<TaskPriority>('medium')
  const [assignee, setAssignee] = useState<string>('')
  const [tags, setTags] = useState('')
  const [dueDate, setDueDate] = useState('')

  useEffect(() => {
    if (task) {
      setTitle(task.title)
      setDescription(task.description)
      setColumn(task.column)
      setPriority(task.priority)
      setAssignee(task.assignee ?? '')
      setTags(task.tags.join(', '))
      setDueDate(task.due_date ?? '')
    } else {
      setTitle('')
      setDescription('')
      setColumn(defaultColumn ?? 'backlog')
      setPriority('medium')
      setAssignee('')
      setTags('')
      setDueDate('')
    }
  }, [task, open, defaultColumn])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    await onSubmit({
      title: title.trim(),
      description: description.trim(),
      column,
      priority,
      assignee: assignee || null,
      tags: tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      due_date: dueDate || null,
    })
  }

  const inputClass = cn(
    'w-full rounded-md border px-3 py-2 text-sm',
    'bg-[var(--theme-input)] border-[var(--theme-border)] text-[var(--theme-text)]',
    'focus:outline-none focus:ring-2 focus:ring-[var(--theme-accent)]',
    'placeholder:text-[var(--theme-muted)]',
  )

  const labelClass = 'mb-1 block text-xs font-medium text-[var(--theme-muted)]'

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(560px,95vw)] overflow-hidden border-[var(--theme-border)] bg-[var(--theme-card)]">
        <div className="p-6">
          <DialogTitle className="mb-1 text-xl font-semibold leading-tight text-[var(--theme-text)]">
            {isEdit ? 'Edit Task' : 'New Task'}
          </DialogTitle>
          <DialogDescription className="mb-5 text-sm text-[var(--theme-muted)]">
            {isEdit
              ? 'Update ownership, priority, and due date in one pass.'
              : 'Create the next unit of work for the board.'}
          </DialogDescription>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={labelClass}>Title *</label>
              <input
                className={inputClass}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What needs to be done?"
                required
                autoFocus
              />
            </div>

            <div>
              <label className={labelClass}>Description</label>
              <textarea
                className={cn(inputClass, 'resize-none')}
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional details..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Column</label>
                <select
                  className={inputClass}
                  value={column}
                  onChange={(e) => setColumn(e.target.value as TaskColumn)}
                >
                  {COLUMN_ORDER.map((col) => (
                    <option key={col} value={col}>
                      {COLUMN_LABELS[col]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Priority</label>
                <select
                  className={inputClass}
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TaskPriority)}
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Assignee</label>
                <select
                  className={inputClass}
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {assignees.map(({ id, label }) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-[10px] leading-relaxed text-[var(--theme-muted)]">
                  Assignee is separate from status. Dragging a card changes its
                  column only.
                </p>
              </div>
              <div>
                <label className={labelClass}>Due Date</label>
                <input
                  type="date"
                  className={inputClass}
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Tags (comma-separated)</label>
              <input
                className={inputClass}
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="frontend, bug, research"
              />
            </div>

            <div className="flex items-center justify-between border-t border-[var(--theme-border)] pt-4">
              <p className="text-[10px] text-[var(--theme-muted)]">
                Press Esc to cancel
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting || !title.trim()}
                  className="cursor-pointer"
                  style={{
                    background: 'var(--theme-accent)',
                    color: 'var(--theme-accent-foreground)',
                  }}
                >
                  {isSubmitting
                    ? 'Saving...'
                    : isEdit
                      ? 'Save Changes'
                      : 'Create Task'}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </DialogContent>
    </DialogRoot>
  )
}
