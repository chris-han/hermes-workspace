import type { CSSProperties, ReactNode } from 'react'

import { cn } from '@/lib/utils'

export interface ScrollContainerProps {
  children: ReactNode
  className?: string
  /** Viewport chrome offset for `dvh`-based max-height. Defaults to `0px`. */
  scrollOffset?: string
  /** Constrain to remaining viewport below the offset. */
  fillViewport?: boolean
}

/**
 * ScrollContainer — `dvh`-safe scroll region with an `--scroll-offset` slot.
 *
 * Replaces recurring `h-[calc(100vh-Nrem)]` / `max-h-[calc(100vh-Nrem)]`
 * patterns. Consumers declare how much chrome the scroll container must
 * subtract via the `scrollOffset` prop; the inner `max-height` resolves
 * through `dvh` so iOS Safari viewport behaviour does not cause layout jump.
 */
export function ScrollContainer({
  children,
  className,
  scrollOffset = '0px',
  fillViewport = true,
}: ScrollContainerProps) {
  const style: CSSProperties = {
    ['--scroll-offset' as string]: scrollOffset,
  }

  return (
    <div
      className={cn(
        'overflow-auto',
        fillViewport && 'max-h-[calc(100dvh-var(--scroll-offset))]',
        className,
      )}
      data-slot="scroll-container"
      style={style}
    >
      {children}
    </div>
  )
}