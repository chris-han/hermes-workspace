import type { AnchorHTMLAttributes, HTMLAttributes, ReactNode } from 'react'

import { Link } from './link'
import { cn } from '@/lib/utils'

function Breadcrumb({
  className,
  label = 'Breadcrumb',
  ...props
}: HTMLAttributes<HTMLElement> & { label?: string }) {
  return (
    <nav
      aria-label={label}
      className={cn(
        'text-[0.8125rem] leading-[1.5] font-medium text-[var(--theme-muted)]',
        className,
      )}
      data-slot="breadcrumb"
      {...props}
    />
  )
}

function BreadcrumbList({
  className,
  ...props
}: HTMLAttributes<HTMLOListElement>) {
  return (
    <ol
      className={cn('flex flex-wrap items-center gap-[0.4rem]', className)}
      data-slot="breadcrumb-list"
      {...props}
    />
  )
}

function BreadcrumbItem({
  className,
  ...props
}: HTMLAttributes<HTMLLIElement>) {
  return (
    <li
      className={cn('inline-flex items-center gap-[0.4rem]', className)}
      data-slot="breadcrumb-item"
      {...props}
    />
  )
}

function BreadcrumbLink(
  props: AnchorHTMLAttributes<HTMLAnchorElement> & { children: ReactNode },
) {
  return <Link variant="navigation" data-slot="breadcrumb-link" {...props} />
}

function BreadcrumbCurrent({
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      aria-current="page"
      className={cn('font-semibold text-[var(--theme-text)]', className)}
      data-slot="breadcrumb-current"
      {...props}
    />
  )
}

function BreadcrumbSeparator({
  children = '/',
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span aria-hidden="true" data-slot="breadcrumb-separator" {...props}>
      {children}
    </span>
  )
}

export {
  Breadcrumb,
  BreadcrumbCurrent,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
}
