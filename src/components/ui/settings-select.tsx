'use client'

import { useMemo, useState, type ChangeEvent, type ReactNode } from 'react'
import { Menu } from '@base-ui/react/menu'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowDown01Icon, Tick02Icon } from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'

export type SettingsSelectOption = {
  value: string
  label: string
  disabled?: boolean
}

type SettingsSelectProps = {
  /** Controlled value. */
  value?: string
  /** Uncontrolled initial value. */
  defaultValue?: string
  /** New API: array of options. */
  options?: Array<SettingsSelectOption>
  /** Legacy API: <option> children (translated internally). */
  children?: ReactNode
  /** New API: callback receiving the next value. */
  onValueChange?: (value: string) => void
  /** Legacy API: receives a synthetic event with `target.value`. */
  onChange?: (e: { target: { value: string } }) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  ariaLabel?: string
  triggerClassName?: string
  id?: string
  name?: string
  required?: boolean
}

/**
 * SettingsSelect — themed popover-based dropdown.
 *
 * Canonical visual reference: the Role dropdown in `DesignSystemDemo`
 * (`.ds-select` / `.ds-select-menu` / `.ds-select-option` classes).
 *
 * The trigger is a quiet button that wears the green accent border on
 * focus. The popup mirrors the trigger width, with each option rendered
 * through `Menu.RadioItem`. The selected and highlighted rows use a
 * warm tan tint (`--theme-card2`) plus a green checkmark for the
 * selected row. The green stays a focus-only signal (trigger border +
 * row check) and is never used as a fill on the selected row, matching
 * the DesignSystemDemo reference.
 *
 * Replaces `<select>` (and the older `DropdownSelect` wrapper) because
 * the OS-native popup ignores `!important` color overrides on
 * WebKit/Safari and renders an unthemable blue highlight.
 *
 * Accepts either the new `options` + `onValueChange` API or the legacy
 * `<option>` children + `onChange` API so each call site migrates by a
 * single token rename.
 */
export function SettingsSelect({
  value,
  defaultValue,
  options,
  children,
  onValueChange,
  onChange,
  placeholder = 'Select an option',
  disabled = false,
  className,
  ariaLabel,
  triggerClassName,
  id,
  name,
  required,
}: SettingsSelectProps) {
  // Translate <option> children into the options array when only
  // children were supplied.
  const finalOptions = useMemo<Array<SettingsSelectOption>>(() => {
    if (options) return options
    const out: Array<SettingsSelectOption> = []
    for (const child of (children as Array<unknown> | null) ?? []) {
      if (
        child &&
        typeof child === 'object' &&
        'type' in (child as Record<string, unknown>) &&
        (child as { type: unknown }).type === 'option'
      ) {
        const el = child as React.ReactElement<{
          value?: string | number
          children?: ReactNode
          disabled?: boolean
        }>
        const v = el.props.value
        const labelNode = el.props.children
        const label =
          typeof labelNode === 'string'
            ? labelNode
            : typeof labelNode === 'number'
              ? String(labelNode)
              : v != null
                ? String(v)
                : ''
        out.push({
          value: v == null ? '' : String(v),
          label,
          disabled: !!el.props.disabled,
        })
      }
    }
    return out
  }, [options, children])

  const isControlled = value !== undefined
  const [internalValue, setInternalValue] = useState<string | undefined>(
    defaultValue ?? value,
  )
  const groupValue = isControlled ? value : internalValue
  const current = finalOptions.find((o) => o.value === groupValue)

  function handleValueChange(next: string) {
    if (!isControlled) {
      setInternalValue(next)
    }
    onValueChange?.(next)
    onChange?.({ target: { value: next } })
  }

  return (
    <Menu.Root disabled={disabled}>
      <Menu.Trigger
        id={id}
        aria-label={ariaLabel}
        className={cn(
          'group flex h-8 w-full items-center justify-between gap-2 rounded-md border border-(--theme-border) bg-(--theme-card) px-2 text-sm text-(--theme-text) outline-none transition-colors',
          'hover:bg-(--theme-card2)',
          'focus-visible:border-(--theme-accent) focus-visible:ring-2 focus-visible:ring-(--theme-accent-subtle)',
          'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-60',
          triggerClassName,
        )}
      >
        <span
          className={cn(
            'min-w-0 truncate text-left',
            !current && 'text-(--theme-muted)',
          )}
        >
          {current?.label ?? placeholder}
        </span>
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          size={16}
          strokeWidth={1.5}
          className="shrink-0 text-(--theme-muted) transition-transform duration-150 group-data-[open]:rotate-180"
        />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="start" className="outline-none">
          <Menu.Popup
            className={cn(
              'min-w-[var(--anchor-width)] overflow-hidden rounded-md border border-(--theme-border) py-1 text-sm',
              className,
            )}
            style={{
              background: 'var(--theme-bg)',
              color: 'var(--theme-text)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
              zIndex: 9999,
            }}
          >
            <Menu.RadioGroup
              value={groupValue}
              onValueChange={handleValueChange}
              disabled={disabled}
            >
              {finalOptions.map((opt) => (
                <Menu.RadioItem
                  key={opt.value}
                  value={opt.value}
                  disabled={opt.disabled}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none transition-colors',
                    'data-[highlighted]:bg-(--theme-card2)',
                    'text-(--theme-text) hover:bg-(--theme-card2)',
                  )}
                >
                  <span className="min-w-0 truncate">{opt.label}</span>
                  <Menu.RadioItemIndicator
                    aria-hidden
                    className="ml-auto flex shrink-0 items-center justify-center text-(--theme-accent)"
                  >
                    <HugeiconsIcon
                      icon={Tick02Icon}
                      size={14}
                      strokeWidth={2}
                    />
                  </Menu.RadioItemIndicator>
                </Menu.RadioItem>
              ))}
            </Menu.RadioGroup>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
      {name && <input type="hidden" name={name} value={groupValue ?? ''} />}
      {required && (
        <input
          type="hidden"
          required
          value={groupValue ?? ''}
          aria-hidden
          tabIndex={-1}
          style={{ display: 'none' }}
        />
      )}
    </Menu.Root>
  )
}

// Re-export the change-event shape for consumers that want it typed.
export type SettingsSelectChangeEvent = ChangeEvent<HTMLSelectElement>