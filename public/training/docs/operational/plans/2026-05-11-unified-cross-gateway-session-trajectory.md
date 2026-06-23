# Unified Cross-Gateway Session Trajectory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make web, Weixin, and Feishu continue the same canonical workspace session and append every turn into the same per-session trajectory file under `.hermes/sessions`, with gateway metadata recorded per turn.

**Architecture:** Keep `workspaces/<workspace_id>/.hermes/sessions/` as the single canonical session artifact root. Treat `SessionDB` as an execution cache/index only, hydrate it from canonical session artifacts when needed, and let canonical artifacts win on any disagreement. Replace global trajectory files with a session-scoped sink that appends derived turn records to `session_<file_key>.trajectory.jsonl`, where `file_key` is a filesystem-safe encoding of `session_id`. Normalize gateway entrypoints so transport-specific IDs resolve to one canonical `session_id` before calling `AIAgent`, using deterministic precedence: `platform_session_key`, then `chat_id + thread_id`, then `chat_id + origin_user_id`, then `chat_id`, then `origin_user_id`.

**Tech Stack:** Python 3.12, FastAPI wrapper, Hermes `AIAgent`, Hermes gateway adapters, JSON/JSONL workspace artifacts, pytest

---

## File Structure

**Modify**
- `src/agents/workspace_session_logs.py`
  Responsible for canonical workspace session artifacts under `.hermes/sessions/`, plus new helpers for canonical session ID resolution and session-scoped trajectory appends.
- `src/agents/webapi_gateway.py`
  Responsible for web session routing, workspace-aware DB hydration, and passing canonical session/gateway metadata into the embedded Hermes API path.
- `src/agents/weixin_ingress_identity.py`
  Responsible for mapping inbound Weixin transport identity to owner/workspace context and canonical session resolution inputs.
- `src/agents/gateway_identity.py`
  Responsible for persisted owner/workspace correlation fields if canonical cross-gateway session mapping needs additional stable metadata.
- `src/eos/hermes_client.py`
  If needed, keep direct Semantier agent calls aligned with the same session/trajectory semantics.
- `hermes-agent/agent/trajectory.py`
  Replace global `trajectory_samples.jsonl` / `failed_trajectories.jsonl` assumptions with a pluggable session-scoped sink helper.
- `hermes-agent/run_agent.py`
  Emit per-turn derived trajectory records with gateway metadata into the workspace session root instead of global files.
- `hermes-agent/gateway/platforms/api_server.py`
  Ensure embedded/web API requests pass stable canonical session and gateway metadata into `AIAgent`; enable session-scoped trajectory emission.
- `hermes-agent/gateway/run.py`
  Ensure main gateway runner resolves the same canonical session ID across channels and passes trajectory metadata on every turn.
- `hermes-agent/gateway/platforms/feishu_comment.py`
  Stop using isolated per-comment history persistence for unified session/trajectory paths; route through canonical session resolution.
- `docs/derived/gateway-unified-multitenant-design.md`
  Final doc touch-up if implementation details drift from the reviewed contract.

**Create**
- `tests/test_workspace_session_logs.py`
  Unit coverage for canonical session resolution and session trajectory append behavior.
- `tests/test_cross_gateway_session_trajectory.py`
  Integration coverage for same-session continuation across web/Weixin/Feishu metadata inputs.

**Existing tests to modify**
- `tests/test_hermes_api_compat.py`
  Web wrapper regressions for canonical session reuse and trajectory sink behavior.
- `tests/test_gateway_identity.py`
  Correlation persistence coverage if owner/session metadata shape changes.
- `hermes-agent/tests/gateway/test_api_server.py`
  Embedded API path coverage for canonical session reuse and trajectory metadata propagation.
- `hermes-agent/tests/gateway/test_agent_cache.py`
  Cached-agent session continuity expectations if canonical session resolution changes.

---

### Task 1: Add Canonical Session + Trajectory Helpers

**Files:**
- Modify: `src/agents/workspace_session_logs.py`
- Test: `tests/test_workspace_session_logs.py`

- [ ] **Step 1: Write the failing tests for session-scoped trajectory append and canonical session resolution**

```python
from pathlib import Path

from agents.workspace_session_logs import (
    append_workspace_session_trajectory,
    create_workspace_session_log,
    list_workspace_session_trajectory,
    resolve_workspace_session_id,
)


def test_append_workspace_session_trajectory_uses_same_file_for_multiple_gateways(tmp_path):
    hermes_home = tmp_path / ".hermes"
    create_workspace_session_log(
        hermes_home,
        session_id="ws-123:session_abc",
        title="Demo",
        source="api_server",
        platform="webchat",
    )

    append_workspace_session_trajectory(
        hermes_home,
        session_id="ws-123:session_abc",
        record={
            "workspace_id": "ws-123",
            "session_id": "ws-123:session_abc",
            "source_gateway": "web",
            "platform_session_key": None,
            "completed": True,
            "trajectory": [{"from": "user", "value": "hello"}],
        },
    )
    append_workspace_session_trajectory(
        hermes_home,
        session_id="ws-123:session_abc",
        record={
            "workspace_id": "ws-123",
            "session_id": "ws-123:session_abc",
            "source_gateway": "weixin",
            "platform_session_key": "wx:dm:o123",
            "completed": True,
            "trajectory": [{"from": "user", "value": "follow up"}],
        },
    )

    rows = list_workspace_session_trajectory(hermes_home, "ws-123:session_abc")
    assert [row["source_gateway"] for row in rows] == ["web", "weixin"]


def test_resolve_workspace_session_id_prefers_transport_mapping_but_returns_canonical_id(tmp_path):
    hermes_home = tmp_path / ".hermes"
    create_workspace_session_log(
        hermes_home,
        session_id="ws-123:session_abc",
        title="Demo",
        source="weixin",
        platform="weixin",
    )

    resolved = resolve_workspace_session_id(hermes_home, "ws-123:session_abc")

    assert resolved == "ws-123:session_abc"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_workspace_session_logs.py -q`
Expected: FAIL with import or attribute errors for `append_workspace_session_trajectory` / `list_workspace_session_trajectory`.

- [ ] **Step 3: Implement minimal trajectory helpers in the canonical session module**

```python
def _session_trajectory_path(hermes_home: Path, session_id: str) -> Path:
    file_key = quote(session_id, safe="-_.")
    return _sessions_dir(hermes_home) / f"session_{file_key}.trajectory.jsonl"


def append_workspace_session_trajectory(
    hermes_home: Path,
    *,
    session_id: str,
    record: dict[str, Any],
) -> None:
    path = _session_trajectory_path(hermes_home, session_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    lock_path = path.with_suffix(path.suffix + ".lock")
    with lock_path.open("a+", encoding="utf-8") as lock_handle:
        fcntl.flock(lock_handle.fileno(), fcntl.LOCK_EX)
        with path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(record, ensure_ascii=False) + "\n")
            handle.flush()
        fcntl.flock(lock_handle.fileno(), fcntl.LOCK_UN)


def list_workspace_session_trajectory(
    hermes_home: Path,
    session_id: str,
) -> list[dict[str, Any]]:
    path = _session_trajectory_path(hermes_home, session_id)
    if not path.exists():
        return []
    rows: list[dict[str, Any]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        payload = json.loads(line)
        if isinstance(payload, dict):
            rows.append(payload)
    return rows
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_workspace_session_logs.py -q`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/agents/workspace_session_logs.py tests/test_workspace_session_logs.py
git commit -m "feat: add canonical workspace session trajectory helpers"
```

### Task 2: Replace Global Trajectory Files With Session-Scoped Sink

**Files:**
- Modify: `hermes-agent/agent/trajectory.py`
- Modify: `hermes-agent/run_agent.py`
- Test: `hermes-agent/tests/run_agent/test_run_agent.py`

- [ ] **Step 1: Write the failing tests for session-scoped trajectory output**

```python
from pathlib import Path

from agent.trajectory import save_trajectory


def test_save_trajectory_writes_to_session_scoped_file(tmp_path):
    target = tmp_path / "session_demo.trajectory.jsonl"

    save_trajectory(
        trajectory=[{"from": "user", "value": "hello"}],
        model="test/model",
        completed=True,
        filename=str(target),
        metadata={"source_gateway": "web", "session_id": "ws-123:demo"},
    )

    lines = target.read_text(encoding="utf-8").splitlines()
    assert len(lines) == 1
    assert '"source_gateway": "web"' in lines[0]
    assert '"session_id": "ws-123:demo"' in lines[0]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest hermes-agent/tests/run_agent/test_run_agent.py -k session_scoped_trajectory -q`
Expected: FAIL because `save_trajectory()` does not accept metadata and still assumes global filenames.

- [ ] **Step 3: Extend trajectory writer to support metadata and session-scoped filename injection**

```python
def save_trajectory(
    trajectory: List[Dict[str, Any]],
    model: str,
    completed: bool,
    filename: str = None,
    metadata: dict[str, Any] | None = None,
):
    if filename is None:
        filename = "trajectory_samples.jsonl" if completed else "failed_trajectories.jsonl"

    entry = {
        "conversations": trajectory,
        "model": model,
        "completed": completed,
    }
    if metadata and metadata.get("timestamp"):
        entry["timestamp"] = normalize_utc_iso(metadata["timestamp"])
    if metadata:
        entry.update(filter_allowed_metadata(metadata))
```

- [ ] **Step 4: Pass session-scoped filename + gateway metadata from `AIAgent._save_trajectory()`**

```python
def _save_trajectory(self, messages: List[Dict[str, Any]], user_query: str, completed: bool):
    if not self.save_trajectories:
        return

    trajectory = self._convert_to_trajectory_format(messages, user_query, completed)
    metadata = {
        "timestamp": messages[-1].get("timestamp"),
        "session_id": self.session_id,
        "workspace_id": self.session_id.split(":", 1)[0] if ":" in self.session_id else None,
        "source_gateway": self.platform or "unknown",
        "platform_session_key": getattr(self, "_gateway_session_key", None),
        "chat_id": getattr(self, "_chat_id", None),
        "thread_id": getattr(self, "_thread_id", None),
        "origin_user_id": getattr(self, "_user_id", None),
    }
    filename = None
    if self.session_log_file is not None:
        filename = str(self.session_log_file.with_name(f"session_{self.session_id}.trajectory.jsonl"))
    _save_trajectory_to_file(trajectory, self.model, completed, filename=filename, metadata=metadata)
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pytest hermes-agent/tests/run_agent/test_run_agent.py -k trajectory -q`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add hermes-agent/agent/trajectory.py hermes-agent/run_agent.py hermes-agent/tests/run_agent/test_run_agent.py
git commit -m "feat: write trajectories to session-scoped workspace files"
```

### Task 3: Enable Trajectory Emission For Web / Embedded API Flow

**Files:**
- Modify: `src/agents/webapi_gateway.py`
- Modify: `hermes-agent/gateway/platforms/api_server.py`
- Modify: `tests/test_hermes_api_compat.py`
- Modify: `hermes-agent/tests/gateway/test_api_server.py`

- [ ] **Step 1: Write the failing web/API tests for save_trajectories propagation**

```python
def test_api_server_agent_enables_save_trajectories(monkeypatch):
    captured = {}

    class FakeAgent:
        def __init__(self, *args, **kwargs):
            captured.update(kwargs)

    monkeypatch.setattr("gateway.platforms.api_server.AIAgent", FakeAgent)
    # construct adapter and call the agent factory path

    assert captured["save_trajectories"] is True
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_hermes_api_compat.py hermes-agent/tests/gateway/test_api_server.py -k trajectories -q`
Expected: FAIL because the agent constructors do not set `save_trajectories=True`.

- [ ] **Step 3: Enable session-scoped trajectory emission in the embedded web/API constructors**

```python
agent = AIAgent(
    model=model,
    **runtime_kwargs,
    max_iterations=max_iterations,
    quiet_mode=True,
    verbose_logging=False,
    save_trajectories=True,
    session_id=session_id,
    platform="api_server",
    gateway_session_key=gateway_session_key,
    session_db=self._ensure_session_db(),
)
```

```python
agent = AIAgent(
    base_url=self._base_url or "",
    api_key=self._api_key or "",
    model=self._model,
    max_iterations=20,
    quiet_mode=True,
    save_trajectories=True,
    skip_context_files=True,
)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_hermes_api_compat.py hermes-agent/tests/gateway/test_api_server.py -k trajectories -q`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/agents/webapi_gateway.py src/agents/semantier_agent.py hermes-agent/gateway/platforms/api_server.py tests/test_hermes_api_compat.py hermes-agent/tests/gateway/test_api_server.py
git commit -m "feat: enable session-scoped trajectory emission for web api flows"
```

### Task 4: Normalize Weixin / Feishu To The Same Canonical Session ID

**Files:**
- Modify: `src/agents/weixin_ingress_identity.py`
- Modify: `hermes-agent/gateway/run.py`
- Modify: `hermes-agent/gateway/platforms/feishu_comment.py`
- Test: `tests/test_cross_gateway_session_trajectory.py`

- [ ] **Step 1: Write the failing cross-gateway continuation tests**

```python
def test_web_and_weixin_append_to_same_session_trajectory_file(tmp_path):
    # seed canonical session ws-123:session_abc
    # simulate a web turn append
    # simulate a weixin turn append using transport metadata
    # assert both records land in session_ws-123:session_abc.trajectory.jsonl
    ...


def test_feishu_comment_flow_resolves_canonical_session_id(tmp_path):
    # simulate Feishu history path resolving to ws-123:session_abc
    # assert no gateway-specific standalone session id is minted
    ...
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_cross_gateway_session_trajectory.py -q`
Expected: FAIL because Weixin/Feishu still use transport-local history/session handling.

- [ ] **Step 3: Introduce canonical session resolution inputs before agent construction**

```python
canonical_session_id = resolve_or_create_canonical_session_id(
    workspace_id=owner_context.workspace_id,
    source_gateway="weixin",
    platform_session_key=context_token or None,
    chat_id=effective_chat_id,
    origin_user_id=sender_id,
)
```

```python
agent = AIAgent(
    ...,
    session_id=canonical_session_id,
    platform=platform_key,
    gateway_session_key=session_key,
    save_trajectories=True,
)
```

```python
# feishu_comment.py
canonical_session_id = resolve_or_create_canonical_session_id(
    workspace_id=workspace_id,
    source_gateway="feishu",
    platform_session_key=session_key,
    chat_id=chat_id,
    origin_user_id=open_id,
)
agent = AIAgent(
    ...,
    session_id=canonical_session_id,
    platform="feishu",
    gateway_session_key=session_key,
    save_trajectories=True,
)
result = agent.run_conversation(prompt, conversation_history=history or None)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_cross_gateway_session_trajectory.py -q`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/agents/weixin_ingress_identity.py hermes-agent/gateway/run.py hermes-agent/gateway/platforms/feishu_comment.py tests/test_cross_gateway_session_trajectory.py
git commit -m "feat: unify canonical session ids across gateway flows"
```

### Task 5: Regression Coverage, Cleanup, and Final Docs Sync

**Files:**
- Modify: `tests/test_runtime_paths.py`
- Modify: `tests/test_gateway_identity.py`
- Modify: `tests/test_hermes_api_compat.py`
- Modify: `docs/derived/gateway-unified-multitenant-design.md`

- [ ] **Step 1: Add final regression assertions for canonical root + trajectory file placement**

```python
def test_workspace_sessions_root_uses_workspace_hermes_sessions(monkeypatch, tmp_path):
    ...
    assert str(sessions_root).endswith("/workspaces/ws-123/.hermes/sessions")


def test_canonical_session_trajectory_file_lives_under_workspace_sessions(tmp_path):
    hermes_home = tmp_path / ".hermes"
    create_workspace_session_log(...)
    append_workspace_session_trajectory(...)
    assert (hermes_home / "sessions" / "session_ws-123:demo.trajectory.jsonl").exists()
```

- [ ] **Step 2: Run focused regression suite**

Run: `pytest -q tests/test_runtime_paths.py tests/test_gateway_identity.py tests/test_workspace_session_logs.py tests/test_cross_gateway_session_trajectory.py tests/test_hermes_api_compat.py hermes-agent/tests/gateway/test_api_server.py hermes-agent/tests/run_agent/test_run_agent.py`
Expected: PASS

- [ ] **Step 3: Reconcile docs with the final implementation names only if needed**

```md
- `session_<file_key>.trajectory.jsonl` is the per-session trajectory append log.
- Global `trajectory_samples.jsonl` and `failed_trajectories.jsonl` are not used for workspace-bound gateway traffic.
```

- [ ] **Step 4: Run the same regression suite again after doc/name cleanup if code changed**

Run: `pytest -q tests/test_runtime_paths.py tests/test_gateway_identity.py tests/test_workspace_session_logs.py tests/test_cross_gateway_session_trajectory.py tests/test_hermes_api_compat.py hermes-agent/tests/gateway/test_api_server.py hermes-agent/tests/run_agent/test_run_agent.py`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/test_runtime_paths.py tests/test_gateway_identity.py tests/test_workspace_session_logs.py tests/test_cross_gateway_session_trajectory.py tests/test_hermes_api_compat.py hermes-agent/tests/gateway/test_api_server.py hermes-agent/tests/run_agent/test_run_agent.py docs/derived/gateway-unified-multitenant-design.md
git commit -m "test: cover unified cross-gateway session trajectory flow"
```

---

## Self-Review

### Spec coverage

- Same canonical session across web/Weixin/Feishu: covered by Task 4.
- Same trajectory file for the same logical session: covered by Tasks 1, 2, and 4.
- Per-turn gateway metadata in trajectory rows: covered by Task 2.
- Unified workspace root under `.hermes/sessions`: covered by Tasks 1 and 5.
- Web/API/embedded path participation: covered by Task 3.
- Regression coverage for wrapper/gateway/runtime paths: covered by Task 5.

### Placeholder scan

- No `TBD`, `TODO`, or deferred implementation markers remain.
- Each task includes concrete files, tests, commands, and code snippets.
- No “similar to above” shortcuts remain.

### Type consistency

- Canonical identity uses `workspace_id`, `session_id`, `source_gateway`, and `platform_session_key` consistently.
- Session-scoped trajectory filename uses `session_<id>.trajectory.jsonl` consistently.
- The plan consistently treats transport metadata as metadata, not canonical identity.

---

Plan complete and saved to `docs/operational/plans/2026-05-11-unified-cross-gateway-session-trajectory.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
