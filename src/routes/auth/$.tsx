import { createFileRoute } from '@tanstack/react-router'
import {
  SEMANTIER_AGENT_AUTH_COOKIE,
  buildSemantierAgentProxyHeaders,
  buildSemantierAgentProxyResponseHeaders,
  withSemantierAgentBase,
} from '../../server/semantier-agent-api'

async function proxyAuthRequest(request: Request, splat: string) {
  const incomingUrl = new URL(request.url)
  const targetPath = splat ? `/auth/${splat}` : '/auth'
  const targetUrl = new URL(withSemantierAgentBase(targetPath))
  targetUrl.search = incomingUrl.search

  const headers = buildSemantierAgentProxyHeaders(request.headers, {
    authHeaders: {},
    forwardBrowserCookies: true,
    allowedCookieNames: [SEMANTIER_AGENT_AUTH_COOKIE],
  })

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: 'manual',
    signal: AbortSignal.timeout(5_000),
  }

  if (!['GET', 'HEAD'].includes(request.method.toUpperCase())) {
    init.body = await request.text()
  }

  try {
    const upstream = await fetch(targetUrl, init)
    const body = await upstream.text()

    return new Response(body, {
      status: upstream.status,
      headers: buildSemantierAgentProxyResponseHeaders(upstream.headers),
    })
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
