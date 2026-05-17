import { createFileRoute } from '@tanstack/react-router'
import {
  allowedSemantierAuthCookieNamesForPath,
  buildSemantierAgentProxyHeaders,
  buildSemantierAgentProxyResponse,
  semantierAgentAuthHeaders,
  withSemantierAgentBase,
} from '../../../server/semantier-agent-api'

function jsonUnauthorizedResponse(
  message = 'Unauthorized',
  status = 401,
) {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function hasCookie(request: Request, name: string): boolean {
  const cookieHeader = request.headers.get('cookie')
  if (!cookieHeader) return false
  return cookieHeader
    .split(';')
    .map((item) => item.trim())
    .some((item) => item.startsWith(`${name}=`))
}

function shouldForceMessagingJsonUnauthorized(request: Request, splat: string): boolean {
  const targetPath = splat.startsWith('/') ? splat : `/${splat}`
  if (!targetPath.startsWith('/messaging/')) {
    return false
  }
  return !hasCookie(request, 'vt_session')
}

// Paths that may involve gateway restarts and need a longer timeout.
const LONG_TIMEOUT_PATHS = ['/messaging/weixin/reconnect', '/messaging/weixin/login']

function proxyTimeoutMs(targetPath: string): number {
  const normalized = targetPath.startsWith('/') ? targetPath : `/${targetPath}`
  if (LONG_TIMEOUT_PATHS.some((p) => normalized.startsWith(p))) {
    return 60_000
  }
  return 10_000
}

async function proxyRequest(request: Request, splat: string) {
  const incomingUrl = new URL(request.url)
  const targetPath = splat.startsWith('/') ? splat : `/${splat}`
  const targetUrl = new URL(withSemantierAgentBase(targetPath))
  targetUrl.search = incomingUrl.search

  const headers = buildSemantierAgentProxyHeaders(request.headers, {
    authHeaders: semantierAgentAuthHeaders(),
    forwardBrowserCookies: true,
    allowedCookieNames: allowedSemantierAuthCookieNamesForPath(targetPath),
  })

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: 'manual',
    signal: AbortSignal.timeout(proxyTimeoutMs(targetPath)),
  }

  if (!['GET', 'HEAD'].includes(request.method.toUpperCase())) {
    init.body = await request.text()
  }

  try {
    const upstream = await fetch(targetUrl, init)
    const body = await upstream.text()
    return buildSemantierAgentProxyResponse(body, upstream)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Agent backend unreachable'
    return jsonUnauthorizedResponse(message, 503)
  }
}

export const Route = createFileRoute('/api/semantier-proxy/$')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        if (shouldForceMessagingJsonUnauthorized(request, params._splat || '')) {
          return jsonUnauthorizedResponse()
        }
        return proxyRequest(request, params._splat || '')
      },
      POST: async ({ request, params }) => {
        if (shouldForceMessagingJsonUnauthorized(request, params._splat || '')) {
          return jsonUnauthorizedResponse()
        }
        return proxyRequest(request, params._splat || '')
      },
      PATCH: async ({ request, params }) => {
        if (shouldForceMessagingJsonUnauthorized(request, params._splat || '')) {
          return jsonUnauthorizedResponse()
        }
        return proxyRequest(request, params._splat || '')
      },
      PUT: async ({ request, params }) => {
        if (shouldForceMessagingJsonUnauthorized(request, params._splat || '')) {
          return jsonUnauthorizedResponse()
        }
        return proxyRequest(request, params._splat || '')
      },
      DELETE: async ({ request, params }) => {
        if (shouldForceMessagingJsonUnauthorized(request, params._splat || '')) {
          return jsonUnauthorizedResponse()
        }
        return proxyRequest(request, params._splat || '')
      },
    },
  },
})
