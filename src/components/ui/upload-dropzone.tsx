import { forwardRef } from 'react'
import type { HTMLAttributes } from 'react'

import { ActionSurface } from './action-surface'
import { cn } from '@/lib/utils'

interface UploadDropzoneProps extends HTMLAttributes<HTMLDivElement> {
  disabled?: boolean
  dragActive?: boolean
  invalid?: boolean
}

const UploadDropzone = forwardRef<HTMLDivElement, UploadDropzoneProps>(
  ({ className, disabled, dragActive, invalid, ...props }, ref) => (
    <ActionSurface
      ref={ref}
      disabled={disabled}
      aria-invalid={invalid || undefined}
      className={cn(
        'rounded-card border border-dashed border-[var(--theme-border-strong,var(--theme-border))] bg-[var(--theme-card)] transition-[border-color,background-color] hover:border-[var(--theme-accent)] hover:bg-[var(--theme-card2)]',
        dragActive &&
          'border-[var(--theme-accent)] bg-[var(--theme-accent)]/10',
        invalid && 'border-[var(--danger-red,#d03238)]',
        className,
      )}
      data-slot="upload-dropzone"
      data-drag-active={dragActive || undefined}
      {...props}
    />
  ),
)
UploadDropzone.displayName = 'UploadDropzone'

export { UploadDropzone }
export type { UploadDropzoneProps }
