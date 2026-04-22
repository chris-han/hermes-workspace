'use client'

import { Switch as SwitchPrimitive } from '@base-ui/react/switch'

import { cn } from '@/lib/utils'

function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'inline-flex h-[calc(var(--thumb-size)+2px)] w-[calc(var(--thumb-size)*2-2px)] shrink-0 cursor-pointer items-center rounded-full border bg-[var(--theme-toggle-off-bg)] p-px outline-none transition-[background-color,border-color,box-shadow] duration-200 [--thumb-size:--spacing(5)] border-[var(--theme-toggle-off-border)] focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-1 focus-visible:ring-offset-background data-[checked]:border-[var(--theme-toggle-on-border)] data-[checked]:bg-[var(--theme-toggle-on-bg)] data-[unchecked]:border-[var(--theme-toggle-off-border)] data-[unchecked]:bg-[var(--theme-toggle-off-bg)] data-[disabled]:cursor-not-allowed data-[disabled]:opacity-64 sm:[--thumb-size:--spacing(4)]',
        className,
      )}
      data-slot="switch"
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          'pointer-events-none block aspect-square h-full origin-left rounded-(--thumb-size) border border-black/8 bg-white shadow-sm will-change-transform [transition:translate_.15s,border-radius_.15s,scale_.1s_.1s,transform-origin_.15s] in-[[role=switch]:active,[data-slot=label]:active]:not-data-disabled:scale-x-110 in-[[role=switch]:active,[data-slot=label]:active]:rounded-[var(--thumb-size)/calc(var(--thumb-size)*1.1)] data-[checked]:origin-[var(--thumb-size)_50%] data-[checked]:translate-x-[calc(var(--thumb-size)-4px)] dark:border-white/10',
        )}
        data-slot="switch-thumb"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
