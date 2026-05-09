import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import YAML from 'yaml'

export type ProfileSummary = {
  name: string
  path: string
  active: boolean
  exists: boolean
  model?: string
  provider?: string
  skillCount: number
  sessionCount: number
  hasEnv: boolean
  updatedAt?: string
}

export type ProfileDetail = {
  name: string
  path: string
  active: boolean
  config: Record<string, unknown>
  envPath?: string
  hasEnv: boolean
  sessionsDir?: string
  skillsDir?: string
}

function getHermesRoot(): string {
  return path.join(os.homedir(), '.hermes')
}

function resolveHermesHome(hermesHome?: string): string {
  const raw = hermesHome?.trim()
  return path.resolve(raw && raw.length > 0 ? raw : getHermesRoot())
}

export function getProfilesRoot(hermesHome: string): string {
  return path.join(resolveHermesHome(hermesHome), 'profiles')
}

function getActiveProfilePath(hermesHome: string): string {
  return path.join(resolveHermesHome(hermesHome), 'active_profile')
}

function validateProfileName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Profile name is required')
  if (trimmed === 'default')
    throw new Error('Default profile cannot be modified here')
  if (
    trimmed.includes('/') ||
    trimmed.includes('\\') ||
    trimmed.includes('..')
  ) {
    throw new Error('Invalid profile name')
  }
  return trimmed
}

function safeReadText(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8')
}

function readYamlConfig(configPath: string): Record<string, unknown> {
  if (!fs.existsSync(configPath)) return {}
  try {
    return (
      (YAML.parse(safeReadText(configPath)) as Record<string, unknown>) || {}
    )
  } catch {
    return {}
  }
}

function countFilesRecursive(
  rootPath: string,
  predicate: (fullPath: string) => boolean,
): number {
  if (!fs.existsSync(rootPath)) return 0
  let count = 0
  const stack = [rootPath]
  while (stack.length > 0) {
    const current = stack.pop() as string
    let entries: Array<fs.Dirent> = []
    try {
      entries = fs.readdirSync(current, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name)
      if (entry.isDirectory()) {
        stack.push(fullPath)
        continue
      }
      if (predicate(fullPath)) count += 1
    }
  }
  return count
}

function latestMtime(paths: Array<string>): string | undefined {
  let latest = 0
  for (const target of paths) {
    if (!fs.existsSync(target)) continue
    try {
      const stat = fs.statSync(target)
      latest = Math.max(latest, stat.mtimeMs)
    } catch {
      // ignore
    }
  }
  return latest > 0 ? new Date(latest).toISOString() : undefined
}

export function getActiveProfileName(hermesHome: string): string {
  const activePath = getActiveProfilePath(hermesHome)
  if (!fs.existsSync(activePath)) return 'default'
  try {
    const raw = safeReadText(activePath).trim()
    return raw || 'default'
  } catch {
    return 'default'
  }
}

export function listProfiles(hermesHome: string): Array<ProfileSummary> {
  const root = resolveHermesHome(hermesHome)
  const profilesRoot = getProfilesRoot(root)
  const activeProfile = getActiveProfileName(root)
  const results: Array<ProfileSummary> = []

  if (fs.existsSync(profilesRoot)) {
    let entries: Array<fs.Dirent> = []
    try {
      entries = fs.readdirSync(profilesRoot, { withFileTypes: true })
    } catch {
      entries = []
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const name = entry.name
      const profilePath = path.join(profilesRoot, name)
      const configPath = path.join(profilePath, 'config.yaml')
      const envPath = path.join(profilePath, '.env')
      const skillsDir = path.join(profilePath, 'skills')
      const sessionsDir = path.join(profilePath, 'sessions')
      const config = readYamlConfig(configPath)
      const skillCount = countFilesRecursive(
        skillsDir,
        (full) => path.basename(full) === 'SKILL.md',
      )
      const sessionCount = countFilesRecursive(sessionsDir, (full) =>
        /\.(jsonl|json|sqlite|db)$/i.test(full),
      )
      results.push({
        name,
        path: profilePath,
        active: name === activeProfile,
        exists: true,
        model: typeof config.model === 'string' ? config.model : undefined,
        provider:
          typeof config.provider === 'string' ? config.provider : undefined,
        skillCount,
        sessionCount,
        hasEnv: fs.existsSync(envPath),
        updatedAt: latestMtime([
          profilePath,
          configPath,
          envPath,
          skillsDir,
          sessionsDir,
        ]),
      })
    }
  }

  const config = readYamlConfig(path.join(root, 'config.yaml'))
  results.unshift({
    name: 'default',
    path: root,
    active: activeProfile === 'default',
    exists: true,
    model: typeof config.model === 'string' ? config.model : undefined,
    provider: typeof config.provider === 'string' ? config.provider : undefined,
    skillCount: countFilesRecursive(
      path.join(root, 'skills'),
      (full) => path.basename(full) === 'SKILL.md',
    ),
    sessionCount: countFilesRecursive(path.join(root, 'sessions'), (full) =>
      /\.(jsonl|json|sqlite|db)$/i.test(full),
    ),
    hasEnv: fs.existsSync(path.join(root, '.env')),
    updatedAt: latestMtime([root, path.join(root, 'config.yaml')]),
  })

  results.sort((a, b) => {
    if (a.active && !b.active) return -1
    if (!a.active && b.active) return 1
    return Date.parse(b.updatedAt || '') - Date.parse(a.updatedAt || '')
  })
  return results
}

export function readProfile(name: string, hermesHome: string): ProfileDetail {
  const root = resolveHermesHome(hermesHome)
  const active = getActiveProfileName(root)
  const normalized = name.trim() || 'default'
  const profilePath =
    normalized === 'default'
      ? root
      : path.join(getProfilesRoot(root), validateProfileName(normalized))
  if (!fs.existsSync(profilePath)) throw new Error('Profile not found')
  const configPath = path.join(profilePath, 'config.yaml')
  const envPath = path.join(profilePath, '.env')
  const sessionsDir = path.join(profilePath, 'sessions')
  const skillsDir = path.join(profilePath, 'skills')
  return {
    name: normalized,
    path: profilePath,
    active: normalized === active,
    config: readYamlConfig(configPath),
    envPath: fs.existsSync(envPath) ? envPath : undefined,
    hasEnv: fs.existsSync(envPath),
    sessionsDir: fs.existsSync(sessionsDir) ? sessionsDir : undefined,
    skillsDir: fs.existsSync(skillsDir) ? skillsDir : undefined,
  }
}

export function setActiveProfile(name: string, hermesHome: string): void {
  const root = resolveHermesHome(hermesHome)
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Profile name is required')
  // "default" means clear the active_profile file (revert to default)
  if (trimmed === 'default') {
    const activePath = getActiveProfilePath(root)
    if (fs.existsSync(activePath)) fs.unlinkSync(activePath)
    return
  }
  const normalized = validateProfileName(trimmed)
  const profilePath = path.join(getProfilesRoot(root), normalized)
  if (!fs.existsSync(profilePath)) throw new Error('Profile not found')
  fs.mkdirSync(root, { recursive: true })
  fs.writeFileSync(getActiveProfilePath(root), `${normalized}\n`, 'utf-8')
}

export function createProfile(
  name: string,
  options?: { cloneFrom?: string; model?: string; provider?: string },
  hermesHome?: string,
): ProfileDetail {
  const root = resolveHermesHome(hermesHome)
  const normalized = validateProfileName(name)
  const profilePath = path.join(getProfilesRoot(root), normalized)
  if (fs.existsSync(profilePath)) throw new Error('Profile already exists')
  fs.mkdirSync(profilePath, { recursive: true })

  const configPath = path.join(profilePath, 'config.yaml')

  // Clone config from source profile if specified
  if (options?.cloneFrom) {
    const sourceName = validateProfileName(options.cloneFrom)
    const sourceConfigPath = path.join(
      getProfilesRoot(root),
      sourceName,
      'config.yaml',
    )
    if (fs.existsSync(sourceConfigPath)) {
      fs.copyFileSync(sourceConfigPath, configPath)
    } else {
      fs.writeFileSync(
        configPath,
        YAML.stringify({ model: '', provider: '' }),
        'utf-8',
      )
    }
  } else {
    fs.writeFileSync(
      configPath,
      YAML.stringify({ model: '', provider: '' }),
      'utf-8',
    )
  }

  // Override model/provider if specified
  if (options?.model || options?.provider) {
    const config = readYamlConfig(configPath)
    if (options.model) config.model = options.model
    if (options.provider) config.provider = options.provider
    fs.writeFileSync(configPath, YAML.stringify(config), 'utf-8')
  }

  // Create subdirectories
  fs.mkdirSync(path.join(profilePath, 'skills'), { recursive: true })
  fs.mkdirSync(path.join(profilePath, 'sessions'), { recursive: true })

  return readProfile(normalized, root)
}

export function deleteProfile(name: string, hermesHome: string): void {
  const root = resolveHermesHome(hermesHome)
  const normalized = validateProfileName(name)
  if (normalized === getActiveProfileName(root))
    throw new Error('Cannot delete the active profile')
  const profilePath = path.join(getProfilesRoot(root), normalized)
  if (!fs.existsSync(profilePath)) throw new Error('Profile not found')
  const trashDir = path.join(root, 'trash')
  fs.mkdirSync(trashDir, { recursive: true })
  const trashName = `${normalized}-${Date.now()}`
  fs.renameSync(profilePath, path.join(trashDir, trashName))
}

export function updateProfileConfig(
  name: string,
  patch: Record<string, unknown>,
  hermesHome: string,
): ProfileDetail {
  const root = resolveHermesHome(hermesHome)
  const normalized = name.trim() || 'default'
  const profilePath =
    normalized === 'default'
      ? root
      : path.join(getProfilesRoot(root), validateProfileName(normalized))
  if (!fs.existsSync(profilePath)) throw new Error('Profile not found')
  const configPath = path.join(profilePath, 'config.yaml')
  const current = readYamlConfig(configPath)
  const merged = { ...current, ...patch }
  // Strip undefined keys
  for (const key of Object.keys(merged)) {
    if (merged[key] === undefined) delete merged[key]
  }
  fs.mkdirSync(path.dirname(configPath), { recursive: true })
  fs.writeFileSync(configPath, YAML.stringify(merged), 'utf-8')
  return readProfile(normalized, root)
}

export function renameProfile(
  oldName: string,
  newName: string,
  hermesHome: string,
): ProfileDetail {
  const root = resolveHermesHome(hermesHome)
  const from = validateProfileName(oldName)
  const to = validateProfileName(newName)
  const fromPath = path.join(getProfilesRoot(root), from)
  const toPath = path.join(getProfilesRoot(root), to)
  if (!fs.existsSync(fromPath)) throw new Error('Profile not found')
  if (fs.existsSync(toPath)) throw new Error('Target profile already exists')
  fs.renameSync(fromPath, toPath)
  if (getActiveProfileName(root) === from) {
    fs.writeFileSync(getActiveProfilePath(root), `${to}\n`, 'utf-8')
  }
  return readProfile(to, root)
}
