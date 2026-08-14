import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import {
  createTenderDetection,
  createTenderReport,
  recordTenderFindingDisposition,
  recordTenderFindingFeedback,
  recordTenderRunMissedFindingFeedback,
} from '../../server/tender-document-review'
import {
  WorkspaceAuthRequiredError,
  resolveActiveWorkspaceRoot,
} from '../../server/workspace-root'

const createUntypedFileRoute = createFileRoute as unknown as (
  path: string,
) => (options: Record<string, unknown>) => unknown

export const Route = createUntypedFileRoute('/api/tender-document-review')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          await resolveActiveWorkspaceRoot(request.headers)
          const body = (await request.json()) as Record<string, unknown>
          const action = String(body.action || 'detect')
          if (action === 'disposition') {
            const disposition = await recordTenderFindingDisposition(
              request.headers,
              body as Parameters<typeof recordTenderFindingDisposition>[1],
            )
            return json({ disposition })
          }
          if (action === 'report') {
            const report = await createTenderReport(
              request.headers,
              String(body.runId || ''),
            )
            return json({ report })
          }
          if (action === 'feedback') {
            const feedback = await recordTenderFindingFeedback(
              request.headers,
              body as Parameters<typeof recordTenderFindingFeedback>[1],
            )
            return json({ feedback })
          }
          if (action === 'missed_finding_feedback') {
            const feedback = await recordTenderRunMissedFindingFeedback(
              request.headers,
              body as Parameters<typeof recordTenderRunMissedFindingFeedback>[1],
            )
            return json({ feedback })
          }
          const run = await createTenderDetection(
            request.headers,
            body as Parameters<typeof createTenderDetection>[1],
          )
          return json({ run })
        } catch (error) {
          if (error instanceof WorkspaceAuthRequiredError) {
            return json({ error: error.message }, { status: 401 })
          }
          return json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to run tender document review',
            },
            { status: 400 },
          )
        }
      },
    },
  },
})
