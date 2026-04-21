import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveActiveWorkspaceRoot } from './workspace-root'

const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(SERVER_DIR, '..', '..', '..')
const REPO_AGENT_HERMES_HOME = path.join(REPO_ROOT, 'agent', '.hermes')
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

  throw new Error(
    'Hermes home is not configured. Set HERMES_HOME or provide a workspace-scoped Hermes home.',
  )
}

export function resolveHermesPath(...segments: Array<string>): string {
  return path.join(resolveHermesHome(), ...segments)
}

export async function resolveHermesHomeFromBackend(
  requestHeaders?: HeadersInit | Headers,
): Promise<string> {
  const activeWorkspace = await resolveActiveWorkspaceRoot(requestHeaders)
  return path.resolve(activeWorkspace.path, '.hermes')
}

export async function resolveHermesPathFromBackend(
  requestHeaders: HeadersInit | Headers | undefined,
  ...segments: Array<string>
): Promise<string> {
  return path.join(await resolveHermesHomeFromBackend(requestHeaders), ...segments)
}

export async function resolveHermesConfigPathFromBackend(
  requestHeaders?: HeadersInit | Headers,
): Promise<string> {
  return resolveHermesPathFromBackend(requestHeaders, 'config.yaml')
}

export async function resolveHermesEnvPathFromBackend(
  requestHeaders?: HeadersInit | Headers,
): Promise<string> {
  return resolveHermesPathFromBackend(requestHeaders, '.env')
}

export async function resolveHermesProfilesPathFromBackend(
  requestHeaders?: HeadersInit | Headers,
): Promise<string> {
  return resolveHermesPathFromBackend(requestHeaders, 'profiles')
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
