import path from 'node:path'
import fs from 'node:fs/promises'
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../server/auth-middleware'
import {
  ensureWorkspacePathWithinRoot,
  resolveActiveWorkspaceRoot,
} from '../../server/workspace-root'

function extractFolderName(fullPath: string): string {
  const parts = fullPath.replace(/\\/g, '/').split('/')
  return parts[parts.length - 1] || 'workspace'
}

async function isValidDirectory(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath)
    return stat.isDirectory()
  } catch {
    return false
  }
}

async function detectWorkspace(
  workspaceRoot: string,
  savedPath?: string,
): Promise<{
  path: string
  folderName: string
  source: string
  isValid: boolean
  workspaceId?: string
  workspaceSlug?: string
  authenticated?: boolean
}> {
  if (savedPath) {
    let resolvedSavedPath = ''
    try {
      resolvedSavedPath = ensureWorkspacePathWithinRoot(
        workspaceRoot,
        savedPath,
      )
    } catch {
      resolvedSavedPath = ''
    }
    const isValid = resolvedSavedPath
      ? await isValidDirectory(resolvedSavedPath)
      : false
    if (isValid) {
      return {
        path: resolvedSavedPath,
        folderName: extractFolderName(resolvedSavedPath),
        source: 'saved',
        isValid: true,
      }
    }
  }

  const isValid = await isValidDirectory(workspaceRoot)
  if (isValid) {
    return {
      path: workspaceRoot,
      folderName: extractFolderName(workspaceRoot),
      source: 'backend',
      isValid: true,
    }
  }

  return {
    path: workspaceRoot,
    folderName: extractFolderName(workspaceRoot),
    source: 'none',
    isValid: false,
  }
}

export const Route = createFileRoute('/api/workspace')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        }
        try {
          const url = new URL(request.url)
          const savedPath = url.searchParams.get('saved') || undefined
          const activeWorkspace = await resolveActiveWorkspaceRoot(
            request.headers,
          )

          const result = await detectWorkspace(activeWorkspace.path, savedPath)

          return json({
            ...result,
            authenticated: activeWorkspace.authenticated,
            workspaceId: activeWorkspace.workspaceId,
            workspaceSlug: activeWorkspace.workspaceSlug,
          })
        } catch (err) {
          return json(
            {
              path: '',
              folderName: '',
              source: 'error',
              isValid: false,
              error: err instanceof Error ? err.message : String(err),
            },
            { status: 500 },
          )
        }
      },
    },
  },
})
