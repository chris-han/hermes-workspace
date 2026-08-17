import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { getTenderDetectionRun } from '../../../../server/tender-document-review'
import { resolveActiveWorkspaceRoot, WorkspaceAuthRequiredError } from '../../../../server/workspace-root'

const createUntypedFileRoute = createFileRoute as unknown as (path: string) => (options: Record<string, unknown>) => unknown

export const Route = createUntypedFileRoute('/api/tender-document-review/runs/$runId')({
  server: { handlers: {
    GET: async ({ request, params }: { request: Request; params: { runId: string } }) => {
      try {
        await resolveActiveWorkspaceRoot(request.headers)
        return json({ run: await getTenderDetectionRun(request.headers, params.runId) })
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : 'Unable to load replay' }, { status: error instanceof WorkspaceAuthRequiredError ? 401 : 400 })
      }
    },
  } },
})
