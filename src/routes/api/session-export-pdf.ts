import { createFileRoute } from '@tanstack/react-router'
import { mdToPdf } from 'md-to-pdf'

import { isAuthenticated } from '../../server/auth-middleware'
import { resolveSessionKey } from '../../server/session-utils'
import {
  getSemantierSessionMessages,
  isSemantierSessionNotFoundError,
  listSemantierSessions,
  toSemantierChatMessage,
} from '../../server/semantier-session-api'
import type { ChatMessage } from '../../screens/chat/types'

const PDF_MIME_TYPE = 'application/pdf'

function normalizeTextFromMessage(message: ChatMessage): string {
  const parts = Array.isArray(message.content) ? message.content : []
  let raw = parts
    .map((part) => (part.type === 'text' ? String(part.text ?? '') : ''))
    .join('')
    .trim()

  if (!raw) {
    const source = message as Record<string, unknown>
    for (const key of ['text', 'body', 'message']) {
      const value = source[key]
      if (typeof value === 'string' && value.trim()) {
        raw = value.trim()
        break
      }
    }
  }

  return raw
}

function sanitizeFilename(value: string): string {
  return (
    value
      .trim()
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/\s+/g, ' ')
      .replace(/^-+|-+$/g, '') || 'conversation'
  )
}

function buildMarkdownTranscript(payload: {
  sessionLabel: string
  messages: Array<ChatMessage>
}): string {
  const lines: Array<string> = [
    `# ${payload.sessionLabel}`,
    '',
    `Exported: ${new Date().toISOString()}`,
    '',
  ]

  if (payload.messages.length === 0) {
    lines.push('_No messages in this conversation._')
    return lines.join('\n')
  }

  for (const message of payload.messages) {
    const role =
      typeof message.role === 'string' && message.role.trim()
        ? message.role.trim().toUpperCase()
        : 'MESSAGE'
    lines.push(`## ${role}`)
    lines.push('')

    const text = normalizeTextFromMessage(message)
    if (text) {
      lines.push(text)
      lines.push('')
    } else {
      lines.push('_No text content_')
      lines.push('')
    }

    const attachments = Array.isArray(message.attachments)
      ? message.attachments
          .map((attachment) => attachment?.name?.trim())
          .filter((value): value is string => Boolean(value))
      : []

    if (attachments.length > 0) {
      lines.push('Attachments:')
      lines.push('')
      for (const attachment of attachments) {
        lines.push(`- ${attachment}`)
      }
      lines.push('')
    }
  }

  return lines.join('\n').trim()
}

export const Route = createFileRoute('/api/session-export-pdf')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'content-type': 'application/json' },
          })
        }

        try {
          const url = new URL(request.url)
          const rawSessionKey = url.searchParams.get('sessionKey')?.trim()
          const friendlyId = url.searchParams.get('friendlyId')?.trim()
          const title = url.searchParams.get('title')?.trim() || 'Conversation'

          let { sessionKey } = await resolveSessionKey({
            rawSessionKey,
            friendlyId,
            defaultKey: 'main',
          })

          if (sessionKey === 'main') {
            const sessions = await listSemantierSessions(request.headers, 1)
            if (sessions.length === 0) {
              return new Response(
                JSON.stringify({ error: 'No conversation found to export' }),
                {
                  status: 404,
                  headers: { 'content-type': 'application/json' },
                },
              )
            }
            sessionKey = sessions[0].session_id
          }

          if (sessionKey === 'new') {
            return new Response(
              JSON.stringify({ error: 'No conversation found to export' }),
              {
                status: 404,
                headers: { 'content-type': 'application/json' },
              },
            )
          }

          let sourceMessages
          try {
            sourceMessages = await getSemantierSessionMessages(
              request.headers,
              sessionKey,
              1000,
            )
          } catch (error) {
            if (isSemantierSessionNotFoundError(error)) {
              return new Response(
                JSON.stringify({ error: 'Conversation no longer exists' }),
                {
                  status: 404,
                  headers: { 'content-type': 'application/json' },
                },
              )
            }
            throw error
          }

          const messages = sourceMessages.map((message, index) =>
            toSemantierChatMessage(message, index),
          )
          const markdown = buildMarkdownTranscript({
            sessionLabel: title,
            messages,
          })

          const pdf = await mdToPdf(
            { content: markdown },
            {
              body_class: ['markdown-body'],
              marked_options: {
                gfm: true,
                breaks: true,
              },
              css: `
                body {
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
                  color: #0f172a;
                  line-height: 1.6;
                  padding: 0;
                }
                .markdown-body {
                  font-size: 13px;
                  max-width: 100%;
                  word-break: break-word;
                }
                .markdown-body table {
                  width: 100%;
                  border-collapse: collapse;
                  table-layout: fixed;
                  margin: 16px 0;
                }
                .markdown-body th,
                .markdown-body td {
                  border: 1px solid #cbd5e1;
                  padding: 8px 10px;
                  vertical-align: top;
                  word-break: break-word;
                }
                .markdown-body th {
                  background: #e2e8f0;
                }
                .markdown-body pre {
                  background: #f8fafc;
                  border: 1px solid #e2e8f0;
                  border-radius: 8px;
                  padding: 12px;
                  overflow-wrap: anywhere;
                  white-space: pre-wrap;
                }
                .markdown-body code {
                  font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
                  font-size: 0.92em;
                }
                .markdown-body blockquote {
                  margin: 16px 0;
                  padding-left: 12px;
                  border-left: 4px solid #cbd5e1;
                  color: #475569;
                }
                .markdown-body h1,
                .markdown-body h2,
                .markdown-body h3 {
                  page-break-after: avoid;
                }
              `,
              pdf_options: {
                format: 'A4',
                margin: {
                  top: '14mm',
                  right: '12mm',
                  bottom: '14mm',
                  left: '12mm',
                },
                printBackground: true,
              },
              launch_options: {
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
              },
            },
          )

          if (!pdf?.content) {
            throw new Error('Failed to generate PDF output')
          }

          const pdfBytes = new Uint8Array(pdf.content)
          const filename = `${sanitizeFilename(title)}.pdf`
          return new Response(pdfBytes, {
            status: 200,
            headers: {
              'content-type': PDF_MIME_TYPE,
              'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
              'cache-control': 'no-store',
            },
          })
        } catch (error) {
          return new Response(
            JSON.stringify({
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to export conversation as PDF',
            }),
            {
              status: 500,
              headers: { 'content-type': 'application/json' },
            },
          )
        }
      },
    },
  },
})
