import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { writeMemory } from '../../../server/hermes-api'
import { requireJsonContentType } from '../../../server/rate-limit'

export const Route = createFileRoute('/api/memory/write')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const csrfCheck = requireJsonContentType(request)
        if (csrfCheck) return csrfCheck
        try {
          const body = (await request.json().catch(() => ({}))) as {
            path?: unknown
            content?: unknown
          }
          if (typeof body.path !== 'string') throw new Error('Path is required')
          const content = typeof body.content === 'string' ? body.content : ''
          return json(await writeMemory({ path: body.path, content }))
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : 'Failed to write memory file'
          const status =
            /required|absolute|traversal|outside workspace|\.md/i.test(message)
              ? 400
              : 500
          return json({ error: message }, { status })
        }
      },
    },
  },
})
