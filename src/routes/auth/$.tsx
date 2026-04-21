import { createFileRoute } from '@tanstack/react-router'
import {
  buildVibeAgentProxyHeaders,
  buildVibeAgentProxyResponseHeaders,
  VIBE_AGENT_AUTH_COOKIE,
  withVibeAgentBase,
} from '../../server/vibe-agent-api'

async function proxyAuthRequest(request: Request, splat: string) {
  const incomingUrl = new URL(request.url)
  const targetPath = splat ? `/auth/${splat}` : '/auth'
  const targetUrl = new URL(withVibeAgentBase(targetPath))
  targetUrl.search = incomingUrl.search

  const headers = buildVibeAgentProxyHeaders(request.headers, {
    authHeaders: {},
    forwardBrowserCookies: true,
    allowedCookieNames: [VIBE_AGENT_AUTH_COOKIE],
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

  return new Response(body, {
    status: upstream.status,
    headers: buildVibeAgentProxyResponseHeaders(upstream.headers),
  })
}

export const Route = createFileRoute('/auth/$')({
  server: {
    handlers: {
      GET: async ({ request, params }) => proxyAuthRequest(request, params._splat || ''),
      POST: async ({ request, params }) => proxyAuthRequest(request, params._splat || ''),
    },
  },
})