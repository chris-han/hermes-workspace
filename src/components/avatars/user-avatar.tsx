import { memo } from 'react'
import { cn } from '@/lib/utils'

type AvatarProps = {
  size?: number
  className?: string
  src?: string | null
  alt?: string
}

/**
 * User avatar — round image when src is provided;
 * fallback is a round non-filled border circle with a user silhouette.
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
        'shrink-0 rounded-full border border-border/70 bg-transparent flex items-center justify-center',
        className
      )}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-muted-foreground"
        style={{ width: size * 0.5, height: size * 0.5 }}
      >
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    </div>
  )
}

export const UserAvatar = memo(UserAvatarComponent)
