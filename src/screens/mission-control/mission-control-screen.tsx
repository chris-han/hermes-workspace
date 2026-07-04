'use client'

import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  CheckListIcon,
  Clock01Icon,
  RefreshIcon,
  Wifi01Icon,
  WifiOffIcon,
} from '@hugeicons/core-free-icons'
import type {
  MissionControlMember,
  MissionControlOnlineStatus,
} from '@/hooks/use-mission-control-status'
import { cn } from '@/lib/utils'
import {
  getOnlineStatus,
  useMissionControlStatus,
} from '@/hooks/use-mission-control-status'

// ── Helpers ─────────────────────────────────────────────────────────

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

function formatCost(n: number | null): string {
  if (n === null) return '—'
  return `${n.toFixed(2)}`
}

function formatRelativeTime(unixSeconds: number | null): string {
  if (!unixSeconds) return 'Never'
  const diffMs = Date.now() - unixSeconds * 1000
  const diffMins = Math.floor(diffMs / 60_000)
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

function formatUpdatedAgo(fetchedAt: number | null): string {
  if (!fetchedAt) return ''
  const diffSec = Math.floor((Date.now() - fetchedAt) / 1000)
  if (diffSec < 5) return 'just now'
  if (diffSec < 60) return `${diffSec}s ago`
  return `${Math.floor(diffSec / 60)}m ago`
}

// ── Status dot ──────────────────────────────────────────────────────

function StatusDot({ status }: { status: MissionControlOnlineStatus }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={cn(
          'inline-block size-2 rounded-full',
          status === 'online' && 'bg-success',
          status === 'offline' && 'bg-danger',
          status === 'unknown' && 'bg-muted-foreground',
        )}
      />
      <span
        className={cn(
          'text-[10px] font-semibold uppercase tracking-widest',
          status === 'online' && 'text-success',
          status === 'offline' && 'text-danger',
          status === 'unknown' && 'text-muted-foreground',
        )}
      >
        {status}
      </span>
    </div>
  )
}

// ── Skeleton card ───────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-card border border-border bg-card overflow-hidden animate-pulse">
      <div className="p-4 h-full space-y-3">
        <div className="flex justify-between items-center mb-1">
          <div className="h-4 bg-muted rounded w-20" />
          <div className="h-4 bg-muted rounded w-24" />
        </div>
        <div>
          <div className="h-7 bg-muted rounded w-32 mb-1.5" />
          <div className="h-4 bg-muted rounded w-40" />
        </div>
        <div className="h-5 bg-muted rounded w-48" />
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="rounded-md border border-border bg-muted/50 h-16"
            />
          ))}
        </div>
        <div className="flex justify-between">
          <div className="h-4 bg-muted rounded w-24" />
          <div className="h-4 bg-muted rounded w-24" />
        </div>
        <div className="flex justify-between">
          <div className="h-4 bg-muted rounded w-20" />
          <div className="h-4 bg-muted rounded w-20" />
        </div>
      </div>
    </div>
  )
}

// ── Agent card ──────────────────────────────────────────────────────

function AgentCard({ member }: { member: MissionControlMember }) {
  const navigate = useNavigate()
  const status = getOnlineStatus(member)
  const telegramPlatform = member.platforms.telegram

  const handleViewTasks = () => {
    void navigate({ to: '/tasks', search: { assignee: member.id } })
  }

  const handleViewJobs = () => {
    void navigate({ to: '/jobs', search: { agent: member.id } })
  }

  return (
    <div
      className={cn(
        'rounded-card border border-border bg-card overflow-hidden',
        'transition-all duration-200 hover:shadow-md hover:border-border',
        status === 'offline' && 'opacity-60',
      )}
    >
      <div className="p-4 h-full flex flex-col gap-3">
        {/* Top row: status dot + role */}
        <div className="flex items-start justify-between gap-2">
          <StatusDot status={status} />
          <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider text-right bg-muted border border-border px-1.5 py-0.5 rounded-md">
            {member.role}
          </span>
        </div>
        {/* Agent name + model */}
        <div>
          <h3 className="text-xl font-bold tracking-tight text-primary">
            {member.displayName || member.id}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {member.model} · {member.provider}
          </p>
          {telegramPlatform && (
            <div className="flex items-center gap-1 mt-1">
              <HugeiconsIcon
                icon={
                  telegramPlatform.state === 'connected'
                    ? Wifi01Icon
                    : WifiOffIcon
                }
                size={10}
                className={cn(
                  telegramPlatform.state === 'connected'
                    ? 'text-success'
                    : 'text-muted-foreground',
                )}
              />
              <span className="text-[10px] text-muted-foreground">
                Telegram: {telegramPlatform.state}
              </span>
            </div>
          )}
        </div>

        {/* Last active */}
        <div>
          <p className="text-[11px] text-muted-foreground">
            Last active:{' '}
            <span className="text-foreground">
              {formatRelativeTime(member.lastSessionAt)}
            </span>
          </p>
          {member.lastSessionTitle && (
            <p className="text-[11px] text-muted-foreground italic truncate mt-0.5">
              "{member.lastSessionTitle}"
            </p>
          )}
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Sessions', value: formatNumber(member.sessionCount) },
            { label: 'Messages', value: formatNumber(member.messageCount) },
            { label: 'Tools', value: formatNumber(member.toolCallCount) },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="rounded-md border border-border bg-muted/50 px-2 py-2 text-center"
            >
              <div className="text-sm font-bold text-primary">{value}</div>
              <div className="text-[9px] text-muted-foreground uppercase tracking-widest mt-0.5">
                {label}
              </div>
            </div>
          ))}
        </div>

        {/* Tokens + cost */}
        <div className="flex justify-between text-[11px]">
          <span className="text-muted-foreground">
            Tokens:{' '}
            <span className="text-foreground">
              {formatTokens(member.totalTokens)}
            </span>
          </span>
          <span className="text-muted-foreground">
            Est. cost:{' '}
            <span className="text-foreground">
              {formatCost(member.estimatedCostUsd)}
            </span>
          </span>
        </div>

        {/* Cron + tasks */}
        <div className="flex justify-between text-[11px]">
          <span className="text-muted-foreground">
            Crons:{' '}
            <span className="text-foreground">{member.cronJobCount}</span>
          </span>
          <span className="text-muted-foreground">
            Tasks:{' '}
            <span className="text-foreground">
              {member.assignedTaskCount} assigned
            </span>
          </span>
        </div>

        {/* Divider */}
        <div className="border-t border-border" />

        {/* Footer actions */}
        <div className="flex justify-between">
          <button
            type="button"
            onClick={handleViewTasks}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted px-2.5 py-1.5 rounded-button transition-colors -ml-2.5"
          >
            <HugeiconsIcon icon={CheckListIcon} size={12} />
            Tasks
          </button>
          <button
            type="button"
            onClick={handleViewJobs}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted px-2.5 py-1.5 rounded-button transition-colors -mr-2.5"
          >
            <HugeiconsIcon icon={Clock01Icon} size={12} />
            Cron Jobs
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Ticker for "Updated X ago" ───────────────────────────────────────

function useUpdatedAgo(fetchedAt: number | null): string {
  const [label, setLabel] = useState(formatUpdatedAgo(fetchedAt))

  useEffect(() => {
    setLabel(formatUpdatedAgo(fetchedAt))
    const interval = setInterval(() => {
      setLabel(formatUpdatedAgo(fetchedAt))
    }, 5_000)
    return () => clearInterval(interval)
  }, [fetchedAt])

  return label
}

// ── Main screen ─────────────────────────────────────────────────────

export function MissionControlScreen() {
  const { crew, lastUpdated, isLoading, isError, refetch } =
    useMissionControlStatus()
  const updatedAgo = useUpdatedAgo(lastUpdated)

  const displayMembers = [...crew].sort((a, b) => {
    const rank = (member: MissionControlMember) => {
      const status = getOnlineStatus(member)
      if (status === 'online') return 0
      if (status === 'offline') return 1
      return 2
    }
    const rankDiff = rank(a) - rank(b)
    if (rankDiff !== 0) return rankDiff
    return (a.displayName || a.id).localeCompare(b.displayName || b.id)
  })

  const onlineCount = displayMembers.filter(
    (m) => getOnlineStatus(m) === 'online',
  ).length
  const assignedTaskCount = displayMembers.reduce(
    (sum, member) => sum + member.assignedTaskCount,
    0,
  )
  const runningCronCount = displayMembers.reduce(
    (sum, member) => sum + member.cronJobCount,
    0,
  )

  const handleRefresh = useCallback(() => {
    void refetch()
  }, [refetch])

  return (
    <div className="flex h-full flex-col gap-6 overflow-auto p-4 md:p-6">
      {/* ── Header ── */}
      <div className="space-y-4">
        <div className="h-px bg-gradient-to-r from-primary/50 to-transparent" />
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="max-w-3xl space-y-2">
            <div>
              <h1 className="text-2xl font-bold tracking-[0.18em] uppercase text-primary">
                Mission Control
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Live agent health across profiles, recent session activity,
                assigned tasks, and cron coverage.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.18em]">
              <span className="rounded-button border border-border bg-card px-3 py-1 text-muted-foreground">
                <span className="text-foreground">{displayMembers.length}</span>{' '}
                members
              </span>
              <span className="rounded-button border border-success/30 bg-success/10 px-3 py-1 text-success">
                {onlineCount} online
              </span>
              <span className="rounded-button border border-border bg-card px-3 py-1 text-muted-foreground">
                {assignedTaskCount} assigned tasks
              </span>
              <span className="rounded-button border border-border bg-card px-3 py-1 text-muted-foreground">
                {runningCronCount} cron jobs
              </span>
              {updatedAgo ? (
                <span className="rounded-button border border-border bg-card px-3 py-1 text-muted-foreground">
                  Updated {updatedAgo}
                </span>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isLoading}
            className={cn(
              'inline-flex items-center gap-2 rounded-button border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-sm transition-all',
              'hover:bg-muted hover:scale-105 active:scale-95',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            <HugeiconsIcon
              icon={RefreshIcon}
              size={13}
              className={isLoading ? 'animate-spin' : ''}
            />
            Refresh manifest
          </button>
        </div>
        <div className="h-px bg-gradient-to-r from-primary/50 to-transparent" />
      </div>

      {/* ── Error state ── */}
      {isError && !isLoading && (
        <div className="rounded-card border border-destructive/30 bg-destructive/10 p-4 text-sm text-danger">
          Failed to load Mission Control status.{' '}
          <button
            type="button"
            onClick={handleRefresh}
            className="underline hover:text-red-300"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Card grid ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {isLoading
          ? Array.from({ length: 5 }, (_, i) => <SkeletonCard key={i} />)
          : displayMembers.map((member) => (
              <AgentCard key={member.id} member={member} />
            ))}
      </div>
    </div>
  )
}

