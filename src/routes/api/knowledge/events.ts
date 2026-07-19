import { createFileRoute } from '@tanstack/react-router'

import {
  listRecentKnowledgeEvents,
  subscribeToKnowledgeEvents,
} from '../../../server/knowledge-event-bus'

export const Route = createFileRoute('/api/knowledge/events')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const workspaceId = url.searchParams.get('workspaceId') || undefined
        const encoder = new TextEncoder()
        let streamClosed = false
        let unsubscribe: (() => void) | null = null
        let heartbeatTimer: ReturnType<typeof setInterval> | null = null

        const stream = new ReadableStream({
          start(controller) {
            const sendEvent = (event: string, data: unknown) => {
              if (streamClosed) return
              try {
                controller.enqueue(
                  encoder.encode(
                    `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
                  ),
                )
              } catch {
                streamClosed = true
              }
            }

            sendEvent('connected', { timestamp: Date.now() })
            for (const event of listRecentKnowledgeEvents(
              workspaceId,
            ).reverse()) {
              sendEvent('knowledge_status', event)
            }

            unsubscribe = subscribeToKnowledgeEvents((event) => {
              sendEvent('knowledge_status', event)
            }, workspaceId)

            heartbeatTimer = setInterval(() => {
              sendEvent('heartbeat', { timestamp: Date.now() })
            }, 30_000)
          },
          cancel() {
            streamClosed = true
            if (unsubscribe) {
              unsubscribe()
              unsubscribe = null
            }
            if (heartbeatTimer) {
              clearInterval(heartbeatTimer)
              heartbeatTimer = null
            }
          },
        })

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no',
          },
        })
      },
    },
  },
})
