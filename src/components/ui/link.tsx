import type { AnchorHTMLAttributes, ReactNode } from 'react'

import { cn } from '@/lib/utils'

type LinkVariant = 'inline' | 'navigation' | 'external' | 'destructive'

interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: LinkVariant
  externalLabel?: ReactNode
}

function Link({
  className,
  variant = 'inline',
  externalLabel = 'opens in a new window',
  children,
  target,
  rel,
  ...props
}: LinkProps) {
  const external = variant === 'external' || target === '_blank'
  return (
    <a
      className={cn(
        'rounded-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-2',
        variant === 'inline' &&
          'font-medium text-[var(--theme-link,var(--dark-green,#163300))] underline decoration-current/40 underline-offset-2 hover:decoration-current',
        variant === 'navigation' &&
          'font-medium text-[var(--theme-muted)] hover:text-[var(--theme-text)] aria-[current=page]:text-[var(--theme-text)]',
        variant === 'external' &&
          'font-medium text-[var(--theme-link,var(--dark-green,#163300))] underline underline-offset-2',
        variant === 'destructive' &&
          'font-semibold text-[var(--danger-red,#d03238)] underline underline-offset-2',
        className,
      )}
      target={target}
      rel={external ? (rel ?? 'noreferrer noopener') : rel}
      data-slot="link"
      {...props}
    >
      {children}
      {external ? <span className="sr-only"> ({externalLabel})</span> : null}
    </a>
  )
}

export { Link }
export type { LinkProps, LinkVariant }
