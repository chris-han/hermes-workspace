import {
  buildVibeAgentProxyHeaders,
  withVibeAgentBase,
} from './vibe-agent-api'

const AUTH_COOKIE_NAMES = ['vt_session']

export type VibeSession = {
  session_id: string
  title?: string
  status?: string
  channel?: string
  created_at?: string
  updated_at?: string
  last_attempt_id?: string
}

export type VibeMessage = {
  message_id: string
  session_id: string
  role: string
  content: string
  created_at: string
  linked_attempt_id?: string
  metadata?: Record<string, unknown>
}

export type VibeSendMessageResponse = {
  message_id: string
  attempt_id?: string
}

function buildSessionHeaders(requestHeaders?: HeadersInit | Headers): Headers {
  return buildVibeAgentProxyHeaders(requestHeaders ?? {}, {
    forwardBrowserCookies: true,
    allowedCookieNames: AUTH_COOKIE_NAMES,
  })
}

async function readError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as Record<string, unknown>
    if (typeof payload.detail === 'string') return payload.detail
    if (typeof payload.error === 'string') return payload.error
    if (typeof payload.message === 'string') return payload.message
    return JSON.stringify(payload)
  } catch {
    return (await response.text().catch(() => '')) || `HTTP ${response.status}`
  }
}

async function vibeJson<T>(
  path: string,
  init?: RequestInit,
  requestHeaders?: HeadersInit | Headers,
): Promise<T> {
  const headers = buildSessionHeaders(requestHeaders)
  const requestInitHeaders = new Headers(init?.headers)
  for (const [key, value] of requestInitHeaders.entries()) {
    headers.set(key, value)
  }

  const response = await fetch(withVibeAgentBase(path), {
    ...init,
    headers,
  })
  if (!response.ok) {
    throw new Error(`Vibe sessions ${path}: ${await readError(response)}`)
  }
  return response.json() as Promise<T>
}

function toMillis(value: string | undefined): number | undefined {
  if (!value) return undefined
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

export function toVibeSessionSummary(
  session: VibeSession,
): Record<string, unknown> {
  const key = session.session_id
  const updatedAt = toMillis(session.updated_at) ?? toMillis(session.created_at)
  return {
    key,
    friendlyId: key,
    kind: 'chat',
    status: session.status || 'idle',
    label: session.title || key,
    title: session.title || key,
    derivedTitle: session.title || key,
    updatedAt,
    createdAt: toMillis(session.created_at) ?? updatedAt ?? Date.now(),
  }
}

export function toVibeChatMessage(
  message: VibeMessage,
  historyIndex?: number,
): Record<string, unknown> {
  const timestamp = toMillis(message.created_at) ?? Date.now()
  return {
    id: `msg-${message.message_id}`,
    role: message.role,
    content: [{ type: 'text', text: message.content || '' }],
    text: message.content || '',
    timestamp,
    createdAt: message.created_at,
    sessionKey: message.session_id,
    linkedAttemptId: message.linked_attempt_id,
    metadata: message.metadata,
    ...(typeof historyIndex === 'number' ? { __historyIndex: historyIndex } : {}),
  }
}

export async function listVibeSessions(
  requestHeaders?: HeadersInit | Headers,
  limit = 50,
): Promise<Array<VibeSession>> {
  return vibeJson<Array<VibeSession>>(
    `/sessions?limit=${limit}`,
    { method: 'GET' },
    requestHeaders,
  )
}

export async function getVibeSession(
  requestHeaders: HeadersInit | Headers | undefined,
  sessionId: string,
): Promise<VibeSession> {
  return vibeJson<VibeSession>(
    `/sessions/${encodeURIComponent(sessionId)}`,
    { method: 'GET' },
    requestHeaders,
  )
}

export async function createVibeSession(
  requestHeaders?: HeadersInit | Headers,
  title?: string,
): Promise<VibeSession> {
  return vibeJson<VibeSession>(
    '/sessions',
    {
      method: 'POST',
      headers: new Headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        title: title || '',
        config: { channel: 'web' },
      }),
    },
    requestHeaders,
  )
}

export async function updateVibeSession(
  requestHeaders: HeadersInit | Headers | undefined,
  sessionId: string,
  title?: string,
): Promise<{ status: string; session_id: string }> {
  return vibeJson<{ status: string; session_id: string }>(
    `/sessions/${encodeURIComponent(sessionId)}`,
    {
      method: 'PATCH',
      headers: new Headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ title: title ?? '' }),
    },
    requestHeaders,
  )
}

export async function deleteVibeSession(
  requestHeaders: HeadersInit | Headers | undefined,
  sessionId: string,
): Promise<{ status: string; deleted: string[]; missing: string[] }> {
  return vibeJson<{ status: string; deleted: string[]; missing: string[] }>(
    '/sessions/batch-delete',
    {
      method: 'POST',
      headers: new Headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ session_ids: [sessionId] }),
    },
    requestHeaders,
  )
}

export async function getVibeSessionMessages(
  requestHeaders: HeadersInit | Headers | undefined,
  sessionId: string,
  limit = 200,
): Promise<Array<VibeMessage>> {
  return vibeJson<Array<VibeMessage>>(
    `/sessions/${encodeURIComponent(sessionId)}/messages?limit=${limit}`,
    { method: 'GET' },
    requestHeaders,
  )
}

export async function sendVibeSessionMessage(
  requestHeaders: HeadersInit | Headers | undefined,
  sessionId: string,
  content: string,
): Promise<VibeSendMessageResponse> {
  return vibeJson<VibeSendMessageResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/messages`,
    {
      method: 'POST',
      headers: new Headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ content }),
    },
    requestHeaders,
  )
}

export async function openVibeSessionEvents(
  requestHeaders: HeadersInit | Headers | undefined,
  sessionId: string,
  options?: {
    lastEventId?: string
    replayExisting?: boolean
    signal?: AbortSignal
  },
): Promise<Response> {
  const headers = buildSessionHeaders(requestHeaders)
  headers.set('accept', 'text/event-stream')
  if (options?.lastEventId?.trim()) {
    headers.set('Last-Event-ID', options.lastEventId.trim())
  }

  const search = new URLSearchParams()
  if (options?.replayExisting) {
    search.set('replay_existing', 'true')
  }

  const path = `/sessions/${encodeURIComponent(sessionId)}/events${search.size > 0 ? `?${search.toString()}` : ''}`
  const response = await fetch(withVibeAgentBase(path), {
    method: 'GET',
    headers,
    signal: options?.signal,
  })
  if (!response.ok) {
    throw new Error(`Vibe sessions ${path}: ${await readError(response)}`)
  }
  return response
}