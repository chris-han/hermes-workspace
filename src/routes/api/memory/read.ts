import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { readMemory } from '../../../server/hermes-api'

export const Route = createFileRoute('/api/memory/read')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const pathParam = url.searchParams.get('path') || ''
        try {
          return json(await readMemory(pathParam))
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : 'Failed to read memory file'
          const status = /not allowed|outside workspace|required/i.test(message)
            ? 400
            : /ENOENT/.test(message)
              ? 404
              : 500
          return json({ error: message }, { status })
        }
      },
    },
  },
})
