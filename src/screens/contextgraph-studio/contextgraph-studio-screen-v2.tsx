/**
 * ContextGraph Studio - chrome v2
 *
 * Redesigned workbench surface for /graph-explorer (and the legacy /contextgraph-studio
 * redirect can still target this if the team chooses to converge the routes later).
 *
 * Layout: 3-pane vertical strip with document-frame header + footer.
 * - Left rail: workspace summary + schema classes + domain filters.
 * - Center: graph canvas with anchor callouts and a status-pinned bottom control strip.
 * - Right: inspector (KG-native 2x2 metrics + properties table + evidence distribution)
 *          stacked above a co-pilot chat panel that shows the generated Cypher on request.
 *
 * Typography policy (locked):
 * - Menu + titles + human-readable labels : Hanken Grotesk (var(--font-hanken))
 * - Codes, IDs, spec rows, footer metadata : JetBrains Mono (var(--font-mono-studio))
 *
 * This is the chrome only. The real MVL flow (Sources / Extract / Ground / Graph /
 * Inspect / Compare / Evaluate) lives in studio-shell.tsx and is reached from the
 * GRAPH tab (which links to /contextgraph-studio for now).
 */

const hk = { fontFamily: 'var(--font-hanken)' } as const
const mn = { fontFamily: 'var(--font-mono-studio)' } as const

// Mock-but-believable numbers from real Semantier / MVL stack concepts.
const WORKSPACE = {
  id: 'ws.prod-knowledge',
  synced: true,
  schemas: 17,
  nodes: 3428,
  edges: 28914,
  evidence: 9612,
  sources: 112,
  lastSync: 'T-00:04:12',
}

const SELECTED_NODE = {
  className: 'Class-Assertion',
  nodeId: '0e15267a1c2f3',
  inDegree: 312,
  inDegreeSchema: 14,
  inDegreeInstance: 298,
  outDegree: 47,
  evidenceTotal: 9612,
  evidenceAvgConf: 0.83,
  lifecycle: 'accepted',
  lifecycleReviewer: 'ch',
  lifecycleReviewedAt: 'T-2d',
  workspaceId: 'ws.prod-knowledge',
  skillRef: 'graph-schema-discovery@1',
  schemaVersion: 'graph_schema_discovery_brief.v1',
  runId: 'r-0e15267',
  buildHash: '0xa1c2f3d4',
  provider: 'anthropic',
  confidence: 0.83,
  reviewer: 'ch',
  reviewedAt: 'T-2d · 14:08 UTC',
}

const EVIDENCE_BY_DOMAIN = [
  { label: 'tender.regulatory', value: 2418, pct: 25, swatch: 'var(--theme-text)' },
  { label: 'evidence.compiled', value: 198, pct: 2, swatch: 'var(--theme-text)' },
  { label: 'source.docx', value: 5838, pct: 61, swatch: 'var(--theme-accent)' },
  { label: 'human.reviewed', value: 812, pct: 8, swatch: 'var(--theme-text)' },
  { label: 'derived.inferred', value: 346, pct: 4, swatch: 'var(--theme-text)' },
]

const SCHEMA_CLASSES = [
  { name: 'Class · Art-Fact', count: 428, swatch: 'var(--theme-accent)' },
  { name: 'Class · Assertion', count: 1204, swatch: 'var(--theme-text)', active: true },
  { name: 'Class · Evidence', count: 9612, swatch: 'var(--theme-text)' },
  { name: 'Class · Source', count: 112, swatch: 'var(--theme-muted)' },
  { name: 'Class · Lifecycle', count: 31, swatch: 'var(--theme-muted)' },
]

const DOMAIN_FILTER = [
  { name: 'tender.regulatory', count: 2418, swatch: 'var(--theme-accent)' },
  { name: 'artifact.spec', count: 812, swatch: 'var(--theme-text)' },
  { name: 'evidence.compiled', count: 198, swatch: 'var(--theme-text)' },
]

type NavTab = {
  label: string
  active?: boolean
}

const NAV_TABS: NavTab[] = [
  { label: 'DASHBOARD' },
  { label: 'GRAPH', active: true },
  { label: 'SCHEMAS' },
  { label: 'EVALUATION' },
  { label: 'GOVERNANCE' },
]

export function ContextGraphStudioScreenV2() {
  return (
    <div
      className="flex h-full min-h-0 flex-col overflow-hidden bg-[var(--theme-bg)] text-[var(--theme-text)]"
      style={hk}
    >
      {/* ========== HEADER ========== */}
      <header
        className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-[var(--theme-border)] bg-[var(--theme-header-bg)] px-4"
      >
        <div className="flex min-w-0 items-center gap-5">
          {/* Brand mark */}
          <div className="flex items-center gap-2">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-sm font-bold text-xs"
              style={{ ...mn, background: 'var(--theme-accent)', color: 'var(--theme-accent-foreground, #163300)' }}
              aria-hidden="true"
            >
              SG
            </div>
            <div className="leading-tight">
              <div className="text-[14px] font-bold tracking-tight">
                ContextGraph Studio
              </div>
              <div
                className="text-[10px] uppercase tracking-[0.18em] text-[var(--theme-muted)]"
                style={mn}
              >
                workbench · v2.4 · semantier/MVL stack
              </div>
            </div>
          </div>

          <span className="h-8 w-px bg-[var(--theme-border)]" aria-hidden="true" />

          {/* Workspace */}
          <div className="flex flex-col justify-center">
            <span
              className="text-[10px] uppercase tracking-[0.18em] text-[var(--theme-muted)]"
              style={mn}
            >
              Workspace
            </span>
            <span className="text-xs font-medium uppercase tracking-[0.16em]" style={mn}>
              {WORKSPACE.id}
            </span>
          </div>

          <span className="h-8 w-px bg-[var(--theme-border)]" aria-hidden="true" />

          {/* Lifecycle */}
          <div className="flex flex-col justify-center">
            <span
              className="text-[10px] uppercase tracking-[0.18em] text-[var(--theme-muted)]"
              style={mn}
            >
              Lifecycle
            </span>
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{
                  background: 'var(--theme-accent)',
                  boxShadow: '0 0 6px var(--theme-accent)',
                }}
                aria-hidden="true"
              />
              <span className="text-xs font-medium uppercase tracking-[0.16em]" style={mn}>
                accepted
              </span>
            </div>
          </div>
        </div>

        {/* Nav (menu) */}
        <nav
          className="flex h-full items-center gap-1 text-[11px] font-semibold tracking-[0.16em]"
          style={mn}
          aria-label="ContextGraph Studio sections"
        >
          {NAV_TABS.map((tab) => (
            <button
              key={tab.label}
              type="button"
              className={
                'h-full px-2 transition-colors ' +
                (tab.active
                  ? 'border-b-2 border-[var(--theme-accent)] text-[var(--theme-text)]'
                  : 'border-b-2 border-transparent text-[var(--theme-muted)] hover:text-[var(--theme-text)]')
              }
              aria-current={tab.active ? 'page' : undefined}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* SEMANTIER brand mark · top right */}
        <div className="flex items-center gap-3">
          <span
            className="hidden text-[10px] uppercase tracking-[0.18em] text-[var(--theme-muted)] sm:inline"
            style={mn}
          >
            parent workspace
          </span>
          <div
            className="flex items-center gap-2 rounded-sm border border-[var(--theme-border)] bg-[var(--theme-bg)] px-2.5 py-1.5"
            aria-label="Semantier workspace brand"
          >
            <span
              aria-hidden="true"
              className="block h-3 w-3"
              style={{
                background: 'var(--theme-accent)',
                clipPath:
                  'polygon(50% 0%, 100% 32%, 82% 100%, 18% 100%, 0% 32%)',
              }}
            />
            <span
              className="text-[12.5px] font-medium tracking-[0.2em] uppercase"
              style={mn}
            >
              SEMANTIER
            </span>
          </div>
        </div>
      </header>

      {/* ========== MAIN 3-PANE LAYOUT ========== */}
      <main className="flex min-h-0 flex-1 overflow-hidden p-2 gap-2">
        {/* LEFT: workspace rail */}
        <aside
          className="flex w-72 shrink-0 flex-col gap-2 overflow-y-auto"
          aria-label="Workspace rail"
        >
          {/* Workspace summary */}
          <section
            className="rounded-md border border-[var(--theme-border)] bg-[var(--theme-card)] p-3"
            style={{ borderRadius: 'var(--radius-editorial-card, 6px)' }}
          >
            <header className="mb-2 flex items-start justify-between">
              <span
                className="text-[10px] uppercase tracking-[0.18em] text-[var(--theme-muted)]"
                style={mn}
              >
                Workspace summary
              </span>
              <span
                className="rounded-sm px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.16em]"
                style={{
                  ...mn,
                  background: 'var(--theme-accent-subtle, rgba(159,232,112,0.14))',
                  color: 'var(--theme-accent)',
                }}
              >
                SYNCED
              </span>
            </header>
            <h2
              className="mb-3 text-lg font-bold tracking-tight"
              style={mn}
            >
              prod-knowledge
            </h2>
            <dl className="space-y-1.5">
              {[
                ['schemas', WORKSPACE.schemas.toLocaleString()],
                ['nodes', WORKSPACE.nodes.toLocaleString()],
                ['edges', WORKSPACE.edges.toLocaleString()],
                ['evidence', WORKSPACE.evidence.toLocaleString()],
                ['last sync', WORKSPACE.lastSync],
              ].map(([k, v]) => (
                <div
                  key={k}
                  className="flex justify-between text-[11px]"
                  style={mn}
                >
                  <dt className="text-[var(--theme-muted)]">{k}</dt>
                  <dd className="font-bold">{v}</dd>
                </div>
              ))}
            </dl>
          </section>

          {/* Schema classes */}
          <section
            className="flex min-h-0 flex-1 flex-col rounded-md border border-[var(--theme-border)] bg-[var(--theme-card)] p-3"
            style={{ borderRadius: 'var(--radius-editorial-card, 6px)' }}
          >
            <header className="mb-2 flex items-center justify-between border-b border-[var(--theme-border)] pb-2">
              <span
                className="text-[10px] uppercase tracking-[0.18em]"
                style={mn}
              >
                Schema classes
              </span>
              <span
                className="text-[9px] text-[var(--theme-muted)]"
                style={mn}
              >
                {WORKSPACE.schemas} schemas
              </span>
            </header>
            <ul className="flex-1 space-y-1.5 overflow-y-auto pr-1">
              {SCHEMA_CLASSES.map((cls) => (
                <li
                  key={cls.name}
                  className={
                    'flex cursor-pointer items-center gap-2 rounded-sm border border-[var(--theme-border)] bg-[var(--theme-card2)] px-2 py-1.5 transition-colors hover:border-[var(--theme-accent)] ' +
                    (cls.active ? 'border-l-2 border-l-[var(--theme-accent)]' : '')
                  }
                >
                  <span
                    aria-hidden="true"
                    className="block h-2 w-2 rounded-sm"
                    style={{ background: cls.swatch }}
                  />
                  <span
                    className="text-xs font-medium uppercase tracking-[0.14em]"
                    style={mn}
                  >
                    {cls.name}
                  </span>
                  <span
                    className="ml-auto text-[10px] text-[var(--theme-muted)]"
                    style={mn}
                  >
                    {cls.count.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* Domain filter */}
          <section
            className="rounded-md border border-[var(--theme-border)] bg-[var(--theme-card)] p-3"
            style={{ borderRadius: 'var(--radius-editorial-card, 6px)' }}
          >
            <header className="mb-2 flex items-center justify-between">
              <span
                className="text-[10px] uppercase tracking-[0.18em] text-[var(--theme-muted)]"
                style={mn}
              >
                Domain filter
              </span>
              <span
                className="text-[9px] text-[var(--theme-muted)]"
                style={mn}
              >
                5 active
              </span>
            </header>
            <ul className="space-y-1.5">
              {DOMAIN_FILTER.map((d) => (
                <li
                  key={d.name}
                  className="flex items-center justify-between text-[11px]"
                  style={mn}
                >
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="block h-2 w-2 rounded-sm"
                      style={{ background: d.swatch }}
                    />
                    {d.name}
                  </span>
                  <span className="text-[var(--theme-muted)]">
                    {d.count.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </aside>

        {/* CENTER: graph canvas */}
        <section
          aria-label="Graph canvas"
          className="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-md border border-[var(--theme-border)] bg-[var(--theme-panel)]"
          style={{ borderRadius: 'var(--radius-editorial-card, 6px)' }}
        >
          {/* Top ruler ticks (industrial-datasheet citation) */}
          <div
            aria-hidden="true"
            className="pointer-events-none flex h-3 shrink-0 justify-around border-b border-[var(--theme-border)]/40 opacity-50"
          >
            {Array.from({ length: 28 }).map((_, i) => {
              const tall = i % 9 === 0 || i % 3 === 0
              return (
                <span
                  key={i}
                  className={
                    'w-px self-end ' +
                    (tall ? 'h-2' : 'h-1') +
                    ' bg-[var(--theme-text)]'
                  }
                />
              )
            })}
          </div>

          <div className="relative flex-1 overflow-hidden p-8">
            {/* Canvas dot grid */}
            <div
              aria-hidden="true"
              className="absolute inset-0"
              style={{
                backgroundImage:
                  'radial-gradient(var(--theme-text) 1px, transparent 1px)',
                backgroundSize: '20px 20px',
                opacity: 0.06,
              }}
            />

            <div className="relative mx-auto h-full w-full max-w-3xl">
              {/* Connection lines */}
              <svg
                className="absolute inset-0 h-full w-full pointer-events-none"
                style={{ stroke: 'var(--theme-muted)', strokeWidth: 1.5, fill: 'none', opacity: 0.55 }}
              >
                <path d="M 50% 50% L 25% 22%" strokeDasharray="3 4" />
                <path d="M 50% 50% L 75% 22%" />
                <path d="M 50% 50% L 22% 78%" />
                <path d="M 50% 50% L 78% 78%" />
                <path d="M 25% 22% L 14% 38%" />
                <path d="M 75% 22% L 86% 38%" />
              </svg>

              {/* Center node (selected) */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                <div
                  className="flex h-[72px] w-[72px] items-center justify-center rounded-lg border-2 shadow-md"
                  style={{
                    background: 'var(--theme-accent)',
                    borderColor: 'var(--theme-text)',
                  }}
                >
                  <span
                    className="text-xs font-medium uppercase tracking-[0.16em]"
                    style={{ ...mn, color: 'var(--theme-accent-foreground, #163300)' }}
                  >
                    SCHEMA
                  </span>
                </div>
                <div
                  className="mt-1.5 whitespace-nowrap rounded border border-[var(--theme-border)] bg-[var(--theme-card)]/95 px-2 py-1 backdrop-blur"
                  style={mn}
                >
                  <span className="text-[10px] font-bold uppercase">
                    schema · {SELECTED_NODE.className}
                  </span>
                </div>
              </div>

              {/* Top-left evidence */}
              <div className="absolute left-[25%] top-[22%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-full border-2 shadow"
                  style={{
                    background: 'var(--theme-text)',
                    borderColor: 'var(--theme-card)',
                    color: 'var(--theme-card)',
                  }}
                >
                  <span className="text-[10px] font-bold" style={mn}>EX</span>
                </div>
                <div className="absolute left-full top-1/2 ml-2 w-max -translate-y-1/2">
                  <div className="absolute -left-6 top-1/2 h-px w-6 bg-[var(--theme-border)]" aria-hidden="true" />
                  <div className="text-[11px] uppercase" style={mn}>
                    <div className="font-bold">
                      Evidence{' '}
                      <span className="ml-1" style={{ color: 'var(--theme-accent)' }}>
                        EX-0e15267
                      </span>
                    </div>
                    <div
                      className="normal-case text-[10px] font-normal text-[var(--theme-muted)]"
                      style={mn}
                    >
                      source · docs/tender/POI-074.docx
                    </div>
                  </div>
                </div>
              </div>

              {/* Top-right source */}
              <div className="absolute left-[75%] top-[22%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-full border-2 shadow"
                  style={{
                    background: 'var(--theme-card2)',
                    borderColor: 'var(--theme-text)',
                    color: 'var(--theme-text)',
                  }}
                >
                  <span className="text-[10px] font-bold" style={mn}>SRC</span>
                </div>
                <div className="absolute right-full top-1/2 mr-2 w-max -translate-y-1/2 text-right">
                  <div className="absolute -right-6 top-1/2 h-px w-6 bg-[var(--theme-border)]" aria-hidden="true" />
                  <div className="text-[11px] uppercase" style={mn}>
                    <div className="font-bold">
                      Source{' '}
                      <span className="ml-1" style={{ color: 'var(--theme-text)' }}>
                        SRC-0218
                      </span>
                    </div>
                    <div
                      className="normal-case text-[10px] font-normal text-[var(--theme-muted)]"
                      style={mn}
                    >
                      sha256 · a1c2f3…d4
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom-left artifact */}
              <div className="absolute left-[22%] top-[78%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded border-2 shadow"
                  style={{
                    background: 'var(--theme-card2)',
                    borderColor: 'var(--theme-text)',
                    color: 'var(--theme-text)',
                  }}
                >
                  <span className="text-[10px] font-bold" style={mn}>ART</span>
                </div>
                <div className="absolute left-full top-1/2 ml-2 w-max -translate-y-1/2">
                  <div className="absolute -left-6 top-1/2 h-px w-6 bg-[var(--theme-border)]" aria-hidden="true" />
                  <div className="text-[11px] uppercase" style={mn}>
                    <div className="font-bold">
                      Artifact{' '}
                      <span className="ml-1" style={{ color: 'var(--theme-accent)' }}>
                        ART-0741
                      </span>
                    </div>
                    <div
                      className="normal-case text-[10px] font-normal text-[var(--theme-muted)]"
                      style={mn}
                    >
                      4 fields · 12 relations
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom-right lifecycle */}
              <div className="absolute left-[78%] top-[78%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded border-2 shadow"
                  style={{
                    background: 'var(--theme-card)',
                    borderColor: 'var(--theme-text)',
                    color: 'var(--theme-text)',
                  }}
                >
                  <span className="text-[10px] font-bold" style={mn}>LC</span>
                </div>
                <div className="absolute right-full top-1/2 mr-2 w-max -translate-y-1/2 text-right">
                  <div className="absolute -right-6 top-1/2 h-px w-6 bg-[var(--theme-border)]" aria-hidden="true" />
                  <div className="text-[11px] uppercase" style={mn}>
                    <div className="font-bold">
                      Lifecycle{' '}
                      <span className="ml-1" style={{ color: 'var(--theme-text)' }}>
                        LC-ACPT
                      </span>
                    </div>
                    <div
                      className="normal-case text-[10px] font-normal text-[var(--theme-muted)]"
                      style={mn}
                    >
                      accepted · reviewer=ch
                    </div>
                  </div>
                </div>
              </div>

              {/* Edge labels at midpoints */}
              <span
                className="absolute left-[16%] top-[38%] rounded border border-[var(--theme-border)] bg-[var(--theme-card)]/95 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-[var(--theme-muted)]"
                style={mn}
              >
                sourced-from
              </span>
              <span
                className="absolute right-[16%] top-[38%] rounded border border-[var(--theme-border)] bg-[var(--theme-card)]/95 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-[var(--theme-muted)]"
                style={mn}
              >
                supports
              </span>
            </div>
          </div>

          {/* Bottom canvas controls: ONE layout strip + ONE mode row */}
          <div
            className="flex shrink-0 items-center justify-between gap-3 border-t border-[var(--theme-border)] bg-[var(--theme-card)] px-3 py-2"
          >
            <div
              className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.16em]"
              style={mn}
            >
              <span className="mr-2 text-[var(--theme-muted)]">Layout</span>
              <button
                type="button"
                className="border-b-2 border-[var(--theme-accent)] px-2 py-1 text-[var(--theme-text)]"
              >
                Force
              </button>
              <button
                type="button"
                className="px-2 py-1 text-[var(--theme-muted)] hover:text-[var(--theme-text)]"
              >
                Hierarchical
              </button>
              <button
                type="button"
                className="px-2 py-1 text-[var(--theme-muted)] hover:text-[var(--theme-text)]"
              >
                Radial
              </button>
              <button
                type="button"
                className="px-2 py-1 text-[var(--theme-muted)] hover:text-[var(--theme-text)]"
              >
                Sankey
              </button>
            </div>
            <div
              className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.16em]"
              style={mn}
            >
              <span className="mr-2 text-[var(--theme-muted)]">Mode</span>
              <button
                type="button"
                className="border-b-2 border-[var(--theme-accent)] px-2 py-1 text-[var(--theme-text)]"
              >
                View
              </button>
              <button
                type="button"
                className="px-2 py-1 text-[var(--theme-muted)] hover:text-[var(--theme-text)]"
              >
                Select
              </button>
              <button
                type="button"
                className="px-2 py-1 text-[var(--theme-muted)] hover:text-[var(--theme-text)]"
              >
                Path
              </button>
              <span className="mx-3 h-3 w-px bg-[var(--theme-border)]" aria-hidden="true" />
              <span className="text-[var(--theme-muted)]">zoom</span>
              <button type="button" className="px-1.5 text-[var(--theme-muted)] hover:text-[var(--theme-text)]">-</button>
              <span className="font-bold">1.0x</span>
              <button type="button" className="px-1.5 text-[var(--theme-muted)] hover:text-[var(--theme-text)]">+</button>
              <span className="mx-3 h-3 w-px bg-[var(--theme-border)]" aria-hidden="true" />
              <button
                type="button"
                className="uppercase text-[var(--theme-muted)] hover:text-[var(--theme-text)]"
              >
                Fit
              </button>
            </div>
          </div>
        </section>

        {/* RIGHT: inspector + chat */}
        <aside
          className="flex w-[22rem] shrink-0 flex-col gap-2 overflow-hidden"
          aria-label="Inspector and chat"
        >
          {/* Inspector (top, 60%) */}
          <section
            className="flex min-h-0 flex-[1.4] flex-col overflow-hidden rounded-md border border-[var(--theme-border)] bg-[var(--theme-card)]"
            style={{ borderRadius: 'var(--radius-editorial-card, 6px)' }}
          >
            <header className="flex shrink-0 items-center justify-between border-b border-[var(--theme-border)] bg-[var(--theme-card2)] px-3 py-2">
              <span
                className="text-[11px] font-medium uppercase tracking-[0.16em]"
                style={mn}
              >
                Inspector
              </span>
              <span
                className="text-[10px] text-[var(--theme-muted)]"
                style={mn}
              >
                id · {SELECTED_NODE.nodeId}
              </span>
            </header>

            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3">
              {/* Identity */}
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="block h-3 w-3 rounded-sm"
                    style={{ background: 'var(--theme-accent)' }}
                  />
                  <span className="text-sm font-bold" style={mn}>
                    schema · {SELECTED_NODE.className}
                  </span>
                </div>
                <p className="text-[12px] leading-snug text-[var(--theme-muted)]">
                  Governed class for evidence-backed assertions in the{' '}
                  <span style={mn}>{WORKSPACE.id}</span> workspace. Lifecycle:
                  accepted by reviewer <span style={mn}>{SELECTED_NODE.lifecycleReviewer}</span>.
                </p>
              </div>

              {/* KG-native 2x2 metrics */}
              <div className="grid grid-cols-2 gap-2">
                <div
                  className="rounded-sm border border-[var(--theme-border)] bg-[var(--theme-card2)] p-2"
                  style={{ borderRadius: 'var(--radius-sm, 4px)' }}
                >
                  <div
                    className="mb-1 text-[9px] uppercase tracking-wider text-[var(--theme-muted)]"
                    style={mn}
                  >
                    in-degree
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-bold" style={mn}>
                      {SELECTED_NODE.inDegree.toLocaleString()}
                    </span>
                    <span
                      className="text-[10px] text-[var(--theme-muted)]"
                      style={mn}
                    >
                      edges
                    </span>
                  </div>
                  <div
                    className="mt-1 text-[9px] text-[var(--theme-muted)]"
                    style={mn}
                  >
                    {SELECTED_NODE.inDegreeSchema} schema ·{' '}
                    {SELECTED_NODE.inDegreeInstance} instance
                  </div>
                </div>
                <div
                  className="rounded-sm border border-[var(--theme-border)] bg-[var(--theme-card2)] p-2"
                  style={{ borderRadius: 'var(--radius-sm, 4px)' }}
                >
                  <div
                    className="mb-1 text-[9px] uppercase tracking-wider text-[var(--theme-muted)]"
                    style={mn}
                  >
                    out-degree
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-bold" style={mn}>
                      {SELECTED_NODE.outDegree.toLocaleString()}
                    </span>
                    <span
                      className="text-[10px] text-[var(--theme-muted)]"
                      style={mn}
                    >
                      edges
                    </span>
                  </div>
                  <div
                    className="mt-1 text-[9px] text-[var(--theme-muted)]"
                    style={mn}
                  >
                    to evidence · to sources
                  </div>
                </div>
                <div
                  className="rounded-sm border border-[var(--theme-border)] bg-[var(--theme-card2)] p-2"
                  style={{ borderRadius: 'var(--radius-sm, 4px)' }}
                >
                  <div
                    className="mb-1 text-[9px] uppercase tracking-wider text-[var(--theme-muted)]"
                    style={mn}
                  >
                    evidence
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-bold" style={mn}>
                      {SELECTED_NODE.evidenceTotal.toLocaleString()}
                    </span>
                    <span
                      className="text-[10px] text-[var(--theme-muted)]"
                      style={mn}
                    >
                      items
                    </span>
                  </div>
                  <div
                    className="mt-1 text-[9px] text-[var(--theme-muted)]"
                    style={mn}
                  >
                    avg conf · {SELECTED_NODE.evidenceAvgConf.toFixed(2)}
                  </div>
                </div>
                <div
                  className="rounded-sm border border-[var(--theme-border)] bg-[var(--theme-card2)] p-2"
                  style={{ borderRadius: 'var(--radius-sm, 4px)' }}
                >
                  <div
                    className="mb-1 text-[9px] uppercase tracking-wider text-[var(--theme-muted)]"
                    style={mn}
                  >
                    lifecycle
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span
                      className="text-base font-bold uppercase"
                      style={mn}
                    >
                      accepted
                    </span>
                  </div>
                  <div
                    className="mt-1 text-[9px] text-[var(--theme-muted)]"
                    style={mn}
                  >
                    last reviewed · {SELECTED_NODE.lifecycleReviewedAt}
                  </div>
                </div>
              </div>

              {/* Properties */}
              <div>
                <header className="mb-2 flex items-end justify-between">
                  <span
                    className="text-[10px] font-medium uppercase tracking-[0.16em]"
                    style={mn}
                  >
                    Properties
                  </span>
                  <span
                    className="text-[9px] text-[var(--theme-muted)]"
                    style={mn}
                  >
                    9 keys
                  </span>
                </header>
                <div
                  className="overflow-hidden rounded-sm border border-[var(--theme-border)]"
                  style={{ borderRadius: 'var(--radius-sm, 4px)' }}
                >
                  <table className="w-full border-collapse text-left">
                    <tbody style={mn} className="text-[11px]">
                      {[
                        ['workspace_id', SELECTED_NODE.workspaceId],
                        ['skill_ref', SELECTED_NODE.skillRef],
                        ['schema_version', SELECTED_NODE.schemaVersion],
                        ['run_id', SELECTED_NODE.runId],
                        ['build_hash', SELECTED_NODE.buildHash],
                        ['provider', SELECTED_NODE.provider],
                        ['confidence', SELECTED_NODE.confidence.toFixed(2)],
                        ['reviewer', SELECTED_NODE.reviewer],
                        ['reviewed_at', SELECTED_NODE.reviewedAt],
                      ].map(([k, v], idx, arr) => (
                        <tr
                          key={k}
                          className={
                            (idx % 2 === 0 ? '' : 'bg-[var(--theme-card2)] ') +
                            (idx === arr.length - 1 ? '' : 'border-b border-[var(--theme-border)]')
                          }
                        >
                          <td className="px-2 py-1.5 text-[var(--theme-muted)]">{k}</td>
                          <td className="px-2 py-1.5 text-right">
                            {k === 'confidence' ? (
                              <span className="font-bold" style={{ color: 'var(--theme-accent)' }}>
                                {v}
                              </span>
                            ) : (
                              v
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Evidence distribution (real KG viz) */}
              <div>
                <header className="mb-2 flex items-end justify-between">
                  <span
                    className="text-[10px] font-medium uppercase tracking-[0.16em]"
                    style={mn}
                  >
                    Evidence by domain
                  </span>
                  <span
                    className="text-[9px] text-[var(--theme-muted)]"
                    style={mn}
                  >
                    9,612 items · 5 domains
                  </span>
                </header>
                <ul className="space-y-1.5">
                  {EVIDENCE_BY_DOMAIN.map((d) => (
                    <li key={d.label}>
                      <div
                        className="mb-0.5 flex justify-between text-[10px]"
                        style={mn}
                      >
                        <span className="font-bold uppercase">{d.label}</span>
                        <span className="text-[var(--theme-muted)]">
                          {d.value.toLocaleString()} · {d.pct}%
                        </span>
                      </div>
                      <div
                        className="h-1.5 overflow-hidden rounded-sm"
                        style={{ background: 'var(--theme-card2)' }}
                      >
                        <div
                          className="h-full"
                          style={{
                            width: `${d.pct}%`,
                            background: d.swatch,
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* Chat (bottom) */}
          <section
            className="flex min-h-[20rem] flex-1 flex-col overflow-hidden rounded-md border border-[var(--theme-border)] bg-[var(--theme-card)]"
            style={{ borderRadius: 'var(--radius-editorial-card, 6px)' }}
          >
            <header className="flex shrink-0 items-center justify-between border-b border-[var(--theme-border)] bg-[var(--theme-card2)] px-3 py-2">
              <span
                className="text-[10px] font-medium uppercase tracking-[0.16em]"
                style={mn}
              >
                Co-pilot · NL to Cypher
              </span>
              <span
                className="text-[9px] text-[var(--theme-muted)]"
                style={mn}
              >
                engine · semantier/kg@2.4
              </span>
            </header>

            <div className="flex-1 space-y-3 overflow-y-auto bg-[var(--theme-card)] p-3">
              {/* User message */}
              <div className="flex flex-col gap-1">
                <span
                  className="text-[9px] uppercase text-[var(--theme-muted)]"
                  style={mn}
                >
                  user · 14:08:42
                </span>
                <div
                  className="rounded-sm border border-[var(--theme-border)] bg-[var(--theme-card2)] p-2 text-[11px]"
                  style={mn}
                >
                  Find every Assertion under schema Class-Assertion with confidence &lt; 0.6 from the tender.regulatory domain. Return run_id and build_hash.
                </div>
              </div>

              {/* System response with generated Cypher disclosure */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span
                    className="text-[9px] font-medium uppercase tracking-[0.14em]"
                    style={{ ...mn, color: 'var(--theme-text)' }}
                  >
                    system · 14:08:43
                  </span>
                  <span
                    className="text-[9px] uppercase text-[var(--theme-muted)]"
                    style={mn}
                  >
                    matched · 7
                  </span>
                </div>
                <div
                  className="border-l-2 p-2 text-[11px]"
                  style={{
                    ...mn,
                    borderColor: 'var(--theme-accent)',
                    background: 'var(--theme-accent-subtle, rgba(159,232,112,0.10))',
                  }}
                >
                  7 assertions below 0.6 confidence. Highlighting edges in canvas. Top:{' '}
                  <span className="font-bold">ART-0741 · 0.41</span>,{' '}
                  <span className="font-bold">ART-0818 · 0.48</span>.
                </div>
                <details
                  className="text-[10px] text-[var(--theme-muted)]"
                  style={mn}
                >
                  <summary className="cursor-pointer uppercase tracking-wider hover:text-[var(--theme-text)]">
                    generated cypher
                  </summary>
                  <pre
                    className="mt-1 overflow-x-auto rounded p-2 text-[10px]"
                    style={{
                      background: 'var(--theme-code-bg)',
                      color: 'var(--theme-code-foreground)',
                      border: '1px solid var(--theme-code-border)',
                    }}
                  >
{`MATCH (a:Assertion)-[:IN_DOMAIN]->(d:Domain {name:"tender.regulatory"})
WHERE a.confidence < 0.6 AND a.workspace_id = "ws.prod-knowledge"
RETURN a.run_id, a.build_hash
ORDER BY a.confidence ASC LIMIT 25`}
                  </pre>
                </details>
              </div>
            </div>

            <form
              onSubmit={(e) => e.preventDefault()}
              className="flex shrink-0 items-center gap-2 border-t border-[var(--theme-border)] bg-[var(--theme-card2)] px-3 py-2"
            >
              <input
                type="text"
                placeholder="Ask the graph · NL or Cypher (⌘K to focus)"
                aria-label="Co-pilot query"
                className="flex-1 rounded-sm border border-[var(--theme-border)] bg-[var(--theme-card)] px-2 py-1.5 text-[11px] outline-none focus:border-[var(--theme-accent)]"
                style={{
                  ...mn,
                  color: 'var(--theme-text)',
                }}
              />
              <button
                type="submit"
                className="rounded-sm border border-[var(--theme-accent)] bg-[var(--theme-accent)] px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.16em]"
                style={{
                  ...mn,
                  color: 'var(--theme-accent-foreground, #163300)',
                }}
              >
                Send
              </button>
            </form>
          </section>
        </aside>
      </main>

      {/* ========== FOOTER: build metadata (industrial document frame) ========== */}
      <footer
        className="flex h-8 shrink-0 items-center justify-between gap-3 border-t border-[var(--theme-border)] bg-[var(--theme-header-bg)] px-4 text-[10px] uppercase tracking-[0.14em] text-[var(--theme-muted)]"
        style={mn}
      >
        <div className="flex items-center gap-3">
          <span>
            model <span className="font-bold text-[var(--theme-text)]">ContextGraph@2.4</span>
          </span>
          <span className="h-3 w-px bg-[var(--theme-border)]" aria-hidden="true" />
          <span>
            run <span className="font-bold text-[var(--theme-text)]">{SELECTED_NODE.runId}</span>
          </span>
          <span className="h-3 w-px bg-[var(--theme-border)]" aria-hidden="true" />
          <span>
            lifecycle <span className="font-bold text-[var(--theme-text)]">{SELECTED_NODE.lifecycle}</span>
          </span>
          <span className="h-3 w-px bg-[var(--theme-border)]" aria-hidden="true" />
          <span>
            mvl <span className="font-bold text-[var(--theme-text)]">closure-ready</span>
          </span>
          <span className="h-3 w-px bg-[var(--theme-border)]" aria-hidden="true" />
          <span>
            build <span className="font-bold text-[var(--theme-text)]">{SELECTED_NODE.buildHash}…</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span>
            render.fps <span className="font-bold text-[var(--theme-text)]">60</span>
          </span>
          <span className="h-3 w-px bg-[var(--theme-border)]" aria-hidden="true" />
          <span>
            eval.queue <span className="font-bold text-[var(--theme-text)]">14</span>
          </span>
          <span className="h-3 w-px bg-[var(--theme-border)]" aria-hidden="true" />
          <span>
            reviewers <span className="font-bold text-[var(--theme-text)]">3</span>
          </span>
          <span className="h-3 w-px bg-[var(--theme-border)]" aria-hidden="true" />
          <span className="font-bold text-[var(--theme-text)]">SG-WS-0e15267</span>
        </div>
      </footer>
    </div>
  )
}
