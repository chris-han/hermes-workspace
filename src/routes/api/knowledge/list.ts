import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import {
  knowledgeRootExists,
  listKnowledgePages,
} from '../../../server/knowledge-browser'
import {
  getKnowledgeBaseEffectiveRoot,
  readKnowledgeBaseConfig,
} from '../../../server/knowledge-config'
import {
  resolveActiveWorkspaceRoot,
  WorkspaceAuthRequiredError,
} from '../../../server/workspace-root'

export const Route = createFileRoute('/api/knowledge/list')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const activeWorkspace = await resolveActiveWorkspaceRoot(
            request.headers,
          )
          const workspaceRoot = activeWorkspace.path
          const context = { datasetType: activeWorkspace.datasetType }
          const config = readKnowledgeBaseConfig(workspaceRoot, context)
          const source = config.source
          const exists = knowledgeRootExists(workspaceRoot, context)
          return json({
            pages: exists ? listKnowledgePages(workspaceRoot, context) : [],
            exists,
            source,
            knowledgeRoot: getKnowledgeBaseEffectiveRoot(
              workspaceRoot,
              context,
            ),
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
                  : 'Failed to list knowledge pages',
            },
            { status: 500 },
          )
        }
      },
    },
  },
})
