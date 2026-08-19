import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export interface PanelProps {
  children: ReactNode
  className?: string
  /** Render a header row inside the panel. */
  title?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  /** Render the panel with elevated depth (used for floating surfaces). */
  elevated?: boolean
}

/**
 * Panel — standard authenticated surface container.
 *
 * Owns surface role (--theme-card / --theme-bg), border role
 * (--theme-border), and standard radius (--radius-card).
 */
export function Panel({
  children,
  className,
  title,
  description,
  actions,
  elevated = false,
}: PanelProps) {
  return (
    <section
      className={cn(
        'rounded-[var(--radius-card)] border border-(--theme-border) bg-(--theme-card) text-(--theme-text)',
        elevated && 'shadow-(--theme-shadow-2)',
        className,
      )}
      data-slot="panel"
      data-elevated={elevated ? 'true' : undefined}
    >
      {title || description || actions ? (
        <header className="flex flex-col gap-2 border-b border-(--theme-border-subtle) px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0 flex-1">
            {title ? (
              <h2 className="text-base font-semibold text-(--theme-text)">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="mt-0.5 text-sm text-(--theme-muted)">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex flex-wrap items-center gap-2 md:justify-end">
              {actions}
            </div>
          ) : null}
        </header>
      ) : null}
      <div className="p-4">{children}</div>
    </section>
  )
}