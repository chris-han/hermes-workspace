import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

import {
  KnowledgeEntitlementRequiredError,
  requireKnowledgeEntitlement,
} from '../../../server/knowledge-entitlement'
import {
  type PromotionTargetAuthorityLevel,
  createKnowledgePromotionRequest,
} from '../../../server/knowledge-promotion-requests'
import {
  WorkspaceAuthRequiredError,
  resolveActiveWorkspaceRoot,
} from '../../../server/workspace-root'

type PromotionRequestBody = {
  pagePath?: unknown
  targetAuthorityLevel?: unknown
  justification?: unknown
  sourceUri?: unknown
  jurisdiction?: unknown
  effectiveFrom?: unknown
  sourceVersion?: unknown
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function isPromotionTargetAuthorityLevel(
  value: string,
): value is PromotionTargetAuthorityLevel {
  return value === 'T2' || value === 'T3' || value === 'T4' || value === 'T5'
}

export const Route = createFileRoute('/api/knowledge/promotion-requests')({
  server: {
    handlers: {
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
          const body = (await request
            .json()
            .catch(() => ({}))) as PromotionRequestBody | null
          if (!body || typeof body !== 'object') {
            return json({ error: 'Invalid request body' }, { status: 400 })
          }
          if (typeof body.pagePath !== 'string') {
            return json({ error: 'pagePath is required' }, { status: 400 })
          }
          if (typeof body.targetAuthorityLevel !== 'string') {
            return json(
              { error: 'targetAuthorityLevel is required' },
              { status: 400 },
            )
          }
          if (!isPromotionTargetAuthorityLevel(body.targetAuthorityLevel)) {
            return json(
              { error: 'targetAuthorityLevel is invalid' },
              { status: 400 },
            )
          }
          if (typeof body.justification !== 'string') {
            return json({ error: 'justification is required' }, { status: 400 })
          }

          const result = await createKnowledgePromotionRequest(
            activeWorkspace.path,
            {
              pagePath: body.pagePath,
              targetAuthorityLevel: body.targetAuthorityLevel,
              justification: body.justification,
              sourceUri: optionalString(body.sourceUri),
              jurisdiction: optionalString(body.jurisdiction),
              effectiveFrom: optionalString(body.effectiveFrom),
              sourceVersion: optionalString(body.sourceVersion),
            },
            {
              datasetType: activeWorkspace.datasetType,
              workspaceId: activeWorkspace.workspaceId,
              userId: 'knowledge-ui',
            },
          )
          return json(result)
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
                  : 'Failed to create promotion request',
            },
            { status: 400 },
          )
        }
      },
    },
  },
})
