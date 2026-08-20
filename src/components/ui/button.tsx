'use client'

import { mergeProps } from '@base-ui/react/merge-props'
import { useRender } from '@base-ui/react/use-render'
import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'
import type * as React from 'react'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'relative inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md leading-none font-medium outline-none transition-[color,background-color,border-color,box-shadow,transform] duration-150 hover:scale-105 active:scale-95 focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--theme-bg)] disabled:pointer-events-none disabled:opacity-60 disabled:hover:scale-100 disabled:active:scale-100 [&_svg]:pointer-events-none [&_svg]:shrink-0 select-none',
  {
    defaultVariants: {
      size: 'default',
      variant: 'default',
    },
    variants: {
      size: {
        default: 'h-8 px-2.5 text-xs',
        sm: 'h-7 px-2 text-[0.6875rem]',
        lg: 'h-9 px-4 text-sm',
        icon: 'size-8 p-0 text-xs',
        'icon-sm': 'size-7 p-0 text-[0.6875rem]',
        'icon-md': 'size-8 p-0 text-xs',
        'icon-xl': 'size-9 p-0 text-sm [&_svg]:size-5',
      },
      variant: {
        default:
          'border border-[var(--dark-green,#163300)] bg-[var(--theme-accent,#9fe870)] text-[var(--theme-accent-foreground,#163300)] shadow-sm hover:brightness-95',
        secondary:
          'border border-[var(--theme-border)] bg-[var(--theme-card2)] text-[var(--theme-text)] hover:bg-[var(--theme-card)]',
        outline:
          'border border-[var(--theme-border-strong,var(--theme-border))] bg-transparent text-[var(--theme-text)] hover:bg-[var(--theme-card2)]',
        ghost:
          'border border-transparent text-[var(--theme-text)] hover:bg-[var(--theme-card2)]',
        destructive:
          'border border-[var(--danger-red,#d03238)] bg-[var(--danger-red,#d03238)] text-[#fff] shadow-sm hover:brightness-90',
      },
    },
  },
)

interface ButtonProps extends useRender.ComponentProps<'button'> {
  variant?: VariantProps<typeof buttonVariants>['variant']
  size?: VariantProps<typeof buttonVariants>['size']
}

function Button({ className, variant, size, render, ...props }: ButtonProps) {
  const typeValue: React.ButtonHTMLAttributes<HTMLButtonElement>['type'] =
    render ? undefined : 'button'

  const defaultProps = {
    className: cn(buttonVariants({ className, size, variant })),
    'data-slot': 'button',
    'data-size': size ?? 'default',
    'data-variant': variant ?? 'default',
    type: typeValue,
  }

  return useRender({
    defaultTagName: 'button',
    props: mergeProps<'button'>(defaultProps, props),
    render,
  })
}

export { Button, buttonVariants }
