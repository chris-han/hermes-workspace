import { getChatMode } from './gateway-capabilities'

export type { ChatMode } from './gateway-capabilities'

export type ChatBackend = 'hermes-enhanced' | 'none'

export function resolveChatBackend(): ChatBackend {
  return 'hermes-enhanced'
}
