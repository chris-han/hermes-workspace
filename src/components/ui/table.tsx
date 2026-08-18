import type { HTMLAttributes, TableHTMLAttributes } from 'react'

import { cn } from '@/lib/utils'

function Table({ className, ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto rounded-card border border-[var(--theme-border)]">
      <table
        className={cn('ds-table w-full border-collapse text-sm', className)}
        data-slot="table"
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <thead
      className={cn('bg-[var(--theme-card2)] text-left', className)}
      data-slot="table-header"
      {...props}
    />
  )
}

function TableBody({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <tbody
      className={cn('divide-y divide-[var(--theme-border)]', className)}
      data-slot="table-body"
      {...props}
    />
  )
}

function TableRow({
  className,
  ...props
}: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        'transition-colors hover:bg-[var(--theme-card2)] aria-selected:bg-[var(--theme-card2)]',
        className,
      )}
      data-slot="table-row"
      {...props}
    />
  )
}

function TableHead({
  className,
  ...props
}: HTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        'px-[1.1rem] py-[0.85rem] text-[0.65rem] leading-[1.5] font-bold tracking-[0.06em] text-[var(--theme-muted)] uppercase',
        className,
      )}
      data-slot="table-head"
      {...props}
    />
  )
}

function TableCell({
  className,
  ...props
}: HTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn(
        'px-[1.1rem] py-[0.9rem] text-sm leading-[1.5] font-medium text-[var(--theme-text)]',
        className,
      )}
      data-slot="table-cell"
      {...props}
    />
  )
}

export { Table, TableBody, TableCell, TableHead, TableHeader, TableRow }
