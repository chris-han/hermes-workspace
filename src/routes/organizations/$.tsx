import { createFileRoute } from '@tanstack/react-router'
import {
  SEMANTIER_AGENT_AUTH_COOKIE,
  buildSemantierAgentProxyHeaders,
  buildSemantierAgentProxyResponseHeaders,
  semantierAgentAuthHeaders,
  withSemantierAgentBase,
} from '../../server/semantier-agent-api'

const DEFAULT_ORGANIZATION_PROXY_TIMEOUT_MS = 10_000

async function proxyOrganizationRequest(request: Request, splat: string) {
  const incomingUrl = new URL(request.url)
  const targetPath = splat ? `/organizations/${splat}` : '/organizations'
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
    signal: AbortSignal.timeout(DEFAULT_ORGANIZATION_PROXY_TIMEOUT_MS),
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
        headers: { 'content-type': 'application/json' },
      },
    )
  }
}

export const Route = createFileRoute('/organizations/$')({
  server: {
    handlers: {
      GET: async ({ request, params }) =>
        proxyOrganizationRequest(request, params._splat || ''),
      POST: async ({ request, params }) =>
        proxyOrganizationRequest(request, params._splat || ''),
      PATCH: async ({ request, params }) =>
        proxyOrganizationRequest(request, params._splat || ''),
      PUT: async ({ request, params }) =>
        proxyOrganizationRequest(request, params._splat || ''),
      DELETE: async ({ request, params }) =>
        proxyOrganizationRequest(request, params._splat || ''),
    },
  },
})
