import { useEffect, useState } from 'react'

import type {ThemeId} from '@/lib/theme';
import {
  THEME_CHANGE_EVENT,
  
  getTheme,
  isValidTheme
} from '@/lib/theme'

function readDocumentTheme(): ThemeId {
  if (typeof document === 'undefined') return getTheme()
  const current = document.documentElement.getAttribute('data-theme')
  return isValidTheme(current) ? current : getTheme()
}

export function useThemeId(): ThemeId {
  const [themeId, setThemeId] = useState<ThemeId>(() => readDocumentTheme())

  useEffect(() => {
    if (typeof window === 'undefined') return

    function syncThemeId() {
      setThemeId(readDocumentTheme())
    }

    function handleStorage(event: StorageEvent) {
      if (event.key !== 'hermes-theme') return
      syncThemeId()
    }

    window.addEventListener(THEME_CHANGE_EVENT, syncThemeId)
    window.addEventListener('storage', handleStorage)

    const observer =
      typeof MutationObserver === 'undefined'
        ? null
        : new MutationObserver(syncThemeId)
    observer?.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })

    syncThemeId()
    return () => {
      window.removeEventListener(THEME_CHANGE_EVENT, syncThemeId)
      window.removeEventListener('storage', handleStorage)
      observer?.disconnect()
    }
  }, [])

  return themeId
}
