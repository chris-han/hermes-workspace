import {
  selectChatProfileAvatarDataUrl,
  selectChatProfileDisplayName,
  useChatSettingsStore,
  DEFAULT_CHAT_DISPLAY_NAME,
} from '@/hooks/use-chat-settings'
import { useSemantierAuthStatus } from '@/lib/semantier-auth'

export function useResolvedAvatarUrl(): string | null {
  const localAvatar = useChatSettingsStore(selectChatProfileAvatarDataUrl)
  const semantierAuth = useSemantierAuthStatus()

  return localAvatar || semantierAuth.data?.user?.avatar_url || null
}

export function useResolvedDisplayName(): string {
  const localName = useChatSettingsStore(selectChatProfileDisplayName)
  const semantierAuth = useSemantierAuthStatus()

  if (localName && localName !== DEFAULT_CHAT_DISPLAY_NAME) {
    return localName
  }

  return semantierAuth.data?.user?.name || DEFAULT_CHAT_DISPLAY_NAME
}
