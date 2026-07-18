import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import {
  normalizeKnowledgeBaseConfigForWorkspace,
  readKnowledgeBaseConfig,
  resolveKnowledgeBaseConfig,
  writeKnowledgeBaseConfig,
} from '../../../server/knowledge-config'
import type { KnowledgeBaseConfig } from '../../../server/knowledge-config'
import {
  resolveActiveWorkspaceRoot,
  WorkspaceAuthRequiredError,
} from '../../../server/workspace-root'

export const Route = createFileRoute('/api/knowledge/config')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const activeWorkspace = await resolveActiveWorkspaceRoot(
            request.headers,
          )
          const resolved = resolveKnowledgeBaseConfig(activeWorkspace.path, {
            datasetType: activeWorkspace.datasetType,
          })
          return json({
            config: resolved.config,
            resolved,
          })
        } catch (error) {
          if (error instanceof WorkspaceAuthRequiredError) {
            return json({ error: error.message }, { status: 401 })
          }
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
          const activeWorkspace = await resolveActiveWorkspaceRoot(
            request.headers,
          )
          const workspaceRoot = activeWorkspace.path
          const body = (await request.json()) as Partial<KnowledgeBaseConfig>
          const current = readKnowledgeBaseConfig(workspaceRoot, {
            datasetType: activeWorkspace.datasetType,
          })
          const next: KnowledgeBaseConfig = {
            source: body.source ?? current.source,
          }
          const normalized = normalizeKnowledgeBaseConfigForWorkspace(
            next,
            workspaceRoot,
            { datasetType: activeWorkspace.datasetType },
          )
          writeKnowledgeBaseConfig(normalized, workspaceRoot)
          return json({ config: normalized })
        } catch (error) {
          if (error instanceof WorkspaceAuthRequiredError) {
            return json({ error: error.message }, { status: 401 })
          }
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
