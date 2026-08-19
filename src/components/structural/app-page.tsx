import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export interface AppPageProps {
  children: ReactNode
  className?: string
  /** Reduce vertical padding for dense data screens. */
  dense?: boolean
}

/**
 * AppPage — `dvh`-safe authenticated page canvas.
 *
 * Replaces the recurring `min-h-screen bg-surface text-primary-900` pattern.
 * Uses `min-h-dvh` so iOS Safari viewport behaviour does not cause layout jump.
 * Themable via `--theme-bg`, `--theme-card`, `--theme-text`.
 */
export function AppPage({ children, className, dense = false }: AppPageProps) {
  return (
    <div
      className={cn(
        'min-h-dvh bg-(--theme-bg) text-(--theme-text)',
        dense ? 'py-4' : 'py-6 md:py-8',
        className,
      )}
      data-slot="app-page"
    >
      {children}
    </div>
  )
}