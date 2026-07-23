import fs from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  resolveWorkspaceAppStateRoot,
  resolveActiveWorkspaceRoot,
} from './workspace-root'

const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(SERVER_DIR, '..', '..', '..')
const REPO_AGENT_HERMES_HOME = path.join(REPO_ROOT, 'agent', '.hermes')
const SEMANTIER_RUNTIME_ROOT_ENV = 'SEMANTIER_LOCAL_STATE_DIR'
const ACCESS_CONTROL_FILENAME = 'access-control.json'

export type AccessControlRole = 'regular' | 'administrator'

export type HermesAccessControl = {
  role: AccessControlRole
  administratorHome: string
}

export type HermesAccessControlResolution = HermesAccessControl & {
  workspaceRoot: string
  workspaceHermesHome: string
  effectiveHermesHome: string
  defaultAdministratorHome: string
}
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

function defaultAccessControl(homeDir = os.homedir()): HermesAccessControl {
  return {
    role: 'regular',
    administratorHome: path.resolve(expandHome(REPO_AGENT_HERMES_HOME, homeDir)),
  }
}

function normalizeAccessControlRole(input: unknown): AccessControlRole {
  return input === 'administrator' ? 'administrator' : 'regular'
}

function normalizeAdministratorHome(input: unknown, homeDir = os.homedir()): string {
  const raw = typeof input === 'string' ? input.trim() : ''
  const fallback = defaultAccessControl(homeDir).administratorHome
  if (!raw) return fallback
  return path.resolve(expandHome(raw, homeDir))
}

function resolveAccessControlFile(workspaceRoot: string): string {
  return path.join(
    resolveWorkspaceAppStateRoot(workspaceRoot),
    ACCESS_CONTROL_FILENAME,
  )
}

export function resolveHermesHomeForWorkspace(
  workspaceRoot: string,
  accessControl: HermesAccessControl,
): string {
  const normalizedWorkspaceRoot = path.resolve(workspaceRoot)
  return normalizedWorkspaceRoot
}

export async function readWorkspaceAccessControl(
  workspaceRoot: string,
): Promise<HermesAccessControl> {
  const normalizedWorkspaceRoot = path.resolve(workspaceRoot)
  const defaults = defaultAccessControl()
  const filePath = resolveAccessControlFile(normalizedWorkspaceRoot)

  try {
    const raw = await fsp.readFile(filePath, 'utf-8')
    const parsed = JSON.parse(raw) as {
      role?: unknown
      administratorHome?: unknown
    }
    return {
      role: normalizeAccessControlRole(parsed.role),
      administratorHome: normalizeAdministratorHome(parsed.administratorHome),
    }
  } catch {
    return defaults
  }
}

export async function writeWorkspaceAccessControl(
  workspaceRoot: string,
  updates: Partial<HermesAccessControl>,
): Promise<HermesAccessControl> {
  const normalizedWorkspaceRoot = path.resolve(workspaceRoot)
  const current = await readWorkspaceAccessControl(normalizedWorkspaceRoot)
  const next: HermesAccessControl = {
    role:
      updates.role === undefined
        ? current.role
        : normalizeAccessControlRole(updates.role),
    administratorHome:
      updates.administratorHome === undefined
        ? current.administratorHome
        : normalizeAdministratorHome(updates.administratorHome),
  }

  const stateRoot = resolveWorkspaceAppStateRoot(normalizedWorkspaceRoot)
  const filePath = resolveAccessControlFile(normalizedWorkspaceRoot)
  await fsp.mkdir(stateRoot, { recursive: true })
  await fsp.writeFile(filePath, JSON.stringify(next, null, 2) + '\n', 'utf-8')
  return next
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
  const accessControl = await readWorkspaceAccessControl(activeWorkspace.path)
  return resolveHermesHomeForWorkspace(activeWorkspace.path, accessControl)
}

export function isSemantierRuntimeRepo(): boolean {
  return fs.existsSync(path.join(REPO_ROOT, 'src', 'agents', 'launcher.py'))
}

export function resolveSemantierRuntimeHome(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const configured = env[SEMANTIER_RUNTIME_ROOT_ENV]?.trim()
  const runtimeRoot = isSemantierRuntimeRepo()
    ? REPO_ROOT
    : path.resolve(REPO_ROOT, '..')
  const raw = configured || path.join(runtimeRoot, '.semantier-home')
  const expanded = expandHome(raw, os.homedir())
  return path.resolve(
    path.isAbsolute(expanded) ? expanded : path.join(runtimeRoot, expanded),
  )
}

export async function resolveInferenceHermesHomeFromBackend(
  requestHeaders?: HeadersInit | Headers,
): Promise<string> {
  if (isSemantierRuntimeRepo()) {
    return resolveSemantierRuntimeHome()
  }
  return resolveHermesHomeFromBackend(requestHeaders)
}

export async function resolveWorkspaceHermesHomeFromBackend(
  requestHeaders?: HeadersInit | Headers,
): Promise<string> {
  return resolveHermesHomeFromBackend(requestHeaders)
}

export async function resolveHermesAccessControlFromBackend(
  requestHeaders?: HeadersInit | Headers,
): Promise<HermesAccessControlResolution> {
  const activeWorkspace = await resolveActiveWorkspaceRoot(requestHeaders)
  const accessControl = await readWorkspaceAccessControl(activeWorkspace.path)
  const workspaceRoot = path.resolve(activeWorkspace.path)
  const workspaceHermesHome = workspaceRoot
  const effectiveHermesHome = resolveHermesHomeForWorkspace(
    workspaceRoot,
    accessControl,
  )
  return {
    ...accessControl,
    workspaceRoot,
    workspaceHermesHome,
    effectiveHermesHome,
    defaultAdministratorHome: defaultAccessControl().administratorHome,
  }
}

export async function updateHermesAccessControlFromBackend(
  requestHeaders: HeadersInit | Headers | undefined,
  updates: Partial<HermesAccessControl>,
): Promise<HermesAccessControlResolution> {
  const activeWorkspace = await resolveActiveWorkspaceRoot(requestHeaders)
  const workspaceRoot = path.resolve(activeWorkspace.path)
  const next = await writeWorkspaceAccessControl(workspaceRoot, updates)

  if (next.role === 'administrator') {
    await fsp.mkdir(next.administratorHome, { recursive: true })
  }

  const workspaceHermesHome = workspaceRoot
  const effectiveHermesHome = resolveHermesHomeForWorkspace(
    workspaceRoot,
    next,
  )
  return {
    ...next,
    workspaceRoot,
    workspaceHermesHome,
    effectiveHermesHome,
    defaultAdministratorHome: defaultAccessControl().administratorHome,
  }
}

export async function resolveHermesPathFromBackend(
  requestHeaders: HeadersInit | Headers | undefined,
  ...segments: Array<string>
): Promise<string> {
  return path.join(
    await resolveHermesHomeFromBackend(requestHeaders),
    ...segments,
  )
}

export async function resolveHermesConfigPathFromBackend(
  requestHeaders?: HeadersInit | Headers,
): Promise<string> {
  return path.join(
    await resolveInferenceHermesHomeFromBackend(requestHeaders),
    'config.yaml',
  )
}

export async function resolveHermesEnvPathFromBackend(
  requestHeaders?: HeadersInit | Headers,
): Promise<string> {
  return path.join(await resolveInferenceHermesHomeFromBackend(requestHeaders), '.env')
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
