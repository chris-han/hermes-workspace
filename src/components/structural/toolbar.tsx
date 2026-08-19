import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export interface ToolbarProps {
  children: ReactNode
  className?: string
}

/**
 * Toolbar — recurring action-row container.
 *
 * Replaces ad-hoc `flex flex-wrap items-center gap-2` action rows that
 * appear above tables, lists, and inspector panels.
 */
export function Toolbar({ children, className }: ToolbarProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 border-b border-(--theme-border-subtle) px-4 py-2',
        className,
      )}
      data-slot="toolbar"
    >
      {children}
    </div>
  )
}