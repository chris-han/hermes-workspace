import {
  buildSemantierAgentProxyHeaders,
  withSemantierAgentBase,
} from './semantier-agent-api'

const AUTH_COOKIE_NAMES = ['vt_session']

export class SemantierSessionApiError extends Error {
  status: number
  path: string

  constructor(path: string, status: number, message: string) {
    super(`Semantier sessions ${path}: ${message}`)
    this.name = 'SemantierSessionApiError'
    this.status = status
    this.path = path
  }
}

export type SemantierSession = {
  key: string
  friendlyId: string
  label?: string
  title?: string
  derivedTitle?: string
  status?: string
  source?: string | null
  model?: string | null
  isActive?: boolean
  messageCount?: number
  channel?: string
  createdAt?: number
  updatedAt?: number
  lastAttemptId?: string
}

export type SemantierMessage = {
  id?: number | string
  messageId?: string
  sessionKey: string
  role: string
  content: string
  createdAt?: string
  timestamp?: number
  linkedAttemptId?: string
  metadata?: Record<string, unknown>
}

export type SemantierSendMessageResponse = {
  messageId?: string
  attemptId?: string
}

type SemantierCreateSessionResponse = {
  ok: boolean
  sessionKey: string
  friendlyId: string
  entry: SemantierSession
  modelApplied?: boolean
}

type SemantierUpdateSessionResponse = {
  ok: boolean
  sessionKey: string
  entry: SemantierSession
}

type RawSemantierSessionDetail = {
  id?: string
  session_id?: string
  title?: string
  is_active?: boolean
  started_at?: number
  last_active?: number
}

type RawSemantierMessage = {
  id?: number | string
  message_id?: string
  session_id?: string
  role?: string
  content?: string
  created_at?: string
  timestamp?: number
  linked_attempt_id?: string
  metadata?: Record<string, unknown>
}

type RawSemantierMessagesResponse =
  | Array<RawSemantierMessage>
  | {
      session_id?: string
      messages?: Array<RawSemantierMessage>
    }

type RawSemantierSendMessageResponse = {
  message_id?: string
  attempt_id?: string
}

function buildSessionHeaders(requestHeaders?: HeadersInit | Headers): Headers {
  return buildSemantierAgentProxyHeaders(requestHeaders ?? {}, {
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

async function semantierJson<T>(
  path: string,
  init?: RequestInit,
  requestHeaders?: HeadersInit | Headers,
): Promise<T> {
  const headers = buildSessionHeaders(requestHeaders)
  const requestInitHeaders = new Headers(init?.headers)
  for (const [key, value] of requestInitHeaders.entries()) {
    headers.set(key, value)
  }

  const response = await fetch(withSemantierAgentBase(path), {
    ...init,
    headers,
  })
  if (!response.ok) {
    throw new SemantierSessionApiError(
      path,
      response.status,
      await readError(response),
    )
  }
  return response.json() as Promise<T>
}

export function isSemantierSessionNotFoundError(error: unknown): boolean {
  if (error instanceof SemantierSessionApiError) {
    return error.status === 404
  }
  if (!(error instanceof Error)) {
    return false
  }
  return /\bnot found\b/i.test(error.message)
}

function toMillis(value: string | number | undefined): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string' || !value) return undefined
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

export function getSemantierSessionKey(session: SemantierSession): string {
  const candidates = [session.key, session.friendlyId]
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue
    const trimmed = candidate.trim()
    if (trimmed) return trimmed
  }
  return ''
}

export function toSemantierSessionSummary(
  session: SemantierSession,
): Record<string, unknown> {
  const key = getSemantierSessionKey(session)
  const label = session.label || session.title || session.derivedTitle || key
  const updatedAt =
    toMillis(session.updatedAt) ??
    toMillis(session.createdAt) ??
    Date.now()
  return {
    key,
    friendlyId: key,
    kind: 'chat',
    status: session.status || 'idle',
    label,
    title: session.title || label,
    derivedTitle: session.derivedTitle || session.title || label,
    updatedAt,
    createdAt:
      toMillis(session.createdAt) ??
      updatedAt ??
      Date.now(),
  }
}

export function toSemantierChatMessage(
  message: SemantierMessage,
  historyIndex?: number,
): Record<string, unknown> {
  const timestamp =
    (typeof message.timestamp === 'number' && Number.isFinite(message.timestamp)
      ? message.timestamp * 1000
      : undefined) ??
    toMillis(message.createdAt) ??
    Date.now()
  const content: Array<Record<string, unknown>> = [
    { type: 'text', text: message.content || '' },
  ]
  const uiSchema =
    message.metadata && typeof message.metadata === 'object'
      ? (message.metadata.ui_schema as unknown)
      : undefined
  if (uiSchema && typeof uiSchema === 'object' && !Array.isArray(uiSchema)) {
    content.push({
      type: 'a2ui',
      schema: uiSchema as Record<string, unknown>,
    })
  }

  return {
    id: `msg-${message.messageId || message.id || historyIndex || 'unknown'}`,
    role: message.role,
    content,
    text: message.content || '',
    timestamp,
    createdAt:
      message.createdAt ||
      (typeof message.timestamp === 'number'
        ? new Date(message.timestamp * 1000).toISOString()
        : undefined),
    sessionKey: message.sessionKey,
    linkedAttemptId: message.linkedAttemptId,
    metadata: message.metadata,
    ...(typeof historyIndex === 'number'
      ? { __historyIndex: historyIndex }
      : {}),
  }
}

export async function listSemantierSessions(
  requestHeaders?: HeadersInit | Headers,
  limit = 50,
): Promise<Array<SemantierSession>> {
  return semantierJson<Array<SemantierSession>>(
    `/sessions?limit=${limit}`,
    { method: 'GET' },
    requestHeaders,
  )
}

export async function getSemantierSession(
  requestHeaders: HeadersInit | Headers | undefined,
  sessionId: string,
): Promise<SemantierSession> {
  const payload = await semantierJson<RawSemantierSessionDetail>(
    `/api/sessions/${encodeURIComponent(sessionId)}`,
    { method: 'GET' },
    requestHeaders,
  )
  const key = payload.id?.trim() || payload.session_id?.trim() || sessionId
  const title = typeof payload.title === 'string' ? payload.title : undefined
  return {
    key,
    friendlyId: key,
    title,
    label: title,
    derivedTitle: title,
    status:
      typeof payload.is_active === 'boolean'
        ? payload.is_active
          ? 'active'
          : 'idle'
        : undefined,
    createdAt:
      typeof payload.started_at === 'number'
        ? Math.floor(payload.started_at * 1000)
        : undefined,
    updatedAt:
      typeof payload.last_active === 'number'
        ? Math.floor(payload.last_active * 1000)
        : typeof payload.started_at === 'number'
          ? Math.floor(payload.started_at * 1000)
          : undefined,
  }
}

export async function createSemantierSession(
  requestHeaders?: HeadersInit | Headers,
  title?: string,
): Promise<SemantierSession> {
  const payload = await semantierJson<SemantierCreateSessionResponse>(
    '/sessions',
    {
      method: 'POST',
      headers: new Headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        label: title || '',
      }),
    },
    requestHeaders,
  )
  return payload.entry
}

export async function updateSemantierSession(
  requestHeaders: HeadersInit | Headers | undefined,
  sessionId: string,
  title?: string,
): Promise<{ status: string; sessionKey: string }> {
  const payload = await semantierJson<SemantierUpdateSessionResponse>(
    '/sessions',
    {
      method: 'PATCH',
      headers: new Headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ sessionKey: sessionId, label: title ?? '' }),
    },
    requestHeaders,
  )
  return {
    status: payload.ok ? 'ok' : 'error',
    sessionKey: payload.sessionKey,
  }
}

export async function deleteSemantierSession(
  requestHeaders: HeadersInit | Headers | undefined,
  sessionId: string,
): Promise<{ status: string; deleted: Array<string>; missing: Array<string> }> {
  const payload = await semantierJson<{ ok: boolean; sessionKey: string }>(
    `/sessions?sessionKey=${encodeURIComponent(sessionId)}`,
    {
      method: 'DELETE',
    },
    requestHeaders,
  )
  return {
    status: payload.ok ? 'ok' : 'error',
    deleted: payload.ok ? [payload.sessionKey] : [],
    missing: payload.ok ? [] : [sessionId],
  }
}

export async function getSemantierSessionMessages(
  requestHeaders: HeadersInit | Headers | undefined,
  sessionId: string,
  limit = 200,
): Promise<Array<SemantierMessage>> {
  const payload = await semantierJson<RawSemantierMessagesResponse>(
    `/api/sessions/${encodeURIComponent(sessionId)}/messages?limit=${limit}`,
    { method: 'GET' },
    requestHeaders,
  )
  const rows = Array.isArray(payload) ? payload : (payload.messages ?? [])
  const resolvedSessionId =
    !Array.isArray(payload) &&
    typeof payload.session_id === 'string' &&
    payload.session_id.trim().length > 0
      ? payload.session_id.trim()
      : sessionId

  return rows.map((message) => ({
    id: message.id,
    messageId: message.message_id,
    sessionKey: message.session_id?.trim() || resolvedSessionId,
    role: message.role || 'assistant',
    content: message.content || '',
    createdAt: message.created_at,
    timestamp: message.timestamp,
    linkedAttemptId: message.linked_attempt_id,
    metadata: message.metadata,
  }))
}

export async function sendSemantierSessionMessage(
  requestHeaders: HeadersInit | Headers | undefined,
  sessionId: string,
  content: string,
): Promise<SemantierSendMessageResponse> {
  const payload = await semantierJson<RawSemantierSendMessageResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/messages`,
    {
      method: 'POST',
      headers: new Headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ content }),
    },
    requestHeaders,
  )
  return {
    messageId: payload.message_id,
    attemptId: payload.attempt_id,
  }
}

export async function openSemantierSessionEvents(
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
  const response = await fetch(withSemantierAgentBase(path), {
    method: 'GET',
    headers,
    signal: options?.signal,
  })
  if (!response.ok) {
    throw new SemantierSessionApiError(
      path,
      response.status,
      await readError(response),
    )
  }
  return response
}
