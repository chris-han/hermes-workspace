import { createFileRoute } from '@tanstack/react-router'
import { isAuthenticated } from '../../server/auth-middleware'
import {
  SEMANTIER_AGENT_AUTH_COOKIE,
  semantierAgentAuthHeaders,
  withSemantierAgentBase,
} from '../../server/semantier-agent-api'

async function handleUpload(request: Request): Promise<Response> {
  let incomingForm: FormData
  try {
    incomingForm = await request.formData()
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid multipart form data' }),
      { status: 400, headers: { 'content-type': 'application/json' } },
    )
  }

  const sessionId = incomingForm.get('session_id')
  const runId = incomingForm.get('run_id')
  const fileField = incomingForm.get('file')

  if (!(fileField instanceof File) && !(fileField instanceof Blob)) {
    return new Response(
      JSON.stringify({ error: 'No file provided' }),
      { status: 400, headers: { 'content-type': 'application/json' } },
    )
  }

  const outgoingForm = new FormData()
  const filename =
    fileField instanceof File ? fileField.name : 'document.pdf'
  outgoingForm.append('file', fileField, filename)
  if (sessionId) outgoingForm.append('session_id', String(sessionId))
  if (runId) outgoingForm.append('run_id', String(runId))

  const targetUrl = withSemantierAgentBase('/upload')

  // Build auth headers; let fetch set content-type (multipart + boundary).
  const authHeaders = semantierAgentAuthHeaders()
  const forwardHeaders = new Headers()
  for (const [key, value] of Object.entries(authHeaders)) {
    forwardHeaders.set(key, value)
  }
  // Forward session cookie so the upstream backend can resolve the workspace.
  const rawCookie = request.headers.get('cookie')
  if (rawCookie) {
    const allowed = new Set([SEMANTIER_AGENT_AUTH_COOKIE])
    const filtered = rawCookie
      .split(';')
      .map((s) => s.trim())
      .filter((s) => {
        const name = s.split('=')[0]?.trim()
        return name && allowed.has(name)
      })
      .join('; ')
    if (filtered) forwardHeaders.set('cookie', filtered)
  }

  let upstream: Response
  try {
    upstream = await fetch(targetUrl, {
      method: 'POST',
      headers: forwardHeaders,
      body: outgoingForm,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Upload proxy error'
    return new Response(JSON.stringify({ error: msg }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    })
  }

  const body = await upstream.text()
  const contentType =
    upstream.headers.get('content-type') ?? 'application/json'
  return new Response(body, {
    status: upstream.status,
    headers: { 'content-type': contentType },
  })
}

export const Route = createFileRoute('/api/upload')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return new Response(
            JSON.stringify({ ok: false, error: 'Unauthorized' }),
            { status: 401, headers: { 'content-type': 'application/json' } },
          )
        }
        return handleUpload(request)
      },
    },
  },
})
