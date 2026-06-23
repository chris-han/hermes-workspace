# Workspace Direct Session Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate authenticated workspace filesystem layout away from `workspaces/<workspace_id>/.hermes/*` and flat `workspaces/<workspace_id>/uploads/*` toward direct workspace folders, with user uploads stored under `workspaces/<workspace_id>/<session_id>/uploads/`.

**Architecture:** `workspaces/<workspace_id>/` becomes the workspace runtime home for authenticated Semantier requests. Runtime-owned subdirectories move directly under the workspace root (`sessions/`, `memories/`, `skills/`, `profiles/`, `cron/`, `logs/`, `home/`, `runs/`, `swarm/runs/`), and per-session user artifacts live under `workspaces/<workspace_id>/<session_id>/`. Legacy `.hermes` paths are handled only by an explicit migration/compatibility layer with tests; new writes must not create `.hermes`.

**Tech Stack:** Python 3.12, FastAPI, pytest, Semantier runtime path helpers, Hermes `HERMES_HOME` environment binding, workspace upload service.

---

## Target Layout

New authenticated workspace layout:

```text
workspaces/<workspace_id>/
  sessions/
  memories/
  skills/
  profiles/
  cron/
  logs/
  home/
  runs/
  swarm/runs/
  <session_id>/
    uploads/
```

Legacy paths to migrate from:

```text
workspaces/<workspace_id>/.hermes/sessions/
workspaces/<workspace_id>/.hermes/memories/
workspaces/<workspace_id>/.hermes/skills/
workspaces/<workspace_id>/.hermes/profiles/
workspaces/<workspace_id>/.hermes/cron/
workspaces/<workspace_id>/.hermes/logs/
workspaces/<workspace_id>/.hermes/home/
workspaces/<workspace_id>/.swarm/runs/
workspaces/<workspace_id>/uploads/
```

Compatibility rule:

- New runtime writes must use the new layout only.
- Legacy `.hermes` and flat `uploads/` may be read only by an explicit migration function or compatibility import path.
- Missing authoritative data must still fail clearly; do not add prompt-memory, inferred, or unmanaged filesystem fallback behavior.

## Current Workspace State Before Executing This Plan

Task 5 is already partially implemented in the working tree at the time this
plan was reviewed:

- `src/agents/workspace_uploads.py` already requires `session_id` and writes to
  `<session_id>/uploads/`.
- `src/agents/webapi_gateway.py` already passes multipart `session_id` into
  `save_workspace_upload()`.
- The stale work is primarily tests and docs: `tests/test_workspace_uploads.py`
  still calls `save_workspace_upload()` without `session_id`, and
  `tests/test_hermes_api_compat.py` still asserts `uploads/<filename>`.

Before starting Task 5, run:

```bash
pytest -q tests/test_workspace_uploads.py tests/test_hermes_api_compat.py -k upload
```

Expected in the current partial state: upload tests fail in places where tests
still expect flat workspace uploads or omit `session_id`.

## File Structure

- Modify `docs/canonical/architecture.md`: update the canonical workspace storage, write policy, and environment binding contracts.
- Modify `docs/derived/gateway-unified-multitenant-design.md`: update user data inventory and route storage descriptions.
- Modify `src/runtime_paths.py`: centralize new direct workspace runtime roots, session roots, session upload roots, and legacy migration helpers.
- Modify `src/agents/gateway_identity.py`: make `ensure_workspace_paths()` create the direct workspace tree and return `(workspace_root, workspace_runtime_home)` where both are the workspace root for authenticated requests.
- Modify `src/agents/workspace_uploads.py`: require `session_id`, write atomically to `workspaces/<workspace_id>/<session_id>/uploads/`, and return that relative path.
- Modify `src/agents/webapi_gateway.py`: require multipart `session_id` on `POST /upload` and call the shared upload service with it.
- Modify `src/agents/workspace_session_logs.py`: move session log reads/writes from `.hermes/sessions/` to `sessions/`, with explicit legacy import.
- Modify `src/agents/session_residue_migration.py`: replace `.hermes` migration target with the new direct `sessions/` target.
- Modify tests that currently assert `.hermes` or flat `uploads/`: update them to assert the new direct layout.
- Add or update `tests/test_runtime_paths.py`, `tests/test_gateway_identity.py`, `tests/test_workspace_uploads.py`, `tests/test_hermes_api_compat.py`, and session-log tests.

---

### Task 1: Canonical Docs Define the New Layout

**Files:**
- Modify: `docs/canonical/architecture.md`
- Modify: `docs/derived/gateway-unified-multitenant-design.md`
- Modify: `tests/test_session_lane_contract_guards.py`

- [ ] **Step 1: Update the canonical runtime storage contract**

In `docs/canonical/architecture.md`, replace the `.hermes` workspace bullets in section `0.4A Runtime Storage Contract` with:

```markdown
- Authenticated workspace session logs and runtime session artifacts live under `workspaces/<workspace_id>/sessions/`.
- `workspaces/<workspace_id>/sessions/sessions.json` is the canonical session index / transport-key map.
- `workspaces/<workspace_id>/sessions/<file_key>.jsonl` is the canonical transcript/event append log.
- `workspaces/<workspace_id>/sessions/session_<file_key>.trajectory.jsonl` is the canonical per-session trajectory log.
- Workspace runtime subdirectories are direct children of `workspaces/<workspace_id>/`: `sessions/`, `memories/`, `skills/`, `profiles/`, `cron/`, `logs/`, `home/`, `runs/`, and `swarm/runs/`.
- Per-session user uploads live under `workspaces/<workspace_id>/<session_id>/uploads/`.
```

- [ ] **Step 2: Update the write-policy contract**

In `docs/canonical/architecture.md`, replace the authenticated write roots section with:

```markdown
- Authenticated workspace sessions may write only governed workspace output directories:
  `workspaces/<workspace_id>/runs/` and
  `workspaces/<workspace_id>/<session_id>/uploads/`.
- `workspaces/<workspace_id>/runs/` is the canonical mutable root for generated run artifacts, replayable work products, and session-produced execution outputs.
- `workspaces/<workspace_id>/<session_id>/uploads/` is the canonical mutable root for user-provided inbound files staged for governed processing within that session.
```

- [ ] **Step 3: Update `HERMES_HOME` documentation**

In `docs/canonical/architecture.md`, update the `HERMES_HOME` row to:

```markdown
| `HERMES_HOME` | Active workspace/runtime home for file-backed tools, skills, memories, config overlays, session artifacts, and workspace write policy. Authenticated requests bind this to `workspaces/<workspace_id>`; shared `.semantier-home` is the launcher/bootstrap fallback. Hermes `SessionDB` uses `SEMANTIER_LOCAL_STATE_DIR/state.db` when that variable is set. | Runtime code except shared SessionDB selection |
```

- [ ] **Step 4: Update the derived gateway data inventory**

In `docs/derived/gateway-unified-multitenant-design.md`, replace user upload inventory entries with:

```markdown
- `workspaces/<workspace_id>/<session_id>/uploads/` (session-scoped user uploads)
```

Replace workspace `.hermes` entries with direct equivalents:

```markdown
- `workspaces/<workspace_id>/sessions/` (canonical session snapshots, transcript logs, and per-session trajectory logs)
- `workspaces/<workspace_id>/memories/` (Hermes memory files)
- `workspaces/<workspace_id>/skills/` (workspace-installed skills)
- `workspaces/<workspace_id>/profiles/` (workspace profiles)
- `workspaces/<workspace_id>/cron/` (workspace cron definitions)
- `workspaces/<workspace_id>/logs/` (workspace runtime logs)
- `workspaces/<workspace_id>/home/` (workspace sandbox/home)
```

- [ ] **Step 5: Replace contract guard test assertions atomically**

In `tests/test_session_lane_contract_guards.py`, replace the complete body of
`test_canonical_architecture_doc_pins_workspace_write_policy_enforcement_contract`
with:

```python
def test_canonical_architecture_doc_pins_workspace_write_policy_enforcement_contract():
    path = _REPO_ROOT / "docs" / "canonical" / "architecture.md"
    content = path.read_text(encoding="utf-8")

    assert "### 0.4B Workspace Write Policy Enforcement Layer" in content
    assert "`workspaces/<workspace_id>/runs/` and" in content
    assert "`workspaces/<workspace_id>/<session_id>/uploads/`" in content
    assert "`workspaces/<workspace_id>/sessions/`" in content
    assert "`workspaces/<workspace_id>/.hermes/`" not in content
    assert "`src/`, `tests/`, and `hermes-workspace/`" in content
    assert "This contract must be enforced by automated tests in CI" in content
```

- [ ] **Step 6: Update reset-session test workspace home setup**

In `tests/test_session_lane_contract_guards.py`, update
`test_gateway_reset_preferred_session_rebinds_alias_and_routes_new_trajectory`:

```python
workspace_home = tmp_path

monkeypatch.setattr(
    "runtime_paths.workspace_hermes_home_path",
    lambda _workspace_id: workspace_home,
)
```

This replaces the old `workspace_home = tmp_path / ".hermes"` setup.

- [ ] **Step 7: Run docs guard tests**

Run:

```bash
pytest -q tests/test_session_lane_contract_guards.py
```

Expected: tests pass after the doc text and assertions agree.

---

### Task 2: Runtime Path Helpers Own the New Layout

**Files:**
- Modify: `src/runtime_paths.py`
- Modify: `tests/test_runtime_paths.py`

- [ ] **Step 1: Add failing tests for direct workspace paths**

Add these tests to `tests/test_runtime_paths.py`:

```python
def test_workspace_runtime_home_is_workspace_root(monkeypatch, tmp_path):
    import runtime_paths

    monkeypatch.setattr(runtime_paths, "_WORKSPACES_ROOT", tmp_path / "workspaces")

    assert runtime_paths.workspace_root_path("ws-123") == tmp_path / "workspaces" / "ws-123"
    assert runtime_paths.workspace_runtime_home_path("ws-123") == tmp_path / "workspaces" / "ws-123"
    assert runtime_paths.workspace_sessions_root("ws-123") == tmp_path / "workspaces" / "ws-123" / "sessions"


def test_workspace_session_uploads_root(monkeypatch, tmp_path):
    import runtime_paths

    monkeypatch.setattr(runtime_paths, "_WORKSPACES_ROOT", tmp_path / "workspaces")

    assert (
        runtime_paths.workspace_session_uploads_root("ws-123", "session_abc")
        == tmp_path / "workspaces" / "ws-123" / "session_abc" / "uploads"
    )


def test_workspace_session_uploads_root_rejects_path_escape(monkeypatch, tmp_path):
    import pytest
    import runtime_paths

    monkeypatch.setattr(runtime_paths, "_WORKSPACES_ROOT", tmp_path / "workspaces")

    with pytest.raises(ValueError):
        runtime_paths.workspace_session_uploads_root("ws-123", "../bad")
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
pytest -q tests/test_runtime_paths.py -k "workspace_runtime_home or session_uploads"
```

Expected: fail because `workspace_runtime_home_path()` and `workspace_session_uploads_root()` do not exist.

- [ ] **Step 3: Add direct-layout helpers**

In `src/runtime_paths.py`, add:

```python
_SESSION_SEGMENT_RE = re.compile(r"^[A-Za-z0-9._:-]+$")


def _validate_session_segment(session_id: str) -> str:
    normalized = str(session_id or "").strip()
    if not normalized or normalized in {".", ".."}:
        raise ValueError("session_id required")
    if not _SESSION_SEGMENT_RE.fullmatch(normalized):
        raise ValueError("session_id must be an ASCII-stable path segment")
    if normalized != Path(normalized).name or any(sep in normalized for sep in ("/", "\\")):
        raise ValueError("session_id must be a safe single path segment")
    return normalized


def workspace_runtime_home_path(workspace_id: str) -> Path:
    return workspace_root_path(workspace_id)
```

Update existing helpers:

```python
def workspace_hermes_home_path(workspace_id: str) -> Path:
    return workspace_runtime_home_path(workspace_id)


def workspace_sessions_root(workspace_id: str) -> Path:
    return workspace_runtime_home_path(workspace_id) / "sessions"


def workspace_session_root(workspace_id: str, session_id: str) -> Path:
    return workspace_root_path(workspace_id) / _validate_session_segment(session_id)


def workspace_session_uploads_root(workspace_id: str, session_id: str) -> Path:
    return workspace_session_root(workspace_id, session_id) / "uploads"


def workspace_uploads_root(workspace_id: str) -> Path:
    raise ValueError("workspace uploads require session_id; use workspace_session_uploads_root")
```

- [ ] **Step 4: Update `bind_workspace_env()` for direct runtime homes**

In `src/runtime_paths.py`, update `workspace_runs_root_from_hermes_home()` so it treats `workspaces/<id>` as the workspace runtime home:

```python
def workspace_runs_root_from_hermes_home(hermes_home: Path) -> Path:
    resolved = Path(hermes_home).expanduser().resolve()
    workspaces_root = _WORKSPACES_ROOT.resolve()
    if resolved.parent != workspaces_root:
        raise ValueError("not a workspace runtime home")
    return resolved / "runs"
```

Update the `bind_workspace_env()` docstring to say authenticated requests bind `HERMES_HOME` to `workspaces/<id>`.

- [ ] **Step 5: Remove flat upload root from base environment binding**

In `src/runtime_paths.py`, remove this behavior from `bind_workspace_env()`:

```python
uploads_root = workspace_root / "uploads"
uploads_root.mkdir(parents=True, exist_ok=True)
os.environ[_WRITE_ALLOWED_ROOTS_ENV] = ",".join(
    [str(runs_root), str(uploads_root)]
)
```

Replace it with:

```python
os.environ[_WRITE_ALLOWED_ROOTS_ENV] = str(runs_root)
```

Base workspace binding should expose only the workspace `runs/` root. The
active session upload root is added later by `bind_workspace_session_env()`.

- [ ] **Step 6: Update runtime path environment binding test**

In `tests/test_runtime_paths.py`, replace
`test_bind_workspace_env_sets_and_restores_for_workspace` with:

```python
def test_bind_workspace_env_sets_and_restores_for_workspace(monkeypatch, tmp_path):
    monkeypatch.setenv("SEMANTIER_LOCAL_STATE_DIR", str(tmp_path / ".semantier-home"))
    monkeypatch.setenv("HERMES_HOME", "/sentinel/previous")
    monkeypatch.delenv("SEMANTIER_WORKSPACE_RUNS_DIR", raising=False)
    monkeypatch.delenv("HERMES_WRITE_SAFE_ROOT", raising=False)
    monkeypatch.delenv("HERMES_WRITE_ALLOWED_ROOTS", raising=False)
    monkeypatch.delenv("TERMINAL_CWD", raising=False)

    workspace_home = workspace_runtime_home_path("ws-bind")
    expected_runs = workspace_runs_root("ws-bind")

    with bind_workspace_env(workspace_home):
        assert os.environ["HERMES_HOME"] == str(workspace_home.resolve())
        assert os.environ["SEMANTIER_WORKSPACE_RUNS_DIR"] == str(expected_runs.resolve())
        assert os.environ["HERMES_WRITE_SAFE_ROOT"] == str(workspace_home.resolve())
        assert os.environ["HERMES_WRITE_ALLOWED_ROOTS"] == str(expected_runs.resolve())
        assert os.environ["TERMINAL_CWD"] == str(workspace_home.resolve())
        assert expected_runs.exists()
        assert not (workspace_home / "uploads").exists()

    assert os.environ["HERMES_HOME"] == "/sentinel/previous"
    assert "SEMANTIER_WORKSPACE_RUNS_DIR" not in os.environ
    assert "HERMES_WRITE_SAFE_ROOT" not in os.environ
    assert "HERMES_WRITE_ALLOWED_ROOTS" not in os.environ
    assert "TERMINAL_CWD" not in os.environ
```

- [ ] **Step 7: Run runtime path tests**

Run:

```bash
pytest -q tests/test_runtime_paths.py
```

Expected: all runtime path tests pass after old `.hermes` and flat upload-root assertions are updated to the new direct layout.

---

### Task 3: Hermes Home Compatibility Spike

**Files:**
- Read: `src/agents/launcher.py`
- Read: embedded Hermes modules that consume `HERMES_HOME`
- Create: `tests/test_workspace_runtime_home_spike.py`

- [ ] **Step 1: Inspect bootstrap behavior**

Run:

```bash
rg -n "def bootstrap_workspace_runtime_home|HERMES_HOME|config.yaml|SOUL.md|plugins|skills" src/agents src hermes-workspace -g '*.py' -g '*.ts' -g '*.tsx'
sed -n '/def bootstrap_workspace_runtime_home/,/def /p' src/agents/launcher.py
```

Record these facts in the PR notes before implementing Task 4:

```text
bootstrap_workspace_runtime_home(runtime_home) creates:
- config path:
- skills path:
- plugins path:
- profiles path:
- SOUL/prompt files:

Hermes consumers use HERMES_HOME by:
- direct env path lookup:
- assumptions about basename ".hermes":
- assumptions about parent workspace root:
```

- [ ] **Step 2: Add a spike test for direct runtime home bootstrap**

Create `tests/test_workspace_runtime_home_spike.py`:

```python
from pathlib import Path


def test_bootstrap_workspace_runtime_home_accepts_workspace_root(tmp_path):
    from agents.launcher import bootstrap_workspace_runtime_home

    workspace_root = tmp_path / "workspaces" / "ws-123"
    shared_skills = tmp_path / ".semantier-home" / "skills"
    shared_skills.mkdir(parents=True)

    bootstrap_workspace_runtime_home(
        workspace_root,
        shared_skills_external_dir=shared_skills,
    )

    assert workspace_root.exists()
    assert (workspace_root / "config.yaml").exists()
    assert (workspace_root / "skills").exists()
    assert not (workspace_root / ".hermes").exists()
```

- [ ] **Step 3: Run the spike test**

Run:

```bash
pytest -q tests/test_workspace_runtime_home_spike.py
```

Expected: if this fails, stop and update this plan before changing
`ensure_workspace_paths()`. Do not proceed to workspace-root `HERMES_HOME`
until bootstrap is verified.

- [ ] **Step 4: Verify no basename `.hermes` dependency**

Run:

```bash
rg -n "name == \"\\.hermes\"|endswith\\(\"\\.hermes\"\\)|/\\.hermes|workspace/.hermes|parent.name.*hermes" src hermes-workspace tests
```

Expected: any hits are either old tests/docs to be migrated or explicit legacy
migration code. If runtime code depends on the basename `.hermes`, add a
separate compatibility task before Task 4.

---

### Task 4: Workspace Bootstrap Stops Creating `.hermes`

**Files:**
- Modify: `src/agents/gateway_identity.py`
- Modify: `tests/test_gateway_identity.py`
- Modify: `tests/test_hermes_api_compat.py`

- [ ] **Step 1: Add failing test for direct workspace bootstrap**

In `tests/test_gateway_identity.py`, update `test_ensure_workspace_paths_creates_workspace_tree` to assert:

```python
workspace_root, runtime_home = ensure_workspace_paths("ws-test")

assert workspace_root == tmp_path / "workspaces" / "ws-test"
assert runtime_home == workspace_root
assert (workspace_root / "sessions").exists()
assert (workspace_root / "memories").exists()
assert (workspace_root / "skills").exists()
assert (workspace_root / "profiles").exists()
assert (workspace_root / "cron").exists()
assert (workspace_root / "logs").exists()
assert (workspace_root / "home").exists()
assert (workspace_root / "runs").exists()
assert (workspace_root / "swarm" / "runs").exists()
assert not (workspace_root / ".hermes").exists()
assert not (workspace_root / "uploads").exists()
```

- [ ] **Step 2: Run the focused failing test**

Run:

```bash
pytest -q tests/test_gateway_identity.py::test_ensure_workspace_paths_creates_workspace_tree
```

Expected: fail because `ensure_workspace_paths()` still creates `.hermes` and flat `uploads/`.

- [ ] **Step 3: Update workspace path creation**

In `src/agents/gateway_identity.py`, change `ensure_workspace_paths()` to:

```python
def ensure_workspace_paths(workspace_id: str) -> tuple[Path, Path]:
    workspace_root = workspace_root_path(workspace_id)
    runtime_home = workspace_runtime_home_path(workspace_id)
    sessions_root = workspace_sessions_root(workspace_id)

    from agents.launcher import bootstrap_workspace_runtime_home

    workspace_root.mkdir(parents=True, exist_ok=True)
    bootstrap_workspace_runtime_home(
        runtime_home,
        shared_skills_external_dir=platform_runtime_root() / "skills",
    )
    (workspace_root / "runs").mkdir(exist_ok=True)
    (workspace_root / "swarm" / "runs").mkdir(parents=True, exist_ok=True)
    sessions_root.mkdir(exist_ok=True)
    (runtime_home / "memories").mkdir(exist_ok=True)
    (runtime_home / "skills").mkdir(exist_ok=True)
    (runtime_home / "profiles").mkdir(exist_ok=True)
    (runtime_home / "cron").mkdir(exist_ok=True)
    (runtime_home / "logs").mkdir(exist_ok=True)
    (runtime_home / "home").mkdir(exist_ok=True)
    sanitize_user_memory_profile(runtime_home)

    return workspace_root, runtime_home
```

Also update imports in that file from `workspace_hermes_home_path` to `workspace_runtime_home_path`.

- [ ] **Step 4: Update test helpers that mock workspace homes**

In `tests/test_hermes_api_compat.py`, change `_mock_authenticated_workspace()`:

```python
runtime_home = workspace_root
(runtime_home / "sessions").mkdir(parents=True, exist_ok=True)
...
lambda candidate_workspace_id: (
    workspace_root,
    runtime_home,
)
```

Replace local variables named `hermes_home = workspace_root / ".hermes"` with `runtime_home = workspace_root` in tests that are asserting authenticated Semantier runtime behavior.

- [ ] **Step 5: Run identity and compatibility focused tests**

Run:

```bash
pytest -q tests/test_gateway_identity.py tests/test_hermes_api_compat.py -k "workspace_paths or workspace_write_policy or upload"
```

Expected: focused tests pass after assertions are updated to direct workspace paths.

---

### Task 5: Reconcile Session-Scoped Upload Tests With Existing Implementation

**Files:**
- Modify: `src/agents/workspace_uploads.py`
- Modify: `src/agents/webapi_gateway.py`
- Modify: `tests/test_workspace_uploads.py`
- Modify: `tests/test_hermes_api_compat.py`

- [ ] **Step 1: Establish current failing baseline**

Run:

```bash
pytest -q tests/test_workspace_uploads.py tests/test_hermes_api_compat.py -k upload
```

Expected in the current partial state: failures show `save_workspace_upload()`
requires `session_id` and webapi tests still expect flat `uploads/<filename>`.

- [ ] **Step 2: Update upload service tests for existing session-scoped behavior**

In `tests/test_workspace_uploads.py`, update `test_save_workspace_upload_accepts_supported_document_formats`:

```python
result = save_workspace_upload(
    workspace_root=tmp_path,
    session_id="session_abc",
    filename=filename,
    content=b"resume bytes",
    content_type="application/octet-stream",
)

assert result.relative_path == f"session_abc/uploads/{filename}"
assert result.file_path == tmp_path / "session_abc" / "uploads" / filename
```

Add:

```python
def test_save_workspace_upload_keeps_sessions_separate(tmp_path):
    first = save_workspace_upload(
        workspace_root=tmp_path,
        session_id="session_one",
        filename="resume.pdf",
        content=b"one",
    )
    second = save_workspace_upload(
        workspace_root=tmp_path,
        session_id="session_two",
        filename="resume.pdf",
        content=b"two",
    )

    assert first.file_path == tmp_path / "session_one" / "uploads" / "resume.pdf"
    assert second.file_path == tmp_path / "session_two" / "uploads" / "resume.pdf"
    assert first.file_path.read_bytes() == b"one"
    assert second.file_path.read_bytes() == b"two"
```

Add:

```python
def test_save_workspace_upload_requires_session_id(tmp_path):
    with pytest.raises(WorkspaceUploadError) as exc_info:
        save_workspace_upload(
            workspace_root=tmp_path,
            session_id="",
            filename="resume.pdf",
            content=b"resume",
        )

    assert exc_info.value.code == "session_id_required"
```

Also update these existing tests so every `save_workspace_upload()` call passes
`session_id="session_test"`:

```python
def test_save_workspace_upload_allocates_collision_safe_filename(tmp_path):
    first = save_workspace_upload(
        workspace_root=tmp_path,
        session_id="session_test",
        filename="resume.pdf",
        content=b"first",
    )
    second = save_workspace_upload(
        workspace_root=tmp_path,
        session_id="session_test",
        filename="resume.pdf",
        content=b"second",
    )

    assert first.filename == "resume.pdf"
    assert second.filename.startswith("resume-")
    assert second.filename.endswith(".pdf")
    assert first.file_path.read_bytes() == b"first"
    assert second.file_path.read_bytes() == b"second"


def test_save_workspace_upload_rejects_unsupported_extension(tmp_path):
    with pytest.raises(WorkspaceUploadError) as exc_info:
        save_workspace_upload(
            workspace_root=tmp_path,
            session_id="session_test",
            filename="resume.exe",
            content=b"binary",
        )

    assert exc_info.value.code == "unsupported_extension"
    assert not (tmp_path / "session_test" / "uploads" / "resume.exe").exists()


def test_save_workspace_upload_rejects_empty_file(tmp_path):
    with pytest.raises(WorkspaceUploadError) as exc_info:
        save_workspace_upload(
            workspace_root=tmp_path,
            session_id="session_test",
            filename="resume.pdf",
            content=b"",
        )

    assert exc_info.value.code == "empty_file"
```

- [ ] **Step 3: Keep or verify session-scoped atomic upload implementation**

`src/agents/workspace_uploads.py` should already contain the following behavior.
If it does not, update it to this shape:

```python
_SESSION_ID_RE = re.compile(r"[^A-Za-z0-9._:-]+")


def sanitize_upload_session_id(session_id: str) -> str:
    safe = _SESSION_ID_RE.sub("_", str(session_id or "").strip()).strip(" .")
    if not safe or safe in {".", ".."}:
        raise WorkspaceUploadError("session_id required", code="session_id_required")
    if "/" in safe or "\\" in safe:
        raise WorkspaceUploadError("invalid session_id", code="invalid_session_id")
    return safe


def _write_unique_file(uploads_dir: Path, filename: str, content: bytes) -> Path:
    requested = uploads_dir / filename
    stem = requested.stem
    suffix = requested.suffix
    candidates = [requested]
    candidates.extend(
        uploads_dir / f"{stem}-{uuid.uuid4().hex[:8]}{suffix}"
        for _ in range(20)
    )
    for candidate in candidates:
        try:
            with candidate.open("xb") as handle:
                handle.write(content)
            return candidate
        except FileExistsError:
            continue
    raise WorkspaceUploadError(
        "Unable to allocate upload filename",
        code="filename_allocation_failed",
        status_code=409,
    )
```

Update `save_workspace_upload()`:

```python
def save_workspace_upload(
    *,
    workspace_root: Path,
    session_id: str,
    filename: str,
    content: bytes,
    content_type: str = "",
    allowed_extensions: frozenset[str] = ALLOWED_DOCUMENT_EXTENSIONS,
) -> WorkspaceUploadResult:
    safe_filename = sanitize_upload_filename(filename, allowed_extensions=allowed_extensions)
    safe_session_id = sanitize_upload_session_id(session_id)
    if not content:
        raise WorkspaceUploadError("file is empty", code="empty_file")

    uploads_dir = Path(workspace_root) / safe_session_id / "uploads"
    uploads_dir.mkdir(parents=True, exist_ok=True)
    target = _write_unique_file(uploads_dir, safe_filename, content)

    return WorkspaceUploadResult(
        filename=target.name,
        file_path=target,
        relative_path=f"{safe_session_id}/uploads/{target.name}",
        content_type=content_type,
        size=len(content),
    )
```

- [ ] **Step 4: Keep or verify `session_id` in the webapi upload route**

`src/agents/webapi_gateway.py` should already read multipart `session_id` and
pass it to `save_workspace_upload()`. If it does not, update
`upload_workspace_document()`:

```python
session_id = str(form.get("session_id") or "").strip()
...
saved = save_workspace_upload(
    workspace_root=Path(workspace_root),
    session_id=session_id,
    filename=file_field.filename or "",
    content=content,
    content_type=file_field.content_type or "",
)
```

- [ ] **Step 5: Verify upload errors are converted to HTTP 400/409**

Before adding the missing-session HTTP test, run:

```bash
rg -n "WorkspaceUploadError|exception_handler" src/agents/webapi_gateway.py
```

Expected: `upload_workspace_document()` catches `WorkspaceUploadError` and
raises `HTTPException(status_code=exc.status_code, detail=...)`, or there is a
registered FastAPI exception handler. If neither exists, add the local
`try`/`except WorkspaceUploadError` conversion in `upload_workspace_document()`
before writing `test_upload_requires_session_id`; otherwise the route may
return `500` instead of `400`.

- [ ] **Step 6: Update stale webapi upload tests**

In `tests/test_hermes_api_compat.py`, update successful upload assertions:

```python
assert payload["relative_path"] == f"session_d5b3634de1ed/uploads/{filename}"
target = workspace_root / "session_d5b3634de1ed" / "uploads" / filename
assert Path(payload["file_path"]) == target
assert not (workspace_root / "uploads").exists()
```

Update unsupported extension test to include the session id and assert:

```python
assert not (workspace_root / "session_d5b3634de1ed" / "uploads" / "resume.exe").exists()
```

Add:

```python
def test_upload_requires_session_id(monkeypatch, tmp_path):
    workspace_root = tmp_path / "workspace"
    _mock_authenticated_workspace(monkeypatch, workspace_root=workspace_root)
    token = create_vt_session_token(
        user_id="user-123",
        workspace_id="ws-123",
        workspace_slug="alice_zhang",
    )

    client = _client()
    client.cookies.set("vt_session", token)
    resp = client.post(
        "/upload",
        files={"file": ("resume.pdf", b"resume bytes", "application/pdf")},
    )

    assert resp.status_code == 400
    assert resp.json()["detail"] == "session_id required"
```

- [ ] **Step 7: Run upload tests**

Run:

```bash
pytest -q tests/test_workspace_uploads.py tests/test_hermes_api_compat.py -k upload
```

Expected: all upload tests pass and no flat `workspace/uploads` directory is created by upload code.

---

### Task 6: Session Logs Move to Direct `sessions/`

**Files:**
- Modify: `src/agents/workspace_session_logs.py`
- Modify: `src/agents/session_residue_migration.py`
- Modify: `tests/test_hermes_api_compat.py`

- [ ] **Step 1: Update tests that create session logs**

In `tests/test_hermes_api_compat.py`, replace:

```python
sessions_dir = workspace_root / ".hermes" / "sessions"
```

with:

```python
sessions_dir = workspace_root / "sessions"
```

Update assertions like:

```python
assert seen["sessions_dir"].endswith("/workspaces/ws-123/sessions")
```

- [ ] **Step 2: Run focused session API tests**

Run:

```bash
pytest -q tests/test_hermes_api_compat.py -k "session and (messages or trajectory or delete or title)"
```

Expected: fail until session log code reads and writes `workspace_root/sessions`.

- [ ] **Step 3: Verify workspace session log root resolution**

If Task 4 changes `ensure_workspace_paths()` to return `workspace_root` as
`hermes_home`, existing `hermes_home / "sessions"` code naturally writes to
`workspaces/<id>/sessions/`. Prefer keeping that simple behavior.

Only replace duplicated path construction with this helper:

```python
def _sessions_root(runtime_home: Path) -> Path:
    return Path(runtime_home) / "sessions"
```

Then call:

```python
sessions_root = _sessions_root(hermes_home)
```

Do not add a general `_normalize_runtime_home()` helper unless a test proves a
real call path still passes legacy `.hermes` after Task 4. Legacy reads belong
in the explicit migration task.

- [ ] **Step 4: Update explicit residue migration target**

In `src/agents/session_residue_migration.py`, replace:

```python
target = target_workspace / ".hermes" / "sessions" / entry.name
```

with:

```python
target = target_workspace / "sessions" / entry.name
```

Keep source detection for legacy files because this is an explicit migration path, not an implicit runtime fallback.

- [ ] **Step 5: Run session tests**

Run:

```bash
pytest -q tests/test_hermes_api_compat.py -k "session and (messages or trajectory or delete or title)"
pytest -q tests/test_shared_session_db_path.py tests/test_embedded_api_workspace_binding.py
```

Expected: tests pass with runtime homes rooted at `workspaces/<workspace_id>`.

---

### Task 7: Environment Binding and Write Policy

**Files:**
- Modify: `src/runtime_paths.py`
- Modify: `tests/test_hermes_api_compat.py`
- Modify: `tests/test_hermes_routing_guard_plugin.py`

- [ ] **Step 1: Confirm base binding no longer exposes flat uploads**

Verify Task 2 already changed `bind_workspace_env()` so
`HERMES_WRITE_ALLOWED_ROOTS` contains only `runs/` until a session id is known.
Do not reintroduce `workspaces/<workspace_id>/uploads/` in this task.

- [ ] **Step 2: Update write policy expectations**

In `tests/test_hermes_api_compat.py`, update the end-to-end write policy test.
This test must run through the normal gateway chat request flow that has already
resolved the internal session id. Use the same request session id in the URL and
the expected upload root; for the existing fake-agent test, use
`/api/sessions/session_xyz/chat`, so the session upload root is
`workspace_root / "session_xyz" / "uploads"`.

Before writing the test setup, verify the route shape:

```bash
rg -n "sessions.*chat|/chat|router.post.*chat" src/agents/webapi_gateway.py | head -20
```

Expected: confirm the concrete handler path for non-stream chat, then use that
confirmed path in the request. If the route differs from
`/api/sessions/{session_id}/chat`, update the test URL and expected session id
binding to match the actual route.

Inside the fake agent, use:

```python
runs_target = workspace_root / "runs" / "job-1" / "result.json"
session_uploads_target = workspace_root / "session_xyz" / "uploads" / "invoice.pdf"
runtime_config_target = workspace_root / "config.yaml"
```

Assert:

```python
assert payload["hermes_home_env"] == str(workspace_root)
assert payload["write_safe_root"] == str(workspace_root)
assert payload["terminal_cwd"] == str(workspace_root)
assert payload["write_allowed_roots"] == ",".join(
    [str((workspace_root / "runs").resolve()), str((workspace_root / "session_xyz" / "uploads").resolve())]
)
assert payload["runs_denied"] is False
assert payload["session_uploads_denied"] is False
assert payload["runtime_config_denied"] is True
```

- [ ] **Step 3: Add session upload root to environment binding**

In `src/runtime_paths.py`, update `bind_workspace_env()` to accept an optional session id only if the call path has it. If changing the signature is too broad, add a second helper:

```python
@contextlib.contextmanager
def bind_workspace_session_env(target_home: Path | str | None, session_id: str | None) -> Iterator[None]:
    with bind_workspace_env(target_home):
        if target_home and session_id:
            workspace_root = Path(target_home).expanduser().resolve()
            uploads_root = workspace_root / _validate_session_segment(session_id) / "uploads"
            uploads_root.mkdir(parents=True, exist_ok=True)
            runs_root = workspace_root / "runs"
            previous = os.environ.get(_WRITE_ALLOWED_ROOTS_ENV)
            os.environ[_WRITE_ALLOWED_ROOTS_ENV] = ",".join([str(runs_root), str(uploads_root)])
            try:
                yield
            finally:
                if previous is None:
                    os.environ.pop(_WRITE_ALLOWED_ROOTS_ENV, None)
                else:
                    os.environ[_WRITE_ALLOWED_ROOTS_ENV] = previous
        else:
            yield
```

Use this helper only in gateway paths that know the active session id.

- [ ] **Step 4: Update gateway chat execution to pass session id into binding**

First locate every binding call site:

```bash
rg -n "bind_workspace_env|bind_workspace_session_env" src/agents/webapi_gateway.py src/agents/
```

In `src/agents/webapi_gateway.py`, find the chat and stream execution paths that call `bind_workspace_env(ctx.hermes_home)` indirectly or directly. Replace with `bind_workspace_session_env(ctx.hermes_home, runtime_session_id)` where `runtime_session_id` is the internal session id already resolved for the request.

- [ ] **Step 5: Run write policy tests**

Run:

```bash
pytest -q tests/test_hermes_api_compat.py -k "write_policy"
pytest -q tests/test_hermes_routing_guard_plugin.py
```

Expected: tools may write `runs/` and the active session `uploads/`, but not repo files or runtime config files.

---

### Task 8: Explicit Legacy Migration

**Files:**
- Modify: `src/agents/session_residue_migration.py`
- Create: `src/agents/workspace_layout_migration.py`
- Create: `tests/test_workspace_layout_migration.py`

- [ ] **Step 1: Add migration tests**

Create `tests/test_workspace_layout_migration.py`:

```python
from pathlib import Path

from agents.workspace_layout_migration import migrate_workspace_layout


def test_migrates_legacy_hermes_runtime_dirs(tmp_path):
    workspace = tmp_path / "workspaces" / "ws-123"
    legacy_sessions = workspace / ".hermes" / "sessions"
    legacy_sessions.mkdir(parents=True)
    (legacy_sessions / "sessions.json").write_text("{}", encoding="utf-8")

    result = migrate_workspace_layout(workspace)

    assert result["migrated"] is True
    assert (workspace / "sessions" / "sessions.json").read_text(encoding="utf-8") == "{}"
    assert not (workspace / ".hermes" / "sessions" / "sessions.json").exists()


def test_migrates_flat_uploads_to_session_when_manifest_exists(tmp_path):
    workspace = tmp_path / "workspaces" / "ws-123"
    uploads = workspace / "uploads"
    uploads.mkdir(parents=True)
    (uploads / "resume.pdf").write_bytes(b"pdf")
    manifest = uploads / ".upload-session-map.json"
    manifest.write_text('{"resume.pdf": "session_abc"}', encoding="utf-8")

    result = migrate_workspace_layout(workspace)

    assert result["migrated"] is True
    assert (workspace / "session_abc" / "uploads" / "resume.pdf").read_bytes() == b"pdf"


def test_migrates_flat_uploads_preserves_legacy_file_types(tmp_path):
    workspace = tmp_path / "workspaces" / "ws-123"
    uploads = workspace / "uploads"
    uploads.mkdir(parents=True)
    (uploads / "candidates.csv").write_bytes(b"name,score\n")
    (uploads / "scores.xlsx").write_bytes(b"xlsx")
    manifest = uploads / ".upload-session-map.json"
    manifest.write_text(
        '{"candidates.csv": "session_abc", "scores.xlsx": "session_abc"}',
        encoding="utf-8",
    )

    result = migrate_workspace_layout(workspace)

    assert result["migrated"] is True
    assert (workspace / "session_abc" / "uploads" / "candidates.csv").read_bytes() == b"name,score\n"
    assert (workspace / "session_abc" / "uploads" / "scores.xlsx").read_bytes() == b"xlsx"


def test_migrate_flat_uploads_rejects_path_traversal_session_id(tmp_path):
    workspace = tmp_path / "ws-123"
    uploads = workspace / "uploads"
    uploads.mkdir(parents=True)
    (uploads / "resume.pdf").write_bytes(b"pdf")
    manifest = uploads / ".upload-session-map.json"
    manifest.write_text('{"resume.pdf": "../escaped"}', encoding="utf-8")

    result = migrate_workspace_layout(workspace)

    assert result["status"] == "ok"
    assert not (tmp_path / "escaped" / "uploads" / "resume.pdf").exists()
    assert (uploads / "resume.pdf").exists()
```

- [ ] **Step 2: Run migration tests to verify they fail**

Run:

```bash
pytest -q tests/test_workspace_layout_migration.py
```

Expected: fail because the module does not exist yet.

- [ ] **Step 3: Implement explicit migration module**

Create `src/agents/workspace_layout_migration.py`:

```python
from __future__ import annotations

import json
from pathlib import Path
import shutil
from typing import Any

from agents.workspace_uploads import sanitize_upload_session_id


_DIR_MOVES = {
    ".hermes/sessions": "sessions",
    ".hermes/memories": "memories",
    ".hermes/skills": "skills",
    ".hermes/profiles": "profiles",
    ".hermes/cron": "cron",
    ".hermes/logs": "logs",
    ".hermes/home": "home",
    ".swarm/runs": "swarm/runs",
}


def _move_tree(source: Path, target: Path) -> bool:
    if not source.exists():
        return False
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists():
        for child in source.iterdir():
            destination = target / child.name
            if destination.exists():
                continue
            shutil.move(str(child), str(destination))
        return True
    shutil.move(str(source), str(target))
    return True


def _safe_existing_upload_filename(value: object) -> str | None:
    filename = Path(str(value or "").strip()).name
    if not filename or filename in {".", ".."}:
        return None
    if "/" in filename or "\\" in filename:
        return None
    return filename


def _migrate_flat_uploads(workspace_root: Path) -> bool:
    uploads = workspace_root / "uploads"
    manifest = uploads / ".upload-session-map.json"
    if not uploads.exists() or not manifest.exists():
        return False
    mapping = json.loads(manifest.read_text(encoding="utf-8"))
    if not isinstance(mapping, dict):
        raise ValueError("upload session manifest must be an object")
    migrated = False
    for filename, session_id in mapping.items():
        try:
            session_id_safe = sanitize_upload_session_id(str(session_id))
        except ValueError:
            continue
        filename_safe = _safe_existing_upload_filename(filename)
        if filename_safe is None:
            continue
        source = uploads / filename_safe
        if not source.is_file():
            continue
        target_dir = workspace_root / session_id_safe / "uploads"
        target_dir.mkdir(parents=True, exist_ok=True)
        target = target_dir / source.name
        if target.exists():
            continue
        shutil.move(str(source), str(target))
        migrated = True
    return migrated


def migrate_workspace_layout(workspace_root: Path) -> dict[str, Any]:
    root = Path(workspace_root)
    migrated = False
    for source_rel, target_rel in _DIR_MOVES.items():
        migrated = _move_tree(root / source_rel, root / target_rel) or migrated
    migrated = _migrate_flat_uploads(root) or migrated
    return {"status": "ok", "migrated": migrated, "workspace_root": str(root)}
```

- [ ] **Step 4: Run migration tests**

Run:

```bash
pytest -q tests/test_workspace_layout_migration.py
```

Expected: migration tests pass.

---

### Task 9: Final Verification and Cleanup

**Files:**
- Modify as needed based on failing assertions from the full suite.

- [ ] **Step 1: Search for stale canonical `.hermes` workspace references**

Run:

```bash
rg -n "workspaces/<workspace_id>/\\.hermes|workspace/.hermes|/\\.hermes/sessions|workspace_root / \"\\.hermes\"" docs src tests
```

Expected: only explicit legacy migration or compatibility comments remain.

- [ ] **Step 2: Search for flat upload root writes**

Run:

```bash
rg -n "workspace_root / \"uploads\"|workspaces/<workspace_id>/uploads|relative_path.*uploads/" docs src tests
```

Expected: no new-write paths use `workspaces/<workspace_id>/uploads`; allowed references must explicitly say legacy migration.

- [ ] **Step 3: Run focused suites**

Run:

```bash
pytest -q tests/test_runtime_paths.py
pytest -q tests/test_gateway_identity.py
pytest -q tests/test_workspace_uploads.py
pytest -q tests/test_hermes_api_compat.py -k "upload or workspace or session"
pytest -q tests/test_route_policy_matrix.py
```

Expected: all focused suites pass.

- [ ] **Step 4: Run broader regression**

Run:

```bash
pytest -q
```

Expected: full test suite passes, or failures are unrelated and documented with exact failing test names.

- [ ] **Step 5: Manual live verification**

Start gateway:

```bash
semantier run --replace
```

Upload through the chat UI or proxy and verify:

```bash
find workspaces -path "*/session_*/uploads/*" -type f
find workspaces -path "*/uploads/*" -type f
find workspaces -path "*/.hermes/*" -type f
```

Expected:

- New upload appears under `workspaces/<workspace_id>/<session_id>/uploads/`.
- No new file appears under `workspaces/<workspace_id>/uploads/`.
- No new authenticated workspace runtime file appears under `workspaces/<workspace_id>/.hermes/`.

---

## Self-Review

Spec coverage:

- Session-scoped upload path is covered by Task 5.
- Same filename in different sessions is covered by Task 5 tests.
- Same filename racing in one session is covered by Task 5 atomic `open("xb")` implementation.
- Removing `.hermes` as an authenticated workspace runtime home is covered by Tasks 1, 2, 3, 4, 6, 7, and 8.
- Legacy `.hermes` compatibility is explicit migration only, covered by Task 8.

Known implementation risk:

- This is a broad architecture migration. The highest-risk areas are `HERMES_HOME` assumptions in embedded Hermes libraries and session-log path assumptions in `workspace_session_logs.py`.
- Do not execute this as one large patch. Complete Tasks 1-5 first if the immediate goal is upload safety; execute Tasks 6-8 only after reviewing all `.hermes` consumers.
