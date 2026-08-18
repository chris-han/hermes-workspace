import type { HTMLAttributes, ReactNode } from 'react'

import { cn } from '@/lib/utils'

type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info'

const toneClasses: Record<Tone, string> = {
  neutral:
    'border-[var(--theme-border)] bg-[var(--theme-card2)] text-[var(--theme-text)]',
  accent:
    'border-[var(--dark-green,#163300)]/30 bg-[var(--theme-accent)] text-[var(--theme-accent-foreground,#163300)]',
  success:
    'border-transparent bg-[var(--theme-success-subtle)] text-[var(--theme-success)]',
  warning:
    'border-transparent bg-[var(--theme-warning-subtle)] text-[var(--theme-warning)]',
  danger:
    'border-transparent bg-[var(--theme-danger-subtle)] text-[var(--theme-danger)]',
  info: 'border-transparent bg-[var(--theme-info-subtle)] text-[var(--theme-info)]',
}

function Badge({
  className,
  tone = 'neutral',
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-[0.35rem] rounded-full border px-[0.625rem] py-1 text-[0.75rem] leading-[1.5] font-semibold',
        toneClasses[tone],
        className,
      )}
      data-slot="badge"
      {...props}
    />
  )
}

function Alert({
  className,
  tone = 'info',
  title,
  children,
  ...props
}: Omit<HTMLAttributes<HTMLDivElement>, 'title'> & {
  tone?: Tone
  title: ReactNode
}) {
  return (
    <div
      className={cn(
        'rounded-[0.75rem] border px-[1.1rem] py-[0.9rem] text-sm leading-[1.55] font-medium',
        toneClasses[tone],
        className,
      )}
      role={tone === 'danger' ? 'alert' : 'status'}
      data-slot="alert"
      {...props}
    >
      <div className="flex flex-wrap items-baseline gap-1">
        <strong className="font-semibold">{title}</strong>
        {children ? <div>{children}</div> : null}
      </div>
    </div>
  )
}

function Progress({
  className,
  value,
  label,
  ...props
}: HTMLAttributes<HTMLDivElement> & { value?: number; label: string }) {
  const normalized =
    value === undefined ? undefined : Math.min(100, Math.max(0, value))
  return (
    <div
      className={cn('grid gap-1.5', className)}
      data-slot="progress-group"
      {...props}
    >
      <div className="flex justify-between text-xs font-medium text-[var(--theme-muted)]">
        <span>{label}</span>
        {normalized === undefined ? null : <span>{normalized}%</span>}
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-[var(--theme-card2)]"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={normalized}
      >
        <div
          className={cn(
            'h-full rounded-full bg-[var(--theme-accent)] transition-[width]',
            normalized === undefined && 'w-1/3 animate-pulse',
          )}
          style={
            normalized === undefined ? undefined : { width: `${normalized}%` }
          }
        />
      </div>
    </div>
  )
}

function EmptyState({
  className,
  title,
  children,
  action,
}: {
  className?: string
  title: ReactNode
  children?: ReactNode
  action?: ReactNode
}) {
  return (
    <section
      className={cn(
        'grid justify-items-center gap-2 rounded-card border border-dashed border-[var(--theme-border)] p-6 text-center',
        className,
      )}
      data-slot="empty-state"
    >
      <h3 className="font-semibold">{title}</h3>
      {children ? (
        <div className="text-sm text-[var(--theme-muted)]">{children}</div>
      ) : null}
      {action}
    </section>
  )
}

function LoadingState({ label = 'Loading' }: { label?: string }) {
  return (
    <div
      className="flex items-center gap-2 text-sm text-[var(--theme-muted)]"
      role="status"
      data-slot="loading-state"
    >
      <span
        className="size-3 animate-pulse rounded-full bg-[var(--theme-accent)]"
        aria-hidden="true"
      />
      {label}
    </div>
  )
}

function ErrorState({
  title = 'Something went wrong',
  children,
  action,
}: {
  title?: ReactNode
  children?: ReactNode
  action?: ReactNode
}) {
  return (
    <Alert tone="danger" title={title} data-slot="error-state">
      {children}
      {action ? <div className="mt-3">{action}</div> : null}
    </Alert>
  )
}

export { Alert, Badge, EmptyState, ErrorState, LoadingState, Progress }
export type { Tone }
