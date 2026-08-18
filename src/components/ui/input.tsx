'use client'

import { Input as InputPrimitive } from '@base-ui/react/input'
import type * as React from 'react'

import { cn } from '@/lib/utils'

type InputProps = Omit<
  InputPrimitive.Props & React.RefAttributes<HTMLInputElement>,
  'size'
> & {
  size?: 'sm' | 'default' | 'lg' | number
  unstyled?: boolean
  nativeInput?: boolean
}

function Input({
  className,
  size = 'default',
  unstyled = false,
  nativeInput = false,
  ...props
}: InputProps) {
  const inputClassName = cn(
    'w-full min-w-0 rounded-[inherit] bg-transparent px-[0.9rem] py-[0.7rem] text-[0.9375rem] leading-[1.5] font-medium outline-none placeholder:text-[color:var(--theme-muted)]',
    size === 'sm' &&
      'px-3 py-2 text-[0.8125rem]',
    size === 'lg' && 'px-4 py-3 text-base',
    props.type === 'search' &&
      '[&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none [&::-webkit-search-results-button]:appearance-none [&::-webkit-search-results-decoration]:appearance-none',
    props.type === 'file' &&
      'text-primary-600 file:me-3 file:bg-transparent file:font-medium file:text-primary-900 file:text-sm',
  )

  return (
    <span
      className={
        cn(
          !unstyled &&
            'relative inline-flex w-full rounded-[0.75rem] border border-[var(--theme-border)] bg-[var(--theme-card)] bg-clip-padding text-[var(--theme-text)] ring-[color:var(--theme-accent)] transition-shadow before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(0.75rem-1px)] has-focus-visible:has-aria-invalid:border-destructive/64 has-focus-visible:has-aria-invalid:ring-destructive/16 has-aria-invalid:border-destructive/36 has-focus-visible:border-[var(--theme-accent)] has-disabled:opacity-64 has-[:disabled,:focus-visible,[aria-invalid]]:shadow-none has-focus-visible:ring-[4px]',
          className,
        ) || undefined
      }
      data-size={size}
      data-slot="input-control"
    >
      {nativeInput ? (
        <input
          className={inputClassName}
          data-slot="input"
          size={typeof size === 'number' ? size : undefined}
          {...props}
        />
      ) : (
        <InputPrimitive
          className={inputClassName}
          data-slot="input"
          size={typeof size === 'number' ? size : undefined}
          {...props}
        />
      )}
    </span>
  )
}

export { Input, type InputProps }
