export let VIBE_AGENT_API =
  process.env.VIBE_AGENT_API_URL || 'http://127.0.0.1:8899'

export const VIBE_AGENT_AUTH_COOKIE = 'vt_session'

export const VIBE_AGENT_API_KEY =
  process.env.VIBE_AGENT_API_KEY || process.env.API_AUTH_KEY || ''

function filterCookieHeader(
  cookieHeader: string | null,
  allowedCookieNames: Array<string>,
): string | null {
  if (!cookieHeader) return null

  const allowed = new Set(allowedCookieNames.map((name) => name.trim()).filter(Boolean))
  if (allowed.size === 0) return null

  const filtered = cookieHeader
    .split(';')
    .map((cookie) => cookie.trim())
    .filter((cookie) => {
      const separatorIndex = cookie.indexOf('=')
      const name = separatorIndex >= 0 ? cookie.slice(0, separatorIndex).trim() : cookie
      return allowed.has(name)
    })

  return filtered.length > 0 ? filtered.join('; ') : null
}

function envFlagEnabled(name: string): boolean {
  const value = process.env[name]?.trim().toLowerCase()
  return value === '1' || value === 'true' || value === 'yes' || value === 'on'
}

export function vibeAgentAuthHeaders(): Record<string, string> {
  return VIBE_AGENT_API_KEY
    ? { Authorization: `Bearer ${VIBE_AGENT_API_KEY}` }
    : {}
}

export function buildVibeAgentProxyHeaders(
  incoming: HeadersInit | Headers,
  options?: {
    authHeaders?: Record<string, string>
    forwardBrowserCookies?: boolean
    allowedCookieNames?: Array<string>
  },
): Headers {
  const headers = new Headers(incoming)
  headers.delete('host')
  headers.delete('content-length')

  const forwardBrowserCookies =
    options?.forwardBrowserCookies ??
    envFlagEnabled('VIBE_AGENT_FORWARD_BROWSER_COOKIES')
  if (!forwardBrowserCookies) {
    headers.delete('cookie')
  } else if (options?.allowedCookieNames?.length) {
    const filteredCookieHeader = filterCookieHeader(
      headers.get('cookie'),
      options.allowedCookieNames,
    )
    if (filteredCookieHeader) {
      headers.set('cookie', filteredCookieHeader)
    } else {
      headers.delete('cookie')
    }
  }

  for (const [key, value] of Object.entries(
    options?.authHeaders ?? vibeAgentAuthHeaders(),
  )) {
    if (!headers.has(key)) {
      headers.set(key, value)
    }
  }

  return headers
}

export function buildVibeAgentProxyResponseHeaders(
  upstreamHeaders: Headers,
): Headers {
  const headers = new Headers()
  const contentType = upstreamHeaders.get('content-type')
  const location = upstreamHeaders.get('location')

  if (contentType) {
    headers.set('content-type', contentType)
  }
  if (location) {
    headers.set('location', location)
  }

  const headersWithSetCookie = upstreamHeaders as Headers & {
    getSetCookie?: () => Array<string>
  }
  const setCookies = headersWithSetCookie.getSetCookie?.()

  if (setCookies && setCookies.length > 0) {
    for (const setCookie of setCookies) {
      headers.append('set-cookie', setCookie)
    }
  } else {
    const setCookie = upstreamHeaders.get('set-cookie')
    if (setCookie) {
      headers.set('set-cookie', setCookie)
    }
  }

  return headers
}

export function withVibeAgentBase(path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  return `${VIBE_AGENT_API}${path.startsWith('/') ? path : `/${path}`}`
}