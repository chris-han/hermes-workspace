import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export type EmptyStateKind = 'empty' | 'loading' | 'error' | 'unavailable' | 'invalid'

export interface EmptyStateProps {
  kind?: EmptyStateKind
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
}

/**
 * EmptyState — canonical state presentation for empty / loading / error /
 * unavailable / invalid screens.
 *
 * Each `kind` resolves to a documented visual treatment:
 * - empty: muted surface, neutral icon
 * - loading: spinner / shimmer
 * - error: danger-tinted border, danger icon
 * - unavailable: muted icon, neutral copy
 * - invalid: warning-tinted border, warning icon
 */
export function EmptyState({
  kind = 'empty',
  title,
  description,
  actions,
  className,
}: EmptyStateProps) {
  const surfaceClass = {
    empty: 'border-(--theme-border) bg-(--theme-card)',
    loading: 'border-(--theme-border) bg-(--theme-card)',
    error: 'border-(--theme-danger) bg-(--theme-danger-subtle, --theme-card2)',
    unavailable: 'border-(--theme-border) bg-(--theme-card2)',
    invalid: 'border-(--theme-warning) bg-(--theme-warning-subtle, --theme-card2)',
  }[kind]

  const titleClass = {
    empty: 'text-(--theme-text)',
    loading: 'text-(--theme-text)',
    error: 'text-(--theme-danger)',
    unavailable: 'text-(--theme-muted)',
    invalid: 'text-(--theme-warning)',
  }[kind]

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-[var(--radius-card)] border p-8 text-center',
        surfaceClass,
        className,
      )}
      data-slot="empty-state"
      data-kind={kind}
    >
      <h3 className={cn('text-base font-semibold', titleClass)}>{title}</h3>
      {description ? (
        <p className="max-w-sm text-sm text-(--theme-muted)">{description}</p>
      ) : null}
      {actions ? (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  )
}