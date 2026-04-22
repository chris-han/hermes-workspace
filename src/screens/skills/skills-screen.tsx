import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsPanel, TabsTab } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import {
  DialogContent,
  DialogDescription,
  DialogRoot,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  ScrollAreaRoot,
  ScrollAreaScrollbar,
  ScrollAreaThumb,
  ScrollAreaViewport,
} from '@/components/ui/scroll-area'
import { Markdown } from '@/components/prompt-kit/markdown'
import { cn } from '@/lib/utils'
import { writeTextToClipboard } from '@/lib/clipboard'
import { toast } from '@/components/ui/toast'

type SkillsTab = 'installed' | 'marketplace' | 'toolsets'
type SkillsSort = 'name' | 'category'
type SkillSourceFilter = 'All' | 'Workspace' | 'Shared' | 'Built-in'

type DisplayControl = {
  label: string
  value: string
}

type SecurityRisk = {
  level: 'safe' | 'low' | 'medium' | 'high'
  flags: Array<string>
  score: number
}

type SkillSummary = {
  id: string
  slug: string
  name: string
  description: string
  author: string
  triggers: Array<string>
  tags: Array<string>
  homepage: string | null
  category: string
  icon: string
  content: string
  fileCount: number
  sourcePath: string
  installed: boolean
  enabled: boolean
  sourceTier?: string
  sourceLabel?: string
  canEdit?: boolean
  canUninstall?: boolean
  canModify?: boolean
  featuredGroup?: string
  security?: SecurityRisk
}

type SkillsApiResponse = {
  skills: Array<SkillSummary>
  total: number
  page: number
  categories: Array<string>
}

type ToolsetSummary = {
  id: string
  name: string
  label: string
  description: string
  tools: Array<string>
  enabled: boolean
  available: boolean
  configured: boolean
  sourceTier?: string
  sourceLabel?: string
  builtin?: boolean
  canModify?: boolean
}

type SkillAction = 'install' | 'uninstall' | 'toggle'

type SkillOverride = {
  installed?: boolean
  enabled?: boolean
}

type PendingSkillAction = {
  skillId: string
  action: SkillAction
}

type SkillSearchTier = 0 | 1 | 2 | 3

type HubSkill = {
  id: string
  name: string
  description: string
  author: string
  category: string
  tags: Array<string>
  downloads?: number
  stars?: number
  source: string
  identifier?: string
  trust_level?: string
  repo?: string | null
  installCommand?: string
  homepage?: string | null
  installed: boolean
  extra?: Record<string, unknown>
}

type HubSearchResponse = {
  results: Array<HubSkill>
  source: string
  total?: number
  error?: string
}

const PAGE_LIMIT = 30

const DEFAULT_CATEGORIES = [
  'All',
  'Web & Frontend',
  'Coding Agents',
  'Git & GitHub',
  'DevOps & Cloud',
  'Browser & Automation',
  'Image & Video',
  'Search & Research',
  'AI & LLMs',
  'Productivity',
  'Marketing & Sales',
  'Communication',
  'Data & Analytics',
  'Finance & Crypto',
]

const SOURCE_FILTERS: Array<SkillSourceFilter> = [
  'All',
  'Workspace',
  'Shared',
  'Built-in',
]

const TAB_OPTIONS: Array<DisplayControl & { value: SkillsTab }> = [
  { label: 'Installed', value: 'installed' },
  { label: 'Toolsets', value: 'toolsets' },
  { label: 'Marketplace', value: 'marketplace' },
]

function resolveSourceTier(
  item: {
    sourceTier?: string
    sourceLabel?: string
    sourcePath?: string
    builtin?: boolean
    canEdit?: boolean
    canUninstall?: boolean
    canModify?: boolean
  },
): string | undefined {
  if (item.sourceTier) return item.sourceTier
  if (item.builtin) return 'builtin'
  if (item.canEdit || item.canUninstall || item.canModify) return 'workspace'

  const sourceLabel = item.sourceLabel?.toLowerCase()
  if (sourceLabel === 'workspace') return 'workspace'
  if (sourceLabel === 'application shared') return 'application'
  if (sourceLabel === 'hermes built-in') return 'builtin'

  const sourcePath = item.sourcePath?.replaceAll('\\', '/')
  if (sourcePath?.includes('/.hermes/skills/')) return 'workspace'

  return undefined
}

function matchesSourceFilter(
  item: {
    sourceTier?: string
    sourceLabel?: string
    sourcePath?: string
    builtin?: boolean
    canEdit?: boolean
    canUninstall?: boolean
    canModify?: boolean
  },
  filter: SkillSourceFilter,
): boolean {
  const sourceTier = resolveSourceTier(item)

  if (filter === 'All') return true
  if (filter === 'Workspace') return sourceTier === 'workspace'
  if (filter === 'Built-in') return sourceTier === 'builtin'
  return sourceTier === 'application' || sourceTier === 'external'
}

function matchesToolsetSearch(toolset: ToolsetSummary, rawSearch: string): boolean {
  const search = rawSearch.trim().toLowerCase()
  if (!search) return true

  return [
    toolset.name,
    toolset.label,
    toolset.description,
    toolset.sourceLabel || '',
    ...toolset.tools,
  ]
    .join('\n')
    .toLowerCase()
    .includes(search)
}

function resolveSkillSearchTier(
  skill: SkillSummary,
  query: string,
): SkillSearchTier {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return 0

  if (skill.name.toLowerCase().includes(normalizedQuery)) return 0

  const tagText = skill.tags.join(' ').toLowerCase()
  const triggerText = skill.triggers.join(' ').toLowerCase()
  if (
    tagText.includes(normalizedQuery) ||
    triggerText.includes(normalizedQuery)
  ) {
    return 1
  }

  if (skill.description.toLowerCase().includes(normalizedQuery)) return 2
  return 3
}

function applySkillOverrides(
  skills: Array<SkillSummary>,
  overrides: Record<string, SkillOverride>,
): Array<SkillSummary> {
  return skills.map((skill) => {
    const override = overrides[skill.id]
    if (!override) return skill

    return {
      ...skill,
      installed: override.installed ?? skill.installed,
      enabled: override.enabled ?? skill.enabled,
    }
  })
}

export function SkillsScreen() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<SkillsTab>('installed')
  const [searchInput, setSearchInput] = useState('')
  const [debouncedMarketplaceSearch, setDebouncedMarketplaceSearch] =
    useState('')
  const [sourceFilter, setSourceFilter] = useState<SkillSourceFilter>('All')
  const [category, setCategory] = useState('All')
  const [sort, setSort] = useState<SkillsSort>('name')
  const [page, setPage] = useState(1)
  const [pendingAction, setPendingAction] =
    useState<PendingSkillAction | null>(null)
  const [skillOverrides, setSkillOverrides] = useState<
    Record<string, SkillOverride>
  >({})
  const [selectedSkill, setSelectedSkill] = useState<SkillSummary | null>(null)
  const [selectedToolset, setSelectedToolset] =
    useState<ToolsetSummary | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    if (tab !== 'marketplace') return

    const timeout = window.setTimeout(() => {
      setDebouncedMarketplaceSearch(searchInput)
    }, 250)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [searchInput, tab])

  const skillsQuery = useQuery({
    queryKey: ['skills-browser', tab, searchInput, category, page, sort],
    enabled: tab !== 'toolsets',
    queryFn: async function fetchSkills(): Promise<SkillsApiResponse> {
      const params = new URLSearchParams()
      params.set('tab', tab)
      params.set('search', searchInput)
      params.set('category', category)
      params.set('page', String(page))
      params.set('limit', String(PAGE_LIMIT))
      params.set('sort', sort)

      const response = await fetch(`/api/skills?${params.toString()}`)
      const payload = (await response.json()) as SkillsApiResponse & {
        error?: string
      }
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to fetch skills')
      }
      return payload
    },
  })

  const toolsetsQuery = useQuery({
    queryKey: ['skills-browser', 'toolsets'],
    enabled: tab === 'toolsets',
    queryFn: async function fetchToolsets(): Promise<Array<ToolsetSummary>> {
      const response = await fetch('/api/tools/toolsets')
      const payload = (await response.json().catch(() => [])) as
        | Array<ToolsetSummary>
        | { error?: string; detail?: string }

      if (!response.ok) {
        const record =
          payload && !Array.isArray(payload)
            ? (payload as { error?: string; detail?: string })
            : {}
        throw new Error(
          record.error || record.detail || 'Failed to load toolsets',
        )
      }

      return Array.isArray(payload) ? payload : []
    },
  })

  const hubQuery = useQuery({
    queryKey: ['skills-hub-search', debouncedMarketplaceSearch],
    enabled: tab === 'marketplace',
    queryFn: async function fetchHubResults(): Promise<HubSearchResponse> {
      const params = new URLSearchParams()
      params.set('q', debouncedMarketplaceSearch)
      params.set('source', 'all')
      params.set('limit', '20')

      const response = await fetch(
        `/api/skills/hub-search?${params.toString()}`,
      )
      const payload = (await response.json()) as HubSearchResponse
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to search skills hub')
      }
      return payload
    },
  })

  const categories = useMemo(
    function resolveCategories() {
      const fromApi = skillsQuery.data?.categories
      if (Array.isArray(fromApi) && fromApi.length > 0) {
        return fromApi
      }
      return DEFAULT_CATEGORIES
    },
    [skillsQuery.data?.categories],
  )

  const totalPages = Math.max(
    1,
    Math.ceil((skillsQuery.data?.total || 0) / PAGE_LIMIT),
  )

  const skills = useMemo(
    function resolveVisibleSkills() {
      const sourceSkills = applySkillOverrides(
        skillsQuery.data?.skills || [],
        skillOverrides,
      ).filter((skill) => matchesSourceFilter(skill, sourceFilter))
      const normalizedQuery = searchInput.trim().toLowerCase()
      if (!normalizedQuery) {
        return sourceSkills
      }

      return sourceSkills
        .map(function mapSkillToTier(skill, index) {
          return {
            skill,
            index,
            tier: resolveSkillSearchTier(skill, normalizedQuery),
          }
        })
        .sort(function sortByTierThenOriginalOrder(a, b) {
          if (a.tier !== b.tier) return a.tier - b.tier
          return a.index - b.index
        })
        .map(function unwrapSkill(entry) {
          return entry.skill
        })
    },
    [searchInput, skillOverrides, skillsQuery.data?.skills, sourceFilter],
  )

  const marketplaceSkills = useMemo<Array<SkillSummary>>(
    function resolveMarketplaceSkills() {
      const sourceSkills: Array<SkillSummary> = (hubQuery.data?.results || []).map(function mapHubSkill(skill) {
        // Gateway returns: name, description, source, identifier, trust_level, repo, path, tags, extra, installed
        const skillId = skill.id || skill.name
        const author =
          skill.author ||
          (skill.repo ? skill.repo.split('/')[0] : null) ||
          (skill.extra as Record<string, unknown>)?.author ||
          skill.source ||
          'Community'
        const homepage =
          skill.homepage ||
          skill.repo ||
          (skill.extra as Record<string, unknown>)?.homepage ||
          null
        const category =
          skill.category ||
          (skill.extra as Record<string, unknown>)?.category ||
          'Productivity'

        return {
          id: skillId,
          slug: skillId,
          name: skill.name || skillId,
          description: skill.description,
          author: String(author),
          triggers: skill.tags,
          tags: skill.tags,
          homepage: typeof homepage === 'string' ? homepage : null,
          category: String(category),
          icon:
            skill.source === 'github'
              ? '🐙'
              : skill.source === 'official' || skill.trust_level === 'builtin'
                ? '✅'
                : skill.source === 'skills-sh'
                  ? '📦'
                  : skill.source === 'lobehub'
                    ? '🧊'
                    : skill.source === 'claude-marketplace'
                      ? '🤖'
                      : '🧩',
          content: [
            skill.description,
            skill.identifier ? `Identifier: ${skill.identifier}` : '',
            skill.trust_level ? `Trust: ${skill.trust_level}` : '',
          ]
            .filter(Boolean)
            .join('\n\n'),
          fileCount: 0,
          sourcePath:
            skill.identifier ||
            (typeof homepage === 'string' ? homepage : '') ||
            skill.source,
          installed: skill.installed,
          enabled: skill.installed,
          sourceTier:
            skill.source === 'official' || skill.trust_level === 'builtin'
              ? 'builtin'
              : 'external',
          sourceLabel:
            skill.source === 'official' || skill.trust_level === 'builtin'
              ? 'Hermes Built-in'
              : 'Shared',
          featuredGroup: undefined,
          security: {
            level:
              skill.trust_level === 'builtin'
                ? 'safe'
                : skill.trust_level === 'trusted'
                  ? 'safe'
                  : 'medium',
            flags: [],
            score: 0,
          },
        }
      })

      return applySkillOverrides(sourceSkills, skillOverrides)
    },
    [hubQuery.data?.results, skillOverrides],
  )

  const toolsets = useMemo(
    function resolveVisibleToolsets() {
      return (toolsetsQuery.data || [])
        .filter((toolset) => matchesSourceFilter(toolset, sourceFilter))
        .filter((toolset) => matchesToolsetSearch(toolset, searchInput))
        .sort((left, right) => left.label.localeCompare(right.label))
    },
    [searchInput, sourceFilter, toolsetsQuery.data],
  )

  const visibleSourceFilters = useMemo(
    () =>
      tab === 'installed'
        ? SOURCE_FILTERS
        : SOURCE_FILTERS.filter((filter) => filter !== 'Workspace'),
    [tab],
  )

  async function copyCommandAndToast(command: string, message: string) {
    try {
      await writeTextToClipboard(command)
      toast(`${message} Copied: ${command}`, {
        type: 'warning',
        icon: '📋',
      })
    } catch {
      toast(`${message} ${command}`, {
        type: 'warning',
        icon: '📋',
        duration: 7000,
      })
    }
  }

  async function runSkillAction(
    action: SkillAction,
    payload: {
      skillId: string
      enabled?: boolean
      source?: HubSkill['source']
    },
  ) {
    setActionError(null)
    setPendingAction({ skillId: payload.skillId, action })

    try {
      const endpoint =
        action === 'install'
          ? '/api/skills/install'
          : action === 'uninstall'
            ? '/api/skills/uninstall'
            : '/api/skills/toggle'

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          skillId: payload.skillId,
          name: payload.skillId,
          identifier: payload.skillId,
          enabled: payload.enabled,
          source: payload.source,
        }),
      })

      const data = (await response.json()) as {
        error?: string
        detail?: string
        command?: string
        ok?: boolean
      }
      const actionError = data.error || data.detail || 'Action failed'
      if (!response.ok) {
        throw new Error(actionError)
      }

      if (
        (action === 'install' || action === 'uninstall') &&
        data.ok === false
      ) {
        if (data.command) {
          await copyCommandAndToast(
            data.command,
            actionError || 'Gateway action unavailable.',
          )
          return
        }
        throw new Error(actionError)
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['skills-browser'] }),
        queryClient.invalidateQueries({ queryKey: ['skills-hub-search'] }),
      ])
      setSkillOverrides(function updateSkillOverrides(current) {
        const next = { ...current }
        const existing = next[payload.skillId] || {}

        if (action === 'install') {
          next[payload.skillId] = {
            ...existing,
            installed: true,
            enabled: true,
          }
          return next
        }

        if (action === 'uninstall') {
          next[payload.skillId] = {
            ...existing,
            installed: false,
            enabled: false,
          }
          return next
        }

        next[payload.skillId] = {
          ...existing,
          enabled: payload.enabled ?? existing.enabled,
        }
        return next
      })
      setSelectedSkill(function updateSelectedSkill(current) {
        if (!current || current.id !== payload.skillId) return current
        if (action === 'install') {
          return {
            ...current,
            installed: true,
            enabled: true,
          }
        }
        if (action === 'uninstall') {
          return {
            ...current,
            installed: false,
            enabled: false,
          }
        }
        return {
          ...current,
          enabled: payload.enabled ?? current.enabled,
        }
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      setActionError(errorMessage)
      toast(errorMessage, { type: 'error', icon: '❌' })
    } finally {
      setPendingAction(null)
    }
  }

  function handleTabChange(nextTab: string) {
    const parsedTab: SkillsTab =
      nextTab === 'installed' ||
      nextTab === 'marketplace' ||
      nextTab === 'toolsets'
        ? nextTab
        : 'installed'

    setTab(parsedTab)
    setPage(1)
    if (parsedTab !== 'installed') {
      setCategory('All')
      setSort('name')
    }
    if (
      parsedTab === 'marketplace' ||
      (parsedTab === 'toolsets' && sourceFilter === 'Workspace')
    ) {
      setSourceFilter('All')
    }
  }

  function handleSearchChange(value: string) {
    setSearchInput(value)
    setPage(1)
  }

  function handleCategoryChange(value: string) {
    setCategory(value)
    setPage(1)
  }

  function handleSortChange(value: SkillsSort) {
    setSort(value)
    setPage(1)
  }

  return (
    <div className="min-h-full overflow-y-auto bg-surface text-ink">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 px-4 py-6 pb-[calc(var(--tabbar-h,80px)+1.5rem)] sm:px-6 lg:px-8">
        <header className="rounded-card border border-border bg-primary-50/85 p-4 backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1.5">
              <p className="text-xs font-medium uppercase text-primary-500 tabular-nums">
                Semantier Marketplace
              </p>
              <h1 className="text-2xl font-medium text-ink text-balance sm:text-3xl">
                Skills & Toolsets
              </h1>
              <p className="text-sm text-primary-500 text-pretty sm:text-base">
                Discover, install, and inspect workspace skills plus the
                toolsets available to the active Semantier runtime.
              </p>
            </div>
          </div>
        </header>

        <section className="rounded-card border border-border bg-primary-50/80 p-3 backdrop-blur-xl sm:p-4">
          <Tabs value={tab} onValueChange={handleTabChange}>
            <div className="flex flex-col gap-3">
              <TabsList
                className="grid w-full grid-cols-3 rounded-button border border-border bg-primary-100/60 p-1"
                variant="default"
              >
                {TAB_OPTIONS.map((option) => (
                  <TabsTab key={option.value} value={option.value} className="min-w-0">
                    {option.label}
                  </TabsTab>
                ))}
              </TabsList>

              <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <input
                  value={searchInput}
                  onChange={(event) => handleSearchChange(event.target.value)}
                  placeholder={
                    tab === 'toolsets'
                      ? 'Search by toolset, source, or tool name'
                      : tab === 'marketplace'
                        ? 'Search Skills Hub, GitHub, and local fallback'
                        : 'Search by name, tags, or description'
                  }
                  className="h-10 w-full min-w-0 rounded-button border border-border bg-primary-100/60 px-3 text-sm text-ink outline-none transition-colors focus:border-primary"
                />

                <div className="flex flex-wrap items-center gap-2">
                  {tab === 'installed' ? (
                    <select
                      value={category}
                      onChange={(event) =>
                        handleCategoryChange(event.target.value)
                      }
                      className="h-10 rounded-button border border-border bg-primary-100/60 px-3 text-sm text-ink outline-none"
                    >
                      {categories.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  ) : null}

                  {tab === 'installed' ? (
                    <select
                      value={sort}
                      onChange={(event) =>
                        handleSortChange(
                          event.target.value === 'category'
                            ? 'category'
                            : 'name',
                        )
                      }
                      className="h-10 rounded-button border border-border bg-primary-100/60 px-3 text-sm text-ink outline-none"
                    >
                      <option value="name">Name A-Z</option>
                      <option value="category">Category</option>
                    </select>
                  ) : null}

                  {tab === 'marketplace' ? (
                    <div className="text-xs text-primary-500">
                      Source: {hubQuery.data?.source || 'hub'}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
                {visibleSourceFilters.map((filter) => {
                  const active = filter === sourceFilter
                  return (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => {
                        setSourceFilter(filter)
                        setPage(1)
                      }}
                      className={cn(
                        'rounded-button border px-3 py-1.5 text-xs font-semibold transition-colors',
                        active
                          ? 'border-primary/40 bg-primary/15 text-primary'
                          : 'border-border bg-primary-100/50 text-primary-500 hover:border-primary-300 hover:text-ink',
                      )}
                    >
                      {filter}
                    </button>
                  )
                })}
            </div>

            {actionError ? (
              <p className="rounded-lg border border-border bg-primary-100/60 px-3 py-2 text-sm text-ink">
                {actionError}
              </p>
            ) : null}

            {tab === 'toolsets' && toolsetsQuery.error ? (
              <p className="rounded-lg border border-border bg-primary-100/60 px-3 py-2 text-sm text-ink">
                {toolsetsQuery.error instanceof Error
                  ? toolsetsQuery.error.message
                  : 'Failed to load toolsets.'}
              </p>
            ) : null}

            <TabsPanel value="installed" className="pt-2">
              <SkillsGrid
                skills={skills}
                loading={skillsQuery.isPending}
                pendingAction={pendingAction}
                tab="installed"
                onOpenDetails={setSelectedSkill}
                onInstall={(skillId) => runSkillAction('install', { skillId })}
                onUninstall={(skillId) =>
                  runSkillAction('uninstall', { skillId })
                }
                onToggle={(skillId, enabled) =>
                  runSkillAction('toggle', { skillId, enabled })
                }
              />
            </TabsPanel>

            <TabsPanel value="marketplace" className="space-y-3 pt-2">
              {hubQuery.error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {hubQuery.error instanceof Error
                    ? hubQuery.error.message
                    : 'Failed to load marketplace skills.'}
                </div>
              ) : hubQuery.data &&
                (hubQuery.data.source === 'installed-fallback' ||
                  hubQuery.data.source === 'error') ? (
                <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                  Skills Hub search unavailable — showing installed skills
                  instead. Ensure the Hermes gateway is running.
                </div>
              ) : null}

              <SkillsGrid
                skills={marketplaceSkills}
                loading={hubQuery.isPending}
                pendingAction={pendingAction}
                tab="marketplace"
                emptyState={{
                  title: searchInput.trim()
                    ? 'No hub skills found'
                    : 'Search the Skills Hub',
                  description: searchInput.trim()
                    ? 'Try a different search term. If Skills Hub is unavailable, local installed skills are used as fallback.'
                    : 'Start typing to search Skills Hub and other skill sources.',
                }}
                onOpenDetails={setSelectedSkill}
                onInstall={(skillId) => {
                  const skill = hubQuery.data?.results.find(
                    (entry) => entry.id === skillId,
                  )
                  runSkillAction('install', {
                    skillId,
                    source: skill?.source,
                  })
                }}
                onUninstall={(skillId) =>
                  runSkillAction('uninstall', { skillId })
                }
                onToggle={(skillId, enabled) =>
                  runSkillAction('toggle', { skillId, enabled })
                }
              />
            </TabsPanel>

            <TabsPanel value="toolsets" className="pt-2">
              <ToolsetsGrid
                toolsets={toolsets}
                loading={toolsetsQuery.isPending}
                onOpenDetails={setSelectedToolset}
              />
            </TabsPanel>
          </Tabs>
        </section>

        {tab === 'installed' ? (
          <footer className="flex items-center justify-between rounded-card border border-border bg-primary-50/80 px-3 py-2.5 text-sm text-primary-500 tabular-nums">
            <span>
              {(skillsQuery.data?.total || 0).toLocaleString()} total skills
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || skillsQuery.isPending}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </Button>
              <span className="min-w-[82px] text-center">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || skillsQuery.isPending}
                onClick={() =>
                  setPage((current) => Math.min(totalPages, current + 1))
                }
              >
                Next
              </Button>
            </div>
          </footer>
        ) : tab === 'toolsets' ? (
          <footer className="flex items-center justify-between rounded-card border border-border bg-primary-50/80 px-3 py-2.5 text-sm text-primary-500 tabular-nums">
            <span>{toolsets.length.toLocaleString()} visible toolsets</span>
            <span>
              {(toolsetsQuery.data?.length || 0).toLocaleString()} total in runtime
            </span>
          </footer>
        ) : null}
      </div>

      <DialogRoot
        open={Boolean(selectedSkill)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedSkill(null)
          }
        }}
      >
        <DialogContent className="rounded-card w-[min(960px,95vw)] border-border bg-primary-50/95 backdrop-blur-sm">
          {selectedSkill ? (
            <div className="flex max-h-[85vh] flex-col">
              <div className="border-b border-border px-5 py-4">
                <DialogTitle className="text-balance">
                  {selectedSkill.icon} {selectedSkill.name}
                </DialogTitle>
                <DialogDescription className="mt-1 text-pretty">
                  by {selectedSkill.author} • {selectedSkill.category} •{' '}
                  {selectedSkill.fileCount.toLocaleString()} files
                </DialogDescription>
                {selectedSkill.security && (
                  <div className="mt-3 overflow-hidden rounded-card border border-border bg-primary-50/80">
                    <SecurityBadge
                      security={selectedSkill.security}
                      compact={false}
                    />
                  </div>
                )}
              </div>

              <ScrollAreaRoot className="h-[56vh]">
                <ScrollAreaViewport className="px-5 py-4">
                  <div className="space-y-3">
                    {selectedSkill.homepage ? (
                      <p className="text-sm text-primary-500 text-pretty">
                        Homepage:{' '}
                        <a
                          href={selectedSkill.homepage}
                          target="_blank"
                          rel="noreferrer"
                          className="underline decoration-border underline-offset-4 hover:decoration-primary"
                        >
                          {selectedSkill.homepage}
                        </a>
                      </p>
                    ) : null}

                    <div className="flex flex-wrap gap-1.5">
                      {selectedSkill.triggers.length > 0 ? (
                        selectedSkill.triggers.slice(0, 8).map((trigger) => (
                          <span
                            key={trigger}
                            className="rounded-md border border-border bg-primary-100/50 px-2 py-0.5 text-xs text-primary-500"
                          >
                            {trigger}
                          </span>
                        ))
                      ) : (
                        <span className="rounded-md border border-border bg-primary-100/50 px-2 py-0.5 text-xs text-primary-500">
                          No triggers listed
                        </span>
                      )}
                    </div>

                    <article className="rounded-card border border-border bg-primary-100/30 p-4 backdrop-blur-sm">
                      <Markdown>
                        {selectedSkill.content ||
                          `# ${selectedSkill.name}\n\n${selectedSkill.description}`}
                      </Markdown>
                    </article>
                  </div>
                </ScrollAreaViewport>
                <ScrollAreaScrollbar>
                  <ScrollAreaThumb />
                </ScrollAreaScrollbar>
              </ScrollAreaRoot>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-3">
                <p className="text-sm text-primary-500 text-pretty">
                  Source:{' '}
                  <code className="inline-code">
                    {selectedSkill.sourcePath}
                  </code>
                </p>
                <div className="flex items-center gap-2">
                  {selectedSkill.installed ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={
                        pendingAction?.skillId === selectedSkill.id ||
                        selectedSkill.canUninstall === false
                      }
                      onClick={() => {
                        runSkillAction('uninstall', {
                          skillId: selectedSkill.id,
                        })
                      }}
                    >
                      {selectedSkill.canUninstall === false
                        ? 'Read only'
                        : 'Uninstall'}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      disabled={pendingAction?.skillId === selectedSkill.id}
                      onClick={() =>
                        runSkillAction('install', { skillId: selectedSkill.id })
                      }
                    >
                      {pendingAction?.skillId === selectedSkill.id &&
                      pendingAction.action === 'install' ? (
                        'Installing…'
                      ) : (
                        'Install'
                      )}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedSkill(null)}
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </DialogRoot>

      <DialogRoot
        open={Boolean(selectedToolset)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedToolset(null)
          }
        }}
      >
        <DialogContent className="rounded-card w-[min(820px,95vw)] border-border bg-primary-50/95 backdrop-blur-sm">
          {selectedToolset ? (
            <div className="flex max-h-[85vh] flex-col">
              <div className="border-b border-border px-5 py-4">
                <DialogTitle className="text-balance">
                  {selectedToolset.label}
                </DialogTitle>
                <DialogDescription className="mt-1 text-pretty">
                  {selectedToolset.sourceLabel || 'Toolset'} •{' '}
                  {selectedToolset.tools.length.toLocaleString()} tools
                </DialogDescription>
              </div>

              <ScrollAreaRoot className="h-[52vh]">
                <ScrollAreaViewport className="px-5 py-4">
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-1.5">
                      <span className="rounded-md border border-border bg-primary-100/50 px-2 py-0.5 text-xs text-primary-500">
                        {selectedToolset.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                      <span className="rounded-md border border-border bg-primary-100/50 px-2 py-0.5 text-xs text-primary-500">
                        {selectedToolset.configured ? 'Configured' : 'No extra config'}
                      </span>
                      {selectedToolset.sourceLabel ? (
                        <span className="rounded-md border border-border bg-primary-100/50 px-2 py-0.5 text-xs text-primary-500">
                          {selectedToolset.sourceLabel}
                        </span>
                      ) : null}
                    </div>

                    <article className="rounded-xl border border-border bg-primary-100/30 p-4 backdrop-blur-sm">
                      <p className="text-sm leading-relaxed text-primary-600">
                        {selectedToolset.description}
                      </p>
                    </article>

                    <div className="rounded-xl border border-border bg-primary-100/30 p-4 backdrop-blur-sm">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-primary-500">
                        Included Tools
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedToolset.tools.map((tool) => (
                          <span
                            key={tool}
                            className="rounded-md border border-border bg-primary-50/80 px-2 py-0.5 text-xs text-primary-600"
                          >
                            {tool}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </ScrollAreaViewport>
                <ScrollAreaScrollbar>
                  <ScrollAreaThumb />
                </ScrollAreaScrollbar>
              </ScrollAreaRoot>

              <div className="flex items-center justify-between gap-2 border-t border-border px-5 py-3">
                <p className="text-sm text-primary-500 text-pretty">
                  Runtime toolsets are currently read-only in the workspace UI.
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedToolset(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </DialogRoot>
    </div>
  )
}

type SkillsGridProps = {
  skills: Array<SkillSummary>
  loading: boolean
  pendingAction: PendingSkillAction | null
  tab: 'installed' | 'marketplace'
  emptyState?: {
    title: string
    description: string
  }
  onOpenDetails: (skill: SkillSummary) => void
  onInstall: (skillId: string) => void
  onUninstall: (skillId: string) => void
  onToggle: (skillId: string, enabled: boolean) => void
}

type ToolsetsGridProps = {
  toolsets: Array<ToolsetSummary>
  loading: boolean
  onOpenDetails: (toolset: ToolsetSummary) => void
}

const SECURITY_BADGE: Record<
  string,
  { label: string; badgeClass: string; confidence: string }
> = {
  safe: {
    label: 'Benign',
    badgeClass: 'bg-green-100 text-green-700 border-green-200',
    confidence: 'HIGH CONFIDENCE',
  },
  low: {
    label: 'Benign',
    badgeClass: 'bg-green-100 text-green-700 border-green-200',
    confidence: 'MODERATE',
  },
  medium: {
    label: 'Caution',
    badgeClass: 'bg-amber-100 text-amber-700 border-amber-200',
    confidence: 'REVIEW RECOMMENDED',
  },
  high: {
    label: 'Warning',
    badgeClass: 'bg-red-100 text-red-700 border-red-200',
    confidence: 'MANUAL REVIEW',
  },
}

function SecurityBadge({
  security,
  compact = true,
}: {
  security?: SecurityRisk
  compact?: boolean
}) {
  if (!security) return null
  const config = SECURITY_BADGE[security.level]
  if (!config) return null

  const [expanded, setExpanded] = useState(false)

  // Compact badge for card grid
  if (compact) {
    return (
      <div className="relative">
        <button
          type="button"
          className={cn(
            'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors',
            config.badgeClass,
          )}
          onMouseEnter={() => setExpanded(true)}
          onMouseLeave={() => setExpanded(false)}
          onClick={(e) => {
            e.stopPropagation()
            setExpanded((v) => !v)
          }}
        >
          {config.label}
        </button>
        {expanded && (
          <div className="absolute bottom-[calc(100%+6px)] left-0 z-50 w-72 overflow-hidden rounded-card border border-border bg-surface p-0 shadow-xl">
            <SecurityScanCard security={security} />
          </div>
        )}
      </div>
    )
  }

  // Full card for detail dialog
  return <SecurityScanCard security={security} />
}

function SecurityScanCard({ security }: { security: SecurityRisk }) {
  const [showDetails, setShowDetails] = useState(false)
  const config = SECURITY_BADGE[security.level]
  if (!config) return null

  const summaryText =
    security.flags.length === 0
      ? 'No risky patterns detected. This skill appears safe to install.'
      : security.level === 'high'
        ? `Found ${security.flags.length} potential security concern${security.flags.length !== 1 ? 's' : ''}. Review before installing.`
        : `The skill's code was scanned for common risk patterns. ${security.flags.length} item${security.flags.length !== 1 ? 's' : ''} noted.`

  return (
    <div className="text-xs">
      <div className="px-3 pt-3 pb-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-primary-400 mb-2">
          Security Scan
        </p>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-primary-500 font-medium w-16 shrink-0">
              Semantier
            </span>
            <span
              className={cn(
                'rounded-md border px-1.5 py-0.5 text-[10px] font-semibold',
                config.badgeClass,
              )}
            >
              {config.label}
            </span>
            <span className="text-[10px] text-primary-400 uppercase tracking-wide font-medium">
              {config.confidence}
            </span>
          </div>
        </div>
      </div>
      <div className="px-3 pb-2">
        <p className="text-primary-500 text-pretty leading-relaxed">
          {summaryText}
        </p>
      </div>
      {security.flags.length > 0 && (
        <div className="border-t border-primary-100">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setShowDetails((v) => !v)
            }}
            className="flex w-full items-center justify-between px-3 py-2 text-accent-500 hover:text-accent-600 transition-colors"
          >
            <span className="text-[11px] font-medium">Details</span>
            <span className="text-[10px]">{showDetails ? '▲' : '▼'}</span>
          </button>
          {showDetails && (
            <div className="px-3 pb-3 space-y-1">
              {security.flags.map((flag) => (
                <div
                  key={flag}
                  className="flex items-start gap-2 text-primary-600"
                >
                  <span className="mt-0.5 text-[9px] text-primary-400">●</span>
                  <span>{flag}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="border-t border-primary-100 px-3 py-2">
        <p className="text-[10px] text-primary-400 italic">
          Like a lobster shell, security has layers — review code before you run
          it.
        </p>
      </div>
    </div>
  )
}

function SkillsGrid({
  skills,
  loading,
  pendingAction,
  tab,
  emptyState,
  onOpenDetails,
  onInstall,
  onUninstall,
  onToggle,
}: SkillsGridProps) {
  if (loading) {
    return <SkillsSkeleton count={tab === 'installed' ? 6 : 9} />
  }

  if (skills.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-border bg-primary-100/40 px-4 py-8 text-center">
        <p className="text-sm font-medium text-primary-700">
          {emptyState?.title || 'No skills found'}
        </p>
        <p className="mt-1 text-xs text-primary-500 text-pretty max-w-sm mx-auto">
          {emptyState?.description ||
            'Try adjusting your filters or search term'}
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <AnimatePresence initial={false}>
        {skills.map((skill) => {
          const isActing = pendingAction?.skillId === skill.id
          const isInstalling =
            pendingAction?.skillId === skill.id &&
            pendingAction.action === 'install'
          const canUninstall = skill.canUninstall ?? true

          return (
            <motion.article
              key={`${tab}-${skill.id}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              className="flex min-h-[220px] flex-col rounded-card border border-border bg-card p-4"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <p className="text-xl leading-none">{skill.icon}</p>
                  <h3 className="line-clamp-1 text-base font-medium text-ink text-balance">
                    {skill.name}
                  </h3>
                  <p className="line-clamp-1 text-xs text-primary-500">
                    by {skill.author}
                  </p>
                </div>
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs tabular-nums',
                    isInstalling
                      ? 'border-primary/40 bg-primary/15 text-primary'
                      : skill.installed
                      ? 'border-primary/40 bg-primary/15 text-primary'
                      : 'border-primary-200 bg-primary-100/60 text-primary-500',
                  )}
                >
                  {isInstalling ? (
                    <>
                      <InlineSpinner />
                      Installing…
                    </>
                  ) : skill.installed ? (
                    'Installed'
                  ) : (
                    'Available'
                  )}
                </span>
              </div>

              <p className="line-clamp-3 min-h-[58px] text-sm text-primary-500 text-pretty">
                {skill.description}
              </p>

              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <SecurityBadge security={skill.security} />
                {skill.sourceLabel ? (
                  <span className="rounded-md border border-border bg-primary-100/50 px-2 py-0.5 text-xs text-primary-500">
                    {skill.sourceLabel}
                  </span>
                ) : null}
                <span className="rounded-md border border-border bg-primary-100/50 px-2 py-0.5 text-xs text-primary-500">
                  {skill.category}
                </span>
                {skill.triggers.slice(0, 2).map((trigger) => (
                  <span
                    key={`${skill.id}-${trigger}`}
                    className="rounded-md border border-border bg-primary-100/50 px-2 py-0.5 text-xs text-primary-500"
                  >
                    {trigger}
                  </span>
                ))}
              </div>

              <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenDetails(skill)}
                >
                  Details
                </Button>

                {tab === 'installed' ? (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 px-1">
                      <Switch
                        checked={skill.enabled}
                        disabled={isActing}
                        onCheckedChange={(checked) =>
                          onToggle(skill.id, checked)
                        }
                        aria-label={`Toggle ${skill.name}`}
                      />
                      <span
                        className={cn(
                          'text-xs font-semibold',
                          skill.enabled ? 'text-ink' : 'text-primary-600',
                        )}
                      >
                        {skill.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isActing || !canUninstall}
                      onClick={() => onUninstall(skill.id)}
                    >
                      {canUninstall ? 'Uninstall' : 'Read only'}
                    </Button>
                  </div>
                ) : skill.installed ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isActing || !canUninstall}
                    onClick={() => onUninstall(skill.id)}
                  >
                    {canUninstall ? 'Uninstall' : 'Read only'}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    disabled={isActing}
                    onClick={() => onInstall(skill.id)}
                  >
                    {isInstalling ? 'Installing…' : 'Install'}
                  </Button>
                )}
              </div>
            </motion.article>
          )
        })}
      </AnimatePresence>
    </div>
  )
}

function ToolsetsGrid({
  toolsets,
  loading,
  onOpenDetails,
}: ToolsetsGridProps) {
  if (loading) {
    return <SkillsSkeleton count={6} />
  }

  if (toolsets.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-border bg-primary-100/40 px-4 py-8 text-center">
        <p className="text-sm font-medium text-primary-700">
          No toolsets found
        </p>
        <p className="mt-1 text-xs text-primary-500 text-pretty max-w-sm mx-auto">
          Try a different search term or source filter.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <AnimatePresence initial={false}>
        {toolsets.map((toolset) => (
          <motion.article
            key={toolset.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
            className="flex min-h-[220px] flex-col rounded-card border border-border bg-card p-4"
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="space-y-1">
                <p className="text-xl leading-none">
                  {toolset.sourceTier === 'application' ? '🧩' : '🛠️'}
                </p>
                <h3 className="line-clamp-2 text-base font-medium text-ink text-balance">
                  {toolset.label}
                </h3>
                <p className="line-clamp-1 text-xs text-primary-500">
                  {toolset.tools.length.toLocaleString()} tools
                </p>
              </div>
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs tabular-nums',
                  toolset.enabled
                    ? 'border-primary/40 bg-primary/15 text-primary'
                    : 'border-primary-200 bg-primary-100/60 text-primary-500',
                )}
              >
                {toolset.enabled ? 'Enabled' : 'Inactive'}
              </span>
            </div>

            <p className="line-clamp-3 min-h-[58px] text-sm text-primary-500 text-pretty">
              {toolset.description}
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {toolset.sourceLabel ? (
                <span className="rounded-md border border-border bg-primary-100/50 px-2 py-0.5 text-xs text-primary-500">
                  {toolset.sourceLabel}
                </span>
              ) : null}
              <span className="rounded-md border border-border bg-primary-100/50 px-2 py-0.5 text-xs text-primary-500">
                {toolset.configured ? 'Configured' : 'No extra config'}
              </span>
              {toolset.tools.slice(0, 2).map((tool) => (
                <span
                  key={`${toolset.id}-${tool}`}
                  className="rounded-md border border-border bg-primary-100/50 px-2 py-0.5 text-xs text-primary-500"
                >
                  {tool}
                </span>
              ))}
            </div>

            <div className="mt-auto flex items-center justify-between gap-2 pt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenDetails(toolset)}
              >
                Details
              </Button>
              <span className="text-xs text-primary-500">
                {toolset.canModify ? 'Editable' : 'Read only'}
              </span>
            </div>
          </motion.article>
        ))}
      </AnimatePresence>
    </div>
  )
}

function InlineSpinner() {
  return (
    <span
      aria-hidden="true"
      className="inline-block size-3 animate-spin rounded-full border-[1.5px] border-current border-r-transparent"
    />
  )
}

type FeaturedGridProps = {
  skills: Array<SkillSummary>
  loading: boolean
  pendingAction: PendingSkillAction | null
  onOpenDetails: (skill: SkillSummary) => void
  onInstall: (skillId: string) => void
  onUninstall: (skillId: string) => void
}

function FeaturedGrid({
  skills,
  loading,
  pendingAction,
  onOpenDetails,
  onInstall,
  onUninstall,
}: FeaturedGridProps) {
  if (loading) {
    return <SkillsSkeleton count={6} large />
  }

  if (skills.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-primary-100/40 px-4 py-10 text-center text-sm text-primary-500 text-pretty">
        Featured picks are currently unavailable.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 pb-2 lg:grid-cols-2">
      {skills.map((skill) => {
        const isActing = pendingAction?.skillId === skill.id
        const isInstalling =
          pendingAction?.skillId === skill.id &&
          pendingAction.action === 'install'
        return (
          <article
            key={skill.id}
            className="flex min-h-0 flex-col rounded-card border border-border bg-card p-4"
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase text-primary-500 tabular-nums">
                  {skill.featuredGroup || 'Staff Pick'}
                </p>
                <h3 className="text-lg font-medium text-ink text-balance">
                  {skill.icon} {skill.name}
                </h3>
                <p className="text-sm text-primary-500">by {skill.author}</p>
              </div>

              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs tabular-nums',
                  isInstalling
                    ? 'border-primary/40 bg-primary/15 text-primary'
                    : skill.installed
                    ? 'border-primary/40 bg-primary/15 text-primary'
                    : 'border-primary-200 bg-primary-100/60 text-primary-500',
                )}
              >
                {isInstalling ? (
                  <>
                    <InlineSpinner />
                    Installing…
                  </>
                ) : skill.installed ? (
                  'Installed'
                ) : (
                  'Staff Pick'
                )}
              </span>
            </div>

            <p className="line-clamp-3 mb-3 text-sm text-primary-500 text-pretty">
              {skill.description}
            </p>

            <div className="mt-auto flex items-center justify-between gap-2 pt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenDetails(skill)}
              >
                Details
              </Button>
              {skill.installed ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isActing}
                  onClick={() => onUninstall(skill.id)}
                >
                  Uninstall
                </Button>
              ) : (
                <Button
                  size="sm"
                  disabled={isActing}
                  onClick={() => onInstall(skill.id)}
                >
                  {isInstalling ? 'Installing…' : 'Install'}
                </Button>
              )}
            </div>
          </article>
        )
      })}
    </div>
  )
}

function SkillsSkeleton({
  count,
  large = false,
}: {
  count: number
  large?: boolean
}) {
  return (
    <div
      className={cn(
        'grid gap-3',
        large
          ? 'grid-cols-1 lg:grid-cols-2'
          : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3',
      )}
    >
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className={cn(
            'animate-pulse rounded-card border border-border bg-primary-50/70 p-4',
            large ? 'min-h-[120px]' : 'min-h-[100px]',
          )}
        >
          <div className="mb-3 h-5 w-2/5 rounded-md bg-primary-100" />
          <div className="mb-2 h-4 w-3/4 rounded-md bg-primary-100" />
          <div className="h-4 w-1/2 rounded-md bg-primary-100" />
          <div className="mt-4 h-20 rounded-card bg-primary-100/80" />
          <div className="mt-4 h-8 w-1/3 rounded-md bg-primary-100" />
        </div>
      ))}
    </div>
  )
}
