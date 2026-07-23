import {   ThinkingOrb } from 'thinking-orbs'
import type {OrbState, OrbTheme} from 'thinking-orbs';
import type { ThemeId } from '@/lib/theme'
import { isDarkTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'

export type ThinkingActivitySize = 20 | 64
export type ThinkingActivityKind =
  | 'working'
  | 'searching'
  | 'solving'
  | 'listening'
  | 'composing'
  | 'shaping'

export type ThinkingActivityIndicatorProps = {
  size: ThinkingActivitySize
  themeId: ThemeId
  kind?: ThinkingActivityKind
  label?: string
  className?: string
  fallbackOnly?: boolean
}

const ACTIVITY_KIND_TO_ORB_STATE: Record<ThinkingActivityKind, OrbState> = {
  working: 'working',
  searching: 'searching',
  solving: 'solving',
  listening: 'listening',
  composing: 'composing',
  shaping: 'shaping',
}

export function resolveThinkingOrbTheme(themeId: ThemeId): OrbTheme {
  return isDarkTheme(themeId) ? 'dark' : 'light'
}

export function resolveThinkingOrbState(
  kind: ThinkingActivityKind = 'working',
): OrbState {
  return ACTIVITY_KIND_TO_ORB_STATE[kind]
}

function ThinkingActivityFallback({
  size,
  label,
}: {
  size: ThinkingActivitySize
  label: string
}) {
  return (
    <span
      role="img"
      aria-label={label}
      data-thinking-activity-fallback
      className="inline-flex items-center justify-center rounded-full border border-current/30"
      style={{ width: size, height: size }}
    >
      <span
        aria-hidden="true"
        className="block rounded-full bg-current"
        style={{
          width: size === 64 ? 10 : 4,
          height: size === 64 ? 10 : 4,
        }}
      />
    </span>
  )
}

export function ThinkingActivityIndicator({
  size,
  themeId,
  kind = 'working',
  label,
  className,
  fallbackOnly = false,
}: ThinkingActivityIndicatorProps) {
  const ariaLabel = label || (size === 64 ? 'Assistant working' : 'Tool working')
  const orbState = resolveThinkingOrbState(kind)
  const orbTheme = resolveThinkingOrbTheme(themeId)

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center text-primary-700',
        className,
      )}
      style={{ width: size, height: size }}
      data-thinking-activity-size={size}
      data-thinking-activity-kind={kind}
    >
      {fallbackOnly ? (
        <ThinkingActivityFallback size={size} label={ariaLabel} />
      ) : (
        <ThinkingOrb
          state={orbState}
          size={size}
          theme={orbTheme}
          aria-label={ariaLabel}
          data-thinking-orb=""
        />
      )}
    </span>
  )
}
