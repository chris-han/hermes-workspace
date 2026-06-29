# Refactoring Plan: Migrate Semantier CLI Delegation to Direct Python API

**Date:** 2026-06-16  
**Status:** Draft plan  
**Scope:** `semantier-runtime` CLI entry points, tests, docs, and courseware

---

## 1. Executive Summary

`semantier-runtime` currently exposes several commands (`semantier`, `semantier-gateway`, `semantier-agent`, `semantier-api`) that delegate heavily to upstream `hermes-agent` CLI entry points via `launcher._run_with_argv()` and `subprocess.run()`. This plan catalogs every delegation point, identifies where a direct Python API call is preferable, and proposes a staged migration.

**Goals:**

- Reduce CLI-argv indirection for programmatic use cases.
- Make tests faster and more precise by calling Python APIs directly.
- Clarify in documentation/courseware when to use CLI vs. in-process API.
- Preserve CLI as a first-class human interface.

**Non-goals:**

- Remove the CLI; human-facing CLI remains.
- Refactor upstream `hermes-agent`; we only change Semantier wrapper usage.
- Port `bootstrap/bootstrap.sh` to Python in this plan. That is tracked as a separate follow-up plan (`docs/plans/YYYY-MM-DD-bootstrap-shell-to-python.md`). Consequently, `run_bootstrap_cli` will keep using `subprocess.run` for now; this plan only documents it as a known boundary.

**Core architectural split:**

- **Human CLI contract** (`run_hermes_cli`, `run_gateway_cli`, `run_agent_cli`): remains a stable, mostly passthrough compatibility surface. It should not be fast-pathed or intercepted for common commands, to avoid drift from upstream Hermes behavior.
- **Programmatic Semantier API contract** (new helpers in `launcher.py` and existing `webapi_gateway.py` routes): provides structured returns, deterministic context binding, and in-process execution for wrappers, tests, and automation.

All migration work adds to the programmatic API contract; the CLI contract continues to delegate unless a command is Semantier-native (e.g., `semantier run`, `semantier bootstrap`).

---

## 2. Current CLI Delegation Patterns

### 2.1 Launcher delegation map

All CLI delegation lives in `src/agents/launcher.py`.

| Semantier Command | Function | Delegation Target | Mechanism |
|---|---|---|---|
| `semantier` | `run_hermes_cli()` | `hermes_cli.main.main` | `_run_with_argv()` |
| `semantier-agent` | `run_agent_cli()` | `run_agent.main` | `_run_with_argv()` |
| `semantier-gateway` | `run_gateway_cli()` | `run_hermes_cli(["gateway", ...])` | `_run_with_argv()` via `run_hermes_cli` |
| `semantier-api` | `run_api()` | `uvicorn.run()` | direct (server start) |
| `semantier run` | `run_runtime_cli()` | `uvicorn.run()` | direct (server start) |
| `semantier bootstrap` | `run_bootstrap_cli()` | `bootstrap/bootstrap.sh` | `subprocess.run()` |
| `semantier-industry-sim` | `run_industry_sim()` | `bootstrap.industry_simulator.cli` | `_run_with_argv()` |

### 2.2 Semantier web API routes that duplicate CLI operations

Several `webapi_gateway.py` routes already avoid CLI and call Hermes Python APIs directly. These are the model for migration:

| Route | Current Python API Used | Replaces Equivalent CLI |
|---|---|---|
| `POST /system/skills/install` | `hermes_cli.skills_hub.do_install()` for skill packages; `_install_repo_local_plugin()` → `hermes_cli.plugins_cmd.dashboard_set_agent_plugin_enabled()` for plugin packages | `hermes skills install`, `hermes plugins enable` |
| `PUT /system/skills/toggle` | `hermes_cli.skills_config.get_disabled_skills`, `save_disabled_skills` | `hermes skills enable/disable` |
| `POST /system/skills/uninstall` | `tools.skills_hub.uninstall_skill` | `hermes skills uninstall` |
| `GET /system/skills` | `runtime_inventory.list_skills_inventory` | `hermes skills list` |
| `GET /system/plugins` | `runtime_inventory.list_plugins_inventory` | `hermes plugins list` |
| `GET /system/tools` | `runtime_inventory.list_toolsets_inventory` | `hermes tools list` |

### 2.3 Tests that invoke CLI

Most CLI invocations are in `tests/test_agents_launcher.py`. Other tests use `subprocess.run` for end-to-end workflows:

- `tests/test_agents_launcher.py` — tests `run_hermes_cli`, `run_gateway_cli`, `run_agent_cli`, `run_bootstrap_cli`, `run_runtime_cli`
- `tests/test_example.py` — uses `subprocess.run` for workflow demo
- `tests/test_workflows.py` — uses `subprocess.run`
- `tests/test_cleanup_users.py` — uses `subprocess.run`
- `tests/test_tenant_backup_restore.py` — uses `subprocess.run`
- `tests/test_p1_export_and_reports.py` — uses `subprocess.run`
- `tests/test_p2_multitenancy_roadmap_status.py` — uses `subprocess.run`
- `tests/test_multitenant_isolation.py` — uses `subprocess.run`
- `scripts/gateway_readiness.py` — uses `subprocess.run`

### 2.4 Documentation and courseware references to CLI

- `docs/courseware/AI_Agents_Workshop_Courseware.md` — L0–L11 use CLI/curl examples
- `how-to-run.md` — primary CLI quickstart
- `README.md` — `pip install -e .; semantier ...`

---

## 3. Migration Matrix

### 3.1 High-priority: Programmatic entry points used by wrappers/tests

| # | Current Call | Proposed Direct API | File(s) | Effort | Notes |
|---|---|---|---|---|---|
| 1 | `run_hermes_cli(["skills", "list"])` | **CLI stays as-is.** Programmatic callers use new `semantier_skills_list()` helper → `runtime_inventory.list_skills_inventory()` | `launcher.py`, tests, courseware | Low | Do NOT fast-path inside `run_hermes_cli`; separate helper preserves CLI contract |
| 2 | `run_hermes_cli(["skills", "install", ...])` | **CLI stays as-is.** `/system/skills/install` already uses `hermes_cli.skills_hub.do_install()` | `webapi_gateway.py` | Low | Keep CLI for humans; web API already direct |
| 3 | `run_hermes_cli(["tools", "list"])` | **CLI stays as-is.** Programmatic callers use new `semantier_tools_list()` helper → `runtime_inventory.list_toolsets_inventory()` | `launcher.py`, tests | Low | Do NOT fast-path inside `run_hermes_cli` |
| 4 | `run_hermes_cli(["plugins", "list"])` | **CLI stays as-is.** Programmatic callers use new `semantier_plugins_list()` helper → `runtime_inventory.list_plugins_inventory()` | `launcher.py`, tests | Low | Do NOT fast-path inside `run_hermes_cli` |
| 5 | `run_hermes_cli(["status"])` | **CLI stays as-is.** Programmatic callers use inventory helpers | `launcher.py`, tests | Low | `status` is human-readable summary; do not intercept |
| 6 | `run_hermes_cli(["gateway", "run", ...])` | **Phase 2 limited to extracting pre-run orchestration** (`_prepare_gateway_env`, `_terminate_hermes_gateway_processes`) into reusable helpers. Direct `GatewayRunner` call deferred until orchestration is fully reusable and tested. | `launcher.py` | Medium-High | Avoid skipping env hydration, auth DB binding, replace-time termination, routing normalization |
| 7 | `run_agent_cli(["--query=..."])` | Add `run_agent_query(query, **kwargs)` helper that calls `run_agent.main()` with kwargs instead of argv. Long-term explore `AIAgent.run_conversation()`. | `launcher.py` | Medium | `run_agent.main` is already a Python function; bypass argv parsing |
| 8 | `run_bootstrap_cli(["--replace"])` | **Out of scope for this plan.** Keep `subprocess.run(["bash", "bootstrap/bootstrap.sh"])`. Track shell-to-Python port separately. | `launcher.py` | N/A | See follow-up plan `docs/plans/YYYY-MM-DD-bootstrap-shell-to-python.md` |
| 9 | `run_runtime_cli(["--replace"])` | Keep `uvicorn.run`; already direct | `launcher.py` | N/A | No change needed |
| 10 | `run_api([...])` | Keep `uvicorn.run`; already direct | `launcher.py` | N/A | No change needed |

### 3.2 Medium-priority: Test helpers and subprocess inventory

The repo contains many `subprocess.run` invocations beyond `test_agents_launcher.py`. A full inventory is required before Phase 1 ends. Known files:

| # | Current Call | Proposed Direct API | File(s) | Effort | Notes |
|---|---|---|---|---|---|
| 11 | `subprocess.run(["semantier", "run", ...])` in workflow tests | Use `run_runtime_cli()` or direct `uvicorn.run` in thread | `tests/test_workflows.py`, `tests/test_example.py`, other workflow tests | Medium | Process lifecycle tests may still need subprocess |
| 12 | `subprocess.run(["semantier", "gateway", ...])` in readiness/isolation tests | Reuse extracted gateway orchestration helpers; keep one E2E subprocess test | `scripts/gateway_readiness.py`, `tests/test_multitenant_isolation.py` | Medium | At least one subprocess test validates CLI bridge |
| 13 | `subprocess.run` in backup/restore/export tests | Mostly lifecycle tests; evaluate case-by-case | `tests/test_tenant_backup_restore.py`, `tests/test_p1_export_and_reports.py`, `tests/test_p2_multitenancy_roadmap_status.py`, `tests/test_cleanup_users.py` | Medium-High | Some may remain process-isolated by design |
| 14 | `subprocess.run` in `scripts/gateway_readiness.py` | Split into two checks: HTTP readiness (replace with `httpx`) + CLI bridge readiness (keep subprocess) | `scripts/gateway_readiness.py` | Low | Do not remove CLI bridge check unless intent changes |

### 3.2.1 Decision: which tests must stay subprocess?

Tests that exercise process semantics must remain subprocess:

- Runtime ownership / port replacement (`test_run_runtime_cli_*`)
- Gateway process termination / signal handling
- Bootstrap script execution (until shell-to-Python port)
- One end-to-end CLI bridge test per major command

All other tests should migrate to direct API calls.

### 3.3 Keep as CLI

These are legitimate CLI use cases and should remain:

- Human operator commands: `semantier run --replace`, `semantier gateway run --replace`
- One-shot interactive commands: `semantier-agent --query=...`
- Shell-completion / argv-heavy commands: model picker, fallback chain
- Commands that intentionally spawn a fresh process to isolate cwd/env

---

## 4. Available Hermes Python APIs

### 4.1 Skills

```python
from hermes_cli.skills_hub import do_list, do_install, skills_command
from hermes_cli.skills_config import skills_command as skills_config_command
from tools.skills_tool import _find_all_skills, _current_skills_dir
from agent.skill_utils import get_disabled_skill_names
```

### 4.2 Plugins

```python
from hermes_cli.plugins_cmd import dashboard_set_agent_plugin_enabled
```

### 4.3 Config

```python
from hermes_cli.config import load_config, save_config
```

### 4.4 Cron

```python
from cron.jobs import list_jobs, create_job, update_job
```

### 4.5 Gateway

```python
from gateway.run import GatewayRunner  # or gateway.run module
```

### 4.6 Agent

```python
from run_agent import main as run_agent_main
from agent.conversation_loop import run_conversation
from agent.agent_init import AIAgent
```

---

## 5. Proposed Implementation

### 5.1 Add direct API helpers in `src/agents/launcher.py`

Introduce small helpers that return structured data instead of exit codes:

```python
def list_skills(*, source_filter: str = "all", enabled_only: bool = False) -> list[dict]:
    """Return installed skills as structured data (no CLI argv)."""
    from hermes_cli.skills_hub import do_list
    # Capture Rich console output or use tools.skills_tool directly
    ...

def list_plugins() -> list[dict]:
    """Return installed plugins."""
    from agents.runtime_inventory import list_plugins_inventory
    return list_plugins_inventory(workspace_hermes_home=None)["plugins"]

def list_tools() -> list[dict]:
    """Return available toolsets."""
    from agents.runtime_inventory import list_toolsets_inventory
    return list_toolsets_inventory(workspace_hermes_home=None)["tools"]
```

### 5.2 Add separate programmatic helpers; do NOT fast-path `run_hermes_cli`

`run_hermes_cli` remains a pure passthrough to `hermes_cli.main.main` (plus Semantier-native routing for `run`/`bootstrap`/`webapi run`). Programmatic callers use new helpers instead:

```python
def semantier_skills_list(*, workspace_hermes_home=None) -> dict:
    from agents.runtime_inventory import list_skills_inventory
    return list_skills_inventory(workspace_hermes_home=workspace_hermes_home)

def semantier_plugins_list(*, workspace_hermes_home=None) -> dict:
    from agents.runtime_inventory import list_plugins_inventory
    return list_plugins_inventory(workspace_hermes_home=workspace_hermes_home)

def semantier_tools_list(*, workspace_hermes_home=None) -> dict:
    from agents.runtime_inventory import list_toolsets_inventory
    return list_toolsets_inventory(workspace_hermes_home=workspace_hermes_home)
```

These helpers are used by:

- New tests (avoid CLI argv parsing).
- `webapi_gateway.py` routes (already direct; align naming).
- Any Semantier wrapper code that currently calls `run_hermes_cli(["skills", "list"])` programmatically.

Rationale: intercepting common commands inside `run_hermes_cli` would create CLI behavior drift (output formatting, profile context, upstream defaults). Separating the contracts is safer.

### 5.3 Refactor `run_agent_cli`

Instead of `_run_with_argv(run_agent_main, [...])`, provide a direct entry point:

```python
def run_agent_query(query: str, *, session_id: str | None = None) -> int:
    from run_agent import main as run_agent_main
    argv = ["semantier-agent", "--query", query]
    if session_id:
        argv.extend(["--session", session_id])
    return _run_with_argv(run_agent_main, argv)
```

Longer term, bypass `run_agent.main` entirely and use `AIAgent.run_conversation()`.

### 5.4 `run_bootstrap_cli` — out of scope

`run_bootstrap_cli` continues to use `subprocess.run(["bash", "bootstrap/bootstrap.sh"])`. Porting the shell script to Python is tracked in a separate follow-up plan.

No changes to `run_bootstrap_cli` in this plan except documentation updates.

### 5.5 Refactor `run_gateway_cli` — extract pre-run orchestration first

Do **not** call `GatewayRunner` directly in Phase 2. Instead:

1. Extract gateway pre-run orchestration from `run_hermes_cli(["gateway", "run", ...])` into reusable helpers:

   ```python
   def _prepare_gateway_env(runtime_root: Path) -> None:
       # Ensure HERMES_HOME / SEMANTIER_AUTH_DB_PATH / SEMANTIER_LOCAL_STATE_DIR
       # Mirror launcher.py env hydration logic
       ...

   def _ensure_gateway_pairing_store(runtime_root: Path) -> None:
       # Prepare pairing directory and auth db binding
       ...
   ```

2. Update `run_hermes_cli` gateway path to use these helpers, preserving exact current behavior.

3. Add unit tests for each helper.

4. Only after helpers are stable and tested, consider a future phase that calls `GatewayRunner` directly — and even then, keep one subprocess E2E test.

Rationale: current gateway path does more than delegation (env hydration, auth DB binding, replace-time process termination, routing normalization). Direct `GatewayRunner` call would skip these unless explicitly reimplemented.

### 5.6 Update `src/agents/__main__.py`

Keep module entry points routing through the CLI helpers for now. Once gateway orchestration helpers exist, `__main__.py` can reuse them for `python -m semantier.agents gateway run`.

---

## 6. Files to Modify

| File | Change |
|---|---|
| `src/agents/launcher.py` | Add direct API helpers; add fast paths; keep CLI delegation fallback |
| `src/agents/__main__.py` | Possibly route to helpers |
| `src/agents/runtime_inventory.py` | Already direct; maybe expose higher-level convenience functions |
| `src/agents/webapi_gateway.py` | Already direct; align helper naming with launcher |
| `tests/test_agents_launcher.py` | Add tests for direct API helpers; keep CLI compatibility tests |
| `tests/test_runtime_inventory.py` (or new) | Add unit tests for `list_skills/plugins/tools` helpers |
| `scripts/gateway_readiness.py` | Replace subprocess health check with `httpx` |
| `bootstrap/bootstrap.sh` | Document as legacy; eventually deprecate after Python port |
| `how-to-run.md` | Document both CLI and Python API usage |
| `docs/courseware/AI_Agents_Workshop_Courseware.md` | Update labs to show Python API alternatives |

---

## 7. Tests to Add/Update

### 7.1 New tests

- `test_list_skills_api_returns_dict_not_cli_output`
- `test_list_plugins_api_returns_dict`
- `test_list_tools_api_returns_dict`
- `test_run_agent_query_direct_api`
- `test_bootstrap_direct_api_dry_run_matches_shell_script`

### 7.2 Existing tests to keep

- CLI compatibility tests in `tests/test_agents_launcher.py` should remain to guarantee the CLI contract.
- Process lifecycle tests can remain subprocess-based where process isolation is intentional.

---

## 8. Courseware Updates

Update `docs/courseware/AI_Agents_Workshop_Courseware.md`:

- **前置说明 / 实验依赖说明**: explicitly distinguish CLI vs. direct Python API.
- **L0**: already added Python API alternatives; extend to show `list_plugins()` and `list_tools()` helpers.
- **L1**: mention that `semantier run --replace` starts a server; for programmatic use, call `run_runtime_cli()` or `uvicorn.run()` directly.
- **L4**: document that `semantier bootstrap --replace` remains a subprocess call to `bootstrap/bootstrap.sh` in this plan; the shell-to-Python port is tracked separately.
- **L9/L11**: explain that pytest tests are direct Python API usage.

Add a new short section: **“什么时候用 CLI，什么时候用 Python API”**.

---

## 9. Phases

### Phase 1: Inventory and helpers (1–2 days)

- Finish full inventory of all `subprocess.run` calls in tests/scripts and classify each as "keep subprocess" or "migrate to API".
- Add `semantier_skills_list`, `semantier_plugins_list`, `semantier_tools_list` helpers in `launcher.py`.
- Keep `run_hermes_cli` as pure passthrough.
- Add unit tests for helpers.
- Update courseware L0.

### Phase 2: Agent and gateway orchestration helpers (2–3 days)

- Refactor `run_agent_cli` to expose `run_agent_query()` helper.
- Extract gateway pre-run orchestration helpers from `run_hermes_cli(["gateway", "run", ...])`.
- Add tests for each helper.
- Update courseware relevant labs.
- **Do not** call `GatewayRunner` directly in this phase.

### Phase 3: Cleanup and test migration (2–3 days)

- Migrate eligible subprocess tests to direct API helpers.
- Split `scripts/gateway_readiness.py` into HTTP readiness check + CLI bridge readiness check.
- Audit remaining `subprocess.run` calls and document why each remains.
- Final docs/courseware pass.

### Follow-up Plan (separate)

- Port `bootstrap/bootstrap.sh` to Python: `docs/plans/YYYY-MM-DD-bootstrap-shell-to-python.md`.

---

## 10. Risks and Considerations

1. **CLI contract drift**: Hermes CLI does more than the bare API (profile switching, TUI, output formatting). We avoid this by keeping `run_hermes_cli` as a pure passthrough and exposing separate programmatic helpers.
2. **Hermes home context**: Many Hermes APIs depend on `HERMES_HOME` / active Hermes home. Direct API callers must set context explicitly (use `bind_workspace_env`).
3. **Upstream API stability**: Hermes internal APIs (`tools.skills_tool._find_all_skills`) are not guaranteed stable. Prefer higher-level `hermes_cli.*` functions or Semantier `runtime_inventory` helpers when possible.
4. **Process isolation**: Some tests intentionally use subprocess to test process ownership, signal handling, port binding. These must remain subprocess and be explicitly documented.
5. **Gateway orchestration**: Direct `GatewayRunner` call risks skipping env hydration, auth DB binding, and termination logic. Defer until pre-run orchestration is fully extracted and tested.

---

## 11. Quick Reference: CLI Command → Python API

| CLI Command | Direct Python API / Function |
|---|---|
| `semantier skills list` | `semantier_skills_list()` → `runtime_inventory.list_skills_inventory()` |
| `semantier skills install <id>` | `hermes_cli.skills_hub.do_install(identifier, ...)` (web API already uses this) |
| `semantier skills uninstall <name>` | `tools.skills_hub.uninstall_skill(name)` |
| `semantier skills enable/disable` | `hermes_cli.skills_config.get_disabled_skills()` + `save_disabled_skills()` |
| `semantier tools list` | `semantier_tools_list()` → `runtime_inventory.list_toolsets_inventory()` |
| `semantier plugins list` | `semantier_plugins_list()` → `runtime_inventory.list_plugins_inventory()` |
| `semantier status` | Keep CLI; programmatic callers use inventory helpers |
| `semantier gateway run` | Keep CLI; Phase 2 extracts pre-run orchestration helpers only |
| `semantier-agent --query=...` | `run_agent_query(query=...)` → `run_agent.main()` with kwargs |
| `semantier bootstrap --replace` | **Out of scope** — remains subprocess shell script |
| `semantier run --replace` | `run_runtime_cli(["--replace"])` — already direct enough |

---

## 13. Key Questions Answered

| # | Question | Decision |
|---|---|---|
| 1 | Should bootstrap migration be in-scope now or moved to a follow-up plan? | **Moved to a separate follow-up plan.** `run_bootstrap_cli` keeps using `subprocess.run(["bash", "bootstrap/bootstrap.sh"])` in this plan. |
| 2 | Should `run_hermes_cli` remain compatibility-first with new helpers separate, or fast-path common commands? | **`run_hermes_cli` remains compatibility-first / pure passthrough.** New programmatic helpers (`semantier_skills_list`, etc.) are exposed separately. |
| 3 | Should Phase 2 directly call `GatewayRunner` or only extract orchestration first? | **Phase 2 limits itself to extracting and testing pre-run orchestration helpers.** Direct `GatewayRunner` call is deferred until a future phase. |
| 4 | Which subprocess tests must remain process-isolated? | Tests for runtime ownership/replacement, gateway signal handling, bootstrap shell execution, and at least one E2E CLI bridge test per major command. All others migrate to API-level tests. |
| 5 | Should `gateway_readiness` keep CLI bridge checks? | **Yes.** Split into (a) HTTP readiness check using `httpx`, and (b) CLI bridge readiness check kept as subprocess. |
| 6 | Should each phase have a formal acceptance checklist tied to architecture laws? | **Yes.** See Section 14. |

---

## 14. Phase Acceptance Checklist

Every phase must satisfy the following before merging:

### Architecture Law Compliance

- [ ] **Identity authority**: no new code resolves identity from LLM memory or transport metadata; governed auth sources remain authoritative.
- [ ] **Deterministic replay**: no new code introduces non-deterministic side effects in programmatic API paths; required artifact hashes/pins are preserved.
- [ ] **Prompt boundary**: prompt prose remains in `src/prompts/` or `SKILL.md`; no inline prompt prose in new launcher helpers.
- [ ] **Workspace isolation**: helpers that touch filesystem use `bind_workspace_env` or equivalent; no global cwd/`HERMES_HOME` mutations.
- [ ] **UTC timestamps**: any new persisted timestamps use timezone-aware UTC ISO-8601.

### Test Requirements

- [ ] New helpers have unit tests with mocked dependencies.
- [ ] CLI compatibility tests still pass without modification.
- [ ] At least one subprocess E2E test remains for each command that intentionally spans process boundaries.
- [ ] `pytest tests/test_agents_launcher.py` passes.

### Documentation/Courseware

- [ ] `how-to-run.md` updated if CLI behavior changes.
- [ ] `docs/courseware/AI_Agents_Workshop_Courseware.md` updated for affected labs.
- [ ] New helpers added to Appendix A core file index if they become stable public API.

---

## 15. Appendix: Exact CLI Delegation Locations

```text
src/agents/launcher.py:82    def _run_with_argv(entrypoint, argv)
src/agents/launcher.py:1006  def run_agent_cli(argv)
src/agents/launcher.py:1014  _run_with_argv(hermes_agent_main, agent_argv)
src/agents/launcher.py:1017  def run_gateway_cli(argv)
src/agents/launcher.py:1028  run_hermes_cli(["gateway", *raw_args], ...)
src/agents/launcher.py:1035  def run_runtime_cli(argv)
src/agents/launcher.py:1087  def run_hermes_cli(argv)
src/agents/launcher.py:1109  run_bootstrap_cli(raw_args[1:], ...)
src/agents/launcher.py:1113  run_runtime_cli(raw_args[1:], ...)
src/agents/launcher.py:1154  _run_with_argv(hermes_main, hermes_argv)
src/agents/launcher.py:1157  def run_bootstrap_cli(argv)
src/agents/launcher.py:1187  subprocess.run(cmd, cwd=repo_root)  # bootstrap.sh
src/agents/launcher.py:1215  _run_with_argv(dataset_cli_main, ...)
src/agents/__main__.py:30    return run_gateway_cli(extra_args)
src/agents/__main__.py:31    return run_agent_cli(extra_args)
```

---

*Next step: review and approve this plan, then implement Phase 1.*
