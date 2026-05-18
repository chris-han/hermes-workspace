import { createFileRoute } from '@tanstack/react-router'
import {
  SEMANTIER_AGENT_AUTH_COOKIE,
  SEMANTIER_AGENT_BROWSER_SESSION_COOKIE,
  allowedSemantierAuthCookieNamesForPath,
  buildSemantierAgentProxyHeaders,
  buildSemantierAgentProxyResponse,
  withSemantierAgentBase,
} from '../../server/semantier-agent-api'

const DEFAULT_AUTH_PROXY_TIMEOUT_MS = 5_000
const WEIXIN_AUTH_PROXY_TIMEOUT_MS = 20_000
const LOGOUT_COOKIE_OPTIONS = 'Max-Age=0; Path=/; SameSite=Lax'

export function getAuthProxyTimeoutMs(targetPath: string): number {
  return targetPath.startsWith('/auth/weixin/login/')
    ? WEIXIN_AUTH_PROXY_TIMEOUT_MS
    : DEFAULT_AUTH_PROXY_TIMEOUT_MS
}

async function proxyAuthRequest(request: Request, splat: string) {
  const incomingUrl = new URL(request.url)
  const targetPath = splat ? `/auth/${splat}` : '/auth'
  const targetUrl = new URL(withSemantierAgentBase(targetPath))
  targetUrl.search = incomingUrl.search

  const headers = buildSemantierAgentProxyHeaders(request.headers, {
    authHeaders: {},
    forwardBrowserCookies: true,
    allowedCookieNames: allowedSemantierAuthCookieNamesForPath(targetPath),
  })

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: 'manual',
    signal: AbortSignal.timeout(getAuthProxyTimeoutMs(targetPath)),
  }

  if (!['GET', 'HEAD'].includes(request.method.toUpperCase())) {
    init.body = await request.text()
  }

  try {
    const upstream = await fetch(targetUrl, init)
    const body = await upstream.text()
    const response = buildSemantierAgentProxyResponse(body, upstream)
    if (targetPath === '/auth/logout') {
      response.headers.append(
        'set-cookie',
        `${SEMANTIER_AGENT_BROWSER_SESSION_COOKIE}=""; ${LOGOUT_COOKIE_OPTIONS}`,
      )
      response.headers.append(
        'set-cookie',
        `${SEMANTIER_AGENT_AUTH_COOKIE}=""; ${LOGOUT_COOKIE_OPTIONS}`,
      )
    }
    return response
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Agent backend unreachable'
    return new Response(
      JSON.stringify({ ok: false, error: message }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}

export const Route = createFileRoute('/auth/$')({
  server: {
    handlers: {
      GET: async ({ request, params }) =>
        proxyAuthRequest(request, params._splat || ''),
      POST: async ({ request, params }) =>
        proxyAuthRequest(request, params._splat || ''),
    },
  },
})
