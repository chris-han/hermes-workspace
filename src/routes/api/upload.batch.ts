import { createFileRoute } from '@tanstack/react-router'
import { isAuthenticated } from '../../server/auth-middleware'
import {
  SEMANTIER_AGENT_AUTH_COOKIE,
  semantierAgentAuthHeaders,
  withSemantierAgentBase,
} from '../../server/semantier-agent-api'

async function handleUploadBatch(request: Request): Promise<Response> {
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
  const fileFields: Array<FormDataEntryValue> = incomingForm.getAll('files')

  if (fileFields.length === 0) {
    return new Response(
      JSON.stringify({ error: 'At least one file is required' }),
      { status: 400, headers: { 'content-type': 'application/json' } },
    )
  }

  const uploadedFiles: Array<{ status: string; filename?: string; file_path?: string }> = []

  for (const fileField of fileFields) {
    const isFile = fileField instanceof File
    const isBlob = fileField instanceof Blob
    if (!isFile && !isBlob) {
      continue
    }

    const outgoingForm = new FormData()
    const filename = isFile ? (fileField as File).name : 'document.pdf'
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
      uploadedFiles.push({
        status: 'error',
        filename,
      })
      continue
    }

    const body = await upstream.text()
    const contentType =
      upstream.headers.get('content-type') ?? 'application/json'

    if (upstream.ok) {
      try {
        const payload = JSON.parse(body) as {
          status?: string
          filename?: string
          file_path?: string
        }
        uploadedFiles.push({
          status: payload.status || 'ok',
          filename: payload.filename,
          file_path: payload.file_path,
        })
      } catch {
        uploadedFiles.push({
          status: 'error',
          filename,
        })
      }
    } else {
      uploadedFiles.push({
        status: 'error',
        filename,
      })
    }
  }

  return new Response(
    JSON.stringify({
      status: 'ok',
      files: uploadedFiles,
    }),
    {
      status: 200,
      headers: { 'content-type': 'application/json' },
    },
  )
}

export const Route = createFileRoute('/api/upload/batch')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return new Response(
            JSON.stringify({ ok: false, error: 'Unauthorized' }),
            { status: 401, headers: { 'content-type': 'application/json' } },
          )
        }
        return handleUploadBatch(request)
      },
    },
  },
})
