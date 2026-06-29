type MissingSessionRecoveryInput = {
  embedded?: boolean
  isNewChat: boolean
  forcedSessionKey?: string
  activeFriendlyId: string
  activeExists: boolean
  sessionsReady: boolean
  historyFetching: boolean
  resolvedSessionKey?: string
  recentSession: boolean
}

export function shouldRecoverMissingSessionRoute(
  input: MissingSessionRecoveryInput,
): boolean {
  if (input.embedded) return false
  if (input.isNewChat) return false
  if (input.forcedSessionKey) return false
  if (!input.activeFriendlyId.trim()) return false
  if (input.activeExists) return false
  if (!input.sessionsReady) return false
  if (input.historyFetching) return false
  if (input.recentSession) return false
  return input.resolvedSessionKey === 'new'
}
