import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

import {
  KnowledgeEntitlementRequiredError,
  requireKnowledgeEntitlement,
} from '../../../server/knowledge-entitlement'
import { emitKnowledgeEvent } from '../../../server/knowledge-event-bus'
import { ingestKnowledgeUpload } from '../../../server/knowledge-ingest'
import {
  WorkspaceAuthRequiredError,
  resolveActiveWorkspaceRoot,
} from '../../../server/workspace-root'

type IngestBody = {
  uploadRef?: unknown
  confirmed?: unknown
  targetDir?: unknown
  languageHint?: unknown
  manualCurationJustification?: unknown
  sessionId?: unknown
}

export const Route = createFileRoute('/api/knowledge/ingest')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const activeWorkspace = await resolveActiveWorkspaceRoot(
            request.headers,
          )
          await requireKnowledgeEntitlement(
            activeWorkspace,
            'ingest',
            request.headers,
          )
          const body = (await request.json().catch(() => ({}))) as IngestBody
          if (body.confirmed !== true) {
            return json(
              {
                ok: false,
                status: 'failed',
                code: 'confirmation_required',
                message: 'Review and import confirmation is required',
              },
              { status: 400 },
            )
          }
          if (typeof body.uploadRef !== 'string') {
            return json(
              {
                ok: false,
                status: 'failed',
                code: 'invalid_upload_ref',
                message: 'Invalid governed upload ref',
              },
              { status: 400 },
            )
          }
          const result = await ingestKnowledgeUpload(
            activeWorkspace.path,
            {
              uploadRef: body.uploadRef,
              confirmed: true,
              targetDir:
                typeof body.targetDir === 'string' ? body.targetDir : null,
              languageHint:
                typeof body.languageHint === 'string'
                  ? body.languageHint
                  : null,
              manualCurationJustification:
                typeof body.manualCurationJustification === 'string'
                  ? body.manualCurationJustification
                  : null,
              workspaceId: activeWorkspace.workspaceId,
              sessionId:
                typeof body.sessionId === 'string' ? body.sessionId : null,
              forceWorkspaceWikiRoot: true,
            },
            {
              emitEvent: (event) => {
                emitKnowledgeEvent({
                  workspaceId: activeWorkspace.workspaceId,
                  sessionId:
                    typeof body.sessionId === 'string' ? body.sessionId : null,
                  ...event,
                })
              },
            },
          )
          const status =
            !result.ok && 'scope' in result && result.scope === 'ingest'
              ? 413
              : !result.ok
                ? 400
                : 200
          return json(result, { status })
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
                  : 'Failed to ingest knowledge upload',
            },
            { status: 500 },
          )
        }
      },
    },
  },
})
