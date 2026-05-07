import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
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

function getConfigPath(workspaceRoot?: string): string {
  if (workspaceRoot) {
    const appStateRoot = resolveWorkspaceAppStateRoot(workspaceRoot)
    return path.join(appStateRoot, 'knowledge-config.json')
  }
  const hermesHome = path.join(os.homedir(), '.hermes')
  return path.join(hermesHome, 'knowledge-config.json')
}

export function readKnowledgeBaseConfig(workspaceRoot?: string): KnowledgeBaseConfig {
  const configPath = getConfigPath(workspaceRoot)
  try {
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf-8')
      const parsed = JSON.parse(raw) as Partial<KnowledgeBaseConfig>
      return {
        source: parsed.source ?? DEFAULT_CONFIG.source,
      }
    }
  } catch {
    // ignore parse errors, use default
  }
  return DEFAULT_CONFIG
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

export function getKnowledgeBaseEffectiveRoot(workspaceRoot?: string): string {
  const config = readKnowledgeBaseConfig(workspaceRoot)
  if (config.source.type === 'local') {
    const configuredRoot = resolveConfiguredLocalPath(
      config.source.path,
      workspaceRoot,
    )
    if (configuredRoot) return configuredRoot
  }
  // fallback: legacy env var or default
  if (process.env.KNOWLEDGE_DIR) return path.resolve(process.env.KNOWLEDGE_DIR)

  if (workspaceRoot) {
    return path.resolve(workspaceRoot, 'knowledge-base')
  }

  const hermesKnowledge = path.join(os.homedir(), '.hermes', 'knowledge')
  if (fs.existsSync(hermesKnowledge)) return hermesKnowledge
  return hermesKnowledge
}
