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

function getPreferencePath(workspaceRoot?: string): string {
  if (!workspaceRoot) {
    throw new Error('workspaceRoot is required for knowledge preference path')
  }
  return path.join(
    resolveWorkspaceAppStateRoot(workspaceRoot),
    'knowledge-context-preferences.json',
  )
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

function hashDatasetGovernanceContext(context?: KnowledgeConfigContext): string {
  const payload = JSON.stringify({
    organizationId: context?.organizationId ?? null,
    datasetType: context?.datasetType ?? null,
    datasetKey: context?.datasetKey ?? null,
    activeDatasetVersionId: context?.activeDatasetVersionId ?? null,
  })
  let hash = 0
  for (let index = 0; index < payload.length; index += 1) {
    hash = (hash * 31 + payload.charCodeAt(index)) >>> 0
  }
  return `ui-${hash.toString(16).padStart(8, '0')}`
}

export function buildKnowledgeDatasetGovernanceConfig(
  context?: KnowledgeConfigContext,
): KnowledgeDatasetGovernanceConfig {
  const datasetType = String(context?.datasetType || '').toUpperCase() || null
  const organizationId = String(context?.organizationId || '').trim()
  const datasetKey = String(context?.datasetKey || '').trim() || null
  const datasetVersionId =
    String(context?.activeDatasetVersionId || '').trim() || null
  const isPrimary =
    datasetType === 'DEMO' ||
    datasetType === 'REAL' ||
    datasetType === 'DEFAULT_REALISTIC_SAMPLE'
  const isOptionalReference =
    datasetType === 'REFERENCE' || datasetType === 'BENCHMARK'
  const normalizedDatasetType =
    datasetType === 'DEFAULT_REALISTIC_SAMPLE' ? 'DEMO' : datasetType
  const auditHash = hashDatasetGovernanceContext(context)
  const optionalRole = datasetType === 'BENCHMARK' ? 'benchmark' : 'reference'
  const rows: Array<KnowledgeDatasetGovernanceRow> = isPrimary
    ? [
        {
          activationId: organizationId
            ? `compat_${organizationId}_primary_analytics`
            : 'compat_primary_analytics',
          sourceKind: 'dataset',
          semanticTier: 'T4',
          lifecycleStatus: 'approved',
          effectiveAuthorityStatus: 'binding_effective',
          userContextControlLevel: 'none',
          retrievalToggleVisible: false,
          promptContextToggleVisible: false,
          queryContextToggleVisible: false,
          retrievalEnabled: true,
          promptContextEnabled: true,
          queryContextEnabled: true,
          datasetUsageRole: 'primary_analytics',
          datasetType: normalizedDatasetType,
          datasetKey,
          datasetVersionId,
          sourceVersionId: datasetVersionId || datasetKey || 'active',
          lastActivationActor: 'Knowledge Base governance',
          auditHash,
          locked: true,
        },
      ]
    : isOptionalReference
      ? [
          {
            activationId: organizationId
              ? `compat_${organizationId}_${optionalRole}`
              : `compat_${optionalRole}`,
            sourceKind: 'dataset',
            semanticTier: 'T6',
            lifecycleStatus: 'approved',
            effectiveAuthorityStatus: 'optional_context',
            userContextControlLevel: 'full_optional_context',
            retrievalToggleVisible: true,
            promptContextToggleVisible: true,
            queryContextToggleVisible: true,
            retrievalEnabled: true,
            promptContextEnabled: true,
            queryContextEnabled: true,
            datasetUsageRole: optionalRole,
            datasetType: normalizedDatasetType,
            datasetKey,
            datasetVersionId,
            sourceVersionId: datasetVersionId || datasetKey || 'active',
            lastActivationActor: 'Knowledge Base governance',
            auditHash,
            locked: false,
          },
        ]
      : []

  return {
    activationResolverPolicyVersion: 'knowledge_activation_resolver.v1',
    resolvedActivationSetHash: auditHash,
    rows,
  }
}

function readPreferenceRecords(
  workspaceRoot?: string,
): Array<KnowledgeContextPreferenceRecord> {
  const preferencePath = getPreferencePath(workspaceRoot)
  try {
    if (!fs.existsSync(preferencePath)) return []
    const parsed = JSON.parse(
      fs.readFileSync(preferencePath, 'utf-8'),
    ) as unknown
    return Array.isArray(parsed)
      ? parsed.filter((item): item is KnowledgeContextPreferenceRecord => {
          return (
            item != null &&
            typeof item === 'object' &&
            typeof (item as KnowledgeContextPreferenceRecord).preferenceId ===
              'string' &&
            typeof (item as KnowledgeContextPreferenceRecord).activationId ===
              'string'
          )
        })
      : []
  } catch {
    return []
  }
}

function writePreferenceRecords(
  workspaceRoot: string,
  records: Array<KnowledgeContextPreferenceRecord>,
): void {
  const preferencePath = getPreferencePath(workspaceRoot)
  fs.mkdirSync(path.dirname(preferencePath), { recursive: true })
  fs.writeFileSync(preferencePath, JSON.stringify(records, null, 2), 'utf-8')
}

function preferenceRecordId(input: KnowledgeContextPreferencePatch): string {
  const subject = input.subjectId?.trim() || 'self'
  return `pref_${input.preferenceScope}_${subject}_${input.activationId}`
}

export function writeKnowledgeContextPreference(
  workspaceRoot: string,
  context: KnowledgeConfigContext | undefined,
  input: KnowledgeContextPreferencePatch,
): KnowledgeContextPreferenceRecord {
  const activationId = String(input.activationId || '').trim()
  if (!activationId) {
    throw new Error('activationId is required')
  }
  if (
    input.preferenceScope !== 'principal' &&
    input.preferenceScope !== 'role' &&
    input.preferenceScope !== 'workspace_default'
  ) {
    throw new Error('preferenceScope is invalid')
  }

  const forbiddenSharedActivationFields = [
    'activationStatus',
    'activation_status',
    'workspaceOverridePolicy',
    'workspace_override_policy',
    'datasetUsageRole',
    'dataset_usage_role',
    'authorityLevel',
    'authority_level',
  ]
  for (const key of forbiddenSharedActivationFields) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      throw new Error('preference updates must not mutate shared activation')
    }
  }

  const governance = buildKnowledgeDatasetGovernanceConfig(context)
  const row = governance.rows.find((candidate) => {
    return candidate.activationId === activationId
  })
  if (!row) {
    throw new Error('activation is not available in the resolved context')
  }
  if (row.locked) {
    throw new Error('binding authority preferences are not user-controllable')
  }
  if (
    input.retrievalEnabled != null &&
    !row.retrievalToggleVisible
  ) {
    throw new Error('retrieval preference is not permitted')
  }
  if (
    input.promptContextEnabled != null &&
    !row.promptContextToggleVisible
  ) {
    throw new Error('prompt-context preference is not permitted')
  }
  if (
    input.queryContextEnabled != null &&
    !row.queryContextToggleVisible
  ) {
    throw new Error('query-context preference is not permitted')
  }

  const records = readPreferenceRecords(workspaceRoot)
  const preferenceId = preferenceRecordId(input)
  const current = records.find((record) => record.preferenceId === preferenceId)
  const next: KnowledgeContextPreferenceRecord = {
    preferenceId,
    activationId,
    preferenceScope: input.preferenceScope,
    subjectId: input.subjectId?.trim() || null,
    retrievalEnabled:
      input.retrievalEnabled ?? current?.retrievalEnabled ?? row.retrievalEnabled,
    promptContextEnabled:
      input.promptContextEnabled ??
      current?.promptContextEnabled ??
      row.promptContextEnabled,
    queryContextEnabled:
      input.queryContextEnabled ??
      current?.queryContextEnabled ??
      row.queryContextEnabled,
    updatedAt: new Date().toISOString(),
  }
  const nextRecords = [
    ...records.filter((record) => record.preferenceId !== preferenceId),
    next,
  ]
  writePreferenceRecords(workspaceRoot, nextRecords)
  return next
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
