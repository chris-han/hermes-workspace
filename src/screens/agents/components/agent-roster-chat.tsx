import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUp01Icon, RefreshIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useAgentChat } from '../hooks/use-agent-chat'
import { getAgentRosterSessionKey } from '../hooks/use-agent-roster'
import { Button } from '@/components/ui/button'
import { Markdown } from '@/components/prompt-kit/markdown'
import { cn } from '@/lib/utils'
import { formatRelativeTime } from '@/screens/dashboard/lib/formatters'

export function AgentRosterChat({
  agentId,
  agentName,
}: {
  agentId: string
  agentName: string
}) {
  const [draft, setDraft] = useState('')
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const { messages, sendMessage, isRefreshing, isSending, error, refresh } =
    useAgentChat(getAgentRosterSessionKey(agentId))

  const renderedMessages = useMemo(() => messages.slice(-50), [messages])

  useEffect(() => {
    if (!scrollRef.current) return
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [renderedMessages])

  async function handleSend() {
    const message = draft.trim()
    if (!message || isSending) return
    await sendMessage(message)
    setDraft('')
  }

  return (
    <section className="rounded-card border border-[var(--theme-border)] bg-[var(--theme-card)] p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-[var(--theme-text)]">
            Chat
          </h3>
          <p className="mt-1 text-sm text-[var(--theme-muted-2)]">
            Persistent session with {agentName}
          </p>
        </div>
        <Button
          variant="secondary"
          className="border border-[var(--theme-border)] bg-[var(--theme-bg)] text-[var(--theme-text)] hover:bg-[var(--theme-card2)]"
          onClick={() => void refresh()}
        >
          <HugeiconsIcon
            icon={RefreshIcon}
            size={16}
            strokeWidth={1.8}
            className={cn(isRefreshing && 'animate-spin')}
          />
          Refresh
        </Button>
      </div>

      <div
        ref={scrollRef}
        className="mt-4 max-h-[26rem] space-y-3 overflow-y-auto rounded-card border border-[var(--theme-border)] bg-[var(--theme-bg)] p-4"
      >
        {renderedMessages.length > 0 ? (
          renderedMessages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'rounded-md border px-4 py-3 text-sm',
                message.role === 'user'
                  ? 'ml-auto max-w-[90%] border-[var(--theme-accent)] bg-[var(--theme-accent-soft)] text-[var(--theme-text)]'
                  : 'max-w-[95%] border-[var(--theme-border)] bg-[var(--theme-card)] text-[var(--theme-text)]',
              )}
            >
              <div className="mb-2 flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--theme-muted)]">
                <span>{message.role}</span>
                {message.timestamp ? (
                  <span>{formatRelativeTime(message.timestamp)}</span>
                ) : null}
              </div>
              {message.role === 'assistant' ? (
                <Markdown>{message.content}</Markdown>
              ) : (
                <p className="whitespace-pre-wrap leading-relaxed">
                  {message.content}
                </p>
              )}
            </div>
          ))
        ) : (
          <p className="text-sm text-[var(--theme-muted)]">
            No messages yet. Start the conversation with this agent.
          </p>
        )}
      </div>

      {error ? (
        <p className="mt-3 text-sm text-[var(--theme-danger)]">{error}</p>
      ) : null}

      <div className="mt-4 flex items-end gap-3">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              void handleSend()
            }
          }}
          placeholder="Type a message..."
          className="min-h-[112px] flex-1 resize-y rounded-md border border-[var(--theme-border)] bg-[var(--theme-bg)] px-4 py-3 text-sm text-[var(--theme-text)] outline-none placeholder:text-[var(--theme-muted)] focus:ring-2 focus:ring-[var(--theme-accent)]"
        />
        <Button
          className="cursor-pointer bg-[var(--theme-accent)] text-[var(--theme-accent-foreground)] hover:bg-[var(--theme-accent-strong)]"
          onClick={() => void handleSend()}
          disabled={!draft.trim() || isSending}
        >
          <HugeiconsIcon icon={ArrowUp01Icon} size={16} strokeWidth={1.8} />
          {isSending ? 'Sending…' : 'Send'}
        </Button>
      </div>
    </section>
  )
}
