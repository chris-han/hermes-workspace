'use client'

import { AlertDialog } from '@base-ui/react/alert-dialog'
import { Button } from './button'
import { cn } from '@/lib/utils'

type AlertDialogRootProps = React.ComponentProps<typeof AlertDialog.Root>

function AlertDialogRoot({ children, ...props }: AlertDialogRootProps) {
  return <AlertDialog.Root {...props}>{children}</AlertDialog.Root>
}

type AlertDialogTriggerProps = React.ComponentProps<typeof AlertDialog.Trigger>

function AlertDialogTrigger({ className, ...props }: AlertDialogTriggerProps) {
  return <AlertDialog.Trigger className={cn(className)} {...props} />
}

type AlertDialogContentProps = {
  className?: string
  children: React.ReactNode
}

function AlertDialogContent({ className, children }: AlertDialogContentProps) {
  return (
    <AlertDialog.Portal>
      <AlertDialog.Backdrop
        className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-[2px] transition-opacity duration-150 data-[state=open]:opacity-100 data-[state=closed]:opacity-0"
        data-slot="alert-dialog-backdrop"
      />
      <AlertDialog.Popup
        className={cn(
          'fixed left-1/2 top-1/2 z-[101] -translate-x-1/2 -translate-y-1/2',
          'w-[min(26rem,calc(100vw-2rem))] rounded-[1.25rem] border border-[var(--theme-border)] bg-[var(--theme-card)] p-0 text-[var(--theme-text)] shadow-xl',
          'transition-all duration-150',
          'data-[state=open]:opacity-100 data-[state=closed]:opacity-0',
          'data-[state=open]:scale-100 data-[state=closed]:scale-95',
          className,
        )}
        data-slot="alert-dialog-content"
      >
        {children}
      </AlertDialog.Popup>
    </AlertDialog.Portal>
  )
}

type AlertDialogTitleProps = React.ComponentProps<typeof AlertDialog.Title>

function AlertDialogTitle({ className, ...props }: AlertDialogTitleProps) {
  return (
    <AlertDialog.Title
      className={cn('text-base font-semibold text-[var(--theme-text)]', className)}
      {...props}
    />
  )
}

type AlertDialogDescriptionProps = React.ComponentProps<
  typeof AlertDialog.Description
>

function AlertDialogDescription({
  className,
  ...props
}: AlertDialogDescriptionProps) {
  return (
    <AlertDialog.Description
      className={cn('text-sm leading-6 text-[var(--theme-muted)]', className)}
      {...props}
    />
  )
}

type AlertDialogCancelProps = React.ComponentProps<typeof AlertDialog.Close>

function AlertDialogCancel({ className, ...props }: AlertDialogCancelProps) {
  return (
    <AlertDialog.Close
      render={<Button variant="outline" className={cn(className)} />}
      {...props}
    />
  )
}

type AlertDialogActionProps = React.ComponentProps<typeof AlertDialog.Close>

function AlertDialogAction({ className, ...props }: AlertDialogActionProps) {
  return (
    <AlertDialog.Close
      render={
        <Button
          variant="destructive"
          className={cn('theme-danger-contrast', className)}
        />
      }
      {...props}
    />
  )
}

export {
  AlertDialogRoot,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
}
