import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

import {
  KnowledgeEntitlementRequiredError,
  requireKnowledgeEntitlement,
} from '../../../server/knowledge-entitlement'
import { listKnowledgeDirectory } from '../../../server/knowledge-files'
import {
  WorkspaceAuthRequiredError,
  resolveActiveWorkspaceRoot,
} from '../../../server/workspace-root'

export const Route = createFileRoute('/api/knowledge/files')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const activeWorkspace = await resolveActiveWorkspaceRoot(
            request.headers,
          )
          await requireKnowledgeEntitlement(
            activeWorkspace,
            'read',
            request.headers,
          )
          const url = new URL(request.url)
          const listed = await listKnowledgeDirectory(
            activeWorkspace.path,
            url.searchParams.get('path'),
            { datasetType: activeWorkspace.datasetType },
          )
          return json(listed)
        } catch (error) {
          if (error instanceof WorkspaceAuthRequiredError) {
            return json({ error: error.message }, { status: 401 })
          }
          if (error instanceof KnowledgeEntitlementRequiredError) {
            return json({ error: error.message }, { status: 403 })
          }
          return json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to list knowledge files',
            },
            { status: 500 },
          )
        }
      },
    },
  },
})
