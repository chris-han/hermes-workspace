import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowDown01Icon } from '@hugeicons/core-free-icons'
import { AnimatePresence, motion } from 'motion/react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsPanel, TabsTab } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import {
  MenuContent,
  MenuItem,
  MenuRoot,
  MenuTrigger,
} from '@/components/ui/menu'
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

type SkillsTab = 'installed' | 'marketplace' | 'toolsets' | 'plugins'
type SkillsSort = 'name' | 'category'
type SkillSourceFilter = 'All' | 'User' | 'Shared'

type DisplayControl = {
  label: string
  value: string
}

type SecurityRisk = {
  level: 'safe' | 'low' | 'medium' | 'high'
  flags: Array<string>
  score: number
}

type SkillConfigFieldOption = {
  label: string
  value: string
}

type SkillConfigField = {
  key: string
  label?: string
  description?: string
  prompt?: string
  placeholder?: string
  type?: 'string' | 'number' | 'boolean' | 'select'
  required?: boolean
  secret?: boolean
  default?: unknown
  options?: Array<SkillConfigFieldOption>
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
  packageType?: string
  packagePath?: string | null
  installed: boolean
  enabled: boolean
  sourceTier?: string
  sourceLabel?: string
  canEdit?: boolean
  canUninstall?: boolean
  canModify?: boolean
  contentHash?: string | null
  latestHash?: string | null
  updateStatus?: 'up_to_date' | 'update_available' | 'unavailable'
  hubIdentifier?: string | null
  hubSource?: string | null
  hubUpdatedAt?: string | null
  canUpdate?: boolean
  featuredGroup?: string
  configFields?: Array<SkillConfigField>
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

type PluginSummary = {
  id: string
  name: string
  label: string
  description: string
  sourceTier?: string
  sourceLabel?: string
  enabled: boolean
  category: string
  toolsets: Array<string>
  tools: Array<string>
  providesHooks: Array<string>
  sourcePath: string
  canModify?: boolean
}

type PluginsApiResponse = {
  plugins: Array<PluginSummary>
  total: number
  categories: Array<string>
}

type SkillUpdateStatus = 'up_to_date' | 'update_available' | 'unavailable'

type SkillUpdateSummary = {
  name: string
  identifier: string
  source: string
  status: SkillUpdateStatus
  currentHash?: string
  latestHash?: string
}

type SkillUpdatesApiResponse = {
  ok: boolean
  updates: Array<SkillUpdateSummary>
  error?: string
  detail?: string
}

type SkillAction = 'install' | 'update' | 'uninstall' | 'toggle'

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
  type?: string
  path?: string | null
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
const DEFAULT_MARKETPLACE_URL = ''
const DEFAULT_MARKETPLACE_DISPLAY_URL =
  'https://hermes-agent.nousresearch.com/docs/api/skills-index.json'
const SEMANTIER_MARKETPLACE_URL =
  'https://github.com/chris-han/semantier-skills'

const MARKETPLACE_URL_PRESETS = [
  {
    label: 'Default Marketplace',
    value: DEFAULT_MARKETPLACE_DISPLAY_URL,
    resolvedValue: DEFAULT_MARKETPLACE_URL,
  },
  {
    label: 'Semantier Marketplace',
    value: SEMANTIER_MARKETPLACE_URL,
    resolvedValue: SEMANTIER_MARKETPLACE_URL,
  },
]

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
  'User',
  'Shared',
]

const TAB_OPTIONS: Array<DisplayControl & { value: SkillsTab }> = [
  { label: 'Installed', value: 'installed' },
  { label: 'Toolsets', value: 'toolsets' },
  { label: 'Plugins', value: 'plugins' },
  { label: 'Marketplace', value: 'marketplace' },
]

function resolveSourceTier(item: {
  sourceTier?: string
  sourceLabel?: string
  sourcePath?: string
  builtin?: boolean
  canEdit?: boolean
  canUninstall?: boolean
  canModify?: boolean
}): string | undefined {
  if (item.sourceTier) return item.sourceTier
  if (item.canEdit || item.canUninstall || item.canModify) return 'workspace'

  const sourceLabel = item.sourceLabel?.toLowerCase()
  if (sourceLabel === 'user' || sourceLabel === 'workspace') return 'workspace'
  if (
    sourceLabel === 'shared' ||
    sourceLabel === 'application shared' ||
    sourceLabel === 'hermes built-in'
  ) {
    return 'application'
  }

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
  if (filter === 'User') return sourceTier === 'workspace'
  return sourceTier !== 'workspace'
}

function matchesToolsetSearch(
  toolset: ToolsetSummary,
  rawSearch: string,
): boolean {
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

function matchesPluginSearch(plugin: PluginSummary, rawSearch: string): boolean {
  const search = rawSearch.trim().toLowerCase()
  if (!search) return true

  return [
    plugin.name,
    plugin.label,
    plugin.description,
    plugin.category,
    plugin.sourceLabel || '',
    ...plugin.toolsets,
    ...plugin.tools,
    ...plugin.providesHooks,
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

function applySkillUpdateStatus(
  skills: Array<SkillSummary>,
  updates: Array<SkillUpdateSummary>,
): Array<SkillSummary> {
  if (updates.length === 0) return skills

  const byName = new Map<string, SkillUpdateSummary>()
  const byIdentifier = new Map<string, SkillUpdateSummary>()
  for (const update of updates) {
    if (update.name) byName.set(update.name, update)
    if (update.identifier) byIdentifier.set(update.identifier, update)
  }

  return skills.map((skill) => {
    const update =
      (skill.hubIdentifier && byIdentifier.get(skill.hubIdentifier)) ||
      byName.get(skill.name)
    if (!update) return skill

    return {
      ...skill,
      updateStatus: update.status,
      contentHash: update.currentHash || skill.contentHash || null,
      latestHash: update.latestHash || skill.latestHash || null,
      hubIdentifier: skill.hubIdentifier || update.identifier || null,
      hubSource: skill.hubSource || update.source || null,
      canUpdate: skill.canUpdate ?? Boolean(update.identifier),
    }
  })
}

type InstallA2UiFieldNode = {
  key: string
  label: string
  description: string
  required: boolean
  control: 'text' | 'number' | 'boolean' | 'select'
  secret: boolean
  placeholder: string
  options: Array<SkillConfigFieldOption>
  defaultValue: string
}

function labelFromSkillConfigKey(key: string): string {
  const tail = key.split('.').pop() || key
  return tail
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function buildInstallA2UiSchema(skill: SkillSummary | null): Array<InstallA2UiFieldNode> {
  const fields = skill?.configFields || []
  return fields
    .filter((field) => field.key)
    .map((field) => {
      const control =
        field.type === 'boolean'
          ? 'boolean'
          : field.type === 'number'
            ? 'number'
            : field.type === 'select'
              ? 'select'
              : 'text'
      const defaultValue =
        field.default === undefined || field.default === null
          ? ''
          : String(field.default)

      return {
        key: field.key,
        label: field.label || labelFromSkillConfigKey(field.key),
        description: field.description || field.prompt || '',
        required: Boolean(field.required),
        control,
        secret: Boolean(field.secret),
        placeholder: field.placeholder || '',
        options: field.options || [],
        defaultValue,
      }
    })
}

function buildInitialInstallConfigValues(
  schema: Array<InstallA2UiFieldNode>,
): Record<string, string> {
  return schema.reduce<Record<string, string>>((acc, node) => {
    acc[node.key] = node.defaultValue
    return acc
  }, {})
}

function buildInstallConfigPayload(
  schema: Array<InstallA2UiFieldNode>,
  values: Record<string, string>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  for (const node of schema) {
    const raw = (values[node.key] || '').trim()
    if (!raw) continue

    if (node.control === 'boolean') {
      payload[node.key] = raw.toLowerCase() === 'true'
      continue
    }
    if (node.control === 'number') {
      const numeric = Number(raw)
      if (Number.isFinite(numeric)) {
        payload[node.key] = numeric
      }
      continue
    }
    payload[node.key] = raw
  }
  return payload
}

function readMarketplaceUrlFromConfig(payload: unknown): string {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return DEFAULT_MARKETPLACE_URL
  }

  const root = payload as Record<string, unknown>
  const skills = root.skills
  if (!skills || typeof skills !== 'object' || Array.isArray(skills)) {
    return DEFAULT_MARKETPLACE_URL
  }

  const value = (skills as Record<string, unknown>).marketplace_url
  const normalized = typeof value === 'string' ? value.trim() : ''
  return normalized || DEFAULT_MARKETPLACE_URL
}

function resolveMarketplaceUrlInput(rawValue: string): string {
  const value = rawValue.trim()
  const preset = MARKETPLACE_URL_PRESETS.find((entry) => entry.value === value)
  return preset ? preset.resolvedValue : value
}

function displayMarketplaceUrlInput(value: string): string {
  return value.trim() || DEFAULT_MARKETPLACE_DISPLAY_URL
}

function normalizeInstallIdentifier(rawValue: string): string {
  const value = rawValue.trim()
  if (!value) return ''

  if (/^https?:\/\/github\.com\//i.test(value)) {
    const stripped = value
      .replace(/^https?:\/\/github\.com\//i, '')
      .replace(/\.git$/i, '')
      .replace(/^\/+|\/+$/g, '')
    if (stripped) return stripped
  }

  if (/^git@github\.com:/i.test(value)) {
    const stripped = value
      .replace(/^git@github\.com:/i, '')
      .replace(/\.git$/i, '')
      .replace(/^\/+|\/+$/g, '')
    if (stripped) return stripped
  }

  return value
}

export function SkillsScreen() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<SkillsTab>('installed')
  const [searchInput, setSearchInput] = useState('')
  const [debouncedMarketplaceSearch, setDebouncedMarketplaceSearch] =
    useState('')
  const [sourceFilter, setSourceFilter] = useState<SkillSourceFilter>('All')
  const [category, setCategory] = useState('All')
  const [pluginCategory, setPluginCategory] = useState('All')
  const [sort, setSort] = useState<SkillsSort>('name')
  const [page, setPage] = useState(1)
  const [pendingAction, setPendingAction] = useState<PendingSkillAction | null>(
    null,
  )
  const [skillOverrides, setSkillOverrides] = useState<
    Record<string, SkillOverride>
  >({})
  const [selectedSkill, setSelectedSkill] = useState<SkillSummary | null>(null)
  const [selectedToolset, setSelectedToolset] = useState<ToolsetSummary | null>(
    null,
  )
  const [selectedPlugin, setSelectedPlugin] = useState<PluginSummary | null>(
    null,
  )
  const [installConfigValues, setInstallConfigValues] = useState<
    Record<string, string>
  >({})
  const [marketplaceUrl, setMarketplaceUrl] = useState('')
  const [marketplaceUrlDraft, setMarketplaceUrlDraft] = useState('')
  const [directInstallIdentifier, setDirectInstallIdentifier] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)

  const installConfigSchema = useMemo(
    () => buildInstallA2UiSchema(selectedSkill),
    [selectedSkill],
  )

  useEffect(() => {
    setInstallConfigValues(buildInitialInstallConfigValues(installConfigSchema))
  }, [installConfigSchema, selectedSkill?.id])

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
    enabled: tab !== 'toolsets' && tab !== 'plugins',
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

  const pluginsQuery = useQuery({
    queryKey: ['skills-browser', 'plugins'],
    queryFn: async function fetchPlugins(): Promise<PluginsApiResponse> {
      const response = await fetch('/api/plugins')
      const payload = (await response.json().catch(() => ({}))) as
        | PluginsApiResponse
        | { error?: string; detail?: string }

      if (!response.ok) {
        const record =
          payload && !Array.isArray(payload)
            ? (payload as { error?: string; detail?: string })
            : {}
        throw new Error(
          record.error || record.detail || 'Failed to load plugins',
        )
      }

      return (payload as PluginsApiResponse) || {
        plugins: [],
        total: 0,
        categories: ['All'],
      }
    },
  })

  const marketplaceConfigQuery = useQuery({
    queryKey: ['skills-marketplace-config'],
    queryFn: async function fetchMarketplaceConfig(): Promise<string> {
      const response = await fetch('/api/config-get')
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
        payload?: unknown
      }

      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || 'Failed to load marketplace config')
      }

      return readMarketplaceUrlFromConfig(payload.payload)
    },
  })

  useEffect(() => {
    if (marketplaceConfigQuery.data === undefined) return
    setMarketplaceUrl(marketplaceConfigQuery.data)
    setMarketplaceUrlDraft(displayMarketplaceUrlInput(marketplaceConfigQuery.data))
  }, [marketplaceConfigQuery.data])

  const installedCountQuery = useQuery({
    queryKey: ['skills-browser', 'installed-count', searchInput, category, sort],
    queryFn: async function fetchInstalledSkillCount(): Promise<SkillsApiResponse> {
      const params = new URLSearchParams()
      params.set('tab', 'installed')
      params.set('search', searchInput)
      params.set('category', category)
      params.set('page', '1')
      params.set('limit', '1')
      params.set('sort', sort)

      const response = await fetch(`/api/skills?${params.toString()}`)
      const payload = (await response.json()) as SkillsApiResponse & {
        error?: string
      }
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to fetch installed skill count')
      }
      return payload
    },
    staleTime: 30_000,
  })

  const hubQuery = useQuery({
    queryKey: ['skills-hub-search', debouncedMarketplaceSearch, marketplaceUrl],
    enabled: tab === 'marketplace',
    queryFn: async function fetchHubResults(): Promise<HubSearchResponse> {
      const params = new URLSearchParams()
      params.set('q', debouncedMarketplaceSearch)
      params.set('source', 'all')
      params.set('limit', '20')
      if (marketplaceUrl) {
        params.set('marketplace_url', marketplaceUrl)
      }

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

  const skillUpdatesQuery = useQuery({
    queryKey: ['skills-updates'],
    enabled: tab === 'installed',
    queryFn: async function fetchSkillUpdates(): Promise<SkillUpdatesApiResponse> {
      const response = await fetch('/api/skills?check_updates=1')
      const payload = (await response.json()) as SkillUpdatesApiResponse
      if (!response.ok) {
        throw new Error(
          payload.error || payload.detail || 'Failed to check skill updates',
        )
      }
      return payload
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
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
      const sourceSkills = applySkillUpdateStatus(
        applySkillOverrides(skillsQuery.data?.skills || [], skillOverrides),
        skillUpdatesQuery.data?.updates || [],
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
    [
      searchInput,
      skillOverrides,
      skillUpdatesQuery.data?.updates,
      skillsQuery.data?.skills,
      sourceFilter,
    ],
  )

  const marketplaceSkills = useMemo<Array<SkillSummary>>(
    function resolveMarketplaceSkills() {
      const sourceSkills: Array<SkillSummary> = (
        hubQuery.data?.results || []
      ).map(function mapHubSkill(skill) {
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
          packageType: skill.type || 'skill',
          packagePath: skill.path || null,
          installed: skill.installed,
          enabled: skill.installed,
          sourceTier:
            skill.source === 'official' || skill.trust_level === 'builtin'
              ? 'application'
              : 'external',
          sourceLabel:
            skill.source === 'official' || skill.trust_level === 'builtin'
              ? 'Shared'
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

  const pluginCategories = useMemo(
    () => pluginsQuery.data?.categories || ['All'],
    [pluginsQuery.data?.categories],
  )

  const plugins = useMemo(
    function resolveVisiblePlugins() {
      return (pluginsQuery.data?.plugins || [])
        .filter((plugin) => matchesSourceFilter(plugin, sourceFilter))
        .filter((plugin) =>
          pluginCategory === 'All' ? true : plugin.category === pluginCategory,
        )
        .filter((plugin) => matchesPluginSearch(plugin, searchInput))
        .sort((left, right) => left.label.localeCompare(right.label))
    },
    [pluginCategory, pluginsQuery.data?.plugins, searchInput, sourceFilter],
  )

  const visibleSourceFilters = useMemo(
    () => SOURCE_FILTERS,
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
      identifier?: string | null
      packageType?: string | null
      path?: string | null
      enabled?: boolean
      source?: HubSkill['source']
      config?: Record<string, unknown>
    },
  ) {
    setActionError(null)
    setPendingAction({ skillId: payload.skillId, action })

    try {
      const endpoint =
        action === 'install' || action === 'update'
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
          identifier: payload.identifier || payload.skillId,
          packageType: payload.packageType || 'skill',
          path: payload.path || '',
          enabled: payload.enabled,
          source: payload.source,
          force: action === 'update',
          config: payload.config || {},
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
        (action === 'install' || action === 'update' || action === 'uninstall') &&
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
        queryClient.invalidateQueries({ queryKey: ['skills-updates'] }),
      ])
      setSkillOverrides(function updateSkillOverrides(current) {
        const next = { ...current }
        const existing = next[payload.skillId] || {}

        if (action === 'install' || action === 'update') {
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
        if (action === 'install' || action === 'update') {
          return {
            ...current,
            installed: true,
            enabled: true,
            updateStatus:
              action === 'update' ? 'up_to_date' : current.updateStatus,
            contentHash:
              action === 'update'
                ? current.latestHash || current.contentHash
                : current.contentHash,
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

  async function saveMarketplaceUrl(nextValue?: string) {
    const trimmed = resolveMarketplaceUrlInput(nextValue ?? marketplaceUrlDraft)
    try {
      const response = await fetch('/api/config-patch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: 'skills.marketplace_url',
          value: trimmed,
        }),
      })
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
      }
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || 'Failed to save marketplace URL')
      }

      setMarketplaceUrl(trimmed)
      await queryClient.invalidateQueries({
        queryKey: ['skills-hub-search'],
      })
      toast('Marketplace URL updated.', { type: 'success', icon: '✅' })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to save marketplace URL'
      setActionError(message)
      toast(message, { type: 'error', icon: '❌' })
    }
  }

  function installFromIdentifierInput() {
    const normalized = normalizeInstallIdentifier(directInstallIdentifier)
    if (!normalized) {
      toast('Enter a skill identifier or repository path first.', {
        type: 'warning',
        icon: '⚠️',
      })
      return
    }

    setDirectInstallIdentifier(normalized)
    void runSkillAction('install', { skillId: normalized, source: 'github' })
  }

  function handleTabChange(nextTab: string) {
    const parsedTab: SkillsTab =
      nextTab === 'installed' ||
      nextTab === 'marketplace' ||
      nextTab === 'toolsets' ||
      nextTab === 'plugins'
        ? nextTab
        : 'installed'

    setTab(parsedTab)
    setPage(1)
    if (parsedTab !== 'installed') {
      setCategory('All')
      setSort('name')
    }
    if (parsedTab !== 'plugins') {
      setPluginCategory('All')
    }
    if (parsedTab === 'marketplace') {
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

  function openInstallFlow(skill: SkillSummary, source?: HubSkill['source']) {
    if (skill.configFields && skill.configFields.length > 0) {
      setSelectedSkill(skill)
      toast('This skill requires install config. Complete the A2UI form to continue.', {
        type: 'warning',
        icon: '🧩',
      })
      return
    }

    void runSkillAction('install', {
      skillId: skill.id,
      identifier: skill.hubIdentifier || skill.id,
      packageType: skill.packageType || 'skill',
      path: skill.packagePath || '',
      source,
    })
  }

  function handleInstallFromDialog(skill: SkillSummary) {
    if (installConfigSchema.length === 0) {
      void runSkillAction('install', { skillId: skill.id })
      return
    }

    const missingRequired = installConfigSchema
      .filter((node) => node.required)
      .filter((node) => !(installConfigValues[node.key] || '').trim())

    if (missingRequired.length > 0) {
      const firstMissing = missingRequired[0]?.label || missingRequired[0]?.key
      const message = `Missing required field: ${firstMissing}`
      setActionError(message)
      toast(message, { type: 'error', icon: '❌' })
      return
    }

    const configPayload = buildInstallConfigPayload(
      installConfigSchema,
      installConfigValues,
    )
    void runSkillAction('install', {
      skillId: skill.id,
      identifier: skill.hubIdentifier || skill.id,
      packageType: skill.packageType || 'skill',
      path: skill.packagePath || '',
      config: configPayload,
    })
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
                Skills, Toolsets & Plugins
              </h1>
              <p className="text-sm text-primary-500 text-pretty sm:text-base">
                Discover, install, and inspect workspace skills plus the
                toolsets and plugins available to the active Semantier runtime.
              </p>
            </div>
          </div>
        </header>

        <section className="rounded-card border border-border bg-primary-50/80 p-3 backdrop-blur-xl sm:p-4">
          <Tabs value={tab} onValueChange={handleTabChange}>
            <div className="flex flex-col gap-3">
              <TabsList
                className="w-full justify-start gap-2 border-b border-border bg-transparent px-0"
                variant="underline"
              >
                {TAB_OPTIONS.map((option) => (
                  <TabsTab
                    key={option.value}
                    value={option.value}
                    className="min-w-0 rounded-none px-1 text-primary-500 data-active:text-ink [&[data-active]_.tab-badge]:border-primary-300 [&[data-active]_.tab-badge]:bg-primary-100 [&[data-active]_.tab-badge]:text-ink"
                  >
                    <span>{option.label}</span>
                    <span className="tab-badge inline-flex min-w-[1.25rem] items-center justify-center rounded-full border border-border bg-primary-50 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-primary-500 tabular-nums">
                      {option.value === 'installed'
                        ? (
                            installedCountQuery.data?.total ??
                            skillsQuery.data?.total ??
                            0
                          ).toLocaleString()
                        : option.value === 'toolsets'
                          ? (toolsetsQuery.data?.length || 0).toLocaleString()
                          : option.value === 'plugins'
                            ? (pluginsQuery.data?.total || 0).toLocaleString()
                          : (
                              hubQuery.data?.total ||
                              hubQuery.data?.results?.length ||
                              0
                            ).toLocaleString()}
                    </span>
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
                      : tab === 'plugins'
                        ? 'Search by plugin, category, toolset, or hook'
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

                  {tab === 'plugins' ? (
                    <select
                      value={pluginCategory}
                      onChange={(event) => {
                        setPluginCategory(event.target.value)
                        setPage(1)
                      }}
                      className="h-10 rounded-button border border-border bg-primary-100/60 px-3 text-sm text-ink outline-none"
                    >
                      {pluginCategories.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
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

            {tab === 'plugins' && pluginsQuery.error ? (
              <p className="rounded-lg border border-border bg-primary-100/60 px-3 py-2 text-sm text-ink">
                {pluginsQuery.error instanceof Error
                  ? pluginsQuery.error.message
                  : 'Failed to load plugins.'}
              </p>
            ) : null}

            <TabsPanel value="installed" className="pt-2">
              {skillUpdatesQuery.error ? (
                <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                  Update check unavailable. Installed content hashes are still
                  shown from the local skill lock.
                </div>
              ) : null}
              <SkillsGrid
                skills={skills}
                loading={skillsQuery.isPending}
                pendingAction={pendingAction}
                tab="installed"
                onOpenDetails={setSelectedSkill}
                onInstall={(skill) => openInstallFlow(skill)}
                onUpdate={(skill) =>
                  runSkillAction('update', {
                    skillId: skill.id,
                    identifier: skill.hubIdentifier,
                  })
                }
                onUninstall={(skillId) =>
                  runSkillAction('uninstall', { skillId })
                }
                onToggle={(skillId, enabled) =>
                  runSkillAction('toggle', { skillId, enabled })
                }
              />
            </TabsPanel>

            <TabsPanel value="marketplace" className="space-y-3 pt-2">
              <div className="grid gap-3 rounded-xl border border-border bg-primary-100/40 p-3 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-500">
                    Install From Git Repo
                  </p>
                  <input
                    value={directInstallIdentifier}
                    onChange={(event) =>
                      setDirectInstallIdentifier(event.target.value)
                    }
                    placeholder="owner/repo/path/to/skill or github URL"
                    className="h-10 w-full rounded-button border border-border bg-primary-50/90 px-3 text-sm text-ink outline-none"
                  />
                  <p className="text-xs text-primary-500">
                    Uses the same backend install path as marketplace results.
                  </p>
                  <div>
                    <Button
                      size="sm"
                      disabled={
                        pendingAction?.action === 'install' &&
                        pendingAction.skillId ===
                          normalizeInstallIdentifier(directInstallIdentifier)
                      }
                      onClick={installFromIdentifierInput}
                    >
                      Install Identifier
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-500">
                    Marketplace URL
                  </p>
                  <div className="flex h-10 w-full overflow-hidden rounded-button border border-border bg-primary-50/90 focus-within:border-primary">
                    <input
                      role="combobox"
                      aria-label="Marketplace URL"
                      aria-controls="marketplace-url-preset-menu"
                      value={marketplaceUrlDraft}
                      onChange={(event) =>
                        setMarketplaceUrlDraft(event.target.value)
                      }
                      placeholder="https://example.com/skills/search"
                      className="min-w-0 flex-1 bg-transparent px-3 text-sm text-ink outline-none"
                    />
                    <MenuRoot>
                      <MenuTrigger
                        type="button"
                        className="flex w-10 shrink-0 items-center justify-center border-l border-border text-primary-600 transition-colors hover:bg-primary-100 hover:text-ink"
                        aria-label="Select marketplace URL"
                      >
                        <HugeiconsIcon
                          icon={ArrowDown01Icon}
                          size={18}
                          strokeWidth={1.6}
                        />
                      </MenuTrigger>
                      <MenuContent
                        side="bottom"
                        align="end"
                        className="w-[min(34rem,calc(100vw-2rem))]"
                      >
                        <div id="marketplace-url-preset-menu">
                          {MARKETPLACE_URL_PRESETS.map((entry) => (
                            <MenuItem
                              key={entry.label}
                              onClick={() => {
                                setMarketplaceUrlDraft(entry.value)
                              }}
                              className="flex-col items-start gap-0.5"
                            >
                              <span className="font-medium">
                                {entry.label}
                              </span>
                              <span className="max-w-full truncate text-xs text-primary-500">
                                {entry.value}
                              </span>
                            </MenuItem>
                          ))}
                        </div>
                      </MenuContent>
                    </MenuRoot>
                  </div>
                  <p className="text-xs text-primary-500">
                    Select a preset or enter a custom marketplace endpoint.
                    The default marketplace uses the built-in Hermes skills index.
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={marketplaceConfigQuery.isPending}
                      onClick={() => {
                        void saveMarketplaceUrl()
                      }}
                    >
                      Save URL
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setMarketplaceUrlDraft(DEFAULT_MARKETPLACE_DISPLAY_URL)
                        void saveMarketplaceUrl('')
                      }}
                    >
                      Reset
                    </Button>
                  </div>
                </div>
              </div>

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
                onInstall={(skill) => {
                  const hubSkill = hubQuery.data?.results.find(
                    (entry) => entry.id === skill.id,
                  )
                  openInstallFlow(skill, hubSkill?.source)
                }}
                onUpdate={(skill) =>
                  runSkillAction('update', {
                    skillId: skill.id,
                    identifier: skill.hubIdentifier,
                  })
                }
                onUninstall={(skillId) =>
                  runSkillAction('uninstall', {
                    skillId,
                    identifier:
                      marketplaceSkills.find((entry) => entry.id === skillId)
                        ?.hubIdentifier || skillId,
                    packageType:
                      marketplaceSkills.find((entry) => entry.id === skillId)
                        ?.packageType || 'skill',
                    path:
                      marketplaceSkills.find((entry) => entry.id === skillId)
                        ?.packagePath || '',
                  })
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

            <TabsPanel value="plugins" className="pt-2">
              <PluginsGrid
                plugins={plugins}
                loading={pluginsQuery.isPending}
                onOpenDetails={setSelectedPlugin}
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
              {(toolsetsQuery.data?.length || 0).toLocaleString()} total in
              runtime
            </span>
          </footer>
        ) : tab === 'plugins' ? (
          <footer className="flex items-center justify-between rounded-card border border-border bg-primary-50/80 px-3 py-2.5 text-sm text-primary-500 tabular-nums">
            <span>{plugins.length.toLocaleString()} visible plugins</span>
            <span>
              {(pluginsQuery.data?.total || 0).toLocaleString()} total in runtime
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
                      {selectedSkill.contentHash ? (
                        <span className="rounded-md border border-border bg-primary-100/50 px-2 py-0.5 text-xs text-primary-500">
                          Installed hash {selectedSkill.contentHash}
                        </span>
                      ) : null}
                      {selectedSkill.updateStatus === 'update_available' &&
                      selectedSkill.latestHash ? (
                        <span className="rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs text-amber-800">
                          Latest hash {selectedSkill.latestHash}
                        </span>
                      ) : null}
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

                    {!selectedSkill.installed && installConfigSchema.length > 0 ? (
                      <section className="rounded-card border border-border bg-primary-50/80 p-4 backdrop-blur-sm">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-500">
                          Install Configuration (A2UI)
                        </p>
                        <p className="mt-1 text-sm text-primary-500">
                          This skill declares configuration fields that are stored under skills.config.* during install.
                        </p>

                        <div className="mt-3 space-y-3">
                          {installConfigSchema.map((node) => (
                            <label key={node.key} className="block space-y-1.5">
                              <span className="text-sm font-medium text-ink">
                                {node.label}
                                {node.required ? (
                                  <span className="ml-1 text-red-600">*</span>
                                ) : null}
                              </span>
                              {node.description ? (
                                <p className="text-xs text-primary-500">{node.description}</p>
                              ) : null}

                              {node.control === 'boolean' ? (
                                <select
                                  value={installConfigValues[node.key] || ''}
                                  onChange={(event) =>
                                    setInstallConfigValues((current) => ({
                                      ...current,
                                      [node.key]: event.target.value,
                                    }))
                                  }
                                  className="h-10 w-full rounded-button border border-border bg-primary-100/60 px-3 text-sm text-ink outline-none"
                                >
                                  <option value="">Select</option>
                                  <option value="true">True</option>
                                  <option value="false">False</option>
                                </select>
                              ) : node.control === 'select' ? (
                                <select
                                  value={installConfigValues[node.key] || ''}
                                  onChange={(event) =>
                                    setInstallConfigValues((current) => ({
                                      ...current,
                                      [node.key]: event.target.value,
                                    }))
                                  }
                                  className="h-10 w-full rounded-button border border-border bg-primary-100/60 px-3 text-sm text-ink outline-none"
                                >
                                  <option value="">Select</option>
                                  {node.options.map((option) => (
                                    <option key={`${node.key}-${option.value}`} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  type={node.secret ? 'password' : node.control === 'number' ? 'number' : 'text'}
                                  value={installConfigValues[node.key] || ''}
                                  onChange={(event) =>
                                    setInstallConfigValues((current) => ({
                                      ...current,
                                      [node.key]: event.target.value,
                                    }))
                                  }
                                  placeholder={node.placeholder || node.key}
                                  className="h-10 w-full rounded-button border border-border bg-primary-100/60 px-3 text-sm text-ink outline-none"
                                />
                              )}
                            </label>
                          ))}
                        </div>
                      </section>
                    ) : null}

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
                    <>
                      {selectedSkill.updateStatus === 'update_available' ? (
                        <Button
                          size="sm"
                          disabled={
                            pendingAction?.skillId === selectedSkill.id ||
                            !selectedSkill.canUpdate
                          }
                          onClick={() => {
                            runSkillAction('update', {
                              skillId: selectedSkill.id,
                              identifier: selectedSkill.hubIdentifier,
                            })
                          }}
                        >
                          {pendingAction?.skillId === selectedSkill.id &&
                          pendingAction.action === 'update'
                            ? 'Updating...'
                            : 'Update'}
                        </Button>
                      ) : null}
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
                            identifier:
                              selectedSkill.hubIdentifier || selectedSkill.id,
                            packageType: selectedSkill.packageType || 'skill',
                            path: selectedSkill.packagePath || '',
                          })
                        }}
                      >
                        {selectedSkill.canUninstall === false
                          ? 'Read only'
                          : 'Uninstall'}
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      disabled={pendingAction?.skillId === selectedSkill.id}
                      onClick={() => handleInstallFromDialog(selectedSkill)}
                    >
                      {pendingAction?.skillId === selectedSkill.id &&
                      pendingAction.action === 'install'
                        ? 'Installing…'
                        : installConfigSchema.length > 0
                          ? 'Install With Config'
                          : 'Install'}
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
                        {selectedToolset.configured
                          ? 'Configured'
                          : 'No extra config'}
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

      <DialogRoot
        open={Boolean(selectedPlugin)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedPlugin(null)
          }
        }}
      >
        <DialogContent className="rounded-card w-[min(820px,95vw)] border-border bg-primary-50/95 backdrop-blur-sm">
          {selectedPlugin ? (
            <div className="flex max-h-[85vh] flex-col">
              <div className="border-b border-border px-5 py-4">
                <DialogTitle className="text-balance">
                  {selectedPlugin.label}
                </DialogTitle>
                <DialogDescription className="mt-1 text-pretty">
                  {selectedPlugin.category} • {selectedPlugin.sourceLabel || 'Plugin'}
                </DialogDescription>
              </div>

              <ScrollAreaRoot className="h-[52vh]">
                <ScrollAreaViewport className="px-5 py-4">
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-1.5">
                      <span className="rounded-md border border-border bg-primary-100/50 px-2 py-0.5 text-xs text-primary-500">
                        {selectedPlugin.enabled ? 'Enabled' : 'Inactive'}
                      </span>
                      <span className="rounded-md border border-border bg-primary-100/50 px-2 py-0.5 text-xs text-primary-500">
                        {selectedPlugin.category}
                      </span>
                      {selectedPlugin.sourceLabel ? (
                        <span className="rounded-md border border-border bg-primary-100/50 px-2 py-0.5 text-xs text-primary-500">
                          {selectedPlugin.sourceLabel}
                        </span>
                      ) : null}
                    </div>

                    <article className="rounded-xl border border-border bg-primary-100/30 p-4 backdrop-blur-sm">
                      <p className="text-sm leading-relaxed text-primary-600">
                        {selectedPlugin.description || 'No plugin description provided.'}
                      </p>
                    </article>

                    <div className="rounded-xl border border-border bg-primary-100/30 p-4 backdrop-blur-sm">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-primary-500">
                        Hook Surfaces
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedPlugin.providesHooks.length > 0 ? (
                          selectedPlugin.providesHooks.map((hook) => (
                            <span
                              key={hook}
                              className="rounded-md border border-border bg-primary-50/80 px-2 py-0.5 text-xs text-primary-600"
                            >
                              {hook}
                            </span>
                          ))
                        ) : (
                          <span className="rounded-md border border-border bg-primary-50/80 px-2 py-0.5 text-xs text-primary-600">
                            No hooks declared
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-border bg-primary-100/30 p-4 backdrop-blur-sm">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-primary-500">
                        Toolsets & Tools
                      </p>
                      <div className="space-y-3">
                        <div className="flex flex-wrap gap-1.5">
                          {selectedPlugin.toolsets.length > 0 ? (
                            selectedPlugin.toolsets.map((toolset) => (
                              <span
                                key={toolset}
                                className="rounded-md border border-border bg-primary-50/80 px-2 py-0.5 text-xs text-primary-600"
                              >
                                {toolset}
                              </span>
                            ))
                          ) : (
                            <span className="rounded-md border border-border bg-primary-50/80 px-2 py-0.5 text-xs text-primary-600">
                              No toolsets exposed
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedPlugin.tools.length > 0 ? (
                            selectedPlugin.tools.map((tool) => (
                              <span
                                key={tool}
                                className="rounded-md border border-border bg-primary-50/80 px-2 py-0.5 text-xs text-primary-600"
                              >
                                {tool}
                              </span>
                            ))
                          ) : (
                            <span className="rounded-md border border-border bg-primary-50/80 px-2 py-0.5 text-xs text-primary-600">
                              No callable tools registered
                            </span>
                          )}
                        </div>
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
                  Source: <code className="inline-code">{selectedPlugin.sourcePath}</code>
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedPlugin(null)}
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
  onInstall: (skill: SkillSummary) => void
  onUpdate: (skill: SkillSummary) => void
  onUninstall: (skillId: string) => void
  onToggle: (skillId: string, enabled: boolean) => void
}

type ToolsetsGridProps = {
  toolsets: Array<ToolsetSummary>
  loading: boolean
  onOpenDetails: (toolset: ToolsetSummary) => void
}

type PluginsGridProps = {
  plugins: Array<PluginSummary>
  loading: boolean
  onOpenDetails: (plugin: PluginSummary) => void
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
            <span className="brand-wordmark text-primary-500 font-medium w-16 shrink-0">
              semantier
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
  onUpdate,
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
          const isUpdating =
            pendingAction?.skillId === skill.id &&
            pendingAction.action === 'update'
          const canUninstall = skill.canUninstall ?? true
          const hasUpdate = skill.updateStatus === 'update_available'

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
                <div className="flex items-center gap-2">
                  {tab === 'installed' ? (
                    <Switch
                      checked={skill.enabled}
                      disabled={isActing || skill.canModify === false}
                      className="[--thumb-size:1.3125rem]"
                      onCheckedChange={(checked) => onToggle(skill.id, checked)}
                      aria-label={`Toggle ${skill.name}`}
                    />
                  ) : null}
                  <span
                    className={cn(
                      'inline-flex h-[calc(1.3125rem+2px)] items-center gap-1.5 rounded-md border px-2 text-xs tabular-nums',
                      isInstalling
                        ? 'border-primary/40 bg-primary/15 text-primary'
                        : skill.installed
                          ? 'border-primary/40 bg-primary/15 text-primary'
                          : 'border-primary-200 bg-primary-100/60 text-primary-500',
                    )}
                  >
                    {isInstalling || isUpdating ? (
                      <>
                        <InlineSpinner />
                        {isUpdating ? 'Updating...' : 'Installing...'}
                      </>
                    ) : hasUpdate ? (
                      'Update available'
                    ) : skill.installed ? (
                      'Installed'
                    ) : (
                      'Available'
                    )}
                  </span>
                </div>
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
                {skill.contentHash ? (
                  <span className="rounded-md border border-border bg-primary-100/50 px-2 py-0.5 text-xs text-primary-500">
                    {skill.contentHash}
                  </span>
                ) : null}
                {hasUpdate && skill.latestHash ? (
                  <span className="rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs text-amber-800">
                    latest {skill.latestHash}
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
                    {hasUpdate ? (
                      <Button
                        size="sm"
                        disabled={isActing || !skill.canUpdate}
                        onClick={() => onUpdate(skill)}
                      >
                        {isUpdating ? 'Updating...' : 'Update'}
                      </Button>
                    ) : null}
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
                    onClick={() => onInstall(skill)}
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

function ToolsetsGrid({ toolsets, loading, onOpenDetails }: ToolsetsGridProps) {
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

function PluginsGrid({ plugins, loading, onOpenDetails }: PluginsGridProps) {
  if (loading) {
    return <SkillsSkeleton count={6} />
  }

  if (plugins.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-border bg-primary-100/40 px-4 py-8 text-center">
        <p className="text-sm font-medium text-primary-700">
          No plugins found
        </p>
        <p className="mt-1 text-xs text-primary-500 text-pretty max-w-sm mx-auto">
          Try a different source filter, category, or search term.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <AnimatePresence initial={false}>
        {plugins.map((plugin) => (
          <motion.article
            key={plugin.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
            className="flex min-h-[220px] flex-col rounded-card border border-border bg-card p-4"
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="space-y-1">
                <p className="text-xl leading-none">
                  {plugin.category === 'Runtime Guard'
                    ? '🛡️'
                    : plugin.category === 'Hook Plugin'
                      ? '🪝'
                      : plugin.category === 'Tool Provider'
                        ? '🧰'
                        : plugin.category === 'Hybrid'
                          ? '🧩'
                          : '⚙️'}
                </p>
                <h3 className="line-clamp-2 text-base font-medium text-ink text-balance">
                  {plugin.label}
                </h3>
                <p className="line-clamp-1 text-xs text-primary-500">
                  {plugin.category}
                </p>
              </div>
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs tabular-nums',
                  plugin.enabled
                    ? 'border-primary/40 bg-primary/15 text-primary'
                    : 'border-primary-200 bg-primary-100/60 text-primary-500',
                )}
              >
                {plugin.enabled ? 'Enabled' : 'Inactive'}
              </span>
            </div>

            <p className="line-clamp-3 min-h-[58px] text-sm text-primary-500 text-pretty">
              {plugin.description || 'No plugin description provided.'}
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {plugin.sourceLabel ? (
                <span className="rounded-md border border-border bg-primary-100/50 px-2 py-0.5 text-xs text-primary-500">
                  {plugin.sourceLabel}
                </span>
              ) : null}
              <span className="rounded-md border border-border bg-primary-100/50 px-2 py-0.5 text-xs text-primary-500">
                {plugin.toolsets.length.toLocaleString()} toolsets
              </span>
              <span className="rounded-md border border-border bg-primary-100/50 px-2 py-0.5 text-xs text-primary-500">
                {plugin.providesHooks.length.toLocaleString()} hooks
              </span>
            </div>

            <div className="mt-auto flex items-center justify-between gap-2 pt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenDetails(plugin)}
              >
                Details
              </Button>
              <span className="text-xs text-primary-500">
                {plugin.canModify ? 'Editable' : 'Read only'}
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
