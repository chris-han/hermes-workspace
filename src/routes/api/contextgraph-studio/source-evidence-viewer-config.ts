import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

import { resolveSourceEvidenceViewerConfig } from '../../../server/source-evidence-viewer-config'

export const Route = createFileRoute(
  '/api/contextgraph-studio/source-evidence-viewer-config',
)({
  server: {
    handlers: {
      GET: async () => json(resolveSourceEvidenceViewerConfig()),
    },
  },
})
