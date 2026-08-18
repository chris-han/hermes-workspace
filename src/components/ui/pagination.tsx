import { Button } from './button'
import { cn } from '@/lib/utils'

interface PaginationProps {
  page: number
  pageCount: number
  onPageChange: (page: number) => void
  compact?: boolean
  className?: string
  label?: string
}

function Pagination({
  page,
  pageCount,
  onPageChange,
  compact = false,
  className,
  label = 'Pagination',
}: PaginationProps) {
  const pages = Array.from({ length: pageCount }, (_, index) => index + 1)
  return (
    <nav
      className={cn('flex items-center gap-1', className)}
      aria-label={label}
    >
      <Button
        variant="outline"
        size={compact ? 'sm' : 'icon-sm'}
        className={compact ? undefined : 'size-9 text-[0.8125rem]'}
        aria-label="Previous"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <span aria-hidden="true">‹</span>
      </Button>
      {compact ? (
        <span className="px-2 text-sm text-[var(--theme-muted)]">
          {page} / {pageCount}
        </span>
      ) : (
        pages.map((item) => (
          <Button
            key={item}
            variant={item === page ? 'default' : 'ghost'}
            size="icon-sm"
            className="size-9 text-[0.8125rem]"
            aria-current={item === page ? 'page' : undefined}
            aria-label={`Page ${item}`}
            onClick={() => onPageChange(item)}
          >
            {item}
          </Button>
        ))
      )}
      <Button
        variant="outline"
        size={compact ? 'sm' : 'icon-sm'}
        className={compact ? undefined : 'size-9 text-[0.8125rem]'}
        aria-label="Next"
        disabled={page >= pageCount}
        onClick={() => onPageChange(page + 1)}
      >
        <span aria-hidden="true">›</span>
      </Button>
    </nav>
  )
}

export { Pagination }
export type { PaginationProps }
