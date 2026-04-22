import { createFileRoute } from '@tanstack/react-router'
import { isAuthenticated } from '../../../server/auth-middleware'
import {
  SEMANTIER_AGENT_AUTH_COOKIE,
  buildSemantierAgentProxyHeaders,
  buildSemantierAgentProxyResponseHeaders,
  semantierAgentAuthHeaders,
  withSemantierAgentBase,
} from '../../../server/semantier-agent-api'

function jsonUnauthorizedResponse() {
  return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
    status: 401,
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
  return !hasCookie(request, SEMANTIER_AGENT_AUTH_COOKIE)
}

async function proxyRequest(request: Request, splat: string) {
  const incomingUrl = new URL(request.url)
  const targetPath = splat.startsWith('/') ? splat : `/${splat}`
  const targetUrl = new URL(withSemantierAgentBase(targetPath))
  targetUrl.search = incomingUrl.search

  const headers = buildSemantierAgentProxyHeaders(request.headers, {
    authHeaders: semantierAgentAuthHeaders(),
    forwardBrowserCookies: true,
    allowedCookieNames: [SEMANTIER_AGENT_AUTH_COOKIE],
  })

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: 'manual',
  }

  if (!['GET', 'HEAD'].includes(request.method.toUpperCase())) {
    init.body = await request.text()
  }

  const upstream = await fetch(targetUrl, init)
  const body = await upstream.text()
  const responseHeaders = buildSemantierAgentProxyResponseHeaders(
    upstream.headers,
  )

  return new Response(body, {
    status: upstream.status,
    headers: responseHeaders,
  })
}

export const Route = createFileRoute('/api/semantier-proxy/$')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        if (!isAuthenticated(request)) {
          return jsonUnauthorizedResponse()
        }
        if (shouldForceMessagingJsonUnauthorized(request, params._splat || '')) {
          return jsonUnauthorizedResponse()
        }
        return proxyRequest(request, params._splat || '')
      },
      POST: async ({ request, params }) => {
        if (!isAuthenticated(request)) {
          return jsonUnauthorizedResponse()
        }
        if (shouldForceMessagingJsonUnauthorized(request, params._splat || '')) {
          return jsonUnauthorizedResponse()
        }
        return proxyRequest(request, params._splat || '')
      },
      PATCH: async ({ request, params }) => {
        if (!isAuthenticated(request)) {
          return jsonUnauthorizedResponse()
        }
        if (shouldForceMessagingJsonUnauthorized(request, params._splat || '')) {
          return jsonUnauthorizedResponse()
        }
        return proxyRequest(request, params._splat || '')
      },
      PUT: async ({ request, params }) => {
        if (!isAuthenticated(request)) {
          return jsonUnauthorizedResponse()
        }
        if (shouldForceMessagingJsonUnauthorized(request, params._splat || '')) {
          return jsonUnauthorizedResponse()
        }
        return proxyRequest(request, params._splat || '')
      },
      DELETE: async ({ request, params }) => {
        if (!isAuthenticated(request)) {
          return jsonUnauthorizedResponse()
        }
        if (shouldForceMessagingJsonUnauthorized(request, params._splat || '')) {
          return jsonUnauthorizedResponse()
        }
        return proxyRequest(request, params._splat || '')
      },
    },
  },
})
