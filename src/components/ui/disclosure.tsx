import type { DetailsHTMLAttributes, HTMLAttributes } from 'react'

import { cn } from '@/lib/utils'

function Disclosure({
  className,
  ...props
}: DetailsHTMLAttributes<HTMLDetailsElement>) {
  return (
    <details
      className={cn(
        'group rounded-card border border-[var(--theme-border)] bg-[var(--theme-card)]',
        className,
      )}
      data-slot="disclosure"
      {...props}
    />
  )
}

function DisclosureSummary({
  className,
  ...props
}: HTMLAttributes<HTMLElement>) {
  return (
    <summary
      className={cn(
        'cursor-pointer list-none rounded-card px-4 py-3 font-semibold outline-none marker:hidden focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)]',
        className,
      )}
      data-slot="disclosure-summary"
      {...props}
    />
  )
}

export { Disclosure, DisclosureSummary }
