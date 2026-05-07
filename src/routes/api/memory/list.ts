import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { listMemoryFiles } from '../../../server/memory-browser'

export const Route = createFileRoute('/api/memory/list')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // Memory is sourced entirely from local filesystem via memory-browser.ts
        // (reads $HERMES_HOME/MEMORY.md + $HERMES_HOME/memory/ + /memories/). No
        // remote gateway endpoint is required, so no capability gate is needed.
        try {
          return json({ files: listMemoryFiles() })
        } catch (error) {
          return json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to list memory files',
            },
            { status: 500 },
          )
        }
      },
    },
  },
})
