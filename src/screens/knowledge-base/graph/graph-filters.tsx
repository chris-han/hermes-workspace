import { Button } from '@/components/ui/button'

import { Search } from 'lucide-react'

import type { GovernedGraphProjection, GraphSelection } from './graph-types'
import type { GraphCopy } from './graph-lenses'
import type { GraphFilters } from './use-graph-search'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { Input } from '@/components/ui/input'

export function GraphFiltersRail({
  projection,
  copy,
  filters,
  matches,
  onFiltersChange,
  onSelect,
}: {
  projection: GovernedGraphProjection
  copy: GraphCopy
  filters: GraphFilters
  matches: GovernedGraphProjection['nodes']
  onFiltersChange: (filters: GraphFilters) => void
  onSelect: (selection: GraphSelection) => void
}) {
  const kinds = unique(['all', ...projection.nodes.map((node) => node.kind)])
  const tiers = unique(['all', ...projection.nodes.map((node) => node.semanticTier)])
  const authorityRoles = unique([
    'all',
    ...projection.nodes.map((node) => node.authorityRole),
  ])
  const states = unique([
    'all',
    ...projection.nodes.map((node) => node.governanceState),
  ])

  return (
    <aside className="min-h-0 rounded-card border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">{copy.filters}</h2>
      </div>
      <div className="space-y-4 p-4">
        <label className="grid gap-2 text-xs font-medium text-muted-foreground">
          {copy.search}
          <span className="relative">
            <Search className="pointer-events-none absolute left-2 top-2 size-4 text-muted-foreground" />
            <Input
              aria-label={copy.search}
              className="pl-7"
              nativeInput
              type="search"
              value={filters.query}
              onChange={(event) =>
                onFiltersChange({ ...filters, query: event.currentTarget.value })
              }
            />
          </span>
        </label>
        <FilterSelect
          label={copy.kind}
          copy={copy}
          value={filters.kind}
          options={kinds}
          onChange={(kind) => onFiltersChange({ ...filters, kind })}
        />
        <FilterSelect
          label={copy.tier}
          copy={copy}
          value={filters.tier}
          options={tiers}
          onChange={(tier) => onFiltersChange({ ...filters, tier })}
        />
        <FilterSelect
          label={copy.authority}
          copy={copy}
          value={filters.authorityRole}
          options={authorityRoles}
          onChange={(authorityRole) =>
            onFiltersChange({ ...filters, authorityRole })
          }
        />
        <FilterSelect
          label={copy.state}
          copy={copy}
          value={filters.governanceState}
          options={states}
          onChange={(governanceState) =>
            onFiltersChange({ ...filters, governanceState })
          }
        />
        <div className="space-y-2">
          {matches.length === 0 ? (
            <div className="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
              {copy.noMatches}
            </div>
          ) : (
            matches.map((node) => (
              <Button
                key={node.id}
                type="button"
                className="grid w-full gap-1 rounded-md border border-border px-3 py-2 text-left text-xs transition-colors hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-blue)]"
                onClick={() => onSelect({ type: 'node', id: node.id })}
              >
                <span className="font-semibold">{node.label}</span>
                <span className="text-muted-foreground">
                  {node.kind} · {node.semanticTier} · {node.governanceState}
                </span>
              </Button>
            ))
          )}
        </div>
      </div>
    </aside>
  )
}

function FilterSelect({
  label,
  copy,
  value,
  options,
  onChange,
}: {
  label: string
  copy: GraphCopy
  value: string
  options: string[]
  onChange: (value: string) => void
}) {
  return (
    <label className="grid gap-2 text-xs font-medium text-muted-foreground">
      {label}
      <DropdownSelect
        className="h-8 rounded-md border border-border bg-card px-2 text-xs text-foreground"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option === 'all' ? copy.all : option}
          </option>
        ))}
      </DropdownSelect>
    </label>
  )
}

function unique(values: string[]) {
  return Array.from(new Set(values))
}
