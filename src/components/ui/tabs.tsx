'use client'

import { Tabs as TabsPrimitive } from '@base-ui/react/tabs'
import type { KeyboardEvent } from 'react'

import { cn } from '@/lib/utils'

type TabsVariant = 'default' | 'line' | 'underline'

function Tabs({ className, ...props }: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      className={cn(
        'flex flex-col gap-2 overflow-visible data-[orientation=vertical]:flex-row',
        className,
      )}
      data-slot="tabs"
      {...props}
    />
  )
}

function TabsList({
  variant = 'default',
  className,
  children,
  ...props
}: TabsPrimitive.List.Props & {
  variant?: TabsVariant
}) {
  return (
    <TabsPrimitive.List
      className={cn(
        'relative z-0 flex w-fit items-center justify-center gap-x-0.5 overflow-visible text-(--theme-muted)',
        'data-[orientation=vertical]:flex-col',
        variant === 'default'
          ? 'p-0.5 text-(--theme-muted)'
          : 'data-[orientation=vertical]:px-1 data-[orientation=horizontal]:py-1',
        className,
      )}
      data-slot="tabs-list"
      data-variant={variant}
      {...props}
    >
      {children}
      <TabsPrimitive.Indicator
        className={cn(
          '-translate-y-(--active-tab-bottom) absolute bottom-0 left-0 h-(--active-tab-height) w-(--active-tab-width) translate-x-(--active-tab-left) transition-[width,translate] duration-(--motion-default) ease-in-out',
          variant === 'line' || variant === 'underline'
            ? 'data-[orientation=vertical]:-translate-x-px z-10 bg-current data-[orientation=horizontal]:h-0.5 data-[orientation=vertical]:w-0.5 data-[orientation=horizontal]:translate-y-px'
            : 'z-0 rounded-md bg-(--theme-accent)',
        )}
        data-slot="tab-indicator"
      />
    </TabsPrimitive.List>
  )
}

function TabsTab({ className, onKeyDown, ...props }: TabsPrimitive.Tab.Props) {
  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    onKeyDown?.(
      event as Parameters<NonNullable<TabsPrimitive.Tab.Props['onKeyDown']>>[0],
    )
    if (event.defaultPrevented) return
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    const tabs = [
      ...(event.currentTarget
        .closest('[role="tablist"]')
        ?.querySelectorAll<HTMLButtonElement>('[role="tab"]:not([disabled])') ??
        []),
    ]
    const current = tabs.indexOf(event.currentTarget)
    const next =
      event.key === 'Home'
        ? tabs[0]
        : event.key === 'End'
          ? tabs.at(-1)
          : event.key === 'ArrowRight'
            ? tabs[(current + 1) % tabs.length]
            : tabs[(current - 1 + tabs.length) % tabs.length]
    if (next) {
      event.preventDefault()
      next.focus()
      next.click()
    }
  }

  return (
    <TabsPrimitive.Tab
      className={cn(
        '[&_svg]:-mx-0.5 relative z-10 flex h-[2.8125rem] shrink-0 grow cursor-pointer items-center justify-center gap-[0.4rem] whitespace-nowrap rounded-none px-1 py-3 text-sm leading-[1.5] font-semibold outline-none transition-[color,background-color,box-shadow] duration-(--motion-default) hover:text-(--theme-text) focus-visible:ring-2 focus-visible:ring-(--theme-focus) data-disabled:pointer-events-none data-[orientation=vertical]:w-full data-[orientation=vertical]:justify-start data-active:text-(--theme-text) data-disabled:opacity-64 [&_svg:not([class*="size-"])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0',
        className,
      )}
      data-slot="tabs-tab"
      onKeyDown={handleKeyDown}
      {...props}
    />
  )
}

function TabsPanel({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      className={cn('flex-1 outline-none', className)}
      data-slot="tabs-content"
      {...props}
    />
  )
}

export {
  Tabs,
  TabsList,
  TabsTab,
  TabsTab as TabsTrigger,
  TabsPanel,
  TabsPanel as TabsContent,
}
