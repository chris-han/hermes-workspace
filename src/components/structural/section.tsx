import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export interface SectionProps {
  title: ReactNode
  description?: ReactNode
  icon?: ReactNode
  children: ReactNode
  className?: string
}

/**
 * Section — recurring sub-section inside a Panel.
 *
 * Replaces ad-hoc local SettingsSection implementations (e.g.
 * `rounded-2xl border border-primary-200 bg-primary-50/80 ...`).
 */
export function Section({
  title,
  description,
  icon,
  children,
  className,
}: SectionProps) {
  return (
    <section
      className={cn(
        'rounded-[var(--radius-card)] border border-(--theme-border) bg-(--theme-card2) p-4 md:p-5',
        className,
      )}
      data-slot="section"
    >
      <div className="mb-4 flex items-start gap-3">
        {icon ? (
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-(--theme-border) bg-(--theme-card) text-(--theme-text)">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="text-base font-medium text-(--theme-text) text-balance">
            {title}
          </h2>
          {description ? (
            <p className="mt-0.5 text-sm text-(--theme-muted) text-pretty">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  )
}