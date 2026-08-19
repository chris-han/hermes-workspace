import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export interface SettingsLayoutProps {
  nav: ReactNode
  content: ReactNode
  className?: string
}

/**
 * SettingsLayout — two-column authenticated settings shell.
 *
 * Replaces the recurring `md:flex-row md:gap-6` aside + content split used by
 * Settings, Organization, Data Connections, MCP, Messaging, Provider screens.
 */
export function SettingsLayout({ nav, content, className }: SettingsLayoutProps) {
  return (
    <div
      className={cn(
        'mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 sm:px-6 md:flex-row md:gap-6 lg:gap-8',
        className,
      )}
      data-slot="settings-layout"
    >
      <aside className="hidden w-48 shrink-0 md:block">
        <div className="sticky top-8">{nav}</div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col gap-4">{content}</div>
    </div>
  )
}

export interface SettingsNavProps {
  title: ReactNode
  children: ReactNode
  className?: string
}

/**
 * SettingsNav — sidebar navigation list used inside SettingsLayout.
 */
export function SettingsNav({ title, children, className }: SettingsNavProps) {
  return (
    <nav className={cn('flex flex-col gap-0.5', className)} data-slot="settings-nav">
      <h1 className="mb-4 px-3 text-lg font-semibold text-(--theme-text)">
        {title}
      </h1>
      {children}
    </nav>
  )
}