import { forwardRef } from 'react'
import type { HTMLAttributes, KeyboardEvent, MouseEvent } from 'react'

import { cn } from '@/lib/utils'

interface ActionSurfaceProps extends HTMLAttributes<HTMLDivElement> {
  disabled?: boolean
}

const ActionSurface = forwardRef<HTMLDivElement, ActionSurfaceProps>(
  ({ className, disabled = false, onClick, onKeyDown, ...props }, ref) => {
    function handleClick(event: MouseEvent<HTMLDivElement>) {
      if (disabled) return
      onClick?.(event)
    }

    function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
      onKeyDown?.(event)
      if (event.defaultPrevented || disabled) return
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        event.currentTarget.click()
      }
    }

    return (
      <div
        ref={ref}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled || undefined}
        className={cn(
          'outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)]',
          disabled && 'cursor-not-allowed opacity-60',
          className,
        )}
        data-slot="action-surface"
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        {...props}
      />
    )
  },
)
ActionSurface.displayName = 'ActionSurface'

export { ActionSurface }
export type { ActionSurfaceProps }
