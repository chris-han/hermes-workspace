'use client'

import { Collapsible as BaseCollapsible } from '@base-ui/react/collapsible'
import * as React from 'react'
import { cn } from '@/lib/utils'

function Collapsible(props: React.ComponentProps<typeof BaseCollapsible.Root>) {
  return <BaseCollapsible.Root {...props} />
}

function CollapsibleTrigger({
  className,
  ...props
}: React.ComponentProps<typeof BaseCollapsible.Trigger>) {
  return (
    <BaseCollapsible.Trigger
      className={cn(
        'group inline-flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-[0.9375rem] leading-[1.5] font-semibold text-[var(--theme-text)] transition-colors hover:bg-[var(--theme-card2)] data-panel-open:text-[var(--theme-text)]',
        className,
      )}
      {...props}
    />
  )
}

type CollapsiblePanelProps = React.ComponentProps<
  typeof BaseCollapsible.Panel
> & {
  contentClassName?: string
}

function CollapsiblePanel({
  className,
  contentClassName,
  children,
  ...props
}: CollapsiblePanelProps) {
  return (
    <BaseCollapsible.Panel
      keepMounted
      className={cn(
        'flex h-(--collapsible-panel-height) flex-col overflow-hidden text-sm transition-all duration-150 ease-out data-ending-style:h-0 data-starting-style:h-0',
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          'px-5 pb-[1.1rem] text-sm leading-[1.6] text-[var(--theme-muted)]',
          contentClassName,
        )}
      >
        {children}
      </div>
    </BaseCollapsible.Panel>
  )
}

export { Collapsible, CollapsibleTrigger, CollapsiblePanel }
