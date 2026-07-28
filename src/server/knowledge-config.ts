import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildSemantierAgentProxyHeaders,
  withSemantierAgentBase,
} from './semantier-agent-api'
import { resolveWorkspaceAppStateRoot } from './workspace-root'

export type KnowledgeBaseSource =
  | { type: 'local'; path: string }
  | { type: 'github'; repo: string; branch: string; path: string }

export type KnowledgeBaseConfig = {
  source: KnowledgeBaseSource
}

export type KnowledgeBaseResolvedConfig = {
  config: KnowledgeBaseConfig
  effectiveRoot: string
  configuredPath: string
  effectiveRootLabel: string
  usesWorkspaceDefault: boolean
  upstreamWikiPath: string
}

const DEFAULT_CONFIG: KnowledgeBaseConfig = {
  source: { type: 'local', path: '' },
}

type KnowledgeConfigContext = {
  datasetType?: string | null
  datasetKey?: string | null
  activeDatasetVersionId?: string | null
  organizationId?: string | null
}

export type KnowledgeDatasetGovernanceRow = {
  activationId: string
  sourceKind: 'dataset'
  semanticTier: 'T4' | 'T5' | 'T6'
  lifecycleStatus: 'approved' | 'proposed' | 'validated' | 'deprecated'
  effectiveAuthorityStatus: 'binding_effective' | 'optional_context'
  userContextControlLevel:
    | 'none'
    | 'query_context'
    | 'prompt_context'
    | 'full_optional_context'
  retrievalToggleVisible: boolean
  promptContextToggleVisible: boolean
  queryContextToggleVisible: boolean
  retrievalEnabled: boolean
  promptContextEnabled: boolean
  queryContextEnabled: boolean
  datasetUsageRole: 'primary_analytics' | 'benchmark' | 'reference' | 'sandbox'
  datasetType: string | null
  datasetKey: string | null
  datasetVersionId: string | null
  sourceVersionId: string
  lastActivationActor: string
  auditHash: string
  locked: boolean
}

export type KnowledgeDatasetGovernanceConfig = {
  activationResolverPolicyVersion: string
  resolvedActivationSetHash: string
  rows: Array<KnowledgeDatasetGovernanceRow>
}

export type KnowledgeContextPreferencePatch = {
  activationId: string
  preferenceScope: 'principal' | 'role' | 'workspace_default'
  subjectId?: string | null
  retrievalEnabled?: boolean
  promptContextEnabled?: boolean
  queryContextEnabled?: boolean
}

export function governedPreferenceRouteForScope(
  preferenceScope:
    | KnowledgeContextPreferencePatch['preferenceScope']
    | null
    | undefined,
): string {
  if (preferenceScope === 'role') return '/api/knowledge/preferences/role'
  if (preferenceScope === 'workspace_default') {
    return '/api/knowledge/preferences/workspace-default'
  }
  return '/api/knowledge/preferences/principal'
}

export type KnowledgeContextPreferenceRecord = {
  preferenceId: string
  activationId: string
  preferenceScope: 'principal' | 'role' | 'workspace_default'
  subjectId: string | null
  retrievalEnabled: boolean
  promptContextEnabled: boolean
  queryContextEnabled: boolean
  updatedAt: string
}

type GovernedActivationProjection = {
  activation_set_snapshot_id?: string | null
  activation_resolver_policy_version?: string | null
  resolved_activation_set_hash?: string | null
  sources?: Array<Record<string, unknown>>
}

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
)
const REPO_BOOTSTRAP_ROOT = path.join(REPO_ROOT, 'bootstrap')
export const WORKSPACE_WIKI_DIRNAME = 'wiki'
export const LEGACY_WORKSPACE_KNOWLEDGE_DIRNAME = 'knowledge-base'

function getConfigPath(workspaceRoot?: string): string {
  if (!workspaceRoot) {
    throw new Error('workspaceRoot is required for knowledge config path')
  }
  const appStateRoot = resolveWorkspaceAppStateRoot(workspaceRoot)
  return path.join(appStateRoot, 'knowledge-config.json')
}

function defaultWorkspaceKnowledgePath(workspaceRoot: string): string {
  return path.join(workspaceRoot, WORKSPACE_WIKI_DIRNAME)
}

function formatEffectiveRootLabel(
  workspaceRoot: string,
  effectiveRoot: string,
): string {
  const relative = path.relative(path.resolve(workspaceRoot), effectiveRoot)
  if (!relative || relative === '.') return WORKSPACE_WIKI_DIRNAME
  if (!relative.startsWith('..') && !path.isAbsolute(relative)) {
    return relative.split(path.sep).join('/')
  }
  return effectiveRoot
}

function isRealCompanyContext(context?: KnowledgeConfigContext): boolean {
  return String(context?.datasetType || '').toUpperCase() === 'REAL'
}

function toggleVisible(
  controlLevel: KnowledgeDatasetGovernanceRow['userContextControlLevel'],
  dimension: 'retrieval' | 'prompt_context' | 'query_context',
): boolean {
  if (controlLevel === 'full_optional_context') return true
  if (controlLevel === 'prompt_context') {
    return dimension === 'retrieval' || dimension === 'prompt_context'
  }
  if (controlLevel === 'query_context') return dimension === 'query_context'
  return false
}

export async function readGovernedKnowledgeDatasetGovernance(
  requestHeaders: HeadersInit | Headers,
): Promise<KnowledgeDatasetGovernanceConfig> {
  const headers = buildSemantierAgentProxyHeaders(requestHeaders, {
    forwardBrowserCookies: true,
  })
  const response = await fetch(
    withSemantierAgentBase('/api/knowledge/activations'),
    { headers },
  )
  if (!response.ok) {
    throw new Error(
      `Governed knowledge activation projection failed (${response.status})`,
    )
  }
  const payload = (await response.json()) as GovernedActivationProjection
  const rows: Array<KnowledgeDatasetGovernanceRow> = (payload.sources || [])
    .filter((source) => String(source.source_kind || '') === 'dataset')
    .map((source): KnowledgeDatasetGovernanceRow => {
      const controlLevel = String(
        source.user_context_control_level || 'none',
      ) as KnowledgeDatasetGovernanceRow['userContextControlLevel']
      const authorityStatus = String(
        source.effective_authority_status || 'optional_context',
      ) as KnowledgeDatasetGovernanceRow['effectiveAuthorityStatus']
      const usageRole = String(
        source.dataset_usage_role || 'reference',
      ) as KnowledgeDatasetGovernanceRow['datasetUsageRole']
      const semanticTier = String(
        source.semantic_tier || 'T6',
      ) as KnowledgeDatasetGovernanceRow['semanticTier']
      const activationId = String(source.activation_id || '')
      const datasetKey =
        source.dataset_key == null ? null : String(source.dataset_key)
      const datasetVersionId =
        source.dataset_version_id == null
          ? null
          : String(source.dataset_version_id)
      return {
        activationId,
        sourceKind: 'dataset',
        semanticTier,
        lifecycleStatus: 'approved',
        effectiveAuthorityStatus: authorityStatus,
        userContextControlLevel: controlLevel,
        retrievalToggleVisible: toggleVisible(controlLevel, 'retrieval'),
        promptContextToggleVisible: toggleVisible(
          controlLevel,
          'prompt_context',
        ),
        queryContextToggleVisible: toggleVisible(controlLevel, 'query_context'),
        retrievalEnabled: Boolean(source.retrieval_included),
        promptContextEnabled: Boolean(source.prompt_context_included),
        queryContextEnabled: Boolean(source.query_context_included),
        datasetUsageRole: usageRole,
        datasetType:
          source.dataset_type == null ? null : String(source.dataset_type),
        datasetKey,
        datasetVersionId,
        sourceVersionId:
          datasetVersionId ||
          datasetKey ||
          String(source.dataset_asset_version_id || activationId),
        lastActivationActor: 'Governed activation resolver',
        auditHash: String(payload.resolved_activation_set_hash || ''),
        locked: authorityStatus === 'binding_effective',
      }
    })

  return {
    activationResolverPolicyVersion: String(
      payload.activation_resolver_policy_version ||
        'knowledge_activation_resolver.unavailable',
    ),
    resolvedActivationSetHash: String(
      payload.resolved_activation_set_hash ||
        payload.activation_set_snapshot_id ||
        'governed_activation_snapshot_unavailable',
    ),
    rows,
  }
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

function rootIsInsideWorkspace(root: string, workspaceRoot: string): boolean {
  const resolvedRoot = path.resolve(root)
  const resolvedWorkspace = path.resolve(workspaceRoot)
  const relative = path.relative(resolvedWorkspace, resolvedRoot)
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
  return resolveKnowledgeBaseConfig(workspaceRoot, context).effectiveRoot
}

export function resolveKnowledgeBaseConfig(
  workspaceRoot?: string,
  context?: KnowledgeConfigContext,
): KnowledgeBaseResolvedConfig {
  if (!workspaceRoot) {
    throw new Error('workspaceRoot is required for knowledge root resolution')
  }
  const config = readKnowledgeBaseConfig(workspaceRoot, context)
  const upstreamWikiPath = path.resolve(workspaceRoot, WORKSPACE_WIKI_DIRNAME)

  if (config.source.type === 'local') {
    const configuredPath = config.source.path.trim()
    const configuredRoot = resolveConfiguredLocalPath(
      configuredPath,
      workspaceRoot,
    )
    const effectiveRoot =
      configuredRoot && rootIsInsideWorkspace(configuredRoot, workspaceRoot)
        ? configuredRoot
        : upstreamWikiPath
    return {
      config,
      effectiveRoot,
      configuredPath,
      effectiveRootLabel: formatEffectiveRootLabel(
        workspaceRoot,
        effectiveRoot,
      ),
      usesWorkspaceDefault:
        !configuredPath ||
        path.resolve(effectiveRoot) === path.resolve(upstreamWikiPath),
      upstreamWikiPath,
    }
  }

  if (process.env.KNOWLEDGE_DIR) {
    const effectiveRoot = path.resolve(process.env.KNOWLEDGE_DIR)
    return {
      config,
      effectiveRoot,
      configuredPath: config.source.path,
      effectiveRootLabel: effectiveRoot,
      usesWorkspaceDefault: false,
      upstreamWikiPath,
    }
  }

  return {
    config,
    effectiveRoot: upstreamWikiPath,
    configuredPath: config.source.path,
    effectiveRootLabel: formatEffectiveRootLabel(
      workspaceRoot,
      upstreamWikiPath,
    ),
    usesWorkspaceDefault: true,
    upstreamWikiPath,
  }
}
