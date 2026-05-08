import { useQuery } from '@tanstack/react-query'

export interface SemantierAuthUser {
  user_id: string
  name: string
  email?: string | null
  avatar_url?: string | null
  feishu_open_id: string
  workspace_slug: string
  auth_provider?: string | null
  weixin_user_id?: string | null
  password_login_name?: string | null
  profile_completed?: boolean
}

export interface SemantierAuthStatus {
  authenticated: boolean
  feishu_oauth_enabled: boolean
  password_login_enabled?: boolean
  profile_completed?: boolean
  workspace_slug?: string | null
  user?: SemantierAuthUser | null
}

export const semantierAuthQueryKey = ['semantier-auth', 'me'] as const

export async function fetchSemantierAuthStatus(): Promise<SemantierAuthStatus> {
  const response = await fetch('/auth/me', {
    signal: AbortSignal.timeout(5000),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  return response.json() as Promise<SemantierAuthStatus>
}

export async function logoutSemantierAuth(): Promise<void> {
  const response = await fetch('/auth/logout', {
    method: 'POST',
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }
}

export function useSemantierAuthStatus() {
  return useQuery({
    queryKey: semantierAuthQueryKey,
    queryFn: fetchSemantierAuthStatus,
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: false,
  })
}
