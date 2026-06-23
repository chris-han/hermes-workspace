# Session-Scoped Sandbox Governance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** Implemented and verified; uncommitted
**Authority:** Operational / design / historical layer
**Scope:** Implementation plan for governed sandbox scoping across Semantier core, embedded Hermes API transport, and Hermes terminal execution
**Upstream sources:**
- `docs/canonical/architecture.md`
- `docs/canonical/document-authority-and-versioning.md`
- `docs/derived/gateway-unified-multitenant-design.md`
- `docs/derived/knowledge_tier_implementation_spec.md`
**Supersedes:** None

**Goal:** Replace the current process-wide default terminal sandbox sharing with Semantier-governed execution-lane-scoped sandbox selection and lifecycle controls, without moving semantic authority into Hermes glue.

## Completion Snapshot

- Implemented in the current uncommitted diff:
  - Semantier-owned sandbox scope contract (`src/agents/sandbox_scope.py`)
  - Interactive scope propagation through Semantier web/wrapper paths
  - Hermes API/header handling plus ContextVar-first terminal scope resolution
  - Background-task sandbox inheritance
  - Cron/job-run sandbox derivation when workspace authority is resolvable
  - Scoped sandbox lifecycle rotation metadata and cleanup guards
  - Canonical and derived doc updates for sandbox scope and transport contract
- Still incomplete in the current uncommitted diff:
  - Commit steps
- Verification snapshot:
  - `pytest tests/tools/test_shared_container_task_id.py tests/tools/test_terminal_sandbox_scope.py tests/cron/test_cron_workdir.py -v` in `hermes-agent`: PASS (`35 passed`)
  - `pytest tests/test_sandbox_scope.py tests/test_embedded_api_workspace_binding.py tests/test_hermes_api_compat.py -v` in repo root: PASS (`90 passed`)
  - `pytest tests/test_runtime_paths.py tests/test_gateway_identity.py tests/test_workspace_session_logs.py tests/test_gateway_runtime_enablement.py -v` in repo root: PASS (`60 passed`)

**Architecture:** Semantier core should resolve sandbox identity and policy from governed workspace plus execution-lane context, then pass a narrow execution contract into Hermes. Hermes remains the executor and enforcer of request-scoped or job-scoped sandbox selection, reuse, and cleanup, but it must not infer tenant authority on its own. Interactive sessions are keyed by canonical session ID, background tasks share the parent session sandbox, and cron jobs get a distinct sandbox keyed by `workspace_id + job_id + run timestamp`. The first delivery is Docker-backed; gVisor pool work stays as a later phase.

**Tech Stack:** Python, FastAPI, aiohttp, ContextVar, hermes-agent terminal tool, pytest

## Rollout Slices

### Slice 1: Per-User-Session Sandbox

Scope:
- Interactive web API sessions
- Embedded gateway/API requests
- Wrapper-driven interactive conversations
- Background tasks spawned from an interactive session

Sandbox key:
- `workspace_id + canonical_session_id`

Rules:
- Each interactive session gets its own sandbox.
- Background tasks reuse the parent session sandbox.
- No cron/job scope changes are required to complete this slice.

Success criteria:
- Code runs inside a sandbox scoped to one user session.
- Two concurrent sessions in the same workspace do not share the implicit `"default"` sandbox.
- Existing benchmark/override behavior still works when no Semantier scope is present.

### Slice 2: Per-Workspace-Job-Run Sandbox

Scope:
- Cron/scheduled job execution only

Sandbox key:
- `workspace_id + job_id + run timestamp`

Rules:
- Cron job runs get distinct sandboxes from interactive sessions and from each other.
- Scope is derived only when workspace authority is resolvable from the existing runtime path.
- If workspace authority cannot be resolved, the runtime must not invent tenant/workspace identity.

Success criteria:
- Scheduled jobs run inside distinct job-run sandboxes.
- A job run does not reuse a live interactive session sandbox.
- Multiple job runs for the same workspace/job at different times do not share the same sandbox key.

## Policy Decisions (locked)

The following policy choices are now fixed for the initial rollout and documented here as the canonical contract:

1. **Derivation authority — Semantier core only:** Semantier core MUST be the only component that derives or mints canonical sandbox scope. Hermes MUST NOT originate or invent sandbox keys. Hermes may only consume a bound sandbox scope provided via the in-process runtime ContextVar contract (see `agents.sandbox_scope.current_sandbox_key()`), or via a Semantier-owned forwarding header on trusted embedded gateway paths. Hermes may fall back to legacy behavior only when no Semantier scope is present, but that fallback MUST NOT invent or assert tenant/workspace identity.

2. **Allowed forwarders — Semantier-owned gateways/wrappers only:** Only Semantier-owned embedded gateways and wrappers are permitted to forward `X-Semantier-Sandbox-Key`. Third-party adapters must not mint or forward sandbox keys unless they are explicitly wrapped/mediated by Semantier code that resolves governed context first.

3. **Header trust model — internal-trust-first, sign-if-crossing-boundary:** For phase-1, the `X-Semantier-Sandbox-Key` header is accepted only on internal/embedded API paths (loopback or host-local) and treated strictly as an execution hint, never as an authorization source. If the header must cross process or host boundaries in future phases, the gateway MUST sign the header (HMAC or short-lived JWT) and Hermes MUST validate the signature (or defer validation to Semantier core) before treating the value as canonical.

- **Runtime contract:** The ContextVar/runtime accessor is authoritative in-process; `SEMANTIER_SANDBOX_KEY` in `os.environ` is allowed only for subprocess inheritance/legacy fallback.
- **Hermes behavior:** Hermes implementations (e.g., `hermes-agent/tools/terminal_tool.py`) MUST check the ContextVar getter first and use that value as the effective sandbox key. If no ContextVar is present, Hermes may consult the environment fallback. When an explicit Semantier scope is present, do not collapse it to the `"default"` shared sandbox.

---

## Review Summary

The pasted review is directionally correct, but it needs three corrections before implementation:

1. The main risk is real and already confirmed in repo code:
   - `hermes-agent/tools/terminal_tool.py` collapses most task IDs to `"default"`.
   - `hermes-agent/tests/tools/test_shared_container_task_id.py` locks in that shared-container behavior.

2. The implementation ownership in the pasted review is too Hermes-centric:
   - Under `docs/canonical/architecture.md`, scope and policy decisions that affect tenant isolation must be resolved from Semantier-governed context first.
   - Hermes should receive an explicit sandbox key/policy contract, not derive tenant/session authority from mutable runtime state.

3. The repo already has the right Semantier-side primitives to build on:
   - `src/runtime_paths.py` already carries request-scoped workspace bindings.
   - `src/agents/webapi_gateway.py` already resolves authenticated workspace and canonical session identity.
   - `hermes-agent/gateway/platforms/api_server.py` already accepts request-scoped workspace binding via `X-Semantier-Hermes-Home`.
   - `hermes-agent/gateway/run.py::_run_background_task` is already part of the canonical workspace-bound execution surface.
   - `hermes-agent/cron/scheduler.py::run_job` already establishes cron-specific execution state and must participate in sandbox scoping.

4. Documentation authority requires a split between canonical and derived updates:
   - Cross-runtime sandbox identity and authority boundaries belong in `docs/canonical/architecture.md`.
   - Gateway transport details such as request headers and embedded API forwarding belong in `docs/derived/gateway-unified-multitenant-design.md`.
   - This plan is an operational artifact and should be archived under `archive_doc/` after implementation is complete if it would otherwise remain as duplicate normative guidance.

5. The scope contract must mirror the repo’s existing ContextVar-first runtime design:
   - Context-local scope must be the primary in-process authority.
   - `os.environ` may be used only as subprocess inheritance / legacy fallback, matching the existing `bind_workspace_env` pattern in `architecture.md`.

## Scope

In scope:
- Execution-lane-scoped sandbox key derivation from governed Semantier context
- Request-scoped propagation into embedded Hermes API requests
- Background-task reuse of the parent session sandbox
- Cron-job scoping keyed by `workspace_id + job_id + run timestamp`
- Hermes terminal sandbox reuse keyed by explicit Semantier sandbox key
- Sandbox lifetime / command-count / post-network rotation controls
- Regression tests and doc updates

Out of scope for this plan:
- gVisor / `runsc` runtime rollout
- External sandbox-runner service
- Pooling/prewarming architecture

## Delivery Order

1. Complete Slice 1 first.
2. Validate interactive session sandboxing, background-task reuse, and lifecycle behavior.
3. Only then implement Slice 2 for cron/job execution.

## File Map

- Create: `src/agents/sandbox_scope.py`
- Create: `tests/test_sandbox_scope.py`
- Modify: `src/runtime_paths.py`
- Modify: `src/agents/hermes_embedded_gateway.py`
- Modify: `src/agents/webapi_gateway.py`
- Modify: `src/agents/semantier_agent.py`
- Modify: `hermes-agent/gateway/platforms/api_server.py`
- Modify: `hermes-agent/gateway/run.py`
- Modify: `hermes-agent/cron/scheduler.py`
- Modify: `hermes-agent/tools/terminal_tool.py`
- Modify: `hermes-agent/tests/tools/test_shared_container_task_id.py`
- Create: `hermes-agent/tests/tools/test_terminal_sandbox_scope.py`
- Create or Modify: `tests/test_embedded_gateway_service.py`
- Create or Modify: `tests/test_embedded_api_workspace_binding.py`
- Modify: `docs/canonical/architecture.md`
- Modify: `docs/derived/gateway-unified-multitenant-design.md`

### Task 1: Add Semantier-Owned Sandbox Scope Contract

**Files:**
- Create: `src/agents/sandbox_scope.py`
- Create: `tests/test_sandbox_scope.py`
- Modify: `src/runtime_paths.py`

- [x] **Step 1: Write failing tests for explicit sandbox scope derivation and binding**

```python
from pathlib import Path

from agents.sandbox_scope import (
    SandboxScope,
    bind_sandbox_scope,
    current_sandbox_scope,
    sandbox_key_for_request,
)


def test_sandbox_key_for_workspace_session_is_stable():
    scope = SandboxScope(
        workspace_id="ws-123",
        lane="interactive_session",
        scope_id="ws-123:sess-abc",
        adapter_key=None,
        network_enabled=False,
    )
    assert sandbox_key_for_request(scope) == "ws:ws-123:session:ws-123:sess-abc"


def test_sandbox_key_for_cron_run_is_distinct():
    scope = SandboxScope(
        workspace_id="ws-123",
        lane="cron_job_run",
        scope_id="job-42:20260603T120000Z",
        adapter_key=None,
        network_enabled=False,
    )
    assert sandbox_key_for_request(scope) == "ws:ws-123:cron:job-42:20260603T120000Z"


def test_bind_sandbox_scope_sets_and_restores_env(monkeypatch):
    monkeypatch.delenv("SEMANTIER_SANDBOX_KEY", raising=False)
    scope = SandboxScope(
        workspace_id="ws-123",
        lane="interactive_session",
        scope_id="ws-123:sess-abc",
        adapter_key="weixin:ws-123:acct-1",
        network_enabled=False,
    )
    with bind_sandbox_scope(scope):
        assert current_sandbox_scope().workspace_id == "ws-123"
        assert current_sandbox_scope().adapter_key == "weixin:ws-123:acct-1"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_sandbox_scope.py -v`
Expected: FAIL with `ModuleNotFoundError` for `agents.sandbox_scope`

- [x] **Step 3: Implement the scope model and request-local binding**

```python
from __future__ import annotations

import contextlib
import os
from contextvars import ContextVar, Token
from dataclasses import dataclass
from typing import Iterator, Optional

_SANDBOX_KEY_ENV = "SEMANTIER_SANDBOX_KEY"
_scope_ctx: ContextVar["SandboxScope | None"] = ContextVar("_semantier_sandbox_scope", default=None)


@dataclass(frozen=True)
class SandboxScope:
    workspace_id: str
    lane: str
    scope_id: str
    adapter_key: str | None
    network_enabled: bool


def sandbox_key_for_request(scope: SandboxScope) -> str:
    if scope.lane == "interactive_session":
        return f"ws:{scope.workspace_id}:session:{scope.scope_id}"
    if scope.lane == "cron_job_run":
        return f"ws:{scope.workspace_id}:cron:{scope.scope_id}"
    raise ValueError(f"unsupported sandbox scope lane: {scope.lane}")


def current_sandbox_scope() -> SandboxScope | None:
    return _scope_ctx.get()


def current_sandbox_key() -> str | None:
    scope = current_sandbox_scope()
    if scope is not None:
        return sandbox_key_for_request(scope)
    raw = os.environ.get(_SANDBOX_KEY_ENV)
    return raw.strip() if raw and raw.strip() else None


@contextlib.contextmanager
def bind_sandbox_scope(scope: SandboxScope | None) -> Iterator[None]:
    if scope is None:
        yield
        return
    key = sandbox_key_for_request(scope)
    prev = os.environ.get(_SANDBOX_KEY_ENV)
    os.environ[_SANDBOX_KEY_ENV] = key
    token: Token = _scope_ctx.set(scope)
    try:
        yield
    finally:
        _scope_ctx.reset(token)
        if prev is None:
            os.environ.pop(_SANDBOX_KEY_ENV, None)
        else:
            os.environ[_SANDBOX_KEY_ENV] = prev
```

- [x] **Step 4: Extend runtime path tests to prove sandbox binding composes with workspace binding**

```python
def test_workspace_and_sandbox_bindings_can_nest(monkeypatch, tmp_path):
    from agents.sandbox_scope import SandboxScope, bind_sandbox_scope, current_sandbox_scope
    from runtime_paths import bind_workspace_env, workspace_hermes_home_path

    monkeypatch.setenv("SEMANTIER_LOCAL_STATE_DIR", str(tmp_path / ".semantier-home"))
    home = workspace_hermes_home_path("ws-123")
    scope = SandboxScope("ws-123", "ws-123:sess-abc", None, False)

    with bind_workspace_env(home):
        with bind_sandbox_scope(scope):
            assert current_sandbox_scope().scope_id == "ws-123:sess-abc"
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pytest tests/test_sandbox_scope.py tests/test_runtime_paths.py -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/agents/sandbox_scope.py tests/test_sandbox_scope.py tests/test_runtime_paths.py
git commit -m "feat: add governed sandbox scope contract"
```

### Task 2: Propagate Interactive Scope Through Semantier Web, Wrapper, and Embedded Gateway Paths

**Files:**
- Modify: `src/agents/hermes_embedded_gateway.py`
- Modify: `src/agents/webapi_gateway.py`
- Modify: `src/agents/semantier_agent.py`
- Modify: `tests/test_embedded_api_workspace_binding.py`
- Modify: `tests/test_embedded_gateway_service.py`

- [x] **Step 1: Write failing tests for request header propagation**

```python
async def test_post_embedded_chat_completion_forwards_sandbox_key(monkeypatch, tmp_path):
    seen = {}

    class FakeClient:
        async def post(self, url, headers, json):
            seen["sandbox_key"] = headers.get("X-Semantier-Sandbox-Key")
            return FakeResponse.ok()

    assert seen["sandbox_key"] == "ws:ws-123:session:ws-123:sess-abc"
```

- [ ] **Step 2: Run targeted tests to verify failure**

Run: `pytest tests/test_embedded_api_workspace_binding.py -v`
Expected: FAIL because the new header is not forwarded

- [x] **Step 3: Bind scope from governed request context and forward it**

```python
from agents.sandbox_scope import SandboxScope, bind_sandbox_scope, sandbox_key_for_request

scope = SandboxScope(
    workspace_id=ctx.workspace_id,
    lane="interactive_session",
    scope_id=session_id,
    adapter_key=None,
    network_enabled=False,
)
with bind_sandbox_scope(scope):
    headers["X-Semantier-Sandbox-Key"] = sandbox_key_for_request(scope)
    upstream_response = await client.post(...)
```

- [x] **Step 4: Cover direct wrapper path so non-web calls do not regress**

```python
def run_conversation(self, prompt: str, *, hermes_home: Path | None = None, session_id: str | None = None):
    scope = None
    workspace_id = _workspace_id_from_hermes_home(target_home)
    if workspace_id and session_id:
        scope = SandboxScope(
            workspace_id=workspace_id,
            lane="interactive_session",
            scope_id=session_id,
            adapter_key=None,
            network_enabled=False,
        )
    with _hermes_home_bound(target_home):
        with bind_sandbox_scope(scope):
            return agent.run_conversation(...)
```

- [x] **Step 5: Bind interactive scope in embedded gateway request surfaces too**

```python
scope = SandboxScope(
    workspace_id=workspace_id,
    lane="interactive_session",
    scope_id=session_id,
    adapter_key=runtime_key if runtime_key else None,
    network_enabled=False,
)
with bind_workspace_env(target_home):
    with bind_sandbox_scope(scope):
        ...
```

- [ ] **Step 6: Run tests to verify propagation works**

Run: `pytest tests/test_embedded_api_workspace_binding.py tests/test_sandbox_scope.py -v`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/agents/hermes_embedded_gateway.py src/agents/webapi_gateway.py src/agents/semantier_agent.py tests/test_embedded_api_workspace_binding.py tests/test_embedded_gateway_service.py
git commit -m "feat: propagate sandbox scope into embedded hermes requests"
```

### Task 3: Teach Hermes API Server and Terminal Tool to Honor Explicit Scope Without Breaking ContextVar Isolation

**Files:**
- Modify: `hermes-agent/gateway/platforms/api_server.py`
- Modify: `hermes-agent/tools/terminal_tool.py`
- Modify: `hermes-agent/tests/tools/test_shared_container_task_id.py`
- Create: `hermes-agent/tests/tools/test_terminal_sandbox_scope.py`

- [x] **Step 1: Write failing Hermes tests for explicit sandbox key preservation**

```python
def test_explicit_semantier_sandbox_key_does_not_collapse(monkeypatch):
    monkeypatch.setenv("SEMANTIER_SANDBOX_KEY", "ws:ws-123:session:ws-123:sess-abc")
    assert terminal_tool._resolve_container_task_id("subagent-0-deadbeef") == "ws:ws-123:session:ws-123:sess-abc"


def test_default_behavior_still_collapses_without_scope(monkeypatch):
    monkeypatch.delenv("SEMANTIER_SANDBOX_KEY", raising=False)
    assert terminal_tool._resolve_container_task_id("subagent-0-deadbeef") == "default"
```

- [ ] **Step 2: Run the failing hermes-agent tests**

Run: `pytest hermes-agent/tests/tools/test_shared_container_task_id.py hermes-agent/tests/tools/test_terminal_sandbox_scope.py -v`
Expected: FAIL because `SEMANTIER_SANDBOX_KEY` is ignored

- [x] **Step 3: Accept a request-scoped sandbox header in the Hermes API server as a transport input**

```python
_SEMANTIER_SANDBOX_KEY_HEADER = "X-Semantier-Sandbox-Key"

@contextlib.contextmanager
def _bound_request_sandbox_key(raw_key: str | None):
    value = (raw_key or "").strip()
    if not value:
        yield
        return
    prev = os.environ.get("SEMANTIER_SANDBOX_KEY")
    os.environ["SEMANTIER_SANDBOX_KEY"] = value
    try:
        yield
    finally:
        if prev is None:
            os.environ.pop("SEMANTIER_SANDBOX_KEY", None)
        else:
            os.environ["SEMANTIER_SANDBOX_KEY"] = prev
```

- [x] **Step 4: Add a ContextVar-first getter inside `terminal_tool.py` instead of using raw `os.getenv()` as the primary source**

```python
from agents.sandbox_scope import current_sandbox_key


def _resolve_container_task_id(task_id: Optional[str]) -> str:
    explicit_scope = current_sandbox_key()
    if explicit_scope:
        return explicit_scope
    if task_id in _task_env_overrides:
        return task_id
    return "default"
```

- [x] **Step 5: Keep legacy benchmark/override behavior intact**

```python
def test_rl_override_wins_when_no_semantier_scope():
    terminal_tool.register_task_env_overrides("rl-42", {"docker_image": "x"})
    try:
        assert terminal_tool._resolve_container_task_id("rl-42") == "rl-42"
    finally:
        terminal_tool.clear_task_env_overrides("rl-42")
```

- [x] **Step 6: Run Hermes tests to verify both scoped and legacy behavior**

Run: `pytest hermes-agent/tests/tools/test_shared_container_task_id.py hermes-agent/tests/tools/test_terminal_sandbox_scope.py -v`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add hermes-agent/gateway/platforms/api_server.py hermes-agent/tools/terminal_tool.py hermes-agent/tests/tools/test_shared_container_task_id.py hermes-agent/tests/tools/test_terminal_sandbox_scope.py
git commit -m "feat: honor semantier sandbox scope in hermes terminal runtime"
```

### Task 4: Wire Background Tasks into the Sandbox Scope Contract (Slice 1)

**Files:**
- Modify: `hermes-agent/gateway/run.py`
- Create or Modify: `tests/test_embedded_gateway_service.py`
- Create or Modify: `tests/test_sandbox_scope.py`
- Create or Modify: `hermes-agent/tests/tools/test_terminal_sandbox_scope.py`

- [x] **Step 1: Write failing tests for background-task scoping**

```python
def test_background_task_shares_parent_session_scope():
    parent = SandboxScope(
        workspace_id="ws-123",
        lane="interactive_session",
        scope_id="ws-123:sess-abc",
        adapter_key=None,
        network_enabled=False,
    )
    assert child_background_scope(parent) == parent
```

- [ ] **Step 2: Run tests to confirm failure**

Run: `pytest tests/test_sandbox_scope.py tests/test_embedded_gateway_service.py hermes-agent/tests/tools/test_terminal_sandbox_scope.py -v`
Expected: FAIL because background scope helpers do not exist yet

- [x] **Step 3: Make `_run_background_task` inherit the parent interactive session sandbox**

```python
parent_scope = current_sandbox_scope()
with bind_sandbox_scope(parent_scope):
    result = run_sync(...)
```

This is intentionally reuse, not a new child scope. Background task execution should stay inside the parent session sandbox unless a later contract explicitly says otherwise.

- [ ] **Step 4: Run focused regression coverage**

Run: `pytest tests/test_sandbox_scope.py tests/test_embedded_gateway_service.py hermes-agent/tests/tools/test_terminal_sandbox_scope.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add hermes-agent/gateway/run.py tests/test_sandbox_scope.py tests/test_embedded_gateway_service.py hermes-agent/tests/tools/test_terminal_sandbox_scope.py
git commit -m "feat: scope background sandbox execution"
```

### Task 5: Add Lifecycle Guards for Isolation Durability (Slice 1)

**Files:**
- Modify: `hermes-agent/tools/terminal_tool.py`
- Modify: `hermes-agent/tools/environments/docker.py`
- Create or Modify: `hermes-agent/tests/tools/test_terminal_sandbox_scope.py`
- Modify: `docs/canonical/architecture.md`
- Modify: `docs/derived/gateway-unified-multitenant-design.md`

- [x] **Step 1: Write failing tests for sandbox rotation policies**

```python
def test_cleanup_rotates_scoped_env_after_max_commands(monkeypatch):
    monkeypatch.setenv("TERMINAL_MAX_SANDBOX_COMMANDS", "3")
    # seed active env metadata with command_count=3 and expect cleanup_vm(...)


def test_cleanup_rotates_scoped_env_after_network_enabled_task(monkeypatch):
    monkeypatch.setenv("TERMINAL_ROTATE_AFTER_NETWORK_TASK", "true")
    # mark env metadata network_used=True and expect cleanup on next pass
```

- [ ] **Step 2: Run the lifecycle tests to confirm they fail**

Run: `pytest hermes-agent/tests/tools/test_terminal_sandbox_scope.py -v`
Expected: FAIL because no rotation metadata exists yet

- [x] **Step 3: Track metadata per active environment**

```python
_active_environment_meta: Dict[str, Dict[str, Any]] = {}

meta = _active_environment_meta.setdefault(
    effective_task_id,
    {"created_at": time.time(), "command_count": 0, "network_used": False},
)
meta["command_count"] += 1
meta["network_used"] = meta["network_used"] or bool(config.get("network"))
```

- [x] **Step 4: Enforce cleanup during idle reaper / command dispatch**

```python
if meta["command_count"] >= config["max_sandbox_commands"]:
    cleanup_vm(task_id)
elif config["rotate_after_network_task"] and meta["network_used"]:
    cleanup_vm(task_id)
elif (time.time() - meta["created_at"]) >= config["max_sandbox_lifetime_seconds"]:
    cleanup_vm(task_id)
```

- [x] **Step 5: Document the canonical runtime contract change in the right layer**

```markdown
### Sandbox Scope Contract

- Semantier resolves sandbox identity from governed workspace + execution-lane context.
- Hermes receives `X-Semantier-Sandbox-Key` as an execution hint only.
- Tenant authority remains governed by Semantier auth/session resolution, not Hermes runtime files.
```

Add that language to `docs/canonical/architecture.md`, near the existing boundary and identity rules, because it defines current runtime truth across components rather than only a gateway specialization.

- [x] **Step 6: Document only gateway-specific transport details in the derived doc**

```markdown
### Embedded Hermes Sandbox Header

- `X-Semantier-Sandbox-Key` is forwarded only by Semantier-owned embedded gateway/API paths.
- The header carries a Semantier-resolved sandbox key derived from governed workspace and execution-lane context.
- The header is an execution-scoping mechanism, not an authority source.
```

- [x] **Step 7: Run focused regression coverage**

Run: `pytest tests/test_sandbox_scope.py tests/test_embedded_api_workspace_binding.py hermes-agent/tests/tools/test_shared_container_task_id.py hermes-agent/tests/tools/test_terminal_sandbox_scope.py -v`
Expected: PASS

- [x] **Step 8: Run broader gateway/runtime regression coverage**

Run: `pytest tests/test_runtime_paths.py tests/test_gateway_identity.py tests/test_workspace_session_logs.py tests/test_gateway_runtime_enablement.py -v`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add hermes-agent/tools/terminal_tool.py hermes-agent/tools/environments/docker.py hermes-agent/tests/tools/test_terminal_sandbox_scope.py docs/canonical/architecture.md docs/derived/gateway-unified-multitenant-design.md
git commit -m "feat: add sandbox lifecycle governance and docs"
```

### Task 6: Wire Cron/Job Runs into the Sandbox Scope Contract (Slice 2)

**Files:**
- Modify: `hermes-agent/cron/scheduler.py`
- Create or Modify: `tests/test_sandbox_scope.py`
- Create or Modify: `hermes-agent/tests/tools/test_terminal_sandbox_scope.py`
- Modify: `docs/canonical/architecture.md`
- Modify: `docs/derived/gateway-unified-multitenant-design.md`

- [x] **Step 1: Write failing tests for cron scoping**

```python
def test_cron_scope_uses_workspace_job_and_timestamp():
    scope = cron_job_scope(
        workspace_id="ws-123",
        job_id="job-42",
        run_timestamp_utc="20260603T120000Z",
    )
    assert sandbox_key_for_request(scope) == "ws:ws-123:cron:job-42:20260603T120000Z"


def test_cron_scope_not_derived_without_workspace_authority():
    assert cron_job_scope_if_resolvable(workdir=None, job_id="job-42", run_timestamp_utc="20260603T120000Z") is None
```

- [ ] **Step 2: Run tests to confirm failure**

Run: `pytest tests/test_sandbox_scope.py hermes-agent/tests/tools/test_terminal_sandbox_scope.py -v`
Expected: FAIL because cron scope helpers do not exist yet

- [x] **Step 3: Make cron derive its own distinct sandbox scope**

```python
scope = SandboxScope(
    workspace_id=derived_workspace_id,
    lane="cron_job_run",
    scope_id=f"{job_id}:{run_timestamp_utc}",
    adapter_key=None,
    network_enabled=False,
)
with bind_sandbox_scope(scope):
    ...
```

- [x] **Step 4: Derive cron `workspace_id` from the same authority path already used for workspace artifact routing**

```python
def _workspace_id_from_job_workdir(job_workdir: str | None) -> str | None:
    # resolve only when workdir is inside workspaces/<id>/...
```

If no workspace can be resolved, cron should not invent tenant identity. It should run without a scoped sandbox key and fall back to existing non-workspace behavior.

- [x] **Step 5: Run focused regression coverage**

Run: `pytest tests/test_sandbox_scope.py hermes-agent/tests/tools/test_terminal_sandbox_scope.py -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add hermes-agent/cron/scheduler.py tests/test_sandbox_scope.py hermes-agent/tests/tools/test_terminal_sandbox_scope.py docs/canonical/architecture.md docs/derived/gateway-unified-multitenant-design.md
git commit -m "feat: scope cron job-run sandbox execution"
```

## Acceptance Criteria

- Requests from different Semantier workspaces or canonical sessions no longer share the implicit `"default"` terminal sandbox.
- Background tasks reuse the parent session sandbox by contract.
- Cron jobs use a distinct sandbox key derived from `workspace_id + job_id + run timestamp` when workspace authority is resolvable.
- Sandbox identity is derived from governed request/session context in Semantier core, not inferred inside Hermes.
- Existing workspace binding via `X-Semantier-Hermes-Home` continues to work.
- Benchmark / RL override behavior still works when no Semantier scope is present.
- Lifecycle rotation is deterministic and test-covered.
- No replay/audit path gains a live runtime dependency.

## Risks and Notes

- Do not key sandbox scope from user-provided friendly session labels; use canonical session IDs only.
- Do not key cron scope from delivery origin metadata alone; derive workspace identity only from established workspace authority paths already used by the runtime.
- Do not store sandbox authority in mutable workspace cache files.
- Keep timestamps for any new Semantier artifacts in UTC ISO-8601.
- Defer gVisor, pooling, and external sandbox-runner design until the scoped Docker path is verified in production.
- After implementation lands, move this plan to `archive_doc/` if keeping it in active docs would duplicate the now-canonical contract language.

## Slice Acceptance

Slice 1 is complete when:
- Interactive sessions run code in session-scoped sandboxes.
- Background tasks reuse the parent session sandbox.
- No cron/job code path changes are required for that release.

Slice 2 is complete when:
- Workspace-scoped cron/job runs execute in distinct job-run sandboxes.
- Cron never invents workspace identity when authority is not resolvable.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-03-session-scoped-sandbox-governance.md`. Two execution options:

1. Subagent-Driven (recommended) - I dispatch a fresh subagent per task, review between tasks, fast iteration
2. Inline Execution - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
