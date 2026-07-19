import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

import {
  KnowledgeEntitlementRequiredError,
  requireKnowledgeEntitlement,
} from '../../../server/knowledge-entitlement'
import {
  validateKnowledgeUploadLimits,
  writeKnowledgeUpload,
} from '../../../server/knowledge-files'
import { emitKnowledgeEvent } from '../../../server/knowledge-event-bus'
import {
  WorkspaceAuthRequiredError,
  resolveActiveWorkspaceRoot,
} from '../../../server/workspace-root'

function formFiles(form: FormData): Array<File> {
  return form
    .getAll('files')
    .filter((value): value is File => value instanceof File)
}

export const Route = createFileRoute('/api/knowledge/upload')({
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
          let form: FormData
          try {
            form = await request.formData()
          } catch {
            return json(
              { error: 'Invalid multipart form data' },
              { status: 400 },
            )
          }
          const files = formFiles(form)
          if (files.length === 0) {
            return json(
              { error: 'At least one file is required' },
              { status: 400 },
            )
          }
          const limitFailure = validateKnowledgeUploadLimits(files)
          if (limitFailure) {
            return json(limitFailure, { status: 413 })
          }
          const targetPath = form.get('path')
          const ingestMode = form.get('ingestMode')
          const sessionId = form.get('session_id')
          emitKnowledgeEvent({
            workspaceId: activeWorkspace.workspaceId,
            sessionId: typeof sessionId === 'string' ? sessionId : null,
            stage: 'upload',
            status: 'running',
            label: 'Uploading knowledge files',
            detail: `${files.length} ${files.length === 1 ? 'file' : 'files'} selected`,
          })
          const results = await Promise.all(
            files.map((file) =>
              writeKnowledgeUpload(
                activeWorkspace.path,
                file,
                typeof targetPath === 'string' ? targetPath : null,
                {
                  datasetType: activeWorkspace.datasetType,
                  forceWorkspaceWikiRoot: true,
                  ingestMode:
                    ingestMode === 'extract' || ingestMode === 'table'
                      ? ingestMode
                      : undefined,
                  sessionId: typeof sessionId === 'string' ? sessionId : null,
                  workspaceId: activeWorkspace.workspaceId,
                },
              ),
            ),
          )
          for (const result of results) {
            if (!result.ok) {
              emitKnowledgeEvent({
                workspaceId: activeWorkspace.workspaceId,
                sessionId: typeof sessionId === 'string' ? sessionId : null,
                stage: 'upload',
                status: 'failed',
                label: `Upload failed: ${result.originalName}`,
                detail: result.message,
                filename: result.originalName,
              })
              continue
            }
            emitKnowledgeEvent({
              workspaceId: activeWorkspace.workspaceId,
              sessionId: typeof sessionId === 'string' ? sessionId : null,
              stage:
                result.kind === 'staged_for_ingest' ? 'review' : 'complete',
              status: result.kind === 'staged_for_ingest' ? 'waiting' : 'done',
              label:
                result.kind === 'staged_for_ingest'
                  ? `Uploaded ${result.storedName}`
                  : `Saved ${result.storedName}`,
              detail:
                result.kind === 'staged_for_ingest'
                  ? 'Waiting for wiki page build'
                  : 'File tree refreshed',
              filename: result.originalName,
              targetPath:
                result.kind === 'staged_for_ingest'
                  ? result.targetWikiPath
                  : result.path,
              uploadRef:
                result.kind === 'staged_for_ingest'
                  ? result.stagedUploadRef
                  : undefined,
            })
          }
          emitKnowledgeEvent({
            workspaceId: activeWorkspace.workspaceId,
            sessionId: typeof sessionId === 'string' ? sessionId : null,
            stage: 'upload',
            status: results.some((result) => !result.ok) ? 'failed' : 'done',
            label: 'Knowledge upload complete',
            detail: `${results.filter((result) => result.ok).length}/${results.length} files accepted`,
          })
          return json(results)
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
                  : 'Failed to upload knowledge files',
            },
            { status: 500 },
          )
        }
      },
    },
  },
})
