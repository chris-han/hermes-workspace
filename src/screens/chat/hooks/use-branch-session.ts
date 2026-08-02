import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'

import { toast } from '@/components/ui/toast'
import type { SemantierBranchResponse } from '@/server/semantier-session-api'
import { branchSessionAtMessage, chatQueryKeys } from '../chat-queries'
import type { ChatMessage } from '../types'
import { normalizeBranchTitle } from './branching'

export { normalizeBranchTitle } from './branching'

export function useBranchSession(sourceSessionKey: string, sourceTitle?: string) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: async (message: ChatMessage) => {
      if (!message.messageId || !message.messageSequence) {
        throw new Error('This response is not branchable yet')
      }
      return branchSessionAtMessage({
        sessionKey: sourceSessionKey,
        messageId: message.messageId,
        sequence: message.messageSequence,
        title: normalizeBranchTitle(sourceTitle),
        idempotencyKey: crypto.randomUUID(),
      })
    },
    onSuccess: async (result: SemantierBranchResponse) => {
      const child = result.session
      const childKey = child.friendlyId || child.key
      await queryClient.invalidateQueries({ queryKey: chatQueryKeys.sessions })
      queryClient.invalidateQueries({
        queryKey: chatQueryKeys.history(childKey, child.key),
      })
      await navigate({
        to: '/chat/$sessionKey',
        params: { sessionKey: childKey },
      })
    },
    onError: (error: Error) => {
      toast(error.message || 'Unable to branch this conversation', {
        type: 'error',
      })
    },
  })

  return {
    branchMessage: mutation.mutate,
    isBranching: mutation.isPending,
    branchingMessageId: mutation.variables?.messageId ?? null,
  }
}
