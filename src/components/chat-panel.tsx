/**
 * Right panel for non-chat routes (v1.3 simplified).
 *
 * Per docs/derived/semantier-workspace-neo-functionalism-chrome-rollout-v1.md
 * (v1.3 amendment), this panel hosts two modes via a text-only tab strip:
 *   - Inspector: KG-native metrics + properties table on workbench routes,
 *               route-context placeholder on other routes.
 *   - Chat: the global chat session (ChatScreen), styled with the
 *           neo-functionalism chrome (mono caps section labels, brand
 *           accents, theme-token discipline).
 *
 * Default mode per route:
 *   - Workbench routes (graph-explorer / contextgraph-studio / knowledge-base
 *     / evaluation): Inspector.
 *   - Other routes: Chat.
 *
 * v1.3: Co-pilot was a separate mode in v1.1 / v1.2 but has been retired —
 * Chat IS the workbench co-pilot under one label.
 */

import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import type { SessionMeta } from '@/screens/chat/types'
import { ChatScreen } from '@/screens/chat/chat-screen'
import {
  NEW_CHAT_FRIENDLY_ID,
  NEW_CHAT_SESSION_KEY,
  chatQueryKeys,
  moveHistoryMessages,
  resetNewChatHistory,
} from '@/screens/chat/chat-queries'
import { cn } from '@/lib/utils'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { Button } from '@/components/ui/button'
import {
  TooltipContent,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { X, PencilSimple, ArrowsOut } from '@/components/ui/icon'

type RightPanelMode = 'inspector' | 'chat'

const WORKBENCH_ROUTE_PREFIXES = ['/graph-explorer', '/contextgraph-studio', '/knowledge-base', '/evaluation']

function isWorkbenchRoute(pathname: string): boolean {
  return WORKBENCH_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

export function ChatPanel({ embedded = false }: { embedded?: boolean } = {}) {
  const isStudioRoute =
    typeof window !== 'undefined' &&
    window.location.pathname.toLowerCase().includes('contextgraph')
  if (isStudioRoute && !embedded) return null
  return <ChatPanelContent embedded={embedded} />
}

function ChatPanelContent({ embedded }: { embedded: boolean }) {
  const isOpen = useWorkspaceStore((s) => s.chatPanelOpen)
  const rightPanelMode = useWorkspaceStore((s) => s.rightPanelMode)
  const sessionKey = useWorkspaceStore((s) => s.chatPanelSessionKey)
  const legalContext = useWorkspaceStore((s) => s.legalCorpusChatContext)
  const setChatPanelOpen = useWorkspaceStore((s) => s.setChatPanelOpen)
  const setChatPanelSessionKey = useWorkspaceStore(
    (s) => s.setChatPanelSessionKey,
  )
  const setRightPanelMode = useWorkspaceStore((s) => s.setRightPanelMode)
  const navigate = useNavigate()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const queryClient = useQueryClient()

  // Pick a sensible default mode the first time the panel renders for a route
  // family; do not clobber once the user has explicitly chosen.
  useEffect(() => {
    if (!isOpen && !embedded) return
    const stored = useWorkspaceStore.getState().rightPanelMode
    if (stored === 'inspector' || stored === 'chat') {
      return
    }
    setRightPanelMode(isWorkbenchRoute(pathname) ? 'inspector' : 'chat')
  }, [pathname, isOpen, embedded, setRightPanelMode])

  const [forcedSession, setForcedSession] = useState<{
    friendlyId: string
    sessionKey: string
  } | null>(null)

  const isNewChat = sessionKey === 'new'
  const activeFriendlyId = sessionKey || 'main'
  const forcedSessionKey =
    forcedSession?.friendlyId === activeFriendlyId
      ? forcedSession.sessionKey
      : undefined

  const sessionsQuery = useQuery({
    queryKey: chatQueryKeys.sessions,
    queryFn: async () => {
      const res = await fetch('/api/sessions')
      if (!res.ok) return []
      const data = await res.json()
      return Array.isArray(data?.sessions)
        ? data?.sessions
        : Array.isArray(data)
          ? data
          : []
    },
    staleTime: 10_000,
    enabled: rightPanelMode === 'chat',
  })
  const sessions: Array<SessionMeta> = sessionsQuery.data ?? []

  const activeSession = sessions.find((s) => s.friendlyId === activeFriendlyId)
  const panelTitle = activeSession
    ? activeSession.label ||
      activeSession.title ||
      activeSession.derivedTitle ||
      'Chat'
    : activeFriendlyId === 'main'
      ? 'Main Session'
      : isNewChat
        ? 'New Chat'
        : 'Chats'

  const handleSessionResolved = useCallback(
    (payload: { friendlyId: string; sessionKey: string }) => {
      moveHistoryMessages(
        queryClient,
        NEW_CHAT_FRIENDLY_ID,
        NEW_CHAT_SESSION_KEY,
        payload.friendlyId,
        payload.sessionKey,
      )
      setForcedSession({
        friendlyId: payload.friendlyId,
        sessionKey: payload.sessionKey,
      })
      setChatPanelSessionKey(payload.friendlyId)
    },
    [queryClient, setChatPanelSessionKey],
  )

  const handleExpand = useCallback(() => {
    setChatPanelOpen(false)
    navigate({
      to: '/chat/$sessionKey',
      params: { sessionKey: activeFriendlyId },
    })
  }, [activeFriendlyId, navigate, setChatPanelOpen])

  const handleClose = useCallback(() => {
    setChatPanelOpen(false)
  }, [setChatPanelOpen])

  const handleNewChat = useCallback(() => {
    setForcedSession(null)
    resetNewChatHistory(queryClient)
    setChatPanelSessionKey('new')
  }, [queryClient, setChatPanelSessionKey])

  const handleSelectSession = useCallback(
    (friendlyId: string) => {
      setForcedSession(null)
      setChatPanelSessionKey(friendlyId)
    },
    [setChatPanelSessionKey],
  )

  const [showSessionList, setShowSessionList] = useState(false)

  return (
    <AnimatePresence>
      {(embedded || isOpen) && (
        <>
          {!embedded ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-10 bg-black/20 min-[1200px]:hidden"
              onClick={handleClose}
              aria-hidden
            />
          ) : null}
          <motion.div
            initial={embedded ? false : { x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={embedded ? undefined : { x: '100%', opacity: 1 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className={
              embedded
                ? 'flex h-full min-h-0 w-full flex-col overflow-hidden border-l border-[var(--theme-border)] bg-[var(--theme-card)]'
                : 'fixed bottom-0 right-0 top-[var(--titlebar-h,0px)] z-20 flex h-[calc(100dvh-var(--titlebar-h,0px))] max-h-[calc(100dvh-var(--titlebar-h,0px))] w-[420px] max-w-[100vw] flex-col overflow-hidden border-l border-[var(--theme-border)] bg-[var(--theme-card)] shadow-xl'
            }
          >
            {/* Row 1: mode tabs (Inspector / Chat) in regular Hanken font, not mono
                caps. v1.6 polish: shed mono-cap editorial label for human
                text so the chrome reads as product, not scientific datasheet. */}
            <div
              className="flex h-9 shrink-0 items-stretch border-b border-[var(--theme-border-subtle)] bg-[var(--theme-card)]"
              style={{ fontFamily: 'var(--font-hanken)' }}
            >
              {(
                [
                  ['inspector', 'Inspector'],
                  ['chat', 'Chat'],
                ] as Array<[RightPanelMode, string]>
              ).map(([mode, label]) => {
                const active = rightPanelMode === mode
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setRightPanelMode(mode)}
                    aria-current={active ? 'true' : undefined}
                    className={cn(
                      'flex items-center px-4 text-[12px] uppercase tracking-[0.06em] font-[600]',
                      active
                        ? 'border-b-2 border-[var(--theme-accent)] text-[var(--theme-text)]'
                        : 'text-[var(--theme-muted)] hover:text-[var(--theme-text)]',
                    )}
                  >
                    {label}
                  </button>
                )
              })}
              <div className="ml-auto flex items-center gap-0.5 pr-2">
                {!embedded ? (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={handleClose}
                    className="text-[var(--theme-muted)] hover:text-[var(--theme-text)]"
                    aria-label="Close right panel"
                  >
                    <X size={14} />
                  </Button>
                ) : null}
              </div>
            </div>

            {/* Row 2 (chat mode): Chat sub-tab on the left + menu on the right.
                v1.6 polish: no INSPECTOR / CHAT sub-tabs. Single 'Chat'
                label sits to the left, then the session title (which expands
                a non-button row list), then the action cluster. */}
            {rightPanelMode === 'chat' ? (
              <div
                className="flex h-9 shrink-0 items-center gap-2 border-b border-[var(--theme-border)] bg-[var(--theme-card)] pl-0 pr-3"
                style={{ fontFamily: 'var(--font-hanken)' }}
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setShowSessionList((v) => !v)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setShowSessionList((v) => !v)
                    }
                  }}
                  className="pl-4 flex-1 self-stretch px-3 text-left text-[13px] text-[var(--theme-muted)] hover:bg-[var(--theme-card2)] cursor-pointer truncate flex items-center"
                  title={panelTitle}
                >
                  {panelTitle}
                </div>
                <div className="flex items-center gap-0.5">
                  <TooltipProvider>
                    <TooltipRoot>
                      <TooltipTrigger
                        onClick={handleNewChat}
                        render={
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            className="text-[var(--theme-muted)] hover:text-[var(--theme-text)]"
                            aria-label="New chat"
                          >
                            <PencilSimple size={14} />
                          </Button>
                        }
                      />
                      <TooltipContent side="bottom">New chat</TooltipContent>
                    </TooltipRoot>
                    <TooltipRoot>
                      <TooltipTrigger
                        onClick={handleExpand}
                        render={
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            className="text-[var(--theme-muted)] hover:text-[var(--theme-text)]"
                            aria-label="Expand to full chat"
                          >
                            <ArrowsOut size={14} />
                          </Button>
                        }
                      />
                      <TooltipContent side="bottom">Full view</TooltipContent>
                    </TooltipRoot>
                  </TooltipProvider>
                </div>
              </div>
            ) : null}

            {/* Body */}
            {rightPanelMode === 'chat' ? (
              <>
                <AnimatePresence>
                  {showSessionList && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="border-b border-[var(--theme-border)] overflow-hidden bg-[var(--theme-card)]"
                    >
                      <div className="max-h-48 overflow-y-auto py-1">
                        {sessions.map((s) => (
                          <div
                            key={s.key}
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                              handleSelectSession(s.friendlyId)
                              setShowSessionList(false)
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                handleSelectSession(s.friendlyId)
                                setShowSessionList(false)
                              }
                            }}
                            className={cn(
                              'flex cursor-pointer items-center justify-between px-3 py-1.5 text-xs truncate transition-colors',
                              s.friendlyId === activeFriendlyId
                                ? 'bg-[var(--theme-accent-subtle)] text-[var(--theme-text)]'
                                : 'text-[var(--theme-muted)] hover:bg-[var(--theme-card2)] hover:text-[var(--theme-text)]',
                            )}
                          >
                            <span className="truncate">
                              {s.label || s.title || s.derivedTitle || s.friendlyId}
                            </span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="relative flex flex-1 min-h-0 flex-col overflow-hidden">
                  {legalContext ? (
                    <div className="border-b border-[var(--theme-border)] px-3 py-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-xs font-semibold text-[var(--theme-text)]">
                            {legalContext.title}
                          </div>
                          <div
                            className="mt-0.5 truncate text-[11px] text-[var(--theme-muted)]"
                            style={{ fontFamily: 'var(--font-mono-studio)' }}
                          >
                            {legalContext.contextType || 'source'} ·{' '}
                            {legalContext.posture ||
                              legalContext.lifecycleState ||
                              'unresolved'}{' '}
                            · {legalContext.comparisonClass || 'comparison pending'}
                          </div>
                        </div>
                        <span
                          className="shrink-0 rounded border border-[var(--theme-border)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--theme-muted)]"
                          style={{ fontFamily: 'var(--font-mono-studio)' }}
                        >
                          Legal
                        </span>
                      </div>
                    </div>
                  ) : null}
                  <ChatScreen
                    key={activeFriendlyId}
                    activeFriendlyId={activeFriendlyId}
                    isNewChat={isNewChat}
                    forcedSessionKey={forcedSessionKey}
                    onSessionResolved={
                      isNewChat ? handleSessionResolved : undefined
                    }
                    compact
                    embedded
                  />
                </div>
              </>
            ) : (
              <InspectorBody pathname={pathname} isWorkbench={isWorkbenchRoute(pathname)} />
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

/**
 * Inspector body. On workbench routes this is the place where KG-native
 * metrics and properties render (driven by per-route selection state from
 * the workbench store; deferred until each workbench exposes a
 * `inspectedSelection` surface). Elsewhere it is a route-context placeholder.
 */
function InspectorBody({ pathname, isWorkbench }: { pathname: string; isWorkbench: boolean }) {
  return (
    <div className="flex-1 overflow-y-auto bg-[var(--theme-card)] p-4">
      <div
        className="text-[11px] uppercase tracking-[0.18em] text-[var(--theme-muted)]"
        style={{ fontFamily: 'var(--font-mono-studio)' }}
      >
        {isWorkbench ? 'No selection' : 'No inspection target on this route'}
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-[var(--theme-muted)]">
        {isWorkbench
          ? 'Select a node or edge in the workbench to inspect its properties, evidence, and lifecycle state.'
          : `Inspector follows the active workbench. The current route (${pathname}) does not expose an inspected selection.`}
      </p>
      {isWorkbench ? (
        <div
          className="mt-4 rounded border border-[var(--theme-border)] bg-[var(--theme-card2)] p-3"
          style={{ borderRadius: 'var(--radius-editorial-card, 6px)' }}
        >
          <div
            className="mb-2 text-[10px] uppercase tracking-[0.16em] text-[var(--theme-muted)]"
            style={{ fontFamily: 'var(--font-mono-studio)' }}
          >
            Properties · empty
          </div>
          <div
            className="text-[11px] text-[var(--theme-muted)]"
            style={{ fontFamily: 'var(--font-mono-studio)' }}
          >
            awaiting selection
          </div>
        </div>
      ) : null}
    </div>
  )
}
