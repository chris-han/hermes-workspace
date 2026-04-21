import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  ensureWorkspacePathWithinRoot,
  formatWorkspaceCwdLabel,
  resolveActiveWorkspaceRoot,
  resolveWorkspaceAppStateRoot,
  resolveWorkspaceCwd,
  toWorkspaceRelativePath,
} from './workspace-root'

describe('ensureWorkspacePathWithinRoot', () => {
  it('resolves relative paths inside the workspace root', () => {
    expect(
      ensureWorkspacePathWithinRoot('/repo/workspaces/public', 'notes/todo.md'),
    ).toBe(path.resolve('/repo/workspaces/public/notes/todo.md'))
  })

  it('rejects paths outside the workspace root', () => {
    expect(() =>
      ensureWorkspacePathWithinRoot('/repo/workspaces/public', '../secret.txt'),
    ).toThrow('Path is outside workspace')
  })
})

describe('toWorkspaceRelativePath', () => {
  it('returns an empty string for the workspace root itself', () => {
    expect(
      toWorkspaceRelativePath('/repo/workspaces/public', '/repo/workspaces/public'),
    ).toBe('')
  })
})

describe('workspace app state helpers', () => {
  it('places local workspace state under the active workspace root', () => {
    expect(
      resolveWorkspaceAppStateRoot('/repo/workspaces/public'),
    ).toBe(path.resolve('/repo/workspaces/public/.hermes-workspace'))
  })

  it('maps terminal home to the workspace root', () => {
    expect(resolveWorkspaceCwd('/repo/workspaces/public', '~')).toBe(
      path.resolve('/repo/workspaces/public'),
    )
    expect(resolveWorkspaceCwd('/repo/workspaces/public', '~/notes')).toBe(
      path.resolve('/repo/workspaces/public/notes'),
    )
    expect(
      formatWorkspaceCwdLabel(
        '/repo/workspaces/public',
        '/repo/workspaces/public/projects/demo',
      ),
    ).toBe('~/projects/demo')
  })
})

describe('resolveActiveWorkspaceRoot', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    vi.restoreAllMocks()
    globalThis.fetch = originalFetch
  })

  it('forwards the vt_session cookie and uses the backend workspace root', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        authenticated: true,
        currentWorkspaceId: 'bb685f18514b4dc89018900bbb4687eb',
        currentWorkspaceSlug: 'alice_zhang',
        currentWorkspaceRoot:
          '/home/chris/repo/Vibe-Trading/workspaces/bb685f18514b4dc89018900bbb4687eb',
      }),
    })
    globalThis.fetch = fetchMock as typeof fetch

    const result = await resolveActiveWorkspaceRoot({
      cookie: 'hermes-auth=workspace-session; vt_session=semantier-user-session',
    })

    expect(result.authenticated).toBe(true)
    expect(result.workspaceId).toBe('bb685f18514b4dc89018900bbb4687eb')
    expect(result.path).toBe(
      path.resolve(
        '/home/chris/repo/Vibe-Trading/workspaces/bb685f18514b4dc89018900bbb4687eb',
      ),
    )

    const [, init] = fetchMock.mock.calls[0]
    const headers = new Headers(init?.headers)
    expect(headers.get('cookie')).toBe('vt_session=semantier-user-session')
  })

  it('falls back to the public workspace when the backend is unavailable', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('offline')) as typeof fetch

    const result = await resolveActiveWorkspaceRoot()

    expect(result.workspaceId).toBe('public')
    expect(result.workspaceSlug).toBe('public')
    expect(result.path.endsWith('/workspaces/public')).toBe(true)
  })
})