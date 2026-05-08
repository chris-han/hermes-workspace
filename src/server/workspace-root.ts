import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  SEMANTIER_AGENT_AUTH_COOKIE,
  buildSemantierAgentProxyHeaders,
  semantierAgentAuthHeaders,
  withSemantierAgentBase,
} from './semantier-agent-api'

const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(SERVER_DIR, '..', '..', '..')
const DEFAULT_PUBLIC_WORKSPACE = path.join(REPO_ROOT, 'workspaces', 'public')
const BACKEND_PATHS_TTL_MS = 5_000
const WORKSPACE_APP_STATE_DIRNAME = '.hermes-workspace'

type BackendWorkspacePathsPayload = {
  authenticated?: unknown
  currentWorkspaceId?: unknown
  currentWorkspaceSlug?: unknown
  currentWorkspaceRoot?: unknown
  currentHermesHome?: unknown
}

export type ActiveWorkspaceRoot = {
  authenticated: boolean
  workspaceId: string
  workspaceSlug: string
  path: string
  hermesHome?: string
  source: 'backend' | 'fallback'
}

const workspaceRootCache = new Map<
  string,
  { value: ActiveWorkspaceRoot; fetchedAt: number }
>()
const workspaceRootPromises = new Map<
  string,
  Promise<ActiveWorkspaceRoot | null>
>()

function normalizeWorkspaceRoot(input: string): string {
  return path.resolve(input)
}

export class WorkspaceAuthRequiredError extends Error {
  constructor(message = 'Authentication required') {
    super(message)
    this.name = 'WorkspaceAuthRequiredError'
  }
}

function fallbackWorkspaceRoot(): never {
  throw new WorkspaceAuthRequiredError('Public workspace is disabled. Please log in.')
}

function cacheKeyFromHeaders(headers?: HeadersInit | Headers): string {
  const normalized = new Headers(headers ?? {})
  const cookieHeader = normalized.get('cookie')
  if (!cookieHeader) return '__anonymous__'
  const filtered = buildSemantierAgentProxyHeaders(
    { cookie: cookieHeader },
    {
      authHeaders: {},
      forwardBrowserCookies: true,
      allowedCookieNames: [SEMANTIER_AGENT_AUTH_COOKIE],
    },
  )
  return filtered.get('cookie') ?? '__anonymous__'
}

async function fetchWorkspaceRootFromBackend(
  requestHeaders?: HeadersInit | Headers,
): Promise<ActiveWorkspaceRoot | null> {
  const headers = buildSemantierAgentProxyHeaders(requestHeaders ?? {}, {
    authHeaders: semantierAgentAuthHeaders(),
    forwardBrowserCookies: true,
    allowedCookieNames: [SEMANTIER_AGENT_AUTH_COOKIE],
  })

  const response = await fetch(withSemantierAgentBase('/system/paths'), {
    headers,
    signal: AbortSignal.timeout(2_000),
  })
  if (!response.ok) return null

  const payload = (await response.json()) as BackendWorkspacePathsPayload
  const workspaceRoot =
    typeof payload.currentWorkspaceRoot === 'string'
      ? payload.currentWorkspaceRoot.trim()
      : ''
  if (!workspaceRoot) return null
  const hermesHome =
    typeof payload.currentHermesHome === 'string'
      ? payload.currentHermesHome.trim()
      : ''

  const isAuthenticated = payload.authenticated === true
  const workspaceId =
    typeof payload.currentWorkspaceId === 'string' &&
    payload.currentWorkspaceId.trim()
      ? payload.currentWorkspaceId.trim()
      : 'public'
  const workspaceSlug =
    typeof payload.currentWorkspaceSlug === 'string' &&
    payload.currentWorkspaceSlug.trim()
      ? payload.currentWorkspaceSlug.trim()
      : 'public'

  if (!isAuthenticated || workspaceId === 'public') {
    throw new WorkspaceAuthRequiredError()
  }

  return {
    authenticated: isAuthenticated,
    workspaceId,
    workspaceSlug,
    path: normalizeWorkspaceRoot(workspaceRoot),
    hermesHome: hermesHome ? normalizeWorkspaceRoot(hermesHome) : undefined,
    source: 'backend',
  }
}

export function ensureWorkspacePathWithinRoot(
  workspaceRoot: string,
  input: string,
): string {
  const normalizedRoot = normalizeWorkspaceRoot(workspaceRoot)
  const raw = input.trim()
  if (!raw) return normalizedRoot

  const resolved = path.isAbsolute(raw)
    ? path.resolve(raw)
    : path.resolve(normalizedRoot, raw)
  const relative = path.relative(normalizedRoot, resolved)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Path is outside workspace')
  }
  return resolved
}

export function resolveWorkspaceAppStateRoot(workspaceRoot: string): string {
  return path.join(
    normalizeWorkspaceRoot(workspaceRoot),
    WORKSPACE_APP_STATE_DIRNAME,
  )
}

export function resolveWorkspaceCwd(
  workspaceRoot: string,
  requestedCwd?: string | null,
): string {
  const normalizedRoot = normalizeWorkspaceRoot(workspaceRoot)
  const raw = requestedCwd?.trim() ?? ''
  if (!raw || raw === '~') {
    return normalizedRoot
  }
  if (raw.startsWith('~/')) {
    return ensureWorkspacePathWithinRoot(normalizedRoot, raw.slice(2))
  }
  return ensureWorkspacePathWithinRoot(normalizedRoot, raw)
}

export function formatWorkspaceCwdLabel(
  workspaceRoot: string,
  resolvedCwd: string,
): string {
  const normalizedRoot = normalizeWorkspaceRoot(workspaceRoot)
  const normalizedCwd = normalizeWorkspaceRoot(resolvedCwd)
  if (normalizedCwd === normalizedRoot) return '~'
  const relative = path
    .relative(normalizedRoot, normalizedCwd)
    .replace(/\\/g, '/')
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    return '~'
  }
  return `~/${relative}`
}

export function toWorkspaceRelativePath(
  workspaceRoot: string,
  resolvedPath: string,
): string {
  const relative = path.relative(
    normalizeWorkspaceRoot(workspaceRoot),
    resolvedPath,
  )
  return relative || ''
}

export async function resolveActiveWorkspaceRoot(
  requestHeaders?: HeadersInit | Headers,
): Promise<ActiveWorkspaceRoot> {
  const key = cacheKeyFromHeaders(requestHeaders)
  const cached = workspaceRootCache.get(key)
  if (cached && Date.now() - cached.fetchedAt < BACKEND_PATHS_TTL_MS) {
    return cached.value
  }

  const inflight = workspaceRootPromises.get(key)
  if (inflight) {
    const resolved = await inflight
    return resolved ?? fallbackWorkspaceRoot()
  }

  const promise = fetchWorkspaceRootFromBackend(requestHeaders)
    .catch((err) => {
      if (err instanceof WorkspaceAuthRequiredError) {
        throw err
      }
      return null
    })
    .finally(() => {
      workspaceRootPromises.delete(key)
    })
  workspaceRootPromises.set(key, promise)

  const resolved = await promise
  if (!resolved) {
    fallbackWorkspaceRoot()
  }
  workspaceRootCache.set(key, { value: resolved, fetchedAt: Date.now() })
  return resolved
}

export function resolveDefaultPublicWorkspaceRoot(): never {
  fallbackWorkspaceRoot()
}

export function workspaceRootExists(targetPath: string): boolean {
  return fs.existsSync(targetPath)
}
