import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { readKnowledgeBaseConfig } from '../../../server/knowledge-config'
import { syncKnowledgeSource } from '../../../server/knowledge-browser'
import type { KnowledgeBaseConfig } from '../../../server/knowledge-config'

export const Route = createFileRoute('/api/knowledge/sync')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Optional: allow body to override source temporarily for one-shot use
        let config: KnowledgeBaseConfig | null = null
        try {
          const text = await request.text()
          if (text) {
            config = JSON.parse(text)
          }
        } catch {
          // ignore parse errors, use stored config
        }

        if (config) {
          const { writeKnowledgeBaseConfig } =
            await import('../../../server/knowledge-config')
          writeKnowledgeBaseConfig(config)
        }

        try {
          const result = await syncKnowledgeSource()
          return json(result)
        } catch (error) {
          return json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to sync knowledge source',
            },
            { status: 500 },
          )
        }
      },
      GET: async ({ request }) => {
        const config = readKnowledgeBaseConfig()
        return json({ source: config.source })
      },
    },
  },
})
