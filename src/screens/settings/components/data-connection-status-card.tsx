import type { DataConnectionSurface } from '@/server/data-connections'

const KIND_LABELS: Record<DataConnectionSurface['kind'], string> = {
  authoritative: 'Authoritative',
  derived: 'Derived',
  'read-only': 'Read-only',
}

const KIND_CLASSES: Record<DataConnectionSurface['kind'], string> = {
  authoritative:
    'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300',
  derived:
    'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-300',
  'read-only':
    'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300',
}

function formatDate(value?: string): string {
  if (!value) return 'Unavailable'
  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) return value
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(parsed)
}

export function DataConnectionStatusCard({
  surface,
}: {
  surface: DataConnectionSurface
}) {
  return (
    <article className="rounded-2xl border border-primary-200 bg-primary-50/80 p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/60">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="text-sm font-semibold text-primary-900 dark:text-neutral-100">
            {surface.label}
          </div>
          <p className="text-sm text-primary-600 dark:text-neutral-400">
            {surface.description}
          </p>
        </div>
        <span
          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${KIND_CLASSES[surface.kind]}`}
        >
          {KIND_LABELS[surface.kind]}
        </span>
      </div>

      <dl className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-primary-200 bg-white/80 p-3 dark:border-neutral-800 dark:bg-neutral-900/70">
          <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-500 dark:text-neutral-500">
            Status
          </dt>
          <dd className="mt-1 text-sm font-medium text-primary-900 dark:text-neutral-100">
            {surface.available ? 'Available' : 'Not ready'}
          </dd>
        </div>
        <div className="rounded-xl border border-primary-200 bg-white/80 p-3 dark:border-neutral-800 dark:bg-neutral-900/70">
          <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-500 dark:text-neutral-500">
            Last Updated
          </dt>
          <dd className="mt-1 text-sm font-medium text-primary-900 dark:text-neutral-100">
            {formatDate(surface.modifiedAt)}
          </dd>
        </div>
      </dl>

      {surface.path ? (
        <div className="mt-3 rounded-xl border border-primary-200 bg-white/80 p-3 dark:border-neutral-800 dark:bg-neutral-900/70">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-500 dark:text-neutral-500">
            Path
          </div>
          <div className="mt-1 break-all font-mono text-xs text-primary-800 dark:text-neutral-200">
            {surface.path}
          </div>
        </div>
      ) : null}

      {surface.details && surface.details.length > 0 ? (
        <ul className="mt-3 space-y-2 text-sm text-primary-700 dark:text-neutral-300">
          {surface.details.map((detail) => (
            <li
              key={detail}
              className="rounded-xl border border-primary-200 bg-white/80 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-900/70"
            >
              {detail}
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  )
}

export { KIND_LABELS }
