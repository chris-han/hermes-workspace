import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

import { resolveSourceEvidenceViewerConfig } from '../../../server/source-evidence-viewer-config'

const createUntypedFileRoute = createFileRoute as unknown as (
  path: string,
) => (options: Record<string, unknown>) => unknown

export const Route = createUntypedFileRoute(
  '/api/contextgraph-studio/source-evidence-viewer-config',
)({
  server: {
    handlers: {
      GET: async () => json(resolveSourceEvidenceViewerConfig()),
    },
  },
})
