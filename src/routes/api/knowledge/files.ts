import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

import {
  KnowledgeEntitlementRequiredError,
  requireKnowledgeEntitlement,
} from '../../../server/knowledge-entitlement'
import {
  createKnowledgeDirectory,
  listKnowledgeDirectory,
  listKnowledgeTree,
} from '../../../server/knowledge-files'
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
          if (url.searchParams.get('tree') === '1') {
            const tree = await listKnowledgeTree(
              activeWorkspace.path,
              {
                datasetType: activeWorkspace.datasetType,
                forceWorkspaceWikiRoot: true,
              },
              5,
            )
            return json(tree)
          }
          const listed = await listKnowledgeDirectory(
            activeWorkspace.path,
            url.searchParams.get('path'),
            {
              datasetType: activeWorkspace.datasetType,
              forceWorkspaceWikiRoot: true,
            },
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
      POST: async ({ request }) => {
        try {
          const activeWorkspace = await resolveActiveWorkspaceRoot(
            request.headers,
          )
          await requireKnowledgeEntitlement(
            activeWorkspace,
            'write',
            request.headers,
          )
          const body = (await request.json().catch(() => ({}))) as {
            parentPath?: unknown
            folderName?: unknown
          }
          if (typeof body.folderName !== 'string') {
            return json({ error: 'folderName is required' }, { status: 400 })
          }
          const created = await createKnowledgeDirectory(
            activeWorkspace.path,
            typeof body.parentPath === 'string' ? body.parentPath : null,
            body.folderName,
            {
              datasetType: activeWorkspace.datasetType,
              forceWorkspaceWikiRoot: true,
            },
          )
          return json(created)
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
                  : 'Failed to create knowledge folder',
            },
            { status: 500 },
          )
        }
      },
    },
  },
})
