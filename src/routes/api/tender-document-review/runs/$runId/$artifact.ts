import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { createTenderLabeledDocx, createTenderReport, getTenderReplay } from '../../../../../server/tender-document-review'
import { resolveActiveWorkspaceRoot, WorkspaceAuthRequiredError } from '../../../../../server/workspace-root'

const createUntypedFileRoute = createFileRoute as unknown as (path: string) => (options: Record<string, unknown>) => unknown
export const Route = createUntypedFileRoute('/api/tender-document-review/runs/$runId/$artifact')({
  server: { handlers: {
    GET: async ({ request, params }: { request: Request; params: { runId: string; artifact: string } }) => {
      try { await resolveActiveWorkspaceRoot(request.headers); return json({ bundle: await getTenderReplay(request.headers, params.runId) }) }
      catch (error) { return json({ error: error instanceof Error ? error.message : 'Unable to load replay' }, { status: error instanceof WorkspaceAuthRequiredError ? 401 : 400 }) }
    },
    POST: async ({ request, params }: { request: Request; params: { runId: string; artifact: string } }) => {
      try {
        await resolveActiveWorkspaceRoot(request.headers)
        if (params.artifact === 'report') return json({ report: await createTenderReport(request.headers, params.runId) })
        if (params.artifact === 'labeled-docx') return json({ derivative: await createTenderLabeledDocx(request.headers, params.runId) })
        return json({ error: 'unknown tender artifact' }, { status: 404 })
      } catch (error) { return json({ error: error instanceof Error ? error.message : 'Unable to create artifact' }, { status: error instanceof WorkspaceAuthRequiredError ? 401 : 400 }) }
    },
  } },
})
