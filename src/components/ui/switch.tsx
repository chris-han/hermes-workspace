'use client'

import { Switch as SwitchPrimitive } from '@base-ui/react/switch'

import { cn } from '@/lib/utils'

function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-[var(--theme-toggle-off-border)] bg-[var(--theme-toggle-off-bg)] p-0 outline-none transition-[background-color,border-color,box-shadow] duration-200 focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-1 focus-visible:ring-offset-background data-[checked]:border-[var(--theme-toggle-on-border)] data-[checked]:bg-[var(--theme-toggle-on-bg)] data-[unchecked]:border-[var(--theme-toggle-off-border)] data-[unchecked]:bg-[var(--theme-toggle-off-bg)] data-[disabled]:cursor-not-allowed data-[disabled]:opacity-64',
        className,
      )}
      data-slot="switch"
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          'pointer-events-none ml-[0.1875rem] block size-[1.125rem] rounded-full border border-black/8 bg-white shadow-sm transition-transform duration-200 data-[checked]:translate-x-5 data-[checked]:bg-[var(--theme-accent-foreground)] dark:border-white/10',
        )}
        data-slot="switch-thumb"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
