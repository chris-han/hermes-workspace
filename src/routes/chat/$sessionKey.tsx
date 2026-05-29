import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Suspense, lazy, useCallback, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  NEW_CHAT_FRIENDLY_ID,
  NEW_CHAT_SESSION_KEY,
  moveHistoryMessages,
  resetNewChatHistory,
} from '../../screens/chat/chat-queries'
import { ErrorBoundary } from '@/components/error-boundary'

const ChatScreen = lazy(async () => {
  const module = await import('../../screens/chat/chat-screen')
  return { default: module.ChatScreen }
})

export const Route = createFileRoute('/chat/$sessionKey')({
  component: ChatRoute,
  // Disable SSR to prevent hydration mismatches from async data
  ssr: false,
  errorComponent: function ChatError({ error, reset }) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-background p-6 text-center text-foreground">
        <div className="max-w-md">
          <div className="mb-4 text-5xl">💬</div>
          <h2 className="mb-3 text-xl font-semibold text-foreground">
            Chat Error
          </h2>
          <p className="mb-6 text-sm text-muted-foreground">
            {error instanceof Error
              ? error.message
              : 'Failed to load chat session'}
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={reset}
              className="rounded-button bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 hover:scale-105 active:scale-95"
            >
              Try Again
            </button>
            <button
              onClick={() => {
                if (typeof window !== 'undefined')
                  window.location.href = '/chat'
              }}
              className="rounded-button border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-all hover:bg-muted hover:scale-105 active:scale-95"
            >
              Return to Main
            </button>
          </div>
        </div>
      </div>
    )
  },
})

function ChatRoute() {
  // Client-only rendering to prevent hydration mismatches
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [forcedSession, setForcedSession] = useState<{
    friendlyId: string
    sessionKey: string
  } | null>(null)
  const params = Route.useParams()
  const activeFriendlyId =
    typeof params.sessionKey === 'string' ? params.sessionKey : 'main'
  const isNewChat = activeFriendlyId === 'new'
  const forcedSessionKey =
    forcedSession?.friendlyId === activeFriendlyId
      ? forcedSession.sessionKey
      : undefined

  // Clear history cache when navigating to new chat
  useEffect(() => {
    if (isNewChat) {
      resetNewChatHistory(queryClient)
    }
  }, [isNewChat, queryClient])

  const handleSessionResolved = useCallback(
    function handleSessionResolved(payload: {
      friendlyId: string
      sessionKey: string
    }) {
      const sourceFriendlyId = activeFriendlyId
      const sourceSessionKey =
        forcedSessionKey ??
        (activeFriendlyId === NEW_CHAT_FRIENDLY_ID
          ? NEW_CHAT_SESSION_KEY
          : activeFriendlyId)
      moveHistoryMessages(
        queryClient,
        sourceFriendlyId,
        sourceSessionKey,
        payload.friendlyId,
        payload.sessionKey,
      )
      queryClient.invalidateQueries({ queryKey: ['chat', 'sessions'] })
      setForcedSession({
        friendlyId: payload.friendlyId,
        sessionKey: payload.sessionKey,
      })
      // Persist last session for refresh recovery
      try {
        localStorage.setItem('hermes-last-session', payload.friendlyId)
      } catch {}
      navigate({
        to: '/chat/$sessionKey',
        params: { sessionKey: payload.friendlyId },
        replace: true,
      })
    },
    [activeFriendlyId, forcedSessionKey, navigate, queryClient],
  )

  if (!mounted) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Loading chat…
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center text-muted-foreground">
            Loading chat…
          </div>
        }
      >
        <ChatScreen
          activeFriendlyId={activeFriendlyId}
          isNewChat={isNewChat}
          forcedSessionKey={forcedSessionKey}
          onSessionResolved={
            isNewChat || activeFriendlyId === 'main'
              ? handleSessionResolved
              : undefined
          }
        />
      </Suspense>
    </ErrorBoundary>
  )
}
