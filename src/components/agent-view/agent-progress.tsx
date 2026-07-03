import { motion } from 'motion/react'
import { cn } from '@/lib/utils'

export type AgentProgressStatus =
  | 'running'
  | 'thinking'
  | 'complete'
  | 'failed'
  | 'queued'

type AgentProgressProps = {
  value: number
  status: AgentProgressStatus
  size?: number
  strokeWidth?: number
  className?: string
  trackClassName?: string
  progressClassName?: string
}

function getProgressStrokeClassName(status: AgentProgressStatus): string {
  if (status === 'failed') return 'text-[var(--theme-danger,#dc2626)]'
  if (status === 'thinking') return 'text-[var(--theme-accent,#1B813E)]'
  if (status === 'complete') return 'text-[var(--theme-success,#1B813E)]'
  if (status === 'queued') return 'text-[var(--theme-muted,#6b7280)]'
  return 'text-[var(--theme-success,#1B813E)]'
}

export function AgentProgress({
  value,
  status,
  size = 96,
  strokeWidth = 6,
  className,
  trackClassName,
  progressClassName,
}: AgentProgressProps) {
  const clamped = Math.max(0, Math.min(100, value))
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={cn('pointer-events-none', className)}
      aria-hidden
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        strokeWidth={strokeWidth}
        className={cn(
          'fill-none stroke-[color:color-mix(in_srgb,var(--theme-bg)_72%,var(--theme-text)_28%)]',
          trackClassName,
        )}
      />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={false}
        animate={{
          strokeDashoffset: circumference - (clamped / 100) * circumference,
        }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className={cn(
          'origin-center -rotate-90 fill-none stroke-current',
          progressClassName ?? getProgressStrokeClassName(status),
        )}
        style={{ transformOrigin: '50% 50%', transform: 'rotate(-90deg)' }}
      />
    </svg>
  )
}
