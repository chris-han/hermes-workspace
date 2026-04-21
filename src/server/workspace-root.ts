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
}

export type ActiveWorkspaceRoot = {
  authenticated: boolean
  workspaceId: string
  workspaceSlug: string
  path: string
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

function fallbackWorkspaceRoot(): ActiveWorkspaceRoot {
  const configured = process.env.HERMES_WORKSPACE_DIR?.trim()
  const target = configured ? configured : DEFAULT_PUBLIC_WORKSPACE
  return {
    authenticated: false,
    workspaceId: 'public',
    workspaceSlug: 'public',
    path: normalizeWorkspaceRoot(target),
    source: 'fallback',
  }
}

function cacheKeyFromHeaders(headers?: HeadersInit | Headers): string {
  const normalized = new Headers(headers ?? {})
  return normalized.get('cookie') ?? '__anonymous__'
}

async function fetchWorkspaceRootFromBackend(
  requestHeaders?: HeadersInit | Headers,
): Promise<ActiveWorkspaceRoot | null> {
  const response = await fetch(withSemantierAgentBase('/system/paths'), {
    headers: buildSemantierAgentProxyHeaders(requestHeaders ?? {}, {
      authHeaders: semantierAgentAuthHeaders(),
      forwardBrowserCookies: true,
      allowedCookieNames: [SEMANTIER_AGENT_AUTH_COOKIE],
    }),
    signal: AbortSignal.timeout(2_000),
  })
  if (!response.ok) return null

  const payload = (await response.json()) as BackendWorkspacePathsPayload
  const workspaceRoot =
    typeof payload.currentWorkspaceRoot === 'string'
      ? payload.currentWorkspaceRoot.trim()
      : ''
  if (!workspaceRoot) return null

  return {
    authenticated: payload.authenticated === true,
    workspaceId:
      typeof payload.currentWorkspaceId === 'string' &&
      payload.currentWorkspaceId.trim()
        ? payload.currentWorkspaceId.trim()
        : 'public',
    workspaceSlug:
      typeof payload.currentWorkspaceSlug === 'string' &&
      payload.currentWorkspaceSlug.trim()
        ? payload.currentWorkspaceSlug.trim()
        : 'public',
    path: normalizeWorkspaceRoot(workspaceRoot),
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
    .catch(() => null)
    .finally(() => {
      workspaceRootPromises.delete(key)
    })
  workspaceRootPromises.set(key, promise)

  const resolved = (await promise) ?? fallbackWorkspaceRoot()
  workspaceRootCache.set(key, { value: resolved, fetchedAt: Date.now() })
  return resolved
}

export function resolveDefaultPublicWorkspaceRoot(): string {
  return fallbackWorkspaceRoot().path
}

export function workspaceRootExists(targetPath: string): boolean {
  return fs.existsSync(targetPath)
}
