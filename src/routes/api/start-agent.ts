import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { startHermesAgent } from '../../server/hermes-agent'

export const Route = createFileRoute('/api/start-agent')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const result = await startHermesAgent()
        return json(result, { status: result.ok ? 200 : 500 })
      },
    },
  },
})
