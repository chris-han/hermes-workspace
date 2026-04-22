import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../server/auth-middleware'
import { ensureGatewayProbed } from '../../server/gateway-capabilities'
import { fetchSemantierSkillsInventory } from '../../server/semantier-skills-api'
import { createCapabilityUnavailablePayload } from '@/lib/feature-gates'

type SkillsTab = 'installed' | 'marketplace' | 'featured'
type SkillsSort = 'name' | 'category'

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
  builtin?: boolean
  sourceTier?: string
  sourceLabel?: string
  canEdit?: boolean
  canUninstall?: boolean
  canModify?: boolean
  featuredGroup?: string
  security: SecurityRisk
}

const KNOWN_CATEGORIES = [
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
] as const

const FEATURED_SKILLS: Array<{ id: string; group: string }> = [
  { id: 'dbalve/fast-io', group: 'Most Popular' },
  { id: 'okoddcat/gitflow', group: 'Most Popular' },
  { id: 'atomtanstudio/craft-do', group: 'Most Popular' },
  { id: 'bro3886/gtasks-cli', group: 'New This Week' },
  { id: 'vvardhan14/pokerpal', group: 'New This Week' },
  {
    id: 'veeramanikandanr48/docker-containerization',
    group: 'Developer Tools',
  },
  { id: 'veeramanikandanr48/azure-auth', group: 'Developer Tools' },
  { id: 'dbalve/fastio-skills', group: 'Productivity' },
  { id: 'gillberto1/moltwallet', group: 'Productivity' },
  { id: 'veeramanikandanr48/backtest-expert', group: 'Productivity' },
]

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function readStringArray(value: unknown): Array<string> {
  if (!Array.isArray(value)) return []
  return value.map((entry) => readString(entry)).filter(Boolean)
}

function slugify(input: string): string {
  const result = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
  return result || 'skill'
}

function normalizeSecurity(value: unknown): SecurityRisk {
  const record = asRecord(value)
  const level = readString(record.level)
  return {
    level:
      level === 'low' ||
      level === 'medium' ||
      level === 'high' ||
      level === 'safe'
        ? level
        : 'safe',
    flags: readStringArray(record.flags),
    score:
      typeof record.score === 'number' && Number.isFinite(record.score)
        ? record.score
        : 0,
  }
}

function guessCategory(record: Record<string, unknown>): string {
  const direct =
    readString(record.category) ||
    readString(record.group) ||
    readString(record.section)
  if (direct) return direct
  const tags = readStringArray(record.tags).map((tag) => tag.toLowerCase())
  if (tags.some((tag) => tag.includes('frontend') || tag.includes('react'))) {
    return 'Web & Frontend'
  }
  if (tags.some((tag) => tag.includes('browser'))) {
    return 'Browser & Automation'
  }
  if (tags.some((tag) => tag.includes('git'))) {
    return 'Git & GitHub'
  }
  if (tags.some((tag) => tag.includes('ai') || tag.includes('llm'))) {
    return 'AI & LLMs'
  }
  return 'Productivity'
}

function normalizeSkill(value: unknown): SkillSummary | null {
  const record = asRecord(value)
  const id =
    readString(record.id) || readString(record.slug) || readString(record.name)
  if (!id) return null

  const name = readString(record.name) || id
  const sourcePath =
    readString(record.sourcePath) ||
    readString(record.path) ||
    readString(record.file) ||
    ''

  return {
    id,
    slug: readString(record.slug) || slugify(id),
    name,
    description: readString(record.description),
    author:
      readString(record.author) ||
      readString(record.owner) ||
      readString(record.publisher),
    triggers: readStringArray(record.triggers),
    tags: readStringArray(record.tags),
    homepage: readString(record.homepage) || null,
    category: guessCategory(record),
    icon: readString(record.icon) || '✨',
    content:
      readString(record.content) ||
      readString(record.readme) ||
      readString(record.prompt),
    fileCount:
      typeof record.fileCount === 'number' && Number.isFinite(record.fileCount)
        ? record.fileCount
        : 0,
    sourcePath,
    // Hermes /api/skills returns the installed skill inventory. Older payloads
    // omit explicit installed/enabled flags, so default to installed=true.
    installed: Boolean(record.installed ?? true),
    enabled: Boolean(record.enabled ?? record.installed ?? true),
    builtin: Boolean(record.builtin),
    sourceTier: readString(record.sourceTier) || undefined,
    sourceLabel: readString(record.sourceLabel) || undefined,
    canEdit: typeof record.canEdit === 'boolean' ? record.canEdit : undefined,
    canUninstall:
      typeof record.canUninstall === 'boolean'
        ? record.canUninstall
        : undefined,
    canModify:
      typeof record.canModify === 'boolean' ? record.canModify : undefined,
    featuredGroup: undefined,
    security: normalizeSecurity(record.security),
  }
}

async function fetchHermesSkills(
  requestHeaders?: HeadersInit | Headers,
): Promise<Array<SkillSummary>> {
  const payload = await fetchSemantierSkillsInventory(requestHeaders)
  return payload.skills
    .map((entry) => normalizeSkill(entry))
    .filter((entry): entry is SkillSummary => entry !== null)
}

function matchesSearch(skill: SkillSummary, rawSearch: string): boolean {
  const search = rawSearch.trim().toLowerCase()
  if (!search) return true

  return [
    skill.id,
    skill.name,
    skill.description,
    skill.author,
    skill.category,
    ...skill.tags,
    ...skill.triggers,
  ]
    .join('\n')
    .toLowerCase()
    .includes(search)
}

function sortSkills(skills: Array<SkillSummary>, sort: SkillsSort) {
  return [...skills].sort((left, right) => {
    if (sort === 'category') {
      const categoryCompare = left.category.localeCompare(right.category)
      if (categoryCompare !== 0) return categoryCompare
    }
    return left.name.localeCompare(right.name)
  })
}

export const Route = createFileRoute('/api/skills')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        }
        const capabilities = await ensureGatewayProbed()
        if (!capabilities.semantier.available && !capabilities.skills) {
          return json({
            ...createCapabilityUnavailablePayload('skills'),
            items: [],
            skills: [],
            total: 0,
            page: 1,
            categories: KNOWN_CATEGORIES,
          })
        }

        try {
          const url = new URL(request.url)
          const tabParam = url.searchParams.get('tab')
          const tab: SkillsTab =
            tabParam === 'installed' ||
            tabParam === 'marketplace' ||
            tabParam === 'featured'
              ? tabParam
              : 'installed'
          const rawSearch = (url.searchParams.get('search') || '').trim()
          const category = (url.searchParams.get('category') || 'All').trim()
          const sortParam = (url.searchParams.get('sort') || 'name').trim()
          const sort: SkillsSort =
            sortParam === 'category' || sortParam === 'name'
              ? sortParam
              : 'name'
          const page = Math.max(1, Number(url.searchParams.get('page') || '1'))
          const limit = Math.min(
            60,
            Math.max(1, Number(url.searchParams.get('limit') || '30')),
          )

          const sourceItems = await fetchHermesSkills(request.headers)
          const installedLookup = new Set(
            sourceItems
              .filter((skill) => skill.installed)
              .map((skill) => skill.id),
          )

          const filteredByTab = sourceItems.filter((skill) => {
            if (tab === 'featured') return true
            if (tab === 'installed') return skill.installed
            return true
          })

          const featuredLookup = new Map(
            FEATURED_SKILLS.map((entry) => [entry.id, entry.group]),
          )

          const filtered = sortSkills(
            filteredByTab
              .map((skill) => ({
                ...skill,
                installed: installedLookup.has(skill.id),
                featuredGroup: featuredLookup.get(skill.id),
              }))
              .filter((skill) => {
                if (tab === 'featured' && !skill.featuredGroup) return false
                if (!matchesSearch(skill, rawSearch)) return false
                if (category !== 'All' && skill.category !== category) {
                  return false
                }
                return true
              }),
            sort,
          )

          const total = filtered.length
          const start = (page - 1) * limit
          const skills = filtered.slice(start, start + limit)

          return json({
            skills,
            total,
            page,
            categories: KNOWN_CATEGORIES,
          })
        } catch (err) {
          return json(
            { error: err instanceof Error ? err.message : String(err) },
            { status: 500 },
          )
        }
      },
    },
  },
})
