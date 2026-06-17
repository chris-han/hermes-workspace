import { useEffect } from 'react'
import { create } from 'zustand'
import type { LocaleId } from '@/lib/i18n'
import { getLocale, setTheme, syncLocaleFromSettings } from '@/lib/i18n'
import { getTheme } from '@/lib/theme'

const LOCAL_SETTINGS_KEY = 'hermes-settings'

export type SettingsThemeMode = 'system' | 'light' | 'dark'
export type AccentColor = 'orange' | 'purple' | 'blue' | 'green'

export type StudioSettings = {
  hermesUrl: string
  hermesToken: string
  locale: LocaleId
  theme: SettingsThemeMode
  accentColor: AccentColor
  editorFontSize: number
  editorWordWrap: boolean
  editorMinimap: boolean
  notificationsEnabled: boolean
  usageThreshold: number
  smartSuggestionsEnabled: boolean
  preferredBudgetModel: string
  preferredPremiumModel: string
  onlySuggestCheaper: boolean
  showSystemMetricsFooter: boolean
  /** Mobile chat nav mode: 'dock' = iMessage (no nav in chat), 'integrated' = chat input in nav pill, 'scroll-hide' = nav shows on scroll up */
  mobileChatNavMode: 'dock' | 'integrated' | 'scroll-hide'
}

type SettingsState = {
  settings: StudioSettings
  settingsLoaded: boolean
  settingsLoading: boolean
  loadSettings: () => Promise<void>
  updateSettings: (updates: Partial<StudioSettings>) => void
}

export const defaultStudioSettings: StudioSettings = {
  hermesUrl: '',
  hermesToken: '',
  locale: getLocale(),
  theme: 'system',
  accentColor: 'blue',
  editorFontSize: 13,
  editorWordWrap: true,
  editorMinimap: false,
  notificationsEnabled: true,
  usageThreshold: 80,
  smartSuggestionsEnabled: false,
  preferredBudgetModel: '',
  preferredPremiumModel: '',
  onlySuggestCheaper: false,
  showSystemMetricsFooter: false,
  mobileChatNavMode: 'dock',
}

type UserSettingsResponse = {
  ok?: boolean
  payload?: {
    settings?: Partial<StudioSettings>
  }
}

function readLocalSettings(): Partial<StudioSettings> | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(LOCAL_SETTINGS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    return parsed as Partial<StudioSettings>
  } catch {
    return null
  }
}

function writeLocalSettings(settings: Partial<StudioSettings>): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // Ignore local persistence failures (privacy mode, quota, etc.).
  }
}

async function loadRemoteSettings(): Promise<Partial<StudioSettings> | null> {
  try {
    const response = await fetch('/api/user-settings', {
      cache: 'no-store',
      credentials: 'same-origin',
    })
    if (!response.ok) return null
    const data = (await response.json()) as UserSettingsResponse
    const remoteSettings = data.payload?.settings ?? {}
    return remoteSettings
  } catch {
    return null
  }
}

async function saveRemoteSettings(updates: Partial<StudioSettings>): Promise<void> {
  const response = await fetch('/api/user-settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    keepalive: true,
    body: JSON.stringify({ settings: updates }),
  })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }
}

export const useSettingsStore = create<SettingsState>()((set, get) => {
  let loadPromise: Promise<void> | null = null

  return {
    settings: defaultStudioSettings,
    settingsLoaded: false,
    settingsLoading: false,
    loadSettings: async function loadSettings() {
      if (get().settingsLoaded) return
      if (loadPromise) return loadPromise

      const localSettings = readLocalSettings()
      if (localSettings) {
        set((state) => ({
          settings: {
            ...state.settings,
            ...localSettings,
          },
        }))
        if (localSettings.locale) {
          syncLocaleFromSettings(localSettings.locale)
        }
      }

      set({ settingsLoading: true })
      loadPromise = (async () => {
        const remoteSettings = await loadRemoteSettings()
        if (remoteSettings) {
          set((state) => {
            const nextSettings = {
              ...state.settings,
              ...remoteSettings,
            }
            if (remoteSettings.locale) {
              syncLocaleFromSettings(remoteSettings.locale)
            }
            writeLocalSettings(nextSettings)
            return {
              settings: nextSettings,
              settingsLoaded: true,
            }
          })
        } else {
          set({ settingsLoaded: true })
        }
      })()
        .catch(() => {
          set({ settingsLoaded: true })
        })
        .finally(() => {
          loadPromise = null
          set({ settingsLoading: false })
        })

      return loadPromise
    },
    updateSettings: function updateSettings(updates) {
      const nextSettings = {
        ...get().settings,
        ...updates,
      }
      set({ settings: nextSettings })
      writeLocalSettings(nextSettings)

      if (updates.locale) {
        syncLocaleFromSettings(updates.locale)
      }

      void saveRemoteSettings(updates).catch(() => {
        // Keep optimistic client state; backend persistence is best-effort.
      })
    },
  }
})

export function useSettings() {
  const settings = useSettingsStore(function selectSettings(state) {
    return state.settings
  })
  const loadSettings = useSettingsStore(function selectLoadSettings(state) {
    return state.loadSettings
  })
  const updateSettings = useSettingsStore(function selectUpdateSettings(state) {
    return state.updateSettings
  })

  useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  return {
    settings,
    updateSettings,
  }
}

export function resolveTheme(theme: SettingsThemeMode): 'light' | 'dark' {
  if (theme === 'light') return 'light'
  if (theme === 'dark') return 'dark'

  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

export function applyTheme(_theme?: SettingsThemeMode) {
  setTheme(getTheme())
  document.documentElement.setAttribute('data-accent', 'orange')
}

export function initializeSettingsAppearance() {
  setTheme(getTheme())
  document.documentElement.setAttribute('data-accent', 'orange')
}
