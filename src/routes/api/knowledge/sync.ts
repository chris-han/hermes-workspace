import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { readKnowledgeBaseConfig } from '../../../server/knowledge-config'
import { syncKnowledgeSource } from '../../../server/knowledge-browser'
import type { KnowledgeBaseConfig } from '../../../server/knowledge-config'
import {
  resolveActiveWorkspaceRoot,
  WorkspaceAuthRequiredError,
} from '../../../server/workspace-root'

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

        try {
          let workspaceRoot = ''
          if (config) {
            const activeWorkspace = await resolveActiveWorkspaceRoot(
              request.headers,
            )
            workspaceRoot = activeWorkspace.path
            const { writeKnowledgeBaseConfig } =
              await import('../../../server/knowledge-config')
            writeKnowledgeBaseConfig(config, workspaceRoot)
          }

          if (!workspaceRoot) {
            const activeWorkspace = await resolveActiveWorkspaceRoot(
              request.headers,
            )
            workspaceRoot = activeWorkspace.path
          }
          const result = await syncKnowledgeSource(workspaceRoot)
          return json(result)
        } catch (error) {
          if (error instanceof WorkspaceAuthRequiredError) {
            return json({ error: error.message }, { status: 401 })
          }
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
        try {
          const activeWorkspace = await resolveActiveWorkspaceRoot(
            request.headers,
          )
          const config = readKnowledgeBaseConfig(activeWorkspace.path)
          return json({ source: config.source })
        } catch (error) {
          if (error instanceof WorkspaceAuthRequiredError) {
            return json({ error: error.message }, { status: 401 })
          }
          return json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to read knowledge source',
            },
            { status: 500 },
          )
        }
      },
    },
  },
})
