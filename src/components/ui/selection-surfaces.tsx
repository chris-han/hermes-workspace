import type { HTMLAttributes, KeyboardEvent, ReactNode } from 'react'

import { Button } from './button'
import { cn } from '@/lib/utils'

function Listbox({
  className,
  label,
  multiselectable,
  ...props
}: HTMLAttributes<HTMLUListElement> & {
  label: string
  multiselectable?: boolean
}) {
  return (
    <ul
      role="listbox"
      aria-label={label}
      aria-multiselectable={multiselectable || undefined}
      className={cn(
        'grid gap-1 rounded-card border border-[var(--theme-border)] bg-[var(--theme-card)] p-1',
        className,
      )}
      data-slot="listbox"
      {...props}
    />
  )
}

function ListboxGroup({
  className,
  label,
  ...props
}: HTMLAttributes<HTMLDivElement> & { label: string }) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn('grid gap-1', className)}
      data-slot="listbox-group"
      {...props}
    />
  )
}

function ListboxOption({
  className,
  selected = false,
  disabled = false,
  onSelect,
  children,
  ...props
}: Omit<HTMLAttributes<HTMLLIElement>, 'onSelect'> & {
  selected?: boolean
  disabled?: boolean
  onSelect?: () => void
  children: ReactNode
}) {
  function moveFocus(event: KeyboardEvent<HTMLLIElement>) {
    const options = [
      ...(event.currentTarget
        .closest('[role="listbox"]')
        ?.querySelectorAll<HTMLElement>(
          '[role="option"]:not([aria-disabled="true"])',
        ) ?? []),
    ]
    const current = options.indexOf(event.currentTarget)
    const next =
      event.key === 'Home'
        ? options[0]
        : event.key === 'End'
          ? options.at(-1)
          : event.key === 'ArrowDown'
            ? options[(current + 1) % options.length]
            : event.key === 'ArrowUp'
              ? options[(current - 1 + options.length) % options.length]
              : undefined
    if (next) {
      event.preventDefault()
      next.focus()
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLLIElement>) {
    moveFocus(event)
    if (!disabled && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault()
      onSelect?.()
    }
  }

  return (
    <li
      role="option"
      aria-selected={selected}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : selected ? 0 : -1}
      className={cn(
        'cursor-pointer rounded-md px-3 py-2 text-sm outline-none hover:bg-[var(--theme-card2)] focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)]',
        selected &&
          'bg-[var(--theme-accent)] text-[var(--theme-accent-foreground)]',
        disabled && 'cursor-not-allowed opacity-60',
        className,
      )}
      data-slot="listbox-option"
      onClick={disabled ? undefined : onSelect}
      onKeyDown={handleKeyDown}
      {...props}
    >
      {children}
    </li>
  )
}

function SegmentedControl({
  className,
  label,
  value,
  options,
  onValueChange,
}: {
  className?: string
  label: string
  value: string
  options: Array<{ value: string; label: ReactNode; disabled?: boolean }>
  onValueChange: (value: string) => void
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'inline-flex rounded-full border border-[var(--theme-border)] bg-[var(--theme-card2)] p-1',
        className,
      )}
      data-slot="segmented-control"
    >
      {options.map((option) => (
        <Button
          key={option.value}
          variant={value === option.value ? 'default' : 'ghost'}
          size="sm"
          className="h-auto border-0 px-[0.9rem] py-[0.4rem] text-[0.8125rem] leading-[1.5] shadow-none"
          disabled={option.disabled}
          aria-pressed={value === option.value}
          onClick={() => onValueChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  )
}

export { Listbox, ListboxGroup, ListboxOption, SegmentedControl }
