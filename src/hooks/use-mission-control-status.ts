import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

export type MissionControlPlatformInfo = {
  state: 'connected' | 'disconnected' | string
  updatedAt: string
}

export type MissionControlMember = {
  id: string
  displayName: string
  role: string
  profileFound: boolean
  gatewayState: 'running' | 'stopped' | 'unknown' | string
  processAlive: boolean
  platforms: Record<string, MissionControlPlatformInfo>
  model: string
  provider: string
  lastSessionTitle: string | null
  lastSessionAt: number | null
  sessionCount: number
  messageCount: number
  toolCallCount: number
  totalTokens: number
  estimatedCostUsd: number | null
  cronJobCount: number
  assignedTaskCount: number
}

export type MissionControlStatus = {
  crew: Array<MissionControlMember>
  fetchedAt: number
}

export type MissionControlOnlineStatus = 'online' | 'offline' | 'unknown'

export function getOnlineStatus(member: MissionControlMember): MissionControlOnlineStatus {
  if (!member.profileFound) return 'unknown'
  if (member.gatewayState === 'unknown') return 'unknown'
  if (member.gatewayState === 'running' && member.processAlive) return 'online'
  return 'offline'
}

const QUERY_KEY = ['mission-control', 'status'] as const
const POLL_INTERVAL_MS = 30_000

async function fetchMissionControlStatus(): Promise<MissionControlStatus> {
  const res = await fetch('/api/mission-control-status')
  if (!res.ok) throw new Error(`Failed to fetch mission-control status: ${res.status}`)
  return res.json() as Promise<MissionControlStatus>
}

export function useMissionControlStatus() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchMissionControlStatus,
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
    staleTime: 20_000,
  })

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () =>
      document.removeEventListener('visibilitychange', handleVisibility)
  }, [queryClient])

  return {
    crew: query.data?.crew ?? [],
    lastUpdated: query.data?.fetchedAt ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  }
}
