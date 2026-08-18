import { cloneElement, forwardRef, isValidElement, useId } from 'react'
import type {
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactElement,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'

import { cn } from '@/lib/utils'

const controlClass =
  'w-full rounded-[0.75rem] border border-[var(--theme-border)] bg-[var(--theme-card)] px-[0.9rem] py-[0.7rem] text-[0.9375rem] leading-[1.5] font-medium text-[var(--theme-text)] outline-none transition-[border-color,box-shadow] placeholder:text-[var(--theme-muted)] focus-visible:border-[var(--theme-accent)] focus-visible:ring-[4px] focus-visible:ring-[var(--theme-accent-subtle)] disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-[var(--danger-red,#d03238)]'

const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(controlClass, 'min-h-24 resize-y', className)}
    data-slot="textarea"
    {...props}
  />
))
Textarea.displayName = 'Textarea'

const NativeSelect = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(({ className, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(controlClass, 'min-h-9 appearance-auto', className)}
    data-slot="native-select"
    {...props}
  />
))
NativeSelect.displayName = 'NativeSelect'

const Checkbox = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    type="checkbox"
    className={cn(
      'size-[1.15rem] appearance-none rounded-[0.375rem] border-[1.5px] border-[var(--theme-border-strong,var(--theme-border))] bg-[var(--theme-card)] accent-[var(--theme-accent)] outline-none checked:border-[var(--theme-accent)] checked:bg-[var(--theme-accent)] focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)] disabled:opacity-60',
      className,
    )}
    data-slot="checkbox"
    {...props}
  />
))
Checkbox.displayName = 'Checkbox'

const Radio = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    type="radio"
    className={cn(
      'size-[1.15rem] appearance-none rounded-full border-[1.5px] border-[var(--theme-border-strong,var(--theme-border))] bg-[var(--theme-card)] accent-[var(--theme-accent)] outline-none checked:border-[var(--theme-accent)] checked:bg-[var(--theme-accent)] focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)] disabled:opacity-60',
      className,
    )}
    data-slot="radio"
    {...props}
  />
))
Radio.displayName = 'Radio'

const FileInput = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    type="file"
    className={cn(
      controlClass,
      'file:mr-3 file:rounded-full file:border-0 file:bg-[var(--theme-accent)] file:px-3 file:py-1 file:text-[0.8125rem] file:leading-none file:font-semibold file:text-[var(--theme-accent-foreground)]',
      className,
    )}
    data-slot="file-input"
    {...props}
  />
))
FileInput.displayName = 'FileInput'

function Datalist({ id, children }: { id: string; children: ReactNode }) {
  return (
    <datalist id={id} data-slot="datalist">
      {children}
    </datalist>
  )
}

function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        'text-sm font-semibold text-[var(--theme-text)]',
        className,
      )}
      data-slot="label"
      {...props}
    />
  )
}

interface FieldProps {
  children: ReactElement<{
    id?: string
    'aria-describedby'?: string
    'aria-invalid'?: boolean
  }>
  label: ReactNode
  description?: ReactNode
  error?: ReactNode
  htmlFor?: string
  required?: boolean
  className?: string
}

function Field({
  children,
  label,
  description,
  error,
  htmlFor,
  required,
  className,
}: FieldProps) {
  const generatedId = useId()
  const controlId = htmlFor ?? generatedId
  const descriptionId = description ? `${controlId}-description` : undefined
  const errorId = error ? `${controlId}-error` : undefined
  const describedBy =
    [descriptionId, errorId].filter(Boolean).join(' ') || undefined
  const control = isValidElement(children)
    ? cloneElement(children, {
        id: children.props.id ?? controlId,
        'aria-describedby': children.props['aria-describedby'] ?? describedBy,
        'aria-invalid': children.props['aria-invalid'] ?? Boolean(error),
      })
    : children
  return (
    <div className={cn('grid gap-1.5', className)} data-slot="field">
      <Label htmlFor={controlId}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </Label>
      {control}
      {description ? (
        <p id={descriptionId} className="text-xs text-[var(--theme-muted)]">
          {description}
        </p>
      ) : null}
      {error ? (
        <p
          className="text-xs font-medium text-[#ff7b80] [.light_&]:text-[#b4232a]"
          id={errorId}
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  )
}

export {
  Checkbox,
  Datalist,
  Field,
  FileInput,
  Label,
  NativeSelect,
  Radio,
  Textarea,
}
export type { FieldProps }
