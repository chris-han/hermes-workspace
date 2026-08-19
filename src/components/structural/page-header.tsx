import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export interface PageHeaderProps {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
}

/**
 * PageHeader — standard authenticated page title row.
 *
 * Owns surface, border, heading hierarchy. Replaces ad-hoc
 * `text-lg font-semibold text-primary-900 px-3` title rows.
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        'flex flex-col gap-2 border-b border-(--theme-border-subtle) pb-3 md:flex-row md:items-center md:justify-between',
        className,
      )}
      data-slot="page-header"
    >
      <div className="min-w-0 flex-1">
        <h1 className="text-lg font-semibold text-(--theme-text) md:text-xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 text-sm text-(--theme-muted)">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          {actions}
        </div>
      ) : null}
    </header>
  )
}