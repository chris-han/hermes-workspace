import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export interface RowProps {
  label: ReactNode
  description?: ReactNode
  children: ReactNode
  className?: string
}

/**
 * Row — labelled control row inside a Section.
 *
 * Replaces ad-hoc local SettingsRow implementations.
 */
export function Row({
  label,
  description,
  children,
  className,
}: RowProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-start gap-3 md:flex-row md:items-center md:justify-between',
        className,
      )}
      data-slot="row"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-(--theme-text) text-balance">
          {label}
        </p>
        {description ? (
          <p className="mt-0.5 text-xs text-(--theme-muted) text-pretty">
            {description}
          </p>
        ) : null}
      </div>
      <div className="flex w-full items-center gap-2 md:w-auto md:justify-end">
        {children}
      </div>
    </div>
  )
}