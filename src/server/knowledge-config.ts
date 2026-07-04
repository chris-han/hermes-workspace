import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveWorkspaceAppStateRoot } from './workspace-root'

export type KnowledgeBaseSource =
  | { type: 'local'; path: string }
  | { type: 'github'; repo: string; branch: string; path: string }

export type KnowledgeBaseConfig = {
  source: KnowledgeBaseSource
}

const DEFAULT_CONFIG: KnowledgeBaseConfig = {
  source: { type: 'local', path: '' },
}

type KnowledgeConfigContext = {
  datasetType?: string | null
}

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
)
const REPO_BOOTSTRAP_ROOT = path.join(REPO_ROOT, 'bootstrap')

function getConfigPath(workspaceRoot?: string): string {
  if (!workspaceRoot) {
    throw new Error('workspaceRoot is required for knowledge config path')
  }
  const appStateRoot = resolveWorkspaceAppStateRoot(workspaceRoot)
  return path.join(appStateRoot, 'knowledge-config.json')
}

function defaultWorkspaceKnowledgePath(workspaceRoot: string): string {
  return path.join(workspaceRoot, 'knowledge-base')
}

function isRealCompanyContext(context?: KnowledgeConfigContext): boolean {
  return String(context?.datasetType || '').toUpperCase() === 'REAL'
}

function localPathInsideWorkspace(
  configuredPath: string,
  workspaceRoot: string,
): boolean {
  const resolved = resolveConfiguredLocalPath(configuredPath, workspaceRoot)
  if (!resolved) return true
  const relative = path.relative(path.resolve(workspaceRoot), resolved)
  return !relative.startsWith('..') && !path.isAbsolute(relative)
}

function isRepoBootstrapLocalPath(
  configuredPath: string,
  workspaceRoot?: string,
): boolean {
  const resolved = resolveConfiguredLocalPath(configuredPath, workspaceRoot)
  if (!resolved) return false
  const relative = path.relative(REPO_BOOTSTRAP_ROOT, resolved)
  return !relative.startsWith('..') && !path.isAbsolute(relative)
}

export function normalizeKnowledgeBaseConfigForWorkspace(
  config: KnowledgeBaseConfig,
  workspaceRoot?: string,
  context?: KnowledgeConfigContext,
): KnowledgeBaseConfig {
  if (!workspaceRoot || !isRealCompanyContext(context)) return config
  if (config.source.type !== 'local') return config
  if (
    !config.source.path.trim() ||
    isRepoBootstrapLocalPath(config.source.path, workspaceRoot) ||
    !localPathInsideWorkspace(config.source.path, workspaceRoot)
  ) {
    return {
      source: {
        type: 'local',
        path: defaultWorkspaceKnowledgePath(workspaceRoot),
      },
    }
  }
  return config
}

export function readKnowledgeBaseConfig(
  workspaceRoot?: string,
  context?: KnowledgeConfigContext,
): KnowledgeBaseConfig {
  const configPath = getConfigPath(workspaceRoot)
  let config = DEFAULT_CONFIG
  try {
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf-8')
      const parsed = JSON.parse(raw) as Partial<KnowledgeBaseConfig>
      config = {
        source: parsed.source ?? DEFAULT_CONFIG.source,
      }
    }
  } catch {
    // ignore parse errors, use default
  }
  return normalizeKnowledgeBaseConfigForWorkspace(
    config,
    workspaceRoot,
    context,
  )
}

export function writeKnowledgeBaseConfig(
  config: KnowledgeBaseConfig,
  workspaceRoot?: string,
): void {
  const configPath = getConfigPath(workspaceRoot)
  const dir = path.dirname(configPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
}

function resolveConfiguredLocalPath(
  configuredPath: string,
  workspaceRoot?: string,
): string {
  const trimmed = configuredPath.trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('~/')) {
    return path.resolve(trimmed.replace(/^~\//, `${os.homedir()}/`))
  }
  if (path.isAbsolute(trimmed)) {
    return path.resolve(trimmed)
  }
  if (workspaceRoot) {
    return path.resolve(workspaceRoot, trimmed)
  }
  return path.resolve(trimmed)
}

export function getKnowledgeBaseEffectiveRoot(
  workspaceRoot?: string,
  context?: KnowledgeConfigContext,
): string {
  const config = readKnowledgeBaseConfig(workspaceRoot, context)
  if (config.source.type === 'local') {
    const configuredRoot = resolveConfiguredLocalPath(
      config.source.path,
      workspaceRoot,
    )
    if (configuredRoot) return configuredRoot
  }
  // fallback: legacy env var or default
  if (process.env.KNOWLEDGE_DIR) return path.resolve(process.env.KNOWLEDGE_DIR)
  if (!workspaceRoot) {
    throw new Error('workspaceRoot is required for knowledge root resolution')
  }
  return path.resolve(workspaceRoot, 'knowledge-base')
}
