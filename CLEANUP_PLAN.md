# Hermes-Workspace — Unused Legacy Code Discovery & Cleanup Plan

**Generated**: 2026-08-21
**Scope**: `hermes-workspace/` (current focus) + `bootstrap/` (versioned scripts)
**Method**: `codebase-memory-mcp` graph queries (`search_graph max_degree=0`, `query_graph`) cross-validated with filesystem `grep` against `src/` and the wider repo
**Coverage caveats**: Graph `max_degree=0` misses dynamic dispatch / string-based lookup, and the original scan also missed several ordinary imports and React lazy imports. Therefore **fan-in=0 and a single grep pass are discovery signals only, never deletion proof**. Every deletion candidate must be re-verified against routes, lazy imports, barrel exports, tests, package scripts, runtime string lookup, and direct/type-only imports immediately before deletion. Any positive reference means `KEEP` unless the reference is intentionally migrated in the same change.

> Graph stats at scan time: `home-chris-repo-semantier-runtime` — 186 539 nodes, 817 096 edges, `status: ready`. `parse_partial` flagged 18 files (see `index_status`); flagged ranges re-checked by hand where they overlapped with findings.

---

## 0 · Headline numbers

| Bucket | Count | Approx. LoC deletable |
|---|---:|---:|
| Orphan source files (delete entire file) | 23 | ~5 800 |
| Orphan stub subdirectories (delete entire dir) | 4 | ~430 |
| Superseded versioned bootstrap scripts | 4 | ~55 000 (mostly `bootstrap_seed_v8.py` ≈ 37 KB / 1.1 K LoC) |
| Self-admitted "stub" files (delete or restore real impl) | 2 | ~80 |
| Dead individual functions/methods in otherwise live files | 138 (125 + 13) | ~600 |

Total recommended deletion footprint: **~62 000 lines** (≈ 70 % of that in `bootstrap/`).

---

## 1 · TIER A — DELETE CANDIDATES, RE-VERIFY BEFORE TOUCHING

The original "high confidence" label was too strong. Review on 2026-08-21 found multiple false positives where live imports existed despite the earlier scan. **Nothing in this section should be deleted solely because the graph reports fan-in=0 or because a previous grep returned zero hits.** Re-run reference checks from the current tree immediately before each deletion and require a clean typecheck/test/build after each small batch.

### 1.1 `hermes-workspace/src/screens/contextgraph-studio/inspect/` — entire directory

**Why**: 7 stub components (each ≤ 181 bytes, single-line). Graph shows 0 callers for `FindingActions`, `FindingList`, `FindingLineage`, `FindingInspector`, `InspectionArtifacts`, `TenderSourceViewer`, `InspectMode`. Confirmed via `grep -rn` over `src/` — no import, no JSX usage, no test reference.

Files (all 1 line each):
```
finding-actions.tsx        143 B
finding-inspector.tsx      181 B
finding-lineage.tsx        140 B
finding-list.tsx           175 B
inspect-screen.tsx          46 B
inspection-artifacts.tsx   157 B
tender-source-viewer.tsx   190 B
```
**Risk**: Low. If the screen is ever rebuilt it can be re-added — each file is a one-liner.

---

### 1.2 `hermes-workspace/src/screens/contextgraph-studio/evaluate/` and `lineage/` and `studio-mode-tabs.tsx` — entire directories + file

**Why**: Stubs identical in shape to the `inspect/` set. `evaluate-screen.tsx` is just `export { EvaluateMode } from '../studio-shell'` and has zero callers; `learning-gate.tsx` is a no-op `<section>` passthrough; `lineage-panel.tsx` and `lineage-client.ts` are 1-line type stubs.

```
evaluate/evaluate-screen.tsx    47 B   ← re-export, no consumers
evaluate/learning-gate.tsx     143 B   ← passthrough component
lineage/lineage-client.ts       83 B   ← type alias, no consumers
lineage/lineage-panel.tsx      143 B   ← passthrough component
studio-mode-tabs.tsx           245 B   ← nav passthrough, no callers
```
**Risk**: Low. The route surface of `ContextGraphStudioScreen` is `studio-shell.tsx`; these are decoupled presentation shells.

---

### 1.3 `hermes-workspace/src/screens/contextgraph-studio/source-viewer/{canonical-source-viewer,evidence-location-resolver}` — 2 stub files

```
canonical-source-viewer.tsx    162 B   ← empty <article> shell
evidence-location-resolver.ts  237 B   ← defines EvidenceResolutionState + EvidenceLocation types, NO consumers
```
The real, working viewer in the same folder is `source-evidence-viewer.tsx` (12.9 KB, 12 imports in src) — keep that.

**Risk**: Low. Types here are unreferenced; component is a one-liner.

---

### 1.4 `hermes-workspace/src/screens/contextgraph-studio/tender-evaluation-panel.tsx`

22 lines exporting `TENDER_EVALUATION_DETECTION_ENDPOINT` + `buildTenderEvaluationDetectionRequest`. Graph + grep confirms zero consumers. Used to back a now-removed "tender evaluation" panel.

**Risk**: Low. Restoreable from git if tender workflow is rebuilt.

---

### 1.5 `hermes-workspace/src/screens/memory/knowledge-browser-screen.tsx` — 3 833 lines, ZERO callers

**Why**: `KnowledgeBrowserScreen` has no import, no JSX usage, no router reference anywhere in `src/` or the wider repo. Grep across the full `semantier-runtime` tree (excl. node_modules, .venv) returns zero matches. The graph `lines: 718-2957` (inner function) plus top-level state/effects (3 833 total) is the largest single dead file in the workspace.

**Risk**: **Medium**. Before deletion, run `git log --follow -- screens/memory/knowledge-browser-screen.tsx` to confirm the file is not the live route surface for any URL path — the screen name suggests it might have been replaced by `memory-browser-screen.tsx` (which IS referenced). The latter file was added later per commit history.

**Action**: open both files side-by-side and verify the surviving `memory-browser-screen.tsx` supersedes it. If yes → delete. If routes diverge → KEEP with a `// @deprecated` and a TODO comment.

---

### 1.6 `hermes-workspace/src/screens/gateway/lib/` — entire directory (4 files)

```
approvals-store.ts        1.5 K   ← AUTHOR MARKED AS STUB: "exec approvals are not used in Hermes Workspace"
mission-checkpoint.ts     2.1 K   ← 0 importers
mission-events.ts         4.3 K   ← 0 importers (MissionEventLog + 14 event types)
workflow-templates.ts     5.5 K   ← 0 importers (storage key `clawsuite:workflow-templates` reveals it was copied from a different product called "ClawSuite")
```
- `approvals-store.ts` is an explicit no-op the author flagged:
  > `// Stub — exec approvals are not used in Hermes Workspace. // Kept as a no-op to satisfy chat-screen imports without breaking chat.`
  Confirm with `grep -rn "approvals-store" src` — if `chat-screen.tsx` no longer imports it, delete unconditionally.
- `workflow-templates.ts` uses storage namespace `clawsuite:*` — leftover from a project rename, never renamed here.

**Risk**: Low for `mission-checkpoint.ts`, `mission-events.ts`, `workflow-templates.ts`. **Medium** for `approvals-store.ts` only if chat-screen still references it — re-grep before deletion.

---

### 1.7 Bootstrap superseded versions — `bootstrap/bootstrap_{seed,cleanup}_v8.py`, `bootstrap_{seed,cleanup}_v81.py`

Last touched in commit `1dcb73a chore: flatten Chris Han changes after 85a886d` — a pure directory-flatten commit, not a feature update. The current equivalent is `bootstrap_seed_v85.py` / `bootstrap_cleanup_v85.py` (last meaningful refactor `1f74612 Refactor financial column identifiers`).

Evidence:
- `grep -rn "bootstrap_seed_v8\|bootstrap_seed_v81\|bootstrap_cleanup_v8\|bootstrap_cleanup_v81"` over the **entire repo** (Python, MD, shell, YAML, TOML, JSON, Dockerfile, Makefile, .claude, .agents, .codex, .github) — **0 hits**.
- `Makefile` targets use `semantier bootstrap` CLI; `src/cli.py` and `cli.py` contain **0** references to "bootstrap" the seeding concept. Only `hermes-agent/cli.py` mentions `hermes_bootstrap` (UTF-8 stdio shim, unrelated).
- `bootstrap/output/` contains only `seeded_demo_organizations.json` and `seeded_suoyang_profiles.json` — neither v8 nor v81 outputs are present, suggesting they were never re-run after v85.

**LoC**: ~37 K in `bootstrap_seed_v8.py` alone + ~30 K in `bootstrap_seed_v81.py` + ~7 K cleanup_v81 + ~11 K cleanup_v8 ≈ **~85 K of stale seed code**.

**Risk**: **Medium-High**. Two retention considerations:
1. If someone has a `bootstrap/output/seeded_ids.json` from an older run still in their local checkout, deleting the cleanup script will orphan those rows. Mitigation: check `git log --all -- bootstrap/output/` first.
2. If a downstream tutorial / handoff doc references these scripts by name, keep the files but mark them `@deprecated`. Search `docs/`, `*.md`, `HANDOFF.md`, `FEATURES-INVENTORY.md` — none found in this scan, but verify before deletion.

**Recommendation**: Delete `bootstrap_seed_v8.py`, `bootstrap_cleanup_v8.py`, `bootstrap_seed_v81.py`, `bootstrap_cleanup_v81.py` after one final `git log --all -- '*v8*.py' '*v81*.py'` review to confirm no historical branches still reference them.

---

## 2 · TIER B — REVIEW BEFORE DELETING

These have **0 callers today** but plausible resurrection paths, so each needs a 5-minute human review.

### 2.1 `contextgraph-studio-screen.tsx` (210 B) vs `contextgraph-studio-screen-v2.tsx` (43 K)

`grep` returned no direct importers of either in `src/`. The v2 variant is large and looks like an experimental successor. Action: determine via the router config which file the route binds to (`grep -rn "contextgraph-studio" src/routes` — none found either, suggesting routing may be in code-gen'd files). Then delete the unused one. The non-trivial v2 is more likely the live one; v1 looks vestigial.

### 2.2 `legal-corpus.tsx` route — `LegalCorpusRedirectRoute` (1-line redirect)

`/legal-corpus` redirects but the destination is hard-coded. Confirm with PM whether the redirect should remain or whether the destination has moved.

### 2.3 Individual dead functions/methods in live files (138 total)

Sample of the highest-signal dead functions (excluding framework-callback false positives in `routes/**`):

| File | Function | Lines | Why flagged |
|---|---|---|---|
| `lib/local-chat-threads.ts` | `setActiveThreadId` | 99-101 | No callers; thread model may have been refactored |
| `lib/provider-catalog.ts` | `mapChunk` | 206-208 | Likely streaming-shim, replaced by direct adapters |
| `routes/files.tsx` | `handleInsertReference`, `onEditorChange` | 84-88 / 129-131 | File-route editor no longer used? |
| `routes/session-events.tsx` | `toggleTimestampSort` | 510-512 | Likely feature removed but handler remained |
| `screens/chat/chat-screen.tsx` | `handler`, `handleRefreshRequest`, `handleSSEDrop`, `handleToggleFileExplorerFromSearch` | various | Many legacy chat hooks left over from UI iterations |
| `screens/dashboard/lib/formatters.ts` | `formatPercent`, `formatTokens`, `formatUptime` | 118-159 | Formatters replaced by new ones? |
| `screens/gateway/agents-screen.tsx` | `handleCloseAgentConfig`, `handleReloadAgentConfig` | 1195-1203 | Likely config-modal removed |
| `screens/memory/memory-browser-screen.tsx` | `handleCancelEditing`, `handleStartEditing` | 274-284 | Inline-edit mode no longer wired |
| `screens/skills/skills-screen.tsx` | `unwrapSkill` | 980-982 | One-liner helper, low value |
| `screens/tasks/tasks-screen.tsx` | `handleDragEnd` | 308-311 | Drag-drop in tasks no longer wired |
| `hooks/use-search-data.ts` | `handleQueryAbort` | 80-82 | Abort hook stale |
| `hooks/use-settings.ts` | `selectLoadSettings`, `selectSettings`, `selectUpdateSettings` | 197-205 | Look like Redux-selector relics; settings now use a different store |

**Suggested workflow**:
1. For each, grep for it under `__tests__/`. If a test exercises it, KEEP (or migrate the test).
2. If no test, and the function is one of the patterns above (handler/format/select/toggle), it's safe to delete.
3. If uncertain, add a `// @deprecated since YYYY-MM — candidate for removal` JSDoc tag and leave for one release cycle.

### 2.4 Other "fan-in=0" packages from `get_architecture` (out of scope for hermes-workspace but listed for awareness)

The architecture scan found these internal-layer packages with 0 inbound edges:
```
acp_adapter, agent, apps, bootstrap_cleanup_*, bootstrap_generate_reports_v81,
bootstrap_materialize_lakehouse, bootstrap_seed_*, eos, export_voucher_packs_v81,
knowledge_evaluation, operational, plans, v2, white-paper, workshop
```
Most are intentional entry points (CLI scripts, benchmark harnesses). `eos` is leaf with no outbound calls — likely a shim module. Each warrants its own audit, but outside this hermes-workspace-focused sweep.

---

## 3 · TIER C — KEEP (false positives or framework-managed)

The graph reported `max_degree=0` for several things that are actually wired in by framework. Do NOT delete:

| Pattern | Why keep |
|---|---|
| `pendingComponent`, `errorComponent` in `routes/*.tsx` | TanStack Router inspects the `Route` factory result, not the individual function refs. Examples: `RootRoute`, `AppRoute`, `ChatIndexRoute`, `AgentRosterPending`, `FilesPending`, `LegalCorpusRedirectRoute`, `pendingComponent` callbacks in route files. |
| All `__tests__/**/FakeSigma` methods (`kill`, `on`, etc.) | Test doubles — looked dead to the graph but exercised by test bodies. |
| `hermes-agent/**` `_reset_client_for_tests`, `_noop_initialize`, `_make_*` etc. | Pytest helpers, called via `pytest.fixture` / `monkeypatch` patterns the LSP resolver misses. |
| `hermes-agent/**` `__getattr__` lazy-load shims | Import-on-access pattern in package `__init__.py`. The shim is the import surface. |
| `keybinds.ts` object-method entries like `agents`, `artifacts`, `profiles`, etc. | String-keyed lookup table — graph can't trace. |
| `Makefile`-invoked `semantier bootstrap` targets | (Currently broken — `semantier bootstrap` doesn't exist in CLI — separate ticket, not Tier A.) |

---

## 4 · Verification commands (run before each deletion batch)

```bash
# 1. Confirm zero textual references (Tier A candidates)
cd /home/chris/repo/semantier-runtime
grep -rn "<SymbolName>" --include='*.{ts,tsx,py,sh,yml,yaml,md,json,toml}' \
  --exclude-dir=node_modules --exclude-dir=.venv --exclude-dir=dist --exclude-dir=runs

# 2. Confirm tests don't reference
grep -rn "<SymbolName>" hermes-workspace/src/**/__tests__/
grep -rn "<SymbolName>" hermes-workspace/**/*.test.{ts,tsx}
grep -rn "<SymbolName>" hermes-agent/tests/

# 3. Confirm CI / agents don't reference
grep -rn "<SymbolName>" .claude/ .agents/ .codex/ .github/ .devcontainer/

# 4. Confirm git history doesn't preserve an active branch that uses them
git log --all --oneline -- '<file>'
git branch -a --contains <last-meaningful-commit-sha>

# 5. Run build & test
cd hermes-workspace && bun run typecheck
cd hermes-workspace && bun run test
cd hermes-workspace && bun run lint
```

---

## 5 · Suggested execution order (smallest blast radius first)

1. **Tier A.1** — delete `inspect/` (1 dir, 7 files, 0 LoC of logic) and run tests.
2. **Tier A.3** — delete `source-viewer/{canonical-source-viewer,evidence-location-resolver}` (2 files, ~400 B).
3. **Tier A.4** — delete `tender-evaluation-panel.tsx` (22 LoC).
4. **Tier A.2** — delete `evaluate/`, `lineage/`, `studio-mode-tabs.tsx`.
5. **Tier A.6** — delete `gateway/lib/{mission-checkpoint,mission-events,workflow-templates,approvals-store}` after the chat-screen re-grep.
6. **Tier A.5** — delete `knowledge-browser-screen.tsx` (3 833 LoC) only after the side-by-side with `memory-browser-screen.tsx`.
7. **Tier B.2/B.3** — batch-delete dead functions inside live files; one file per commit for clean bisect.
9. **Tier A.7** — delete `bootstrap_{seed,cleanup}_v8.py` and `_v81.py` LAST, because they are the largest deletion and have the highest chance of being cited in someone's local docs.

---

## 6 · Out-of-scope follow-ups (flag for separate tickets)

- **Makefile `semantier bootstrap` is broken** — `src/cli.py` has no `bootstrap` subcommand. Either remove the Makefile targets or wire the CLI. Tracked separately because the fix is a feature decision, not cleanup.
- **`bootstrap/output/` is missing v85 manifests** — only `seeded_demo_organizations.json` and `seeded_suoyang_profiles.json` exist. The latest v85 run did not regenerate `seeded_ids_v85.json`. Cleanup script `bootstrap_cleanup_v85.py` will refuse to run without that manifest.
- **`semantier` package list (15 packages with fan-in=0)** — many are intentional CLI entry points, but `eos`, `acp_adapter`, `agent`, `apps`, `operational`, `plans`, `white-paper`, `workshop` deserve a separate audit.
- **13 parse_partial files** flagged in `index_status` — `hermes-workspace/src/styles.css:21-27`, `hermes-workspace/src/components/settings-dialog/settings-dialog.tsx:852/870`, `hermes-workspace/src/screens/skills/skills-screen.tsx:1405`. The graph may have missed symbols inside these ranges; grep those ranges before declaring 100 % confidence in this plan.

---

*End of plan.*