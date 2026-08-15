'use client'

import { Dialog } from '@base-ui/react/dialog'
import { cn } from '@/lib/utils'

export const Sheet = Dialog.Root
export const SheetTrigger = Dialog.Trigger
export const SheetClose = Dialog.Close

export function SheetContent({ className, children, style, ...props }: React.ComponentProps<typeof Dialog.Popup>) {
  return (
    <Dialog.Portal>
      <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/50" />
      <Dialog.Popup
        {...props}
        style={{
          background: 'var(--theme-panel)',
          borderLeft: '1px solid var(--theme-border)',
          color: 'var(--theme-text)',
          boxShadow: 'var(--theme-shadow-3)',
          ...style,
        }}
        className={cn(
          'fixed inset-y-0 right-0 z-50 flex w-[min(420px,92vw)] flex-col p-5 shadow-xl',
          className,
        )}
      >{children}</Dialog.Popup>
    </Dialog.Portal>
  )
}

export const SheetTitle = Dialog.Title
export const SheetDescription = Dialog.Description
