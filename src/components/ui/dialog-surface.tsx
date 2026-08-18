import { forwardRef, useEffect, useRef } from 'react'
import type { HTMLAttributes, KeyboardEvent as ReactKeyboardEvent } from 'react'

import { cn } from '@/lib/utils'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

interface DialogSurfaceProps extends HTMLAttributes<HTMLDivElement> {
  onDismiss?: () => void
}

const DialogSurface = forwardRef<HTMLDivElement, DialogSurfaceProps>(
  ({ className, onDismiss, onKeyDown, ...props }, forwardedRef) => {
    const localRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
      const surface = localRef.current
      if (!surface) return

      const previouslyFocused = document.activeElement as HTMLElement | null
      const siblings: Array<HTMLElement> = surface.parentElement
        ? ([...surface.parentElement.children].filter(
            (element) =>
              element !== surface && !element.hasAttribute('aria-hidden'),
          ) as Array<HTMLElement>)
        : []
      const previousInert = siblings.map((element) => element.inert)
      siblings.forEach((element) => {
        element.inert = true
      })

      const firstFocusable = surface.querySelector<HTMLElement>(FOCUSABLE)
      ;(firstFocusable ?? surface).focus()

      return () => {
        siblings.forEach((element, index) => {
          element.inert = previousInert[index]
        })
        previouslyFocused?.focus()
      }
    }, [])

    function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
      onKeyDown?.(event)
      if (event.defaultPrevented) return
      if (event.key === 'Escape' && onDismiss) {
        event.preventDefault()
        onDismiss()
        return
      }
      if (event.key !== 'Tab') return

      const surface = localRef.current
      if (!surface) return
      const focusable = [...surface.querySelectorAll<HTMLElement>(FOCUSABLE)]
      if (focusable.length === 0) {
        event.preventDefault()
        surface.focus()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    return (
      <div
        ref={(node) => {
          localRef.current = node
          if (typeof forwardedRef === 'function') forwardedRef(node)
          else if (forwardedRef) forwardedRef.current = node
        }}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={cn('outline-none', className)}
        data-slot="dialog-surface"
        onKeyDown={handleKeyDown}
        {...props}
      />
    )
  },
)
DialogSurface.displayName = 'DialogSurface'

export { DialogSurface }
export type { DialogSurfaceProps }
