import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

const LIGHT_THEMES = new Set([
  'hermes-nous-light',
  'hermes-official-light',
  'hermes-classic-light',
  'hermes-slate-light',
  'semantier-light',
])

function useIsLightTheme(): boolean {
  const [light, setLight] = useState(false)
  useEffect(() => {
    const check = () => {
      const theme = document.documentElement.getAttribute('data-theme') || ''
      setLight(LIGHT_THEMES.has(theme))
    }
    check()
    const observer = new MutationObserver(check)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })
    return () => observer.disconnect()
  }, [])
  return light
}

// Map provider IDs to logo file names.
// Logos live in /public/providers (dark) and /public/providers/light (light).
// Add a mapping here when introducing a new provider; the missing cases
// below fall back to a unified monogram tile so the grid stays visually
// consistent even when an asset does not exist yet.
const PROVIDER_LOGO_FILES: Record<string, string> = {
  nous: 'nous.png',
  'openai-codex': 'openai.png',
  openai: 'openai.png',
  anthropic: 'anthropic.png',
  openrouter: 'openrouter.png',
  ollama: 'ollama.png',
  'atomic-chat': 'atomic-chat.png',
  kimi: 'kimi.png',
  'kimi-coding': 'kimi.png',
  minimax: 'minimax.png',
  zai: 'zhipu.png',
  zhipu: 'zhipu.png',
}

const PROVIDER_INITIALS: Record<string, string> = {
  alibaba: 'Q',
  xiaomi: 'M',
  custom: 'C',
}

export function ProviderLogo({
  provider,
  size = 32,
  className,
}: {
  provider: string
  size?: number
  className?: string
}) {
  const isLight = useIsLightTheme()
  const base = isLight ? '/providers/light' : '/providers'
  const file = PROVIDER_LOGO_FILES[provider]
  const initial = (PROVIDER_INITIALS[provider] ?? provider?.[0] ?? '?')
    .toUpperCase()
    .slice(0, 1)

  // Every tile has the same shape, border, and background. Image tiles
  // contain the asset with object-contain so it never crops. Missing-asset
  // tiles render a quiet monogram with a soft border so the grid still
  // reads as a complete system.
  const tileStyle = { width: size, height: size }

  if (!file) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-md border border-(--theme-border) bg-(--theme-card) text-[10px] font-semibold text-(--theme-muted) select-none',
          className,
        )}
        style={tileStyle}
        aria-label={provider}
        role="img"
      >
        {initial}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex items-center justify-center overflow-hidden rounded-md border border-(--theme-border) bg-(--theme-card)',
        className,
      )}
      style={tileStyle}
    >
      <img
        src={`${base}/${file}`}
        alt={provider}
        className="h-full w-full object-contain"
        loading="lazy"
        draggable={false}
      />
    </div>
  )
}
