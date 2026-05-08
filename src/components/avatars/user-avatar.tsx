import { memo } from 'react'
import { cn } from '@/lib/utils'

type AvatarProps = {
  size?: number
  className?: string
  src?: string | null
  alt?: string
}

export function deriveAvatarInitials(label: string): string {
  const trimmed = label.trim()
  if (!trimmed) return '?'

  const firstVisible = Array.from(trimmed).find((char) => /\S/.test(char))
  if (!firstVisible) return '?'
  return firstVisible.toUpperCase()
}

/**
 * User avatar — round image when src is provided;
 * fallback is a round initials badge derived from the resolved user label.
 */
function UserAvatarComponent({
  size = 28,
  className,
  src,
  alt = 'User avatar',
}: AvatarProps) {
  if (src && src.trim().length > 0) {
    return (
      <img
        src={src}
        alt={alt}
        className={cn('shrink-0 object-cover rounded-full', className)}
        style={{
          width: size,
          height: size,
        }}
      />
    )
  }

  return (
    <div
      className={cn(
        'theme-accent-fill theme-accent-icon shrink-0 rounded-full border border-[color:var(--theme-accent-border)] flex items-center justify-center font-medium select-none',
        className,
      )}
      style={{ width: size, height: size }}
      aria-label={alt}
      title={alt}
    >
      <span
        aria-hidden="true"
        style={{
          fontSize: Math.max(11, Math.round(size * 0.4)),
          lineHeight: `${size}px`,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: size,
          height: size,
          textAlign: 'center',
        }}
      >
        {deriveAvatarInitials(alt)}
      </span>
    </div>
  )
}

export const UserAvatar = memo(UserAvatarComponent)
