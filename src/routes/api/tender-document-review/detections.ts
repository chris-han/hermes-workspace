import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { createTenderDetection } from '../../../server/tender-document-review'
import {
  resolveActiveWorkspaceRoot,
  WorkspaceAuthRequiredError,
} from '../../../server/workspace-root'

const createUntypedFileRoute = createFileRoute as unknown as (
  path: string,
) => (options: Record<string, unknown>) => unknown

export const Route = createUntypedFileRoute(
  '/api/tender-document-review/detections',
)({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          await resolveActiveWorkspaceRoot(request.headers)
          const body = (await request.json()) as Record<string, unknown>
          return json({
            run: await createTenderDetection(request.headers, body),
          })
        } catch (error) {
          return json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : 'Unable to create tender detection',
            },
            {
              status: error instanceof WorkspaceAuthRequiredError ? 401 : 400,
            },
          )
        }
      },
    },
  },
})
