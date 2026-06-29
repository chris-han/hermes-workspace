export const SEMANTIER_AGENT_API =
  process.env.SEMANTIER_AGENT_API_URL || 'http://127.0.0.1:8899'

export const SEMANTIER_AGENT_AUTH_COOKIE = 'vt_session'
export const SEMANTIER_AGENT_BROWSER_SESSION_COOKIE = 'vt_browser_session'

export const SEMANTIER_AGENT_API_KEY =
  process.env.SEMANTIER_AGENT_API_KEY || process.env.API_AUTH_KEY || ''

function filterCookieHeader(
  cookieHeader: string | null,
  allowedCookieNames: Array<string>,
): string | null {
  if (!cookieHeader) return null

  const allowed = new Set(
    allowedCookieNames.map((name) => name.trim()).filter(Boolean),
  )
  if (allowed.size === 0) return null

  const filtered = cookieHeader
    .split(';')
    .map((cookie) => cookie.trim())
    .filter((cookie) => {
      const separatorIndex = cookie.indexOf('=')
      const name =
        separatorIndex >= 0 ? cookie.slice(0, separatorIndex).trim() : cookie
      return allowed.has(name)
    })

  return filtered.length > 0 ? filtered.join('; ') : null
}

function envFlagEnabled(name: string): boolean {
  const value = process.env[name]?.trim().toLowerCase()
  return value === '1' || value === 'true' || value === 'yes' || value === 'on'
}

function splitSetCookieHeader(value: string): Array<string> {
  const out: Array<string> = []
  let start = 0
  let i = 0
  while (i < value.length) {
    if (value[i] === ',') {
      const rest = value.slice(i + 1)
      if (/^\s*[!#$%&'*+\-.^_`|~0-9A-Za-z]+=/.test(rest)) {
        out.push(value.slice(start, i).trim())
        start = i + 1
      }
    }
    i += 1
  }
  out.push(value.slice(start).trim())
  return out.filter(Boolean)
}

function getSetCookieValues(upstreamHeaders: Headers): Array<string> {
  const headersWithSetCookie = upstreamHeaders as {
    getSetCookie?: () => Array<string>
  }
  if (typeof headersWithSetCookie.getSetCookie === 'function') {
    const setCookies = headersWithSetCookie.getSetCookie()
    if (setCookies.length > 0) {
      return setCookies
    }
  }
  const setCookie = upstreamHeaders.get('set-cookie')
  return setCookie ? splitSetCookieHeader(setCookie) : []
}

export function semantierAgentAuthHeaders(): Record<string, string> {
  return SEMANTIER_AGENT_API_KEY
    ? { Authorization: `Bearer ${SEMANTIER_AGENT_API_KEY}` }
    : {}
}

export function buildSemantierAgentProxyHeaders(
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
    envFlagEnabled('SEMANTIER_AGENT_FORWARD_BROWSER_COOKIES')
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
    options?.authHeaders ?? semantierAgentAuthHeaders(),
  )) {
    if (!headers.has(key)) {
      headers.set(key, value)
    }
  }

  return headers
}

export function buildSemantierAgentProbeHeaders(
  targetPath: string,
  incomingCookieHeader: string | null,
): Headers {
  const incomingHeaders: HeadersInit = incomingCookieHeader
    ? { cookie: incomingCookieHeader }
    : {}
  return buildSemantierAgentProxyHeaders(incomingHeaders, {
    authHeaders: semantierAgentAuthHeaders(),
    forwardBrowserCookies: true,
    allowedCookieNames: allowedSemantierAuthCookieNamesForPath(targetPath),
  })
}

export function buildSemantierAgentProxyResponseHeaders(
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

  for (const setCookie of getSetCookieValues(upstreamHeaders)) {
    headers.append('set-cookie', setCookie)
  }

  return headers
}

export function buildSemantierAgentProxyResponse(
  body: BodyInit | null | undefined,
  upstream: Response,
): Response {
  const response = new Response(body, {
    status: upstream.status,
    headers: buildSemantierAgentProxyResponseHeaders(upstream.headers),
  })
  for (const setCookie of getSetCookieValues(upstream.headers)) {
    response.headers.append('set-cookie', setCookie)
  }
  return response
}

export function withSemantierAgentBase(path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  return `${SEMANTIER_AGENT_API}${path.startsWith('/') ? path : `/${path}`}`
}

export function allowedSemantierAuthCookieNamesForPath(
  targetPath: string,
): Array<string> {
  const normalized = targetPath.startsWith('/') ? targetPath : `/${targetPath}`
  if (
    normalized.startsWith('/auth/weixin/login/') ||
    normalized === '/auth/weixin/login' ||
    normalized.startsWith('/auth/feishu/login/') ||
    normalized === '/auth/feishu/login'
  ) {
    return [SEMANTIER_AGENT_AUTH_COOKIE, SEMANTIER_AGENT_BROWSER_SESSION_COOKIE]
  }
  return [SEMANTIER_AGENT_AUTH_COOKIE]
}
