import {
  SEMANTIER_AGENT_API,
  SEMANTIER_AGENT_AUTH_COOKIE,
  buildSemantierAgentProxyHeaders,
  semantierAgentAuthHeaders,
} from './semantier-agent-api'

/**
 * Semantier unicell architecture — agent wrapper is the only backend.
 */

export let HERMES_API = process.env.HERMES_API_URL || 'http://127.0.0.1:8899'
export let HERMES_DASHBOARD_URL = HERMES_API

export const GATEWAY_MODE_OVERRIDE_ENV = 'HERMES_WORKSPACE_MODE'

const PROBE_TIMEOUT_MS = 3_000
const PROBE_TTL_MS = 120_000

// ── Types ─────────────────────────────────────────────────────────

export type CoreCapabilities = {
  health: boolean
  chatCompletions: boolean
  models: boolean
  streaming: boolean
  probed: boolean
}

export type EnhancedCapabilities = {
  sessions: boolean
  enhancedChat: boolean
  skills: boolean
  memory: boolean
  config: boolean
  jobs: boolean
}

export type DashboardCapabilities = {
  dashboard: {
    available: boolean
    url: string
  }
}

export type SemantierCapabilities = {
  semantier: {
    available: boolean
    url: string
  }
}

/** Full capabilities — backward compat with existing code */
export type GatewayCapabilities = CoreCapabilities &
  EnhancedCapabilities &
  DashboardCapabilities &
  SemantierCapabilities

export type GatewayMode =
  | 'semantier-unicell'
  | 'zero-fork'
  | 'enhanced-fork'
  | 'portable'
  | 'disconnected'

export type GatewayModeSource = 'probe' | 'override'

export type ChatMode = 'enhanced-hermes' | 'portable' | 'disconnected'

export type ConnectionStatus =
  | 'connected'
  | 'enhanced'
  | 'partial'
  | 'disconnected'

const GATEWAY_MODE_LABELS: Record<GatewayMode, string> = {
  'semantier-unicell': 'Semantier Unicell',
  'zero-fork': 'Zero Fork',
  'enhanced-fork': 'Enhanced Fork',
  portable: 'Portable',
  disconnected: 'Disconnected',
}

// ── State ─────────────────────────────────────────────────────────

let capabilities: GatewayCapabilities = {
  health: false,
  chatCompletions: false,
  models: false,
  streaming: false,
  sessions: false,
  enhancedChat: false,
  skills: false,
  memory: false,
  config: false,
  jobs: false,
  dashboard: {
    available: false,
    url: HERMES_DASHBOARD_URL,
  },
  semantier: {
    available: false,
    url: SEMANTIER_AGENT_API,
  },
  probed: false,
}

let probePromise: Promise<GatewayCapabilities> | null = null
let lastProbeAt = 0
let lastLoggedSummary = ''

function normalizeGatewayModeOverride(
  value: string | undefined,
): GatewayMode | null {
  const normalized = value?.trim().toLowerCase()
  if (!normalized) return null
  if (normalized === 'semantier-native') return 'semantier-unicell'
  if (
    normalized === 'semantier-unicell' ||
    normalized === 'zero-fork' ||
    normalized === 'enhanced-fork' ||
    normalized === 'portable' ||
    normalized === 'disconnected'
  ) {
    return normalized
  }
  return null
}

export const BEARER_TOKEN = process.env.HERMES_API_TOKEN || ''

function authHeaders(): Record<string, string> {
  return BEARER_TOKEN ? { Authorization: `Bearer ${BEARER_TOKEN}` } : {}
}

function withDashboardBase(path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  return `${HERMES_API}${path.startsWith('/') ? path : `/${path}`}`
}

export async function dashboardFetch(
  path: string,
  init: RequestInit = {},
  options?: {
    requestHeaders?: HeadersInit | Headers
  },
): Promise<Response> {
  const requestPath = withDashboardBase(path)
  const method = (init.method || 'GET').toUpperCase()
  const headers = buildSemantierAgentProxyHeaders(init.headers ?? {}, {
    authHeaders: {
      ...authHeaders(),
      ...semantierAgentAuthHeaders(),
    },
    forwardBrowserCookies: true,
    allowedCookieNames: [SEMANTIER_AGENT_AUTH_COOKIE],
  })

  if (options?.requestHeaders) {
    const forwarded = buildSemantierAgentProxyHeaders(options.requestHeaders, {
      authHeaders: {},
      forwardBrowserCookies: true,
      allowedCookieNames: [SEMANTIER_AGENT_AUTH_COOKIE],
    })
    const cookie = forwarded.get('cookie')
    if (cookie && !headers.has('cookie')) {
      headers.set('cookie', cookie)
    }
  }

  return fetch(requestPath, {
    ...init,
    method,
    headers,
  })
}

// ── Probing ───────────────────────────────────────────────────────

async function probe(path: string): Promise<boolean> {
  try {
    const res = await fetch(`${HERMES_API}${path}`, {
      headers: authHeaders(),
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    })
    if (res.status === 404 || res.status === 403) return false
    return true
  } catch {
    return false
  }
}

async function probeSemantier(): Promise<{ available: boolean; url: string }> {
  try {
    const res = await fetch(`${SEMANTIER_AGENT_API}/health`, {
      headers: semantierAgentAuthHeaders(),
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    })
    return { available: res.ok, url: SEMANTIER_AGENT_API }
  } catch {
    return { available: false, url: SEMANTIER_AGENT_API }
  }
}

const OPTIONAL_APIS = new Set(['dashboard'])

function logCapabilities(next: GatewayCapabilities): void {
  const core: Array<string> = []
  const enhanced: Array<string> = []
  const missing: Array<string> = []

  const coreKeys: Array<keyof CoreCapabilities> = ['health']
  const enhancedKeys: Array<keyof EnhancedCapabilities> = []

  for (const key of coreKeys) {
    ;(next[key] ? core : missing).push(key)
  }
  for (const key of enhancedKeys) {
    ;(next[key] ? enhanced : missing).push(key)
  }
  if (next.dashboard.available) core.push('dashboard')
  else missing.push('dashboard')
  if (next.semantier.available) core.push('semantier')
  else missing.push('semantier')

  const mode = getGatewayMode()
  const summary = `[gateway] gateway=${HERMES_API} mode=${mode} core=[${core.join(', ')}] enhanced=[${enhanced.join(', ')}] missing=[${missing.join(', ')}]`
  if (summary === lastLoggedSummary) return
  lastLoggedSummary = summary
  console.log(summary)

}

function autoDetectGatewayUrl(): void {
  HERMES_API = process.env.HERMES_API_URL || 'http://127.0.0.1:8899'
}

export function probeGateway(options?: {
  force?: boolean
}): GatewayCapabilities {
  const force = options?.force === true
  if (!force && capabilities.probed) {
    return capabilities
  }

  autoDetectGatewayUrl()

  capabilities = {
    health: true,
    chatCompletions: false,
    models: false,
    streaming: false,
    probed: true,
    sessions: false,
    enhancedChat: false,
    skills: false,
    // Memory is always available: workspace reads $HERMES_HOME/MEMORY.md +
    // memory/*.md + memories/*.md directly from the local filesystem.
    // No remote gateway endpoint is required.
    memory: true,
    config: false,
    jobs: false,
    dashboard: { available: true, url: HERMES_API },
    semantier: { available: true, url: SEMANTIER_AGENT_API },
  }
  lastProbeAt = Date.now()
  logCapabilities(capabilities)
  return capabilities
}

export function ensureGatewayProbed(): GatewayCapabilities {
  if (!capabilities.probed) {
    return probeGateway()
  }
  return capabilities
}

// ── Accessors ─────────────────────────────────────────────────────

export function getCapabilities(): GatewayCapabilities {
  return capabilities
}

export function getCoreCapabilities(): CoreCapabilities {
  return {
    health: capabilities.health,
    chatCompletions: capabilities.chatCompletions,
    models: capabilities.models,
    streaming: capabilities.streaming,
    probed: capabilities.probed,
  }
}

export function getEnhancedCapabilities(): EnhancedCapabilities {
  return {
    sessions: capabilities.sessions,
    enhancedChat: capabilities.enhancedChat,
    skills: capabilities.skills,
    memory: capabilities.memory,
    config: capabilities.config,
    jobs: capabilities.jobs,
  }
}

export function getGatewayMode(): GatewayMode {
  const configuredMode = getConfiguredGatewayMode()
  if (configuredMode) return configuredMode
  return deriveGatewayModeFromCapabilities(capabilities)
}

export function getGatewayModeSource(): GatewayModeSource {
  return getConfiguredGatewayMode() ? 'override' : 'probe'
}

export function getGatewayModeLabel(mode: GatewayMode): string {
  return GATEWAY_MODE_LABELS[mode]
}

export function getConfiguredGatewayMode(): GatewayMode | null {
  return normalizeGatewayModeOverride(process.env[GATEWAY_MODE_OVERRIDE_ENV])
}

export function getChatMode(): ChatMode {
  if (capabilities.semantier.available) return 'enhanced-hermes'
  return 'disconnected'
}

export function getConnectionStatus(): ConnectionStatus {
  if (capabilities.semantier.available) return 'enhanced'
  return 'disconnected'
}

export function isHermesConnected(): boolean {
  return (
    capabilities.health ||
    capabilities.semantier.available
  )
}

void ensureGatewayProbed()

export function deriveGatewayModeFromCapabilities(
  next: Pick<
    GatewayCapabilities,
    | 'dashboard'
    | 'semantier'
    | 'chatCompletions'
    | 'sessions'
    | 'enhancedChat'
    | 'health'
  >,
): GatewayMode {
  if (next.semantier.available) return 'semantier-unicell'
  return 'disconnected'
}
