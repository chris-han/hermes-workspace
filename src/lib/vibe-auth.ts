import { useQuery } from '@tanstack/react-query'

export interface VibeAuthUser {
  user_id: string
  name: string
  email?: string | null
  avatar_url?: string | null
  feishu_open_id: string
  workspace_slug: string
}

export interface VibeAuthStatus {
  authenticated: boolean
  feishu_oauth_enabled: boolean
  workspace_slug?: string | null
  user?: VibeAuthUser | null
}

export const vibeAuthQueryKey = ['vibe-auth', 'me'] as const

export async function fetchVibeAuthStatus(): Promise<VibeAuthStatus> {
  const response = await fetch('/auth/me', {
    signal: AbortSignal.timeout(5000),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  return response.json() as Promise<VibeAuthStatus>
}

export async function logoutVibeAuth(): Promise<void> {
  const response = await fetch('/auth/logout', {
    method: 'POST',
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }
}

export function useVibeAuthStatus() {
  return useQuery({
    queryKey: vibeAuthQueryKey,
    queryFn: fetchVibeAuthStatus,
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: false,
  })
}