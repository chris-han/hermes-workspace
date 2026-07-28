import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import {
  buildEffectiveContextGraph,
  buildKnowledgeGraph,
  buildNativeMetadataSummary,
} from '../../../server/knowledge-browser'
import { readGovernedKnowledgeDatasetGovernance } from '../../../server/knowledge-config'
import {
  resolveActiveWorkspaceRoot,
  WorkspaceAuthRequiredError,
} from '../../../server/workspace-root'

export const Route = createFileRoute('/api/knowledge/graph')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const activeWorkspace = await resolveActiveWorkspaceRoot(
            request.headers,
          )
          const context = {
            organizationId: activeWorkspace.organizationId,
            datasetType: activeWorkspace.datasetType,
            datasetKey: activeWorkspace.datasetKey,
            activeDatasetVersionId: activeWorkspace.activeDatasetVersionId,
          }
          const datasetGovernance =
            await readGovernedKnowledgeDatasetGovernance(request.headers)
          return json({
            ...buildKnowledgeGraph(activeWorkspace.path, {
              datasetType: activeWorkspace.datasetType,
            }),
            effectiveContext: buildEffectiveContextGraph(context, {
              datasetGovernance,
            }),
            nativeMetadata: buildNativeMetadataSummary(activeWorkspace.path, context, {
              datasetGovernance,
            }),
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
                  : 'Failed to build knowledge graph',
            },
            { status: 500 },
          )
        }
      },
    },
  },
})
