import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { semantierAgentAuthHeaders, withSemantierAgentBase } from './semantier-agent-api'

const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(SERVER_DIR, '..', '..', '..')
const REPO_AGENT_HERMES_HOME = path.join(REPO_ROOT, 'agent', '.hermes')
const BACKEND_PATHS_TTL_MS = 30_000

type BackendPathsPayload = {
  hermesHome?: unknown
}

let backendHermesHomeCache: string | null = null
let backendHermesHomeFetchedAt = 0
let backendHermesHomePromise: Promise<string | null> | null = null

export type ResolveHermesHomeOptions = {
  env?: NodeJS.ProcessEnv
  homeDir?: string
  repoAgentHermesHome?: string
  existsSync?: (targetPath: string) => boolean
}

function expandHome(input: string, homeDir: string): string {
  if (input === '~') return homeDir
  if (input.startsWith('~/')) return path.join(homeDir, input.slice(2))
  return input
}

export function resolveHermesHome(
  options: ResolveHermesHomeOptions = {},
): string {
  const env = options.env ?? process.env
  const homeDir = options.homeDir ?? os.homedir()
  const existsSync = options.existsSync ?? fs.existsSync
  const repoAgentHermesHome =
    options.repoAgentHermesHome ?? REPO_AGENT_HERMES_HOME

  const configured = env.HERMES_HOME?.trim()
  if (configured) {
    return path.resolve(expandHome(configured, homeDir))
  }

  if (existsSync(repoAgentHermesHome)) {
    return path.resolve(repoAgentHermesHome)
  }

  return path.resolve(homeDir, '.hermes')
}

export function resolveHermesPath(...segments: string[]): string {
  return path.join(resolveHermesHome(), ...segments)
}

async function fetchBackendHermesHome(): Promise<string | null> {
  const response = await fetch(withSemantierAgentBase('/system/paths'), {
    headers: semantierAgentAuthHeaders(),
    signal: AbortSignal.timeout(2_000),
  })
  if (!response.ok) return null

  const payload = (await response.json()) as BackendPathsPayload
  const hermesHome =
    typeof payload.hermesHome === 'string' ? payload.hermesHome.trim() : ''
  return hermesHome ? path.resolve(hermesHome) : null
}

export async function resolveHermesHomeFromBackend(): Promise<string> {
  const isFresh = Date.now() - backendHermesHomeFetchedAt < BACKEND_PATHS_TTL_MS
  if (backendHermesHomeCache && isFresh) {
    return backendHermesHomeCache
  }

  if (!backendHermesHomePromise) {
    backendHermesHomePromise = fetchBackendHermesHome()
      .catch(() => null)
      .finally(() => {
        backendHermesHomePromise = null
      })
  }

  const fromBackend = await backendHermesHomePromise
  if (fromBackend) {
    backendHermesHomeCache = fromBackend
    backendHermesHomeFetchedAt = Date.now()
    return fromBackend
  }

  const fallback = resolveHermesHome()
  backendHermesHomeCache = fallback
  backendHermesHomeFetchedAt = Date.now()
  return fallback
}

export async function resolveHermesPathFromBackend(
  ...segments: string[]
): Promise<string> {
  return path.join(await resolveHermesHomeFromBackend(), ...segments)
}

export async function resolveHermesConfigPathFromBackend(): Promise<string> {
  return resolveHermesPathFromBackend('config.yaml')
}

export async function resolveHermesEnvPathFromBackend(): Promise<string> {
  return resolveHermesPathFromBackend('.env')
}

export async function resolveHermesProfilesPathFromBackend(): Promise<string> {
  return resolveHermesPathFromBackend('profiles')
}

export function resolveHermesConfigPath(): string {
  return resolveHermesPath('config.yaml')
}

export function resolveHermesEnvPath(): string {
  return resolveHermesPath('.env')
}

export function resolveHermesProfilesPath(): string {
  return resolveHermesPath('profiles')
}

export function getRepoAgentHermesHome(): string {
  return REPO_AGENT_HERMES_HOME
}