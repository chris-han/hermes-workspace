import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import {
  readKnowledgeBaseConfig,
  writeKnowledgeBaseConfig,
} from '../../../server/knowledge-config'
import type { KnowledgeBaseConfig } from '../../../server/knowledge-config'

export const Route = createFileRoute('/api/knowledge/config')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          return json({ config: readKnowledgeBaseConfig() })
        } catch (error) {
          return json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to read knowledge base config',
            },
            { status: 500 },
          )
        }
      },
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as Partial<KnowledgeBaseConfig>
          const current = readKnowledgeBaseConfig()
          const next: KnowledgeBaseConfig = {
            source: body.source ?? current.source,
          }
          writeKnowledgeBaseConfig(next)
          return json({ config: next })
        } catch (error) {
          return json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to save knowledge base config',
            },
            { status: 500 },
          )
        }
      },
    },
  },
})
