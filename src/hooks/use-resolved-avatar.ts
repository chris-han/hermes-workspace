import {
  selectChatProfileAvatarDataUrl,
  selectChatProfileDisplayName,
  useChatSettingsStore,
  DEFAULT_CHAT_DISPLAY_NAME,
} from '@/hooks/use-chat-settings'
import { useVibeAuthStatus } from '@/lib/vibe-auth'

export function useResolvedAvatarUrl(): string | null {
  const localAvatar = useChatSettingsStore(selectChatProfileAvatarDataUrl)
  const vibeAuth = useVibeAuthStatus()

  return localAvatar || vibeAuth.data?.user?.avatar_url || null
}

export function useResolvedDisplayName(): string {
  const localName = useChatSettingsStore(selectChatProfileDisplayName)
  const vibeAuth = useVibeAuthStatus()

  if (localName && localName !== DEFAULT_CHAT_DISPLAY_NAME) {
    return localName
  }

  return vibeAuth.data?.user?.name || DEFAULT_CHAT_DISPLAY_NAME
}
