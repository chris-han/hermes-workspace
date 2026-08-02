import * as React from 'react'
import { cn } from '@/lib/utils'

type DropdownSelectProps = React.SelectHTMLAttributes<HTMLSelectElement>

export const DropdownSelect = React.forwardRef<
  HTMLSelectElement,
  DropdownSelectProps
>(function DropdownSelect({ className, children, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cn(
        'theme-native-select rounded-md border border-primary-300 bg-transparent p-2',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  )
})
