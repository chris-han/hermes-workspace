import {
  DEFAULT_CHAT_DISPLAY_NAME,
  selectChatProfileAvatarDataUrl,
  selectChatProfileDisplayName,
  useChatSettingsStore,
} from '@/hooks/use-chat-settings'
import type { SemantierAuthStatus } from '@/lib/semantier-auth'
import { useSemantierAuthStatus } from '@/lib/semantier-auth'

export function useResolvedAvatarUrl(): string | null {
  const localAvatar = useChatSettingsStore(selectChatProfileAvatarDataUrl)
  const semantierAuth = useSemantierAuthStatus()

  return localAvatar || semantierAuth.data?.user?.avatar_url || null
}

export function resolveDisplayName(
  localName: string,
  auth: SemantierAuthStatus | undefined,
): string {
  const authUser = auth?.user
  const authName = authUser?.name?.trim() || ''
  const localTrimmed = localName.trim()
  const localLooksLikeLegacyIdentifier =
    localTrimmed === (authUser?.user_id ?? '') ||
    localTrimmed === (authUser?.weixin_user_id ?? '') ||
    localTrimmed === (auth?.workspace_slug ?? '')

  if (auth?.authenticated && auth?.profile_completed && authName) {
    if (
      !localTrimmed ||
      localTrimmed === DEFAULT_CHAT_DISPLAY_NAME ||
      localLooksLikeLegacyIdentifier
    ) {
      return authName
    }
  }

  if (localName && localName !== DEFAULT_CHAT_DISPLAY_NAME) {
    return localName
  }

  return authName || DEFAULT_CHAT_DISPLAY_NAME
}

export function useResolvedDisplayName(): string {
  const localName = useChatSettingsStore(selectChatProfileDisplayName)
  const semantierAuth = useSemantierAuthStatus()
  return resolveDisplayName(localName, semantierAuth.data)
}
