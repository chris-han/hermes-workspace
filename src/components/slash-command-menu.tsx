'use client'

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react'
import type { Ref } from 'react'

import { useAutocompleteFilter } from '@/components/ui/autocomplete'
import { Command, CommandItem, CommandList } from '@/components/ui/command'
import { cn } from '@/lib/utils'

type SlashCommandDefinition = {
  command: string
  description: string
}

type SkillSummary = {
  name?: unknown
  description?: unknown
  installed?: unknown
  enabled?: unknown
}

type SkillsApiResponse = {
  skills?: unknown
}

type SlashCommandMenuProps = {
  open: boolean
  query: string
  onSelect: (command: SlashCommandDefinition) => void
}

type SlashCommandMenuHandle = {
  moveSelection: (step: number) => void
  selectActive: () => boolean
}

const SLASH_COMMANDS: Array<SlashCommandDefinition> = [
  { command: '/new', description: 'Start new session' },
  { command: '/clear', description: 'Clear screen and start fresh' },
  { command: '/model', description: 'Show or change the current model' },
  { command: '/save', description: 'Save the current conversation' },
  { command: '/skills', description: 'Browse and manage skills' },
  { command: '/skin', description: 'Change the display theme' },
  { command: '/help', description: 'Show available commands' },
]

const SKILL_INVALID_CHARS = /[^a-z0-9-]/g
const SKILL_MULTI_HYPHEN = /-+/g

function commandForSkillName(name: string): string | null {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/_+/g, '-')
    .replace(SKILL_INVALID_CHARS, '')
    .replace(SKILL_MULTI_HYPHEN, '-')
    .replace(/^-|-$/g, '')

  return normalized ? `/${normalized}` : null
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function mergeInstalledSkillCommands(
  baseCommands: Array<SlashCommandDefinition>,
  skills: Array<SkillSummary>,
): Array<SlashCommandDefinition> {
  return mergeSlashCommands(baseCommands, skillsToSlashCommands(skills))
}

function skillsToSlashCommands(
  skills: Array<SkillSummary>,
): Array<SlashCommandDefinition> {
  const skillCommands: Array<SlashCommandDefinition> = []
  const seen = new Set<string>()

  for (const skill of skills) {
    if (skill.installed === false || skill.enabled === false) continue

    const name = readString(skill.name)
    if (!name) continue

    const command = commandForSkillName(name)
    if (!command || seen.has(command)) continue

    seen.add(command)
    skillCommands.push({
      command,
      description: readString(skill.description) || `Invoke the ${name} skill`,
    })
  }

  return skillCommands.sort((left, right) => {
    return left.command.localeCompare(right.command)
  })
}

function mergeSlashCommands(
  baseCommands: Array<SlashCommandDefinition>,
  skillCommands: Array<SlashCommandDefinition>,
): Array<SlashCommandDefinition> {
  const seen = new Set(baseCommands.map((item) => item.command))
  const nextCommands = [...baseCommands]

  for (const item of skillCommands) {
    if (seen.has(item.command)) continue
    seen.add(item.command)
    nextCommands.push(item)
  }

  return nextCommands
}

async function fetchInstalledSkillCommands(): Promise<
  Array<SlashCommandDefinition>
> {
  const response = await fetch('/api/skills?tab=installed&limit=500')
  if (!response.ok) return []

  const payload = (await response.json().catch(() => ({}))) as SkillsApiResponse
  if (!Array.isArray(payload.skills)) return []

  return skillsToSlashCommands(payload.skills as Array<SkillSummary>)
}

const SlashCommandMenu = forwardRef(function SlashCommandMenu(
  { open, query, onSelect }: SlashCommandMenuProps,
  ref: Ref<SlashCommandMenuHandle>,
) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [skillCommands, setSkillCommands] = useState<
    Array<SlashCommandDefinition>
  >([])
  const filter = useAutocompleteFilter({ sensitivity: 'base' })
  const commands = useMemo(() => {
    return mergeSlashCommands(SLASH_COMMANDS, skillCommands)
  }, [skillCommands])

  useEffect(() => {
    if (!open || skillCommands.length > 0) return

    let cancelled = false
    void fetchInstalledSkillCommands()
      .then((items) => {
        if (!cancelled) setSkillCommands(items)
      })
      .catch(() => {
        if (!cancelled) setSkillCommands([])
      })

    return () => {
      cancelled = true
    }
  }, [open, skillCommands.length])

  const filteredCommands = useMemo(() => {
    const normalizedQuery = query.trim()
    if (!normalizedQuery) return commands

    return commands.filter((item) =>
      filter.contains(
        item,
        normalizedQuery,
        (target) => `${target.command} ${target.description}`,
      ),
    )
  }, [commands, filter, query])

  useEffect(() => {
    setActiveIndex(0)
  }, [open, query])

  useEffect(() => {
    if (filteredCommands.length === 0) {
      setActiveIndex(0)
      return
    }
    setActiveIndex((previous) =>
      Math.max(0, Math.min(previous, filteredCommands.length - 1)),
    )
  }, [filteredCommands.length])

  useImperativeHandle(
    ref,
    () => ({
      moveSelection(step: number) {
        if (!open || filteredCommands.length === 0) return
        const direction = step >= 0 ? 1 : -1
        setActiveIndex((previous) => {
          const next = previous + direction
          if (next < 0) return filteredCommands.length - 1
          if (next >= filteredCommands.length) return 0
          return next
        })
      },
      selectActive() {
        if (!open || filteredCommands.length === 0) return false
        const selected = filteredCommands[activeIndex]
        if (!selected) return false
        onSelect(selected)
        return true
      },
    }),
    [activeIndex, filteredCommands, onSelect, open],
  )

  if (!open) return null

  return (
    <div className="pointer-events-none absolute inset-x-2 bottom-[calc(100%+0.5rem)] z-[70]">
      <div
        className="pointer-events-auto overflow-hidden rounded-xl border border-primary-200 shadow-lg"
        style={{
          background: 'var(--color-surface, var(--theme-card, #1a1f2e))',
        }}
      >
        <Command
          items={filteredCommands}
          value={query}
          onValueChange={() => {}}
          mode="none"
          autoHighlight={false}
          keepHighlight={false}
        >
          {filteredCommands.length === 0 ? (
            <div className="px-3 py-2 text-sm text-primary-600">
              No commands found
            </div>
          ) : (
            <CommandList className="max-h-60 min-h-0">
              {filteredCommands.map((item, index) => (
                <CommandItem
                  key={item.command}
                  value={item.command}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseMove={() => setActiveIndex(index)}
                  onClick={() => onSelect(item)}
                  className={cn(
                    'flex flex-col items-start gap-0.5 rounded-md px-3 py-2',
                    index === activeIndex && 'bg-primary-100 text-primary-900',
                  )}
                >
                  <span className="text-sm font-semibold">{item.command}</span>
                  <span className="text-xs text-primary-600">
                    {item.description}
                  </span>
                </CommandItem>
              ))}
            </CommandList>
          )}
        </Command>
      </div>
    </div>
  )
})

export {
  commandForSkillName,
  mergeInstalledSkillCommands,
  mergeSlashCommands,
  SlashCommandMenu,
  skillsToSlashCommands,
  type SlashCommandDefinition,
  type SlashCommandMenuHandle,
}
