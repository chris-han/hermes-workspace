import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { validateTenderGraphFocus } from '../../../server/tender-document-review'
import { resolveActiveWorkspaceRoot, WorkspaceAuthRequiredError } from '../../../server/workspace-root'

const createUntypedFileRoute = createFileRoute as unknown as (path: string) => (options: Record<string, unknown>) => unknown
export const Route = createUntypedFileRoute('/api/tender-document-review/graph-focus')({
  server: { handlers: { POST: async ({ request }: { request: Request }) => {
    try {
      await resolveActiveWorkspaceRoot(request.headers)
      const body = await request.json() as { finding?: Record<string, unknown>; accepted_release_hash?: string }
      return json(await validateTenderGraphFocus(request.headers, { finding: body.finding ?? {}, acceptedReleaseHash: body.accepted_release_hash ?? '' }))
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : 'Unable to validate graph focus' }, { status: error instanceof WorkspaceAuthRequiredError ? 401 : 400 })
    }
  } } },
})
