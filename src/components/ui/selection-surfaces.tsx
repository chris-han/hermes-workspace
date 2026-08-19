import { useState } from 'react'
import type { HTMLAttributes, KeyboardEvent, ReactNode } from 'react'
import { Check, ChevronDown } from 'lucide-react'

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
  navigation = false,
}: {
  className?: string
  label: string
  value: string
  options: Array<{ value: string; label: ReactNode; disabled?: boolean }>
  onValueChange: (value: string) => void
  navigation?: boolean
}) {
  function moveSelection(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const enabled = options
      .map((option, optionIndex) => ({ option, optionIndex }))
      .filter(({ option }) => !option.disabled)
    const current = enabled.findIndex(({ optionIndex }) => optionIndex === index)
    const next =
      event.key === 'Home'
        ? enabled[0]
        : event.key === 'End'
          ? enabled.at(-1)
          : event.key === 'ArrowRight'
            ? enabled[(current + 1) % enabled.length]
            : enabled[(current - 1 + enabled.length) % enabled.length]
    if (!next) return
    onValueChange(next.option.value)
    const buttons = event.currentTarget.parentElement?.querySelectorAll('button')
    buttons?.[next.optionIndex]?.focus()
  }

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
      {options.map((option, index) => (
        <Button
          key={option.value}
          variant={value === option.value ? 'default' : 'ghost'}
          size="sm"
          className="h-auto border-0 px-[0.9rem] py-[0.4rem] text-[0.8125rem] leading-[1.5] shadow-none"
          disabled={option.disabled}
          aria-pressed={value === option.value}
          aria-current={
            navigation && value === option.value ? 'page' : undefined
          }
          onClick={() => onValueChange(option.value)}
          onKeyDown={(event) => moveSelection(event, index)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  )
}

function ControlledSelect({
  className,
  label,
  value,
  options,
  onValueChange,
  compact = false,
}: {
  className?: string
  label: string
  value: string
  options: Array<{ value: string; label: ReactNode; disabled?: boolean }>
  onValueChange: (value: string) => void
  compact?: boolean
}) {
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  )
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(selectedIndex)

  function choose(index: number) {
    const option = options[index]
    if (!option || option.disabled) return
    onValueChange(option.value)
    setHighlighted(index)
    setOpen(false)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'Escape') {
      setOpen(false)
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const direction = event.key === 'ArrowDown' ? 1 : -1
      let next = highlighted
      do {
        next = (next + direction + options.length) % options.length
      } while (options[next]?.disabled && next !== highlighted)
      setHighlighted(next)
      setOpen(true)
      return
    }
    if ((event.key === 'Enter' || event.key === ' ') && open) {
      event.preventDefault()
      choose(highlighted)
    }
  }

  const selected = options[selectedIndex]
  return (
    <div
      className={cn('relative inline-block', className)}
      data-slot="controlled-select"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
    >
      <button
        type="button"
        className={cn(
          'flex w-full items-center justify-between gap-3 rounded-[0.75rem] border border-[var(--theme-border)] bg-[var(--theme-card)] text-left font-medium text-[var(--theme-text)] outline-none transition-[border-color,box-shadow] hover:border-[var(--theme-border-strong)] focus-visible:border-[var(--theme-accent)] focus-visible:ring-[4px] focus-visible:ring-[var(--theme-accent-subtle)]',
          compact
            ? 'h-8 min-w-32 px-2.5 text-xs'
            : 'px-[0.9rem] py-[0.7rem] text-[0.9375rem]',
        )}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          setHighlighted(selectedIndex)
          setOpen((current) => !current)
        }}
        onKeyDown={handleKeyDown}
        data-slot="controlled-select-trigger"
      >
        <span>{selected?.label}</span>
        <ChevronDown
          aria-hidden="true"
          data-slot="controlled-select-chevron"
          className={cn(
            'size-[1.0625rem] shrink-0 self-center text-[var(--theme-muted)] transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>
      {open ? (
        <ul
          role="listbox"
          aria-label={label}
          className="absolute left-0 top-[calc(100%+0.4rem)] z-50 m-0 grid min-w-full list-none gap-1 rounded-[0.75rem] border border-[var(--theme-border)] bg-[var(--theme-card)] p-[0.35rem] shadow-lg"
          data-slot="controlled-select-menu"
        >
          {options.map((option, index) => (
            <li key={option.value} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={option.value === value}
                aria-disabled={option.disabled || undefined}
                disabled={option.disabled}
                className={cn(
                  'flex w-full items-center justify-between rounded-md border-0 bg-transparent px-[0.7rem] py-[0.65rem] text-left text-sm font-medium text-[var(--theme-text)] outline-none hover:bg-[var(--theme-card2)] focus-visible:bg-[var(--theme-card2)]',
                  highlighted === index && 'bg-[var(--theme-card2)]',
                  option.value === value && 'font-semibold',
                  option.disabled && 'cursor-not-allowed opacity-60',
                )}
                onMouseEnter={() => setHighlighted(index)}
                onClick={() => choose(index)}
              >
                <span>{option.label}</span>
                {option.value === value ? (
                  <Check
                    aria-hidden="true"
                    data-slot="controlled-select-check"
                    className="size-[0.9375rem] shrink-0"
                  />
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export type MultiSelectOption = {
  value: string
  label: ReactNode
  disabled?: boolean
}

function MultiSelectDropdown({
  className,
  label,
  value,
  options,
  onValueChange,
  compact = false,
  emptyLabel = 'All',
}: {
  className?: string
  label: string
  value: Set<string>
  options: MultiSelectOption[]
  onValueChange: (next: Set<string>) => void
  compact?: boolean
  emptyLabel?: string
}) {
  const [open, setOpen] = useState(false)
  // "No filter" can be expressed as either an empty Set (consumer has not yet
  // initialised) or a full Set (all options explicitly kept). The trigger
  // collapses both into `emptyLabel` so the dropdown always reads "All" until
  // the reviewer starts narrowing.
  const allChecked =
    options.length === 0 || value.size === 0 || value.size === options.length
  const triggerLabel = allChecked
    ? emptyLabel
    : `${value.size} / ${options.length} selected`

  function toggle(optionValue: string) {
    const next = new Set(value)
    if (next.has(optionValue)) next.delete(optionValue)
    else next.add(optionValue)
    onValueChange(next)
  }

  return (
    <div
      className={cn('relative inline-block', className)}
      data-slot="multi-select-dropdown"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false)
        }
      }}
    >
      <button
        type="button"
        className={cn(
          'flex w-full items-center justify-between gap-3 rounded-[0.75rem] border border-[var(--theme-border)] bg-[var(--theme-card)] text-left font-medium text-[var(--theme-text)] outline-none transition-[border-color,box-shadow] hover:border-[var(--theme-border-strong)] focus-visible:border-[var(--theme-accent)] focus-visible:ring-[4px] focus-visible:ring-[var(--theme-accent-subtle)] disabled:cursor-not-allowed disabled:opacity-60',
          compact
            ? 'h-8 min-w-32 px-2.5 text-xs'
            : 'px-[0.9rem] py-[0.7rem] text-[0.9375rem]',
        )}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={options.length === 0}
        onClick={() => setOpen((current) => !current)}
        data-slot="multi-select-dropdown-trigger"
      >
        <span>{triggerLabel}</span>
        <ChevronDown
          aria-hidden="true"
          data-slot="multi-select-dropdown-chevron"
          className={cn(
            'size-[1.0625rem] shrink-0 self-center text-[var(--theme-muted)] transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>
      {open && options.length > 0 ? (
        <div
          role="menu"
          aria-label={label}
          data-slot="multi-select-dropdown-popover"
          className="absolute left-0 top-[calc(100%+0.4rem)] z-50 grid min-w-full gap-1 rounded-[0.75rem] border border-[var(--theme-border)] bg-[var(--theme-card)] p-[0.35rem] shadow-lg"
        >
          {options.map((option) => {
            const checked = value.has(option.value)
            return (
              <label
                key={option.value}
                role="menuitemcheckbox"
                aria-checked={checked}
                aria-disabled={option.disabled || undefined}
                className={cn(
                  'flex w-full cursor-pointer items-center gap-2 rounded-md px-[0.7rem] py-[0.55rem] text-left text-xs font-medium text-[var(--theme-text)] outline-none hover:bg-[var(--theme-card2)]',
                  option.disabled && 'cursor-not-allowed opacity-60',
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={option.disabled}
                  onChange={() => toggle(option.value)}
                  className="size-[0.9rem] shrink-0 accent-[var(--theme-accent)]"
                  data-slot="multi-select-dropdown-checkbox"
                />
                <span className="flex-1 truncate">{option.label}</span>
              </label>
            )
          })}
          <div className="mt-1 flex items-center justify-between border-t border-[var(--theme-border)] px-[0.7rem] pt-[0.5rem] text-[11px]">
            <button
              type="button"
              data-slot="multi-select-dropdown-all"
              className="font-medium text-[var(--theme-accent)] hover:underline"
              onClick={() =>
                onValueChange(new Set(options.map((option) => option.value)))
              }
            >
              All
            </button>
            <button
              type="button"
              data-slot="multi-select-dropdown-clear"
              className="font-medium text-muted-foreground hover:underline"
              onClick={() => onValueChange(new Set())}
            >
              Clear
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export {
  ControlledSelect,
  Listbox,
  ListboxGroup,
  ListboxOption,
  MultiSelectDropdown,
  SegmentedControl,
}
