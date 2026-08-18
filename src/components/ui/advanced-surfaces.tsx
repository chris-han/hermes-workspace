import type {
  HTMLAttributes,
  KeyboardEvent,
  ReactNode,
  TableHTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from 'react'

import { cn } from '@/lib/utils'

interface ResizeHandleProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'onChange'
> {
  orientation?: 'horizontal' | 'vertical'
  value: number
  min?: number
  max?: number
  step?: number
  onValueChange: (value: number) => void
  label?: string
}

function ResizeHandle({
  className,
  orientation = 'vertical',
  value,
  min = 0,
  max = 100,
  step = 5,
  onValueChange,
  label = 'Resize panels',
  ...props
}: ResizeHandleProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const decrease = orientation === 'vertical' ? 'ArrowLeft' : 'ArrowUp'
    const increase = orientation === 'vertical' ? 'ArrowRight' : 'ArrowDown'
    if (event.key !== decrease && event.key !== increase) return
    event.preventDefault()
    onValueChange(
      Math.min(
        max,
        Math.max(min, value + (event.key === increase ? step : -step)),
      ),
    )
  }
  return (
    <div
      role="separator"
      tabIndex={0}
      aria-label={label}
      aria-orientation={orientation}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      className={cn(
        'group grid shrink-0 place-items-center bg-[var(--theme-border)] outline-none hover:bg-[var(--theme-accent)] focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)]',
        orientation === 'vertical'
          ? 'w-1 cursor-col-resize'
          : 'h-1 cursor-row-resize',
        className,
      )}
      data-slot="resize-handle"
      {...props}
      onKeyDown={handleKeyDown}
    />
  )
}

function TreeView({
  className,
  label,
  children,
  ...props
}: HTMLAttributes<HTMLUListElement> & { label: string }) {
  return (
    <ul
      role="tree"
      aria-label={label}
      className={cn('grid gap-1 text-sm', className)}
      data-slot="tree-view"
      {...props}
    >
      {children}
    </ul>
  )
}

function TreeItem({
  className,
  expanded,
  selected,
  level = 1,
  onExpandedChange,
  onSelect,
  children,
  ...props
}: HTMLAttributes<HTMLLIElement> & {
  expanded?: boolean
  selected?: boolean
  level?: number
  onExpandedChange?: (expanded: boolean) => void
  onSelect?: () => void
}) {
  function handleKeyDown(event: KeyboardEvent<HTMLLIElement>) {
    const items = [
      ...(event.currentTarget
        .closest('[role="tree"]')
        ?.querySelectorAll<HTMLElement>(
          '[role="treeitem"]:not([aria-disabled="true"])',
        ) ?? []),
    ]
    const current = items.indexOf(event.currentTarget)
    const next =
      event.key === 'Home'
        ? items[0]
        : event.key === 'End'
          ? items.at(-1)
          : event.key === 'ArrowDown'
            ? items[(current + 1) % items.length]
            : event.key === 'ArrowUp'
              ? items[(current - 1 + items.length) % items.length]
              : undefined
    if (next) {
      event.preventDefault()
      next.focus()
      return
    }
    if (event.key === 'ArrowRight' && expanded === false) {
      event.preventDefault()
      onExpandedChange?.(true)
    } else if (event.key === 'ArrowLeft' && expanded === true) {
      event.preventDefault()
      onExpandedChange?.(false)
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onSelect?.()
    }
  }
  return (
    <li
      role="treeitem"
      aria-expanded={expanded}
      aria-selected={selected}
      aria-level={level}
      tabIndex={selected ? 0 : -1}
      className={cn(
        'rounded-md px-2 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)]',
        selected &&
          'bg-[var(--theme-accent)] text-[var(--theme-accent-foreground)]',
        className,
      )}
      data-slot="tree-item"
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      {...props}
    >
      {children}
    </li>
  )
}

function CanvasControlLayer({
  className,
  label,
  controls,
  accessibleFallback,
  children,
}: {
  className?: string
  label: string
  controls: ReactNode
  accessibleFallback: ReactNode
  children: ReactNode
}) {
  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-card border border-[var(--theme-border)]',
        className,
      )}
      aria-label={label}
    >
      <div aria-hidden="true" data-slot="canvas-visual">
        {children}
      </div>
      <div
        className="absolute left-3 top-3 flex gap-1"
        role="toolbar"
        aria-label={`${label} controls`}
      >
        {controls}
      </div>
      <div className="sr-only" data-slot="canvas-fallback">
        {accessibleFallback}
      </div>
    </section>
  )
}

function DataGrid({
  className,
  label,
  ...props
}: TableHTMLAttributes<HTMLTableElement> & { label: string }) {
  return (
    <div className="overflow-auto rounded-card border border-[var(--theme-border)]">
      <table
        role="grid"
        aria-label={label}
        className={cn('w-full border-collapse text-sm', className)}
        data-slot="data-grid"
        {...props}
      />
    </div>
  )
}

function DataGridHeader(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead data-slot="data-grid-header" {...props} />
}

function DataGridBody(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody data-slot="data-grid-body" {...props} />
}

function DataGridRow({
  className,
  ...props
}: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      role="row"
      className={cn(
        'border-b border-[var(--theme-border)] last:border-b-0 aria-selected:bg-[var(--theme-accent)]/15',
        className,
      )}
      data-slot="data-grid-row"
      {...props}
    />
  )
}

function DataGridHead({
  className,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      role="columnheader"
      className={cn('px-3 py-2 text-left font-semibold', className)}
      data-slot="data-grid-head"
      {...props}
    />
  )
}

function DataGridCell({
  className,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement>) {
  function handleKeyDown(event: KeyboardEvent<HTMLTableCellElement>) {
    if (
      !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)
    )
      return
    const row = event.currentTarget.parentElement
    const grid = event.currentTarget.closest('[role="grid"]')
    if (!row || !grid) return
    const rows = [...grid.querySelectorAll<HTMLTableRowElement>('[role="row"]')]
    const cells = [...row.querySelectorAll<HTMLElement>('[role="gridcell"]')]
    const rowIndex = rows.indexOf(row as HTMLTableRowElement)
    const columnIndex = cells.indexOf(event.currentTarget)
    const target =
      event.key === 'ArrowLeft'
        ? cells[columnIndex - 1]
        : event.key === 'ArrowRight'
          ? cells[columnIndex + 1]
          : rows[
              rowIndex + (event.key === 'ArrowDown' ? 1 : -1)
            ]?.querySelectorAll<HTMLElement>('[role="gridcell"]')[columnIndex]
    if (target) {
      event.preventDefault()
      target.focus()
    }
  }
  return (
    <td
      role="gridcell"
      className={cn('px-3 py-2', className)}
      data-slot="data-grid-cell"
      tabIndex={props.tabIndex ?? -1}
      onKeyDown={handleKeyDown}
      {...props}
    />
  )
}

function SplitPanel({
  className,
  orientation = 'vertical',
  value,
  min = 20,
  max = 80,
  onValueChange,
  primary,
  secondary,
  label = 'Resize split panels',
}: {
  className?: string
  orientation?: 'horizontal' | 'vertical'
  value: number
  min?: number
  max?: number
  onValueChange: (value: number) => void
  primary: ReactNode
  secondary: ReactNode
  label?: string
}) {
  const horizontal = orientation === 'horizontal'
  return (
    <div
      className={cn(
        'flex min-h-0 min-w-0 overflow-hidden rounded-card border border-[var(--theme-border)]',
        horizontal ? 'flex-col' : 'flex-row',
        className,
      )}
      data-slot="split-panel"
    >
      <div
        style={{ flexBasis: `${value}%` }}
        className="min-h-0 min-w-0 overflow-auto"
      >
        {primary}
      </div>
      <ResizeHandle
        orientation={orientation}
        value={value}
        min={min}
        max={max}
        onValueChange={onValueChange}
        label={label}
      />
      <div
        style={{ flexBasis: `${100 - value}%` }}
        className="min-h-0 min-w-0 overflow-auto"
      >
        {secondary}
      </div>
    </div>
  )
}

export {
  CanvasControlLayer,
  DataGrid,
  DataGridBody,
  DataGridCell,
  DataGridHead,
  DataGridHeader,
  DataGridRow,
  ResizeHandle,
  SplitPanel,
  TreeItem,
  TreeView,
}
export type { ResizeHandleProps }
