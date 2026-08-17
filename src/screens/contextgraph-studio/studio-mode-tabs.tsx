import type { ReactNode } from 'react'

export function StudioModeTabs({ children }: { children?: ReactNode }) {
  return <nav aria-label="ContextGraph Studio modes" className="flex min-w-0 items-center gap-1 overflow-x-auto">{children}</nav>
}
