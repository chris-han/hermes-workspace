# Remove Shared Session Runtime Paths Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate runtime dependence on shared `.semantier-home/trajectories/` and `.semantier-home/sessions/`, and make those directories disappear as active runtime surfaces, so session indexes, transcripts, and per-session trajectory logs exist only under `workspaces/<workspace_id>/.hermes/sessions/`.

**Architecture:** Treat workspace session artifacts as the only filesystem-backed session store for Semantier runtime traffic, with shared `state.db` remaining an execution cache/index only. Replace upstream-style shared gateway index readers with workspace-aware resolution helpers owned by Semantier, remove code paths that create or read shared session artifacts under `.semantier-home/trajectories/` and `.semantier-home/sessions/`, and leave any remaining legacy residue accessible only through explicit migration/quarantine tooling.

**Tech Stack:** Python, FastAPI/web gateway adapters, Hermes gateway/session store, pytest, repo docs under `docs/`

---

## Audit Summary

Direct runtime dependencies on shared `.semantier-home/trajectories/` still exist in:

- `hermes-agent/gateway/config.py`
- `hermes-agent/gateway/session.py`
- `hermes-agent/gateway/mirror.py`
- `hermes-agent/gateway/channel_directory.py`
- `hermes-agent/mcp_serve.py`
- `hermes-agent/hermes_cli/status.py`
- `hermes-agent/hermes_cli/main.py`
- `hermes-agent/tui_gateway/server.py`

Shared `.semantier-home/sessions/` is no longer a live authority path in current runtime code. Remaining references are legacy cleanup/migration or tests/docs:

- `src/agents/session_residue_migration.py`
- `tests/test_session_residue_migration.py`
- stale references in docs and historical fixtures

Observed runtime residue in the current repo checkout:

- `.semantier-home/trajectories/sessions.json`
- `.semantier-home/trajectories/<session_id>.jsonl`
- `.semantier-home/sessions/session_*.json`

These should stop being created after this refactor, and the runtime should no longer require either directory to exist.

## Contract Changes

This plan assumes and enforces the following stricter contract:

- `workspaces/<workspace_id>/.hermes/sessions/` is the only supported filesystem session store for Semantier runtime session artifacts.
- `.semantier-home/trajectories/` is not a supported runtime session index or transcript store.
- `.semantier-home/sessions/` is not a supported runtime session store.
- Shared-path session artifacts may exist only as legacy residue pending explicit migration or quarantine.
- Normal runtime execution, local development flows, authenticated gateway traffic, and maintenance commands must not recreate `.semantier-home/trajectories/` or `.semantier-home/sessions/`.

## Decision Freeze

Freeze these decisions before touching runtime code so Task 3 and Task 4 do not churn:

1. `mcp_serve` unscoped reads default to reject. Cross-workspace enumeration is allowed only through an explicit admin/operator-scoped path introduced deliberately during implementation.
2. Canonical `session_id` wins over origin-metadata search whenever both are available.
3. `get_gateway_trajectories_dir()` is not an authenticated-runtime session surface after this refactor. If retained, it must be isolated behind a clearly separate non-authenticated/non-workspace code path.
4. Authenticated traffic must never fall back to any non-workspace local session store.
5. Launcher/bootstrap must enforce a strict no-create invariant for `.semantier-home/trajectories/` and `.semantier-home/sessions/` during normal runtime execution. Creation is allowed only inside explicit migration/quarantine flows.

## Execution Phases

### Phase A: Contract And Acceptance

Purpose:

- update docs so the stricter target is explicit
- define regression checks that fail if any active runtime path recreates the shared dirs

Primary tasks:

- Task 1: Freeze The Canonical Contract
- Task 6: Full Regression Sweep And Disk Verification

### Phase B: Runtime Refactor

Purpose:

- remove shared path defaults, readers, and maintenance flows
- move all active session-index and transcript lookups to workspace-owned helpers

Primary tasks:

- Task 2: Remove Shared Trajectory Store As Gateway Default
- Task 3: Replace Shared Index Readers With Workspace-Aware Helpers
- Task 4: Route CLI/TUI Maintenance Commands To Workspace Session Directories

### Phase C: Legacy Residue Containment

Purpose:

- keep migration/quarantine support for old files without preserving the shared dirs as live runtime surfaces

Primary tasks:

- Task 5: Decommission Shared Session Residue As A Supported Runtime Surface

## File Map

### Core runtime/session routing

- Modify: `hermes-agent/gateway/config.py`
  Purpose: remove shared trajectory store as the default gateway `sessions_dir` and stop treating it as a valid active runtime store.
- Modify: `hermes-agent/gateway/session.py`
  Purpose: stop falling back to shared transcript/index files and remove shared-path usage from active runtime session routing.
- Modify: `hermes-agent/gateway/run.py`
  Purpose: ensure every authenticated gateway turn binds canonical workspace session paths before any index/transcript write.
- Modify: `src/agents/workspace_session_logs.py`
  Purpose: expose any missing helpers for workspace-scoped index lookup, transcript append, channel/session resolution, and migration support.

### Secondary consumers currently reading shared `trajectories/sessions.json`

- Modify: `hermes-agent/gateway/mirror.py`
  Purpose: resolve target sessions from workspace-owned session indexes instead of the shared gateway index.
- Modify: `hermes-agent/gateway/channel_directory.py`
  Purpose: build channel/contact hints from workspace-owned session indexes or another explicit workspace-aware source.
- Modify: `hermes-agent/mcp_serve.py`
  Purpose: read conversations from workspace-owned indexes instead of a single shared `trajectories/sessions.json`.
- Modify: `hermes-agent/hermes_cli/status.py`
  Purpose: stop reporting session index state from the shared trajectories dir.
- Modify: `hermes-agent/hermes_cli/main.py`
  Purpose: make delete/prune commands operate on the correct workspace sessions dir instead of the shared trajectories dir.
- Modify: `hermes-agent/tui_gateway/server.py`
  Purpose: route session deletion against workspace-owned session directories.

### Shared residue cleanup and bootstrap boundary

- Modify: `src/agents/session_residue_migration.py`
  Purpose: narrow this module to migration/quarantine of truly legacy residue and remove any implication that shared session directories remain a supported runtime surface.
- Modify: `src/agents/launcher.py`
  Purpose: add startup assertions/cleanup hooks so `.semantier-home/trajectories/` and `.semantier-home/sessions/` are not recreated as active runtime directories.

### Docs

- Modify: `docs/canonical/architecture.md`
  Purpose: remove stale claims that `.semantier-home/trajectories/` remains a canonical gateway index for current authenticated sessions.
- Modify: `docs/derived/gateway-unified-multitenant-design.md`
  Purpose: keep the executable contract aligned with the implementation after the shared-path removal.
- Modify: `docs/operational/saas-multitenancy-roadmap.md`
  Purpose: record the final cleanup of shared session path dependencies.

### Tests

- Modify: `hermes-agent/tests/gateway/test_session.py`
- Modify: `hermes-agent/tests/gateway/test_channel_directory.py`
- Modify: `hermes-agent/tests/gateway/test_mirror.py`
- Modify: `hermes-agent/tests/test_mcp_serve.py`
- Modify: `tests/test_hermes_api_compat.py`
- Modify: `tests/test_session_residue_migration.py`
- Add: `tests/test_shared_session_path_elimination.py`
  Purpose: assert no active runtime path reads/writes `.semantier-home/trajectories/` or `.semantier-home/sessions/`.

---

### Task 1: Freeze The Canonical Contract

**Files:**
- Modify: `docs/canonical/architecture.md`
- Modify: `docs/derived/gateway-unified-multitenant-design.md`
- Modify: `docs/operational/saas-multitenancy-roadmap.md`

- [x] **Step 1: Write the failing doc-alignment test**

Add a focused lint-style test in `tests/test_runtime_paths.py` or a new `tests/test_shared_session_path_elimination.py` asserting:

- the docs positively declare `workspaces/<workspace_id>/.hermes/sessions/` as the canonical session store
- `sessions.json`, transcript `.jsonl`, and trajectory `.trajectory.jsonl` are positively described there
- shared `.semantier-home/trajectories/` and `.semantier-home/sessions/` references appear only in explicitly named legacy/migration sections

Example assertion targets:

```python
def test_docs_define_workspace_session_store_as_canonical():
    text = Path("docs/derived/gateway-unified-multitenant-design.md").read_text(encoding="utf-8")
    assert "workspaces/<workspace_id>/.hermes/sessions/" in text
    assert "sessions.json" in text
    assert "session_<file_key>.trajectory.jsonl" in text


def test_shared_session_paths_appear_only_in_legacy_sections():
    text = Path("docs/canonical/architecture.md").read_text(encoding="utf-8")
    legacy_section = _legacy_or_migration_sections(text)
    assert ".semantier-home/trajectories/" in legacy_section
    assert ".semantier-home/sessions/" in legacy_section
```

- [x] **Step 2: Run the test to verify it fails**

Run:

```bash
pytest tests/test_shared_session_path_elimination.py -k architecture -v
```

Expected: FAIL because current docs still describe `.semantier-home/trajectories/` as a current session-index surface outside a legacy-only framing.

- [x] **Step 3: Update the docs to the intended post-refactor contract**

Required doc outcomes:

- `workspaces/<workspace_id>/.hermes/sessions/sessions.json` is the workspace session index / transport-key map.
- `workspaces/<workspace_id>/.hermes/sessions/<file_key>.jsonl` is the canonical transcript/event log.
- `workspaces/<workspace_id>/.hermes/sessions/session_<file_key>.trajectory.jsonl` is the canonical per-session trajectory log.
- `.semantier-home/trajectories/` and `.semantier-home/sessions/` are described only as legacy residue inputs, not runtime-owned active stores.

- [x] **Step 4: Re-run the test**

Run:

```bash
pytest tests/test_shared_session_path_elimination.py -k architecture -v
```

Expected: PASS

- [x] **Step 5: Commit**

```bash
git add docs/canonical/architecture.md docs/derived/gateway-unified-multitenant-design.md docs/operational/saas-multitenancy-roadmap.md tests/test_shared_session_path_elimination.py
git commit -m "docs: define workspace session store as sole authenticated authority"
```

### Task 2: Remove Shared Trajectory Store As Gateway Default

**Files:**
- Modify: `hermes-agent/gateway/config.py`
- Modify: `hermes-agent/gateway/session.py`
- Test: `hermes-agent/tests/gateway/test_session.py`
- Test: `tests/test_shared_session_path_elimination.py`

- [x] **Step 1: Write the failing runtime tests**

Add tests covering:

```python
def test_gateway_config_does_not_default_to_shared_trajectory_store(monkeypatch, tmp_path):
    monkeypatch.setenv("HERMES_HOME", str(tmp_path / ".semantier-home"))
    config = GatewayConfig()
    assert config.sessions_dir != tmp_path / ".semantier-home" / "trajectories"


def test_workspace_bound_session_never_falls_back_to_shared_trajectory_jsonl(tmp_path):
    config = GatewayConfig(sessions_dir=tmp_path / "forbidden-shared")
    store = SessionStore(sessions_dir=config.sessions_dir, config=config)
    workspace_home = tmp_path / "workspaces" / "ws-123" / ".hermes"
    store.register_workspace_home("ws-123:session_abc", workspace_home)
    path = store.get_transcript_path("ws-123:session_abc")
    assert "forbidden-shared" not in str(path)
    assert str(path).endswith("/workspaces/ws-123/.hermes/sessions/ws-123%3Asession_abc.jsonl")


def test_authenticated_gateway_turn_binds_workspace_session_paths_before_first_write(tmp_path):
    workspace_home = tmp_path / "workspaces" / "ws-123" / ".hermes"
    shared_dir = tmp_path / ".semantier-home" / "trajectories"
    shared_dir.mkdir(parents=True, exist_ok=True)
    config = GatewayConfig(sessions_dir=shared_dir)
    store = SessionStore(sessions_dir=config.sessions_dir, config=config)
    store.register_workspace_home("ws-123:session_abc", workspace_home)
    store.append_to_transcript("ws-123:session_abc", {"role": "user", "content": "hi"}, skip_db=True)
    assert not (shared_dir / "ws-123:session_abc.jsonl").exists()
    assert (workspace_home / "sessions" / "ws-123%3Asession_abc.jsonl").exists()
```

- [x] **Step 2: Run the targeted tests**

Run:

```bash
pytest hermes-agent/tests/gateway/test_session.py -k "trajectory_store or falls_back_to_shared or binds_workspace_session_paths_before_first_write" -v
pytest tests/test_shared_session_path_elimination.py -k "shared_trajectory" -v
```

Expected: FAIL because the current default still points at `get_gateway_trajectories_dir()` and non-workspace fallbacks remain available.

- [x] **Step 3: Implement the minimal routing change**

Implementation requirements:

- `GatewayConfig.sessions_dir` must no longer default to `get_gateway_trajectories_dir()`.
- `SessionStore.get_transcript_path()` must use workspace-owned paths for authenticated sessions with no silent shared fallback after registration.
- Authenticated turns must bind the canonical workspace session path before the first index/transcript write.
- Any remaining non-workspace path must not use `.semantier-home/trajectories/` or `.semantier-home/sessions/` as an active session store.

- [x] **Step 4: Re-run the targeted tests**

Run:

```bash
pytest hermes-agent/tests/gateway/test_session.py -k "trajectory_store or falls_back_to_shared or binds_workspace_session_paths_before_first_write" -v
pytest tests/test_shared_session_path_elimination.py -k "shared_trajectory" -v
```

Expected: PASS

- [x] **Step 5: Commit**

```bash
git add hermes-agent/gateway/config.py hermes-agent/gateway/session.py hermes-agent/tests/gateway/test_session.py tests/test_shared_session_path_elimination.py
git commit -m "refactor: remove shared trajectory store as gateway default"
```

### Task 3: Replace Shared Index Readers With Workspace-Aware Helpers

**Files:**
- Modify: `src/agents/workspace_session_logs.py`
- Modify: `hermes-agent/gateway/mirror.py`
- Modify: `hermes-agent/gateway/channel_directory.py`
- Modify: `hermes-agent/mcp_serve.py`
- Test: `hermes-agent/tests/gateway/test_mirror.py`
- Test: `hermes-agent/tests/gateway/test_channel_directory.py`
- Test: `hermes-agent/tests/test_mcp_serve.py`

- [x] **Step 1: Write failing tests for each direct shared-index consumer**

Add tests asserting these components read workspace-owned session indexes and function without `.semantier-home/trajectories/sessions.json`.

Core examples:

```python
def test_mirror_reads_workspace_sessions_index(tmp_path, monkeypatch):
    workspace_sessions = tmp_path / "workspaces" / "ws-123" / ".hermes" / "sessions"
    workspace_sessions.mkdir(parents=True)
    (workspace_sessions / "sessions.json").write_text(json.dumps({...}), encoding="utf-8")
    assert mirror_to_session(...) is True


def test_channel_directory_builds_from_workspace_sessions(tmp_path, monkeypatch):
    workspace_sessions = tmp_path / "workspaces" / "ws-123" / ".hermes" / "sessions"
    ...
    entries = _build_from_sessions("slack")
    assert entries == [...]


def test_mcp_serve_loads_workspace_session_index_without_shared_trajectories(tmp_path, monkeypatch):
    workspace_sessions = tmp_path / "workspaces" / "ws-123" / ".hermes" / "sessions"
    ...
    assert _load_sessions_index() != {}
```

- [x] **Step 2: Run the tests to verify they fail**

Run:

```bash
pytest hermes-agent/tests/gateway/test_mirror.py -v
pytest hermes-agent/tests/gateway/test_channel_directory.py -v
pytest hermes-agent/tests/test_mcp_serve.py -k sessions_index -v
```

Expected: FAIL because those modules still read `get_gateway_trajectories_dir() / "sessions.json"` directly.

- [x] **Step 2.5: Freeze Task 3 behavior decisions in tests before implementation**

Before editing runtime code, write the exact expected behavior into the new/updated tests:

- unscoped `mcp_serve` reads reject by default
- canonical `session_id` lookup wins over origin-metadata search
- no shared `.semantier-home/trajectories/sessions.json` fallback is allowed

This step is complete only when those expectations are encoded in test names and assertions, not left as prose.

- [x] **Step 3: Add workspace-aware helper APIs and update consumers**

Implementation requirements:

- Add a helper in `src/agents/workspace_session_logs.py` that can:
  - load a workspace session index by `workspace_hermes_home`
  - iterate all workspace session indexes when an admin/global listing surface needs them
  - resolve by canonical session id or alias without using shared `.semantier-home/trajectories/sessions.json`
- Update:
  - `gateway/mirror.py`
  - `gateway/channel_directory.py`
  - `mcp_serve.py`
to consume those helpers instead of direct shared-file reads.

- [x] **Step 4: Re-run the tests**

Run:

```bash
pytest hermes-agent/tests/gateway/test_mirror.py -v
pytest hermes-agent/tests/gateway/test_channel_directory.py -v
pytest hermes-agent/tests/test_mcp_serve.py -k sessions_index -v
```

Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/agents/workspace_session_logs.py hermes-agent/gateway/mirror.py hermes-agent/gateway/channel_directory.py hermes-agent/mcp_serve.py hermes-agent/tests/gateway/test_mirror.py hermes-agent/tests/gateway/test_channel_directory.py hermes-agent/tests/test_mcp_serve.py
git commit -m "refactor: move shared session-index consumers to workspace session logs"
```

### Task 4: Route CLI/TUI Maintenance Commands To Workspace Session Directories

**Files:**
- Modify: `hermes-agent/hermes_cli/main.py`
- Modify: `hermes-agent/hermes_cli/status.py`
- Modify: `hermes-agent/tui_gateway/server.py`
- Test: `tests/test_hermes_api_compat.py`
- Test: `hermes-agent/tests/test_tui_gateway_server.py`

- [x] **Step 1: Write failing tests for maintenance commands**

Add tests covering:

```python
def test_cli_delete_session_uses_workspace_sessions_dir(...):
    ...
    assert "/workspaces/ws-123/.hermes/sessions" in seen["sessions_dir"]


def test_tui_delete_session_uses_workspace_sessions_dir(...):
    ...
    assert "/workspaces/ws-123/.hermes/sessions" in captured["sessions_dir"]


def test_status_does_not_report_shared_trajectory_sessions_json(...):
    ...
```

- [x] **Step 2: Run the targeted tests**

Run:

```bash
pytest tests/test_hermes_api_compat.py -k "delete_uses_workspace_scoped_sessions_dir" -v
pytest hermes-agent/tests/test_tui_gateway_server.py -k "sessions_dir" -v
```

Expected: FAIL where command handlers still compute session maintenance paths from `get_gateway_trajectories_dir()`.

- [x] **Step 3: Implement workspace-aware maintenance path resolution**

Implementation requirements:

- Session delete/prune/status surfaces must resolve the workspace sessions dir from the authenticated context or canonical session id.
- Shared `.semantier-home/trajectories` must not be passed as `sessions_dir`.
- Any non-workspace/local fallback must use a non-shared-path design chosen during implementation, not reuse `.semantier-home/trajectories/` or `.semantier-home/sessions/`.

- [x] **Step 4: Re-run the targeted tests**

Run:

```bash
pytest tests/test_hermes_api_compat.py -k "delete_uses_workspace_scoped_sessions_dir" -v
pytest hermes-agent/tests/test_tui_gateway_server.py -k "sessions_dir" -v
```

Expected: PASS

- [x] **Step 5: Commit**

```bash
git add hermes-agent/hermes_cli/main.py hermes-agent/hermes_cli/status.py hermes-agent/tui_gateway/server.py tests/test_hermes_api_compat.py hermes-agent/tests/test_tui_gateway_server.py
git commit -m "refactor: use workspace session directories for session maintenance surfaces"
```

### Task 5: Decommission Shared Session Residue As A Supported Runtime Surface

**Files:**
- Modify: `src/agents/session_residue_migration.py`
- Modify: `src/agents/launcher.py`
- Test: `tests/test_session_residue_migration.py`
- Test: `tests/test_shared_session_path_elimination.py`

- [x] **Step 1: Write failing tests for shared-path non-creation**

Add tests covering:

```python
def test_authenticated_runtime_does_not_create_shared_trajectories_dir(tmp_path, monkeypatch):
    ...
    assert not (tmp_path / ".semantier-home" / "trajectories").exists()


def test_authenticated_runtime_does_not_create_shared_sessions_dir(tmp_path, monkeypatch):
    ...
    assert not (tmp_path / ".semantier-home" / "sessions").exists()
```

- [x] **Step 2: Run the tests to verify they fail**

Run:

```bash
pytest tests/test_shared_session_path_elimination.py -k "does_not_create_shared" -v
```

Expected: FAIL because current runtime surfaces still create `.semantier-home/trajectories/` and historical residue may still be created.

- [x] **Step 3: Narrow shared residue support to migration-only**

Implementation requirements:

- `src/agents/session_residue_migration.py` remains only as an explicit migration/quarantine tool for old data.
- Launcher/bootstrap code must not create `.semantier-home/sessions/` or `.semantier-home/trajectories/` during runtime flow.
- If legacy residue is discovered, it should be quarantined or migrated explicitly, not recreated as an active runtime store.

- [x] **Step 4: Re-run the tests**

Run:

```bash
pytest tests/test_session_residue_migration.py -v
pytest tests/test_shared_session_path_elimination.py -k "does_not_create_shared" -v
```

Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/agents/session_residue_migration.py src/agents/launcher.py tests/test_session_residue_migration.py tests/test_shared_session_path_elimination.py
git commit -m "refactor: decommission shared session residue as runtime surface"
```

### Task 6: Full Regression Sweep And Disk Verification

**Files:**
- Modify as needed from prior tasks only
- Test: `hermes-agent/tests/gateway/test_session.py`
- Test: `hermes-agent/tests/gateway/test_mirror.py`
- Test: `hermes-agent/tests/gateway/test_channel_directory.py`
- Test: `hermes-agent/tests/test_mcp_serve.py`
- Test: `tests/test_hermes_api_compat.py`
- Test: `tests/test_session_residue_migration.py`
- Test: `tests/test_shared_session_path_elimination.py`

- [x] **Step 1: Run the focused regression suite**

Run:

```bash
pytest \
  hermes-agent/tests/gateway/test_session.py \
  hermes-agent/tests/gateway/test_mirror.py \
  hermes-agent/tests/gateway/test_channel_directory.py \
  hermes-agent/tests/test_mcp_serve.py \
  tests/test_hermes_api_compat.py \
  tests/test_session_residue_migration.py \
  tests/test_shared_session_path_elimination.py -v
```

Expected: PASS

- [x] **Step 2: Run repository session-path grep as a safety check**

Run:

```bash
rg -n "\\.semantier-home/trajectories|\\.semantier-home/sessions|get_gateway_trajectories_dir\\(" src hermes-agent -S
```

Expected:

- no runtime code path treats `.semantier-home/trajectories` as an authenticated session store
- no runtime code path reads or writes `.semantier-home/sessions` as an active session store

- [x] **Step 3: Run separate docs/tests allowlist grep**

Run:

```bash
rg -n "\\.semantier-home/trajectories|\\.semantier-home/sessions|get_gateway_trajectories_dir\\(" tests docs scripts -S
```

Expected:

- references are limited to explicit migration tests, lineage docs, or intentional compatibility notes
- each remaining hit is explainable by the stricter contract and not an active runtime dependency

- [x] **Step 4: Verify no new shared session artifacts are created by targeted flows**

Run:

```bash
find .semantier-home -maxdepth 2 \\( -path '.semantier-home/trajectories' -o -path '.semantier-home/sessions' \\) -print
```

Expected: no new active runtime artifacts after session tests; any remaining files should be pre-existing legacy residue or explicit quarantine fixtures only, and the refactor should make it practical to remove those directories entirely in normal dev/runtime setups.

- [x] **Step 5: Verify shared runtime session directories are absent after clean targeted flows using isolated temp homes**

Run:

```bash
tmp_runtime="$(mktemp -d)"
SEMANTIER_LOCAL_STATE_DIR="$tmp_runtime/.semantier-home" HERMES_HOME="$tmp_runtime/.semantier-home" pytest \
  hermes-agent/tests/gateway/test_session.py \
  hermes-agent/tests/gateway/test_mirror.py \
  hermes-agent/tests/gateway/test_channel_directory.py \
  hermes-agent/tests/test_mcp_serve.py \
  tests/test_hermes_api_compat.py \
  tests/test_shared_session_path_elimination.py -v
find "$tmp_runtime/.semantier-home" -maxdepth 2 \\( -path "$tmp_runtime/.semantier-home/trajectories" -o -path "$tmp_runtime/.semantier-home/sessions" \\) -print
```

Expected:

- the test run passes
- `find` prints nothing
- this proves active runtime flows do not recreate the shared session directories

Validation note (2026-06-01):

- Running the full isolated command including `tests/test_hermes_api_compat.py` can produce `$HERMES_HOME/sessions` via compatibility fixtures that intentionally synthesize local-session artifacts.
- Running the isolated runtime-focused sweep (`gateway/test_session.py`, `gateway/test_mirror.py`, `gateway/test_channel_directory.py`, `test_mcp_serve.py`, `test_shared_session_path_elimination.py`) passes and `find` prints nothing for `.semantier-home/trajectories`/`.semantier-home/sessions`.

- [x] **Step 6: Commit the final sweep**

```bash
git add -A
git commit -m "test: verify shared session runtime paths are eliminated"
```

## Open Design Decisions To Resolve During Implementation
Resolved by the Decision Freeze section above. Do not reopen them during execution without a plan revision.

## Review Notes

This refactor is larger than a pure path rename because the shared `sessions.json` file is still being used as a cross-cutting lookup/index by multiple upstream Hermes surfaces. The target state for this plan is stricter than the existing roadmap wording: the shared session directories should not exist anymore as runtime surfaces. The safest execution order is:

1. freeze the doc contract
2. add workspace-aware helper APIs
3. migrate direct readers
4. remove shared defaults/fallbacks
5. assert no shared-path creation remains

Plan complete and saved to `docs/operational/plans/2026-06-01-remove-shared-session-runtime-paths.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
