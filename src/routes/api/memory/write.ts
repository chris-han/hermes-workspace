import fs from 'node:fs'
import path from 'node:path'
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { getMemoryWorkspaceRoot } from '../../../server/memory-browser'
import { resolveWorkspaceHermesHomeFromBackend } from '../../../server/hermes-home'
import { requireJsonContentType } from '../../../server/rate-limit'

function validateMemoryWritePath(
  inputPath: unknown,
  workspaceRoot: string,
): {
  relativePath: string
  fullPath: string
} {
  if (typeof inputPath !== 'string') {
    throw new Error('Path is required')
  }

  const relativePath = inputPath.replace(/\\/g, '/').trim()
  if (!relativePath) throw new Error('Path is required')
  if (path.isAbsolute(relativePath))
    throw new Error('Absolute paths are not allowed')
  if (relativePath.includes('..'))
    throw new Error('Path traversal is not allowed')
  if (!relativePath.toLowerCase().endsWith('.md'))
    throw new Error('Only .md files are allowed')

  const memoryRoot = getMemoryWorkspaceRoot({ workspaceRoot })
  const fullPath = path.resolve(memoryRoot, relativePath)
  const relativeFromRoot = path.relative(memoryRoot, fullPath)
  if (relativeFromRoot.startsWith('..') || path.isAbsolute(relativeFromRoot)) {
    throw new Error('Resolved path is outside workspace')
  }

  return { relativePath, fullPath }
}

export const Route = createFileRoute('/api/memory/write')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const csrfCheck = requireJsonContentType(request)
        if (csrfCheck) return csrfCheck
        // Memory writes go directly to workspace-scoped local fs. The root is
        // resolved from the authenticated backend context, not global HERMES_HOME.
        try {
          const body = (await request.json().catch(() => ({}))) as {
            path?: unknown
            content?: unknown
          }
          const workspaceRoot = await resolveWorkspaceHermesHomeFromBackend(
            request.headers,
          )
          const { relativePath, fullPath } = validateMemoryWritePath(
            body.path,
            workspaceRoot,
          )
          const content = typeof body.content === 'string' ? body.content : ''

          fs.mkdirSync(path.dirname(fullPath), { recursive: true })
          fs.writeFileSync(fullPath, content, 'utf-8')
          return json({ success: true, path: relativePath })
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : 'Failed to write memory file'
          const status =
            /required|absolute|traversal|outside workspace|\.md/i.test(message)
              ? 400
              : 500
          return json({ error: message }, { status })
        }
      },
    },
  },
})
