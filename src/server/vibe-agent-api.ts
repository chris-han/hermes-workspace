export let VIBE_AGENT_API =
  process.env.VIBE_AGENT_API_URL || 'http://127.0.0.1:8899'

export const VIBE_AGENT_API_KEY =
  process.env.VIBE_AGENT_API_KEY || process.env.API_AUTH_KEY || ''

export function vibeAgentAuthHeaders(): Record<string, string> {
  return VIBE_AGENT_API_KEY
    ? { Authorization: `Bearer ${VIBE_AGENT_API_KEY}` }
    : {}
}

export function withVibeAgentBase(path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  return `${VIBE_AGENT_API}${path.startsWith('/') ? path : `/${path}`}`
}