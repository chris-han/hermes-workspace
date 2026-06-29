# Feishu Meeting Coordinator Design Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align `semantier-skills/plugins/feishu_meeting_coordinator/` and its Semantier runtime glue with `docs/derived/feishu-meeting-coordinator-plugin-design.md`.

**Architecture:** Keep durable orchestration in `src/agents/meeting_coordinator_*` and keep plugin handlers thin. Preserve governed Feishu session authority, SQLite continuity, prompt assets under `src/prompts/meeting_coordinator/`, and separate RSVP-monitor and delivery-retry lifecycles. Treat the design doc as the target contract, except where it explicitly labels a behavior as a current implementation note.

**Tech Stack:** Python 3.12, SQLite, pytest, Hermes plugin registration, Hermes cron APIs, Semantier Web API gateway.

---

## Comparison Summary

The current implementation already matches these design requirements:

- Plugin package shape exists under `semantier-skills/plugins/feishu_meeting_coordinator/` with `plugin.yaml`, `__init__.py`, `tools.py`, `messages.py`, `cli.py`, `dashboard/plugin_api.py`, `scripts/feishu_bot_api.py`, and bundled `SKILL.md`.
- The marketplace entry exists under top-level `skills` in `semantier-skills/marketplace/index.json`.
- Plugin registration includes all design-listed tools, `toolset="meeting-coordinator"`, a bundled skill path, and CLI command `feishu-meeting-coordinator`.
- Durable RSVP state uses SQLite through `src/agents/meeting_coordinator_store.py`, not unmanaged JSON files.
- RSVP normalization uses ASCII machine values and treats `accepted`, `declined`, and `tentative` as terminal.
- Follow-up and creator escalation state are separate from live RSVP truth.
- Creator escalation retry uses a separate `meeting-rsvp-delivery-retry:<workspace_id>` cron path.
- Prompt prose for follow-ups, escalations, cancel suggestions, and delivery retry lives in `src/prompts/meeting_coordinator/`.
- Feishu chat requester resolution fails closed when no trusted Feishu session requester exists.

The main remaining design/code drifts to refactor are:

1. Monitor cron shape drift: `semantier-skills/plugins/feishu_meeting_coordinator/tools.py` and `src/agents/webapi_gateway.py` prefer deterministic no-agent script cron jobs, while the design contract says monitor jobs should run with `profile="meeting-coordinator"`, `skills=["feishu_meeting_coordinator"]`, and prompt asset `RSVP_MONITOR_JOB.md`.
2. Public schema hardening drift: `feishu_meeting_monitor_start` exposes `workspace_id` as required and exposes `creator_delivery_binding`, while the design says public calls should derive workspace, creator, and delivery binding from trusted session metadata when available.
3. Manual stop audit drift: `monitor_stop` removes/disables cron but does not persist `cancelled`, matching a current behavior note but not the hardening target.
4. Pending-start failure semantics drift: scheduler setup failure remains `pending_start` with `last_start_error`; the design calls out future `failed` state hardening for unrecoverable setup failures.
5. Operator surfaces are thin: `dashboard/plugin_api.py` is an empty executable placeholder, and `cli.py` prints a static string instead of listing monitor state.
6. Web UI operator panel is not implemented in `hermes-workspace/src/screens/agents/operations-screen.tsx`.
7. Prompt resolution caveat remains: `messages.py` only works in repo-local layouts where `src/prompts/meeting_coordinator/` is reachable by walking parents.

## File Structure

Modify:

- `src/agents/meeting_coordinator_gateway.py` - remove monitor no-agent script preference, create profile-backed RSVP monitor cron, add cancelled/failed store calls.
- `src/agents/meeting_coordinator_store.py` - add monitor `cancelled` and `failed` transitions, keep timestamp writes UTC-aware.
- `src/agents/webapi_gateway.py` - align Web API cron client monitor-job creation/healing with profile-backed prompt jobs; keep delivery retry behavior unchanged.
- `semantier-skills/plugins/feishu_meeting_coordinator/tools.py` - remove or deprecate `_LocalCronClient.ensure_monitor_tick_job`, harden monitor-start payload authority derivation.
- `semantier-skills/plugins/feishu_meeting_coordinator/__init__.py` - adjust public schema for monitor start so `workspace_id` and `creator_delivery_binding` are compatibility inputs, not public authority.
- `semantier-skills/plugins/feishu_meeting_coordinator/cli.py` - make `monitors` inspect persisted state.
- `semantier-skills/plugins/feishu_meeting_coordinator/dashboard/plugin_api.py` - either remove from package inventory or make it a thin adapter that delegates to gateway/store helpers.
- `semantier-skills/plugins/feishu_meeting_coordinator/messages.py` - support an injected prompt root env var for marketplace installs.
- `hermes-workspace/src/screens/agents/components/meeting-coordinator-panel.tsx` - expand the existing Meeting Coordinator operator panel to the full design field/action coverage.

Test:

- `tests/test_meeting_coordinator_gateway.py`
- `tests/test_meeting_coordinator_webapi.py`
- `tests/test_feishu_meeting_coordinator_tools.py`
- `tests/test_feishu_meeting_coordinator_plugin.py`
- `tests/test_feishu_meeting_coordinator_messages.py`
- `tests/test_feishu_meeting_coordinator_package_inventory.py`
- Add `tests/test_feishu_meeting_coordinator_cli.py`
- Add `hermes-workspace/src/screens/agents/components/meeting-coordinator-panel.test.tsx`.

Do not modify:

- `docs/derived/feishu-meeting-coordinator-plugin-design.md` except to record intentional design changes after implementation.
- `docs/canonical/architecture.md` unless the architecture contract itself changes, which this plan does not require.

---

### Task 1: Lock Current Inventory And Authority Contracts

**Files:**
- Modify: `tests/test_feishu_meeting_coordinator_plugin.py`
- Modify: `tests/test_feishu_meeting_coordinator_tools.py`
- Test: `tests/test_feishu_meeting_coordinator_plugin.py`
- Test: `tests/test_feishu_meeting_coordinator_tools.py`

- [ ] **Step 1: Confirm current session-resolution helper names**

Run:

```bash
rg -n "def (_prepare_monitor_payload|_workspace_id_from_session|_creator_delivery_binding|_session_metadata|_feishu_chat_initiator_open_id|_requester_open_id)" semantier-skills/plugins/feishu_meeting_coordinator/tools.py
```

Expected: these helpers exist in `tools.py`. If one is absent because the file changed before implementation, define the missing helper with the name used by this plan before adding tests that monkeypatch it.

- [ ] **Step 2: Add schema assertions for monitor-start authority fields**

Add this test to `tests/test_feishu_meeting_coordinator_plugin.py`:

```python
def test_monitor_start_schema_marks_authority_fields_as_runtime_compatibility():
    module = load_plugin_module()
    ctx = FakePluginContext()

    module.register(ctx)

    schema = ctx.tools["feishu_meeting_monitor_start"]["schema"]["parameters"]
    assert "creator_user_id" not in schema["properties"]
    assert "workspace_id" in schema["properties"]
    assert "trusted gateway/runtime compatibility" in schema["properties"]["workspace_id"]["description"]
    assert "creator_delivery_binding" in schema["properties"]
    assert "trusted gateway/runtime compatibility" in schema["properties"]["creator_delivery_binding"]["description"]
    assert "workspace_id" not in schema["required"]
    assert set(schema["required"]) == {"event_id", "event_revision_id", "calendar_id"}
```

- [ ] **Step 3: Add monitor-start runtime authority test**

Add this test to `tests/test_feishu_meeting_coordinator_tools.py`:

```python
def test_monitor_start_prefers_trusted_session_workspace_and_creator(monkeypatch):
    tools = load_tools_module()
    seen = {}

    class Gateway:
        def start_monitor(self, payload):
            seen["payload"] = payload
            return {"monitor_id": "m_1", "status": "active"}

    monkeypatch.setattr(
        tools,
        "_session_metadata",
        lambda: {
            "platform": "feishu",
            "origin_user_id": "ou_trusted_creator",
            "workspace_id": "ws_trusted",
            "chat_id": "oc_creator",
            "session_id": "sess_1",
            "session_key": "key_1",
            "hermes_home": "/tmp/hermes",
        },
    )
    monkeypatch.setattr(tools, "_feishu_chat_initiator_open_id", lambda: "ou_trusted_creator")

    raw = tools.feishu_meeting_monitor_start(
        {
            "workspace_id": "ws_untrusted",
            "event_id": "event_1",
            "event_revision_id": "rev_1",
            "calendar_id": "cal_1",
            "creator_delivery_binding": {
                "workspace_owner_id": "ws_untrusted",
                "creator_user_id": "ou_attacker",
                "platform": "feishu",
                "chat_id": "oc_attacker",
            },
            "attendees": [{"user_id": "ou_a", "message_user_id": "ou_a"}],
        },
        gateway=Gateway(),
    )

    payload = json.loads(raw)
    assert payload["ok"] is True
    assert seen["payload"]["workspace_id"] == "ws_trusted"
    assert seen["payload"]["creator_user_id"] == "ou_trusted_creator"
    assert seen["payload"]["creator_delivery_binding"]["workspace_owner_id"] == "ws_trusted"
    assert seen["payload"]["creator_delivery_binding"]["creator_user_id"] == "ou_trusted_creator"
    assert seen["payload"]["creator_delivery_binding"]["chat_id"] == "oc_creator"
```

- [ ] **Step 4: Run the focused tests and verify they fail**

Run:

```bash
pytest -v tests/test_feishu_meeting_coordinator_plugin.py::test_monitor_start_schema_marks_authority_fields_as_runtime_compatibility tests/test_feishu_meeting_coordinator_tools.py::test_monitor_start_prefers_trusted_session_workspace_and_creator
```

Expected: both tests fail before implementation. The schema test should fail because `workspace_id` is required or descriptions are missing. The authority test should fail if the gateway-injected path bypasses trusted session normalization.

- [ ] **Step 5: Implement schema and payload hardening**

In `semantier-skills/plugins/feishu_meeting_coordinator/__init__.py`, update the `feishu_meeting_monitor_start` schema:

```python
"workspace_id": {
    "type": "string",
    "description": "Trusted gateway/runtime compatibility workspace id. In Feishu sessions, session metadata is authoritative.",
},
...
"creator_delivery_binding": {
    **_CREATOR_BINDING_SCHEMA,
    "description": "Trusted gateway/runtime compatibility binding. Normal Feishu chat calls omit this and use session metadata.",
},
```

Set required fields to:

```python
required=("event_id", "event_revision_id", "calendar_id")
```

In `semantier-skills/plugins/feishu_meeting_coordinator/tools.py`, change `feishu_meeting_monitor_start` so trusted Feishu session metadata is applied before any gateway call, including tests that inject `gateway=`:

```python
def feishu_meeting_monitor_start(args, **kwargs):
    try:
        payload = _prepare_monitor_payload(dict(args or {}))
        monitor = _gateway(kwargs).start_monitor(payload)
    except Exception as exc:
        return _error(str(exc))
    return _ok("monitor", monitor)
```

In `_prepare_monitor_payload`, set `workspace_id` from trusted session metadata first:

```python
session_workspace_id = _workspace_id_from_session(metadata)
workspace_id = session_workspace_id or _text(payload.get("workspace_id"))
```

Set creator from trusted requester only:

```python
prepared["creator_user_id"] = requester_open_id
prepared["creator_delivery_binding"] = _creator_delivery_binding(metadata, requester_open_id)
```

This intentionally stops preserving caller-supplied creator authority in public tool paths.

- [ ] **Step 6: Run the focused tests and verify they pass**

Run:

```bash
pytest -v tests/test_feishu_meeting_coordinator_plugin.py::test_monitor_start_schema_marks_authority_fields_as_runtime_compatibility tests/test_feishu_meeting_coordinator_tools.py::test_monitor_start_prefers_trusted_session_workspace_and_creator
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add semantier-skills/plugins/feishu_meeting_coordinator/__init__.py semantier-skills/plugins/feishu_meeting_coordinator/tools.py tests/test_feishu_meeting_coordinator_plugin.py tests/test_feishu_meeting_coordinator_tools.py
git commit -m "fix: harden Feishu monitor start authority"
```

### Task 2: Restore Profile-Backed RSVP Monitor Cron Jobs

**Files:**
- Modify: `src/agents/meeting_coordinator_gateway.py`
- Modify: `src/agents/webapi_gateway.py`
- Modify: `semantier-skills/plugins/feishu_meeting_coordinator/tools.py`
- Modify: `tests/test_meeting_coordinator_gateway.py`
- Modify: `tests/test_meeting_coordinator_webapi.py`

- [ ] **Step 1: Confirm prompt and skill-reference helpers**

Run:

```bash
rg -n "def _prompt\\(|def _workspace_skill_refs|class MeetingCoordinatorWebApiCronClient|class _LocalCronClient" src/agents/meeting_coordinator_gateway.py src/agents/webapi_gateway.py semantier-skills/plugins/feishu_meeting_coordinator/tools.py
```

Expected: `src/agents/meeting_coordinator_gateway.py` already defines `_prompt(name: str, **values: str)`, and both cron clients already define `_workspace_skill_refs`. If either helper is absent because the implementation changed, add it before continuing:

```python
def _prompt(name: str, **values: str) -> str:
    text = (_PROMPTS_ROOT / name).read_text(encoding="utf-8")
    for key, value in values.items():
        text = text.replace("{{" + key + "}}", str(value))
    return text
```

- [ ] **Step 2: Replace deterministic no-agent cron expectations**

In `tests/test_meeting_coordinator_gateway.py`, remove `DeterministicFakeCronClient` and `test_start_monitor_prefers_deterministic_cron`. Add this assertion to `test_start_monitor_creates_profile_cron`:

```python
assert "Run feishu_meeting_monitor_tick" in cron.created[0]["prompt"]
assert "monitor_id=" in cron.created[0]["prompt"]
assert cron.created[0]["skills"] == ["feishu_meeting_coordinator"]
```

In `tests/test_meeting_coordinator_webapi.py`, replace `test_meeting_coordinator_cron_client_creates_deterministic_monitor_job` with:

```python
def test_meeting_coordinator_cron_client_creates_profile_monitor_job(tmp_path, monkeypatch):
    from agents import webapi_gateway

    created = []
    workspace_home = tmp_path / ".hermes"

    class Ctx:
        workspace_id = "ws_1"
        hermes_home = workspace_home

    monkeypatch.setattr(webapi_gateway, "_list_workspace_cron_jobs", lambda ctx, include_disabled=True: [])
    monkeypatch.setattr(
        webapi_gateway,
        "_create_workspace_cron_job",
        lambda ctx, body: created.append(body) or {"id": "cron_1", **body},
    )

    client = webapi_gateway.MeetingCoordinatorWebApiCronClient(Ctx())
    cron_id = client.ensure_job(
        name="meeting-rsvp-monitor:m_1",
        schedule="every 2m",
        profile="meeting-coordinator",
        prompt="Run feishu_meeting_monitor_tick for monitor_id=m_1.",
        skills=["feishu_meeting_coordinator"],
        deliver="local",
        repeat=0,
    )

    assert cron_id == "cron_1"
    assert created[0]["no_agent"] is False
    assert created[0]["script"] is None
    assert created[0]["profile"] == "meeting-coordinator"
    assert created[0]["skills"] == ["feishu_meeting_coordinator"]
    assert created[0]["prompt"] == "Run feishu_meeting_monitor_tick for monitor_id=m_1."
```

Delete or rewrite `test_meeting_coordinator_cron_client_heals_prompt_monitor_job_to_script` so the expected healing direction is from script/no-agent to prompt/profile:

```python
def test_meeting_coordinator_cron_client_heals_script_monitor_job_to_profile_prompt(tmp_path, monkeypatch):
    from agents import webapi_gateway

    updates = []
    workspace_home = tmp_path / ".hermes"

    class Ctx:
        workspace_id = "ws_1"
        hermes_home = workspace_home

    monkeypatch.setattr(
        webapi_gateway,
        "_list_workspace_cron_jobs",
        lambda ctx, include_disabled=True: [
            {
                "id": "cron_1",
                "name": "meeting-rsvp-monitor:m_1",
                "enabled": True,
                "prompt": "",
                "skills": [],
                "profile": None,
                "no_agent": True,
                "script": "semantier_meeting_monitor_tick_m_1.py",
            }
        ],
    )
    monkeypatch.setattr(
        webapi_gateway,
        "_update_workspace_cron_job",
        lambda ctx, job_id, update: updates.append((job_id, update)) or {"id": job_id, **update},
    )

    client = webapi_gateway.MeetingCoordinatorWebApiCronClient(Ctx())
    monkeypatch.setattr(client, "_workspace_skill_refs", lambda skills: list(skills))
    cron_id = client.ensure_job(
        name="meeting-rsvp-monitor:m_1",
        schedule="every 2m",
        profile="meeting-coordinator",
        prompt="Run feishu_meeting_monitor_tick for monitor_id=m_1.",
        skills=["feishu_meeting_coordinator"],
        deliver="local",
        repeat=0,
    )

    assert cron_id == "cron_1"
    assert updates == [
        (
            "cron_1",
            {
                "enabled": True,
                "no_agent": False,
                "script": None,
                "prompt": "Run feishu_meeting_monitor_tick for monitor_id=m_1.",
                "skills": ["feishu_meeting_coordinator"],
                "profile": "meeting-coordinator",
            },
        )
    ]
```

The `client._workspace_skill_refs` monkeypatch keeps this unit test focused on script-to-profile healing. A separate Web API cron-client test should continue to cover installed-skill resolution to `feishu_meeting_coordinator:feishu-bot-meeting-coordinator`.

- [ ] **Step 3: Run tests and verify failures**

Run:

```bash
pytest -v tests/test_meeting_coordinator_gateway.py::test_start_monitor_creates_profile_cron tests/test_meeting_coordinator_webapi.py::test_meeting_coordinator_cron_client_creates_profile_monitor_job tests/test_meeting_coordinator_webapi.py::test_meeting_coordinator_cron_client_heals_script_monitor_job_to_profile_prompt
```

Expected: gateway test may pass for fake cron but Web API tests fail because the Web API cron client still has script/no-agent monitor helpers.

- [ ] **Step 4: Remove deterministic monitor script creation from gateway**

In `src/agents/meeting_coordinator_gateway.py`, remove `DeterministicMonitorCronClient` and `monitor_tick_cron_script`. Simplify `start_monitor` to always create or heal a profile-backed cron through `ensure_job`:

```python
def start_monitor(
    payload: dict[str, Any],
    *,
    store: MeetingCoordinatorStore,
    cron: CronClient,
) -> dict[str, Any]:
    monitor = store.start_monitor(payload)
    cron_id = str(monitor.get("cron_job_id") or "")
    if cron_id and cron.job_exists(cron_id):
        return monitor
    try:
        prompt = _prompt(
            "RSVP_MONITOR_JOB.md",
            monitor_id=monitor["monitor_id"],
            workspace_id=monitor["workspace_id"],
            event_id=monitor["event_id"],
            calendar_id=monitor["calendar_id"],
        )
        new_cron_id = cron.ensure_job(
            name=f"meeting-rsvp-monitor:{monitor['monitor_id']}",
            schedule="every 2m",
            profile="meeting-coordinator",
            prompt=prompt,
            skills=["feishu_meeting_coordinator"],
            deliver="local",
            repeat=0,
        )
    except Exception as exc:
        return store.mark_monitor_start_failed(monitor["monitor_id"], detail=str(exc))
    return store.attach_cron_job(monitor["monitor_id"], new_cron_id)
```

- [ ] **Step 5: Remove script monitor helpers from plugin cron client**

In `semantier-skills/plugins/feishu_meeting_coordinator/tools.py`, remove `_LocalCronClient.ensure_monitor_tick_job`. Leave `_workspace_skill_refs`, `ensure_job`, `job_exists`, `disable_job`, and `delete_job`.

- [ ] **Step 6: Align Web API cron client**

In `src/agents/webapi_gateway.py`, remove `MeetingCoordinatorWebApiCronClient.ensure_monitor_tick_job` and its import of `monitor_tick_cron_script`. Ensure `ensure_job` sends/updates these fields for any monitor job:

```python
{
    "name": name,
    "schedule": schedule,
    "prompt": prompt,
    "skills": self._workspace_skill_refs(skills),
    "deliver": deliver,
    "repeat": repeat,
    "profile": profile,
    "no_agent": False,
    "script": None,
}
```

When healing an existing job, include updates for:

```python
if job.get("enabled") is False:
    updates["enabled"] = True
if job.get("no_agent") is not False:
    updates["no_agent"] = False
if job.get("script") is not None:
    updates["script"] = None
if str(job.get("prompt") or "") != prompt:
    updates["prompt"] = prompt
if list(job.get("skills") or []) != resolved_skills:
    updates["skills"] = resolved_skills
if str(job.get("profile") or "") != profile:
    updates["profile"] = profile
```

- [ ] **Step 7: Run focused cron tests**

Run:

```bash
pytest -v tests/test_meeting_coordinator_gateway.py tests/test_meeting_coordinator_webapi.py
```

Expected: PASS after updating any obsolete test names and expectations.

- [ ] **Step 8: Commit**

```bash
git add src/agents/meeting_coordinator_gateway.py src/agents/webapi_gateway.py semantier-skills/plugins/feishu_meeting_coordinator/tools.py tests/test_meeting_coordinator_gateway.py tests/test_meeting_coordinator_webapi.py
git commit -m "fix: align meeting monitor cron jobs with coordinator profile"
```

### Task 3: Persist Cancelled And Failed Monitor States

**Files:**
- Modify: `src/agents/meeting_coordinator_store.py`
- Modify: `src/agents/meeting_coordinator_gateway.py`
- Modify: `docs/derived/feishu-meeting-coordinator-plugin-design.md`
- Modify: `tests/test_meeting_coordinator_store.py`
- Modify: `tests/test_meeting_coordinator_gateway.py`

- [ ] **Step 1: Add store tests for monitor terminal states**

Add to `tests/test_meeting_coordinator_store.py`:

```python
def test_store_marks_monitor_cancelled(tmp_path):
    db = store.MeetingCoordinatorStore(tmp_path / "state.db")
    monitor = db.start_monitor(_payload())

    cancelled = db.mark_monitor_cancelled(monitor["monitor_id"], detail="operator stop")

    assert cancelled["status"] == "cancelled"
    assert cancelled["completed_at"].endswith("Z")
    assert cancelled["last_start_error"] == "operator stop"


def test_store_marks_monitor_failed(tmp_path):
    db = store.MeetingCoordinatorStore(tmp_path / "state.db")
    monitor = db.start_monitor(_payload())

    failed = db.mark_monitor_failed(monitor["monitor_id"], detail="cron unavailable")

    assert failed["status"] == "failed"
    assert failed["completed_at"].endswith("Z")
    assert failed["last_start_error"] == "cron unavailable"
```

- [ ] **Step 2: Add gateway tests for stop and unrecoverable cron setup**

Add to `tests/test_meeting_coordinator_gateway.py`:

```python
def test_monitor_stop_marks_monitor_cancelled(tmp_path):
    store = MeetingCoordinatorStore(tmp_path / "state.db")
    cron = CompletionCronClient()
    monitor = gateway.start_monitor(payload(), store=store, cron=cron)

    result = gateway.monitor_stop(
        {"monitor_id": monitor["monitor_id"], "reason": "operator stop"},
        store=store,
        cron=cron,
    )

    saved = store.get_monitor(monitor["monitor_id"])
    assert result == {"monitor_id": monitor["monitor_id"], "stopped": True, "status": "cancelled"}
    assert saved["status"] == "cancelled"
    assert saved["last_start_error"] == "operator stop"
    assert cron.deleted == ["cron_1"]


def test_start_monitor_can_mark_unrecoverable_setup_failure_failed(tmp_path):
    store = MeetingCoordinatorStore(tmp_path / "state.db")

    result = gateway.start_monitor(
        {**payload(), "scheduler_failure_terminal": True},
        store=store,
        cron=FailingCronClient(),
    )

    assert result["status"] == "failed"
    assert result["last_start_error"] == "cron unavailable"
```

- [ ] **Step 3: Run tests and verify failures**

Run:

```bash
pytest -v tests/test_meeting_coordinator_store.py::test_store_marks_monitor_cancelled tests/test_meeting_coordinator_store.py::test_store_marks_monitor_failed tests/test_meeting_coordinator_gateway.py::test_monitor_stop_marks_monitor_cancelled tests/test_meeting_coordinator_gateway.py::test_start_monitor_can_mark_unrecoverable_setup_failure_failed
```

Expected: FAIL because `mark_monitor_cancelled` and `mark_monitor_failed` do not exist and `monitor_stop` does not persist status.

- [ ] **Step 4: Implement store transitions**

Add to `MeetingCoordinatorStore`:

```python
def mark_monitor_cancelled(self, monitor_id: str, *, detail: str | None = None) -> dict[str, Any]:
    now = utc_now_iso()
    with self._connect() as conn:
        conn.execute(
            """
            UPDATE meeting_rsvp_monitors
            SET status='cancelled',
                completed_at=COALESCE(completed_at, ?),
                last_start_error=?,
                updated_at=?
            WHERE monitor_id=?
            """,
            (now, detail, now, monitor_id),
        )
    return self.get_monitor(monitor_id)

def mark_monitor_failed(self, monitor_id: str, *, detail: str) -> dict[str, Any]:
    now = utc_now_iso()
    with self._connect() as conn:
        conn.execute(
            """
            UPDATE meeting_rsvp_monitors
            SET status='failed',
                completed_at=COALESCE(completed_at, ?),
                last_start_error=?,
                updated_at=?
            WHERE monitor_id=?
            """,
            (now, detail, now, monitor_id),
        )
    return self.get_monitor(monitor_id)
```

This deliberately reuses `last_start_error` for the cancellation reason because the current schema has no `cancelled_reason` column. Record that as technical debt in the design doc in Step 6; do not add a new column in this task unless the implementation owner chooses to do the broader schema migration and compatibility tests.

Update replacement query status set from:

```sql
status IN ('active', 'pending_start', 'error')
```

to:

```sql
status IN ('active', 'pending_start', 'error', 'failed')
```

Do not replace `complete`, `cancelled`, or already `replaced` rows.

- [ ] **Step 5: Implement gateway transitions**

In `start_monitor`, replace cron failure handling with:

```python
    except Exception as exc:
        detail = str(exc)
        if payload.get("scheduler_failure_terminal") is True:
            return store.mark_monitor_failed(monitor["monitor_id"], detail=detail)
        return store.mark_monitor_start_failed(monitor["monitor_id"], detail=detail)
```

Treat `scheduler_failure_terminal` as a trusted gateway/runtime-only compatibility flag. Do not expose it in the public plugin schema in `semantier-skills/plugins/feishu_meeting_coordinator/__init__.py`, and do not copy it from untrusted public tool arguments into `_prepare_monitor_payload`.

In `_monitor_is_terminal`, include `failed`:

```python
return str(monitor.get("status") or "") in {"complete", "cancelled", "replaced", "failed"}
```

In `monitor_stop`, persist cancellation:

```python
def monitor_stop(
    payload: dict[str, Any],
    *,
    store: MeetingCoordinatorStore,
    cron: CronClient,
) -> dict[str, Any]:
    monitor_id = str(payload["monitor_id"])
    monitor = store.get_monitor(monitor_id)
    _dismiss_monitor_cron(monitor, cron)
    reason = str(payload.get("reason") or "operator stop")
    cancelled = store.mark_monitor_cancelled(monitor_id, detail=reason)
    return {"monitor_id": monitor_id, "stopped": True, "status": cancelled["status"]}
```

- [ ] **Step 6: Update the design doc for the hardened stop output and internal failure flag**

In `docs/derived/feishu-meeting-coordinator-plugin-design.md`, update the `feishu_meeting_monitor_stop` output contract from:

```json
{
  "ok": true,
  "result": {
    "monitor_id": "string",
    "stopped": true
  }
}
```

to:

```json
{
  "ok": true,
  "result": {
    "monitor_id": "string",
    "stopped": true,
    "status": "cancelled"
  }
}
```

Also update the monitor state-machine hardening note to state:

```text
Manual stop now persists status='cancelled'. Until a dedicated cancelled_reason column is added, the operator reason is stored in last_start_error for compatibility with the existing schema; this is technical debt, not a new semantic meaning for scheduler errors.

scheduler_failure_terminal is an internal trusted gateway/runtime flag used to promote unrecoverable scheduler setup failures to failed; it is not part of the public tool schema.
```

- [ ] **Step 7: Run focused tests**

Run:

```bash
pytest -v tests/test_meeting_coordinator_store.py tests/test_meeting_coordinator_gateway.py
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/agents/meeting_coordinator_store.py src/agents/meeting_coordinator_gateway.py docs/derived/feishu-meeting-coordinator-plugin-design.md tests/test_meeting_coordinator_store.py tests/test_meeting_coordinator_gateway.py
git commit -m "feat: persist meeting monitor terminal states"
```

### Task 4: Make Operator CLI And Dashboard Adapter Real Thin Surfaces

**Files:**
- Modify: `semantier-skills/plugins/feishu_meeting_coordinator/cli.py`
- Modify: `semantier-skills/plugins/feishu_meeting_coordinator/dashboard/plugin_api.py`
- Add: `tests/test_feishu_meeting_coordinator_cli.py`
- Modify: `tests/test_feishu_meeting_coordinator_package_inventory.py`

- [ ] **Step 1: Confirm store operator methods exist**

Run:

```bash
rg -n "def (list_operation_monitors|list_operation_delivery_tasks|get_workspace_state)" src/agents/meeting_coordinator_store.py
```

Expected: all three methods exist on `MeetingCoordinatorStore`. If a method is absent, add it before implementing CLI/dashboard adapters, using the SQL shapes already described in the Durable State and Observability sections of `docs/derived/feishu-meeting-coordinator-plugin-design.md`.

- [ ] **Step 2: Add CLI behavior tests**

Create `tests/test_feishu_meeting_coordinator_cli.py`:

```python
from __future__ import annotations

import importlib.util
import sys
from argparse import ArgumentParser
from pathlib import Path
from types import SimpleNamespace


def load_cli_module():
    module_path = Path("semantier-skills/plugins/feishu_meeting_coordinator/cli.py").resolve()
    spec = importlib.util.spec_from_file_location("feishu_meeting_coordinator_cli", module_path)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


class FakeStore:
    def list_operation_monitors(self, *, workspace_id, limit):
        assert workspace_id == "ws_1"
        assert limit == 20
        return [
            {
                "monitor_id": "m_1",
                "status": "active",
                "event_id": "event_1",
                "cron_job_id": "cron_1",
                "pending_delivery_tasks": 0,
            }
        ]


def test_cli_monitors_lists_store_rows(capsys):
    cli = load_cli_module()
    args = SimpleNamespace(command="monitors", workspace_id="ws_1", limit=20, store=FakeStore())

    assert cli.command(args) == 0

    out = capsys.readouterr().out
    assert "m_1" in out
    assert "active" in out
    assert "event_1" in out


def test_cli_registers_monitors_subcommand_default():
    cli = load_cli_module()
    parser = ArgumentParser()
    subparsers = parser.add_subparsers(dest="command")

    cli.register_cli(subparsers)

    args = parser.parse_args(["monitors", "--workspace-id", "ws_1"])
    assert args.command == "monitors"
    assert args.workspace_id == "ws_1"
    assert args.limit == 20
```

- [ ] **Step 3: Add dashboard and CLI inventory tests**

In `tests/test_feishu_meeting_coordinator_package_inventory.py`, add:

```python
def test_plugin_cli_exports_register_and_command():
    cli = Path("semantier-skills/plugins/feishu_meeting_coordinator/cli.py").read_text(
        encoding="utf-8"
    )

    assert "def register_cli(" in cli
    assert "def command(" in cli
    assert "set_defaults(command=\"monitors\")" in cli


def test_dashboard_plugin_api_delegates_to_runtime_gateway():
    adapter = Path("semantier-skills/plugins/feishu_meeting_coordinator/dashboard/plugin_api.py").read_text(
        encoding="utf-8"
    )

    assert "agents import meeting_coordinator_store" in adapter
    assert "agents import meeting_coordinator_gateway" in adapter
    assert "sqlite3.connect" not in adapter
```

- [ ] **Step 4: Run tests and verify failures**

Run:

```bash
pytest -v tests/test_feishu_meeting_coordinator_cli.py tests/test_feishu_meeting_coordinator_package_inventory.py::test_dashboard_plugin_api_delegates_to_runtime_gateway
```

Expected: FAIL because CLI is static and dashboard adapter is empty.

- [ ] **Step 5: Implement CLI monitor listing**

Replace `cli.py` with:

```python
from __future__ import annotations

import json
from typing import Any


def register_cli(parser) -> None:
    monitors = parser.add_parser("monitors")
    monitors.add_argument("--workspace-id", required=True)
    monitors.add_argument("--limit", type=int, default=20)
    monitors.set_defaults(command="monitors")


def _store_from_args(args: Any):
    injected = getattr(args, "store", None)
    if injected is not None:
        return injected
    from agents.meeting_coordinator_store import MeetingCoordinatorStore

    return MeetingCoordinatorStore()


def command(args) -> int:
    command_name = getattr(args, "command", None)
    if command_name != "monitors":
        print("supported commands: monitors")
        return 2
    store = _store_from_args(args)
    rows = store.list_operation_monitors(
        workspace_id=str(args.workspace_id),
        limit=int(args.limit),
    )
    print(json.dumps({"monitors": rows}, ensure_ascii=False, sort_keys=True))
    return 0
```

- [ ] **Step 6: Implement dashboard adapter as a thin delegation layer**

Replace `dashboard/plugin_api.py` with:

```python
from __future__ import annotations

from typing import Any


def list_monitors(*, workspace_id: str, limit: int = 50, store: Any | None = None) -> dict[str, Any]:
    from agents import meeting_coordinator_store

    active_store = store or meeting_coordinator_store.MeetingCoordinatorStore()
    return {
        "monitors": active_store.list_operation_monitors(workspace_id=workspace_id, limit=limit),
        "delivery_tasks": active_store.list_operation_delivery_tasks(workspace_id=workspace_id, limit=limit),
        "workspace_state": active_store.get_workspace_state(workspace_id),
    }


def retry_delivery_now(*, workspace_id: str, store: Any, delivery_client: Any) -> dict[str, Any]:
    from agents import meeting_coordinator_gateway

    return meeting_coordinator_gateway.escalation_retry_tick(
        {"workspace_id": workspace_id},
        store=store,
        delivery_client=delivery_client,
    )


def requeue_delivery_task(*, delivery_task_id: str, reason: str, store: Any, cron: Any) -> dict[str, Any]:
    from agents import meeting_coordinator_gateway

    return meeting_coordinator_gateway.requeue_delivery_task(
        delivery_task_id=delivery_task_id,
        reason=reason,
        store=store,
        cron=cron,
    )
```

- [ ] **Step 7: Run focused tests**

Run:

```bash
pytest -v tests/test_feishu_meeting_coordinator_cli.py tests/test_feishu_meeting_coordinator_package_inventory.py
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add semantier-skills/plugins/feishu_meeting_coordinator/cli.py semantier-skills/plugins/feishu_meeting_coordinator/dashboard/plugin_api.py tests/test_feishu_meeting_coordinator_cli.py tests/test_feishu_meeting_coordinator_package_inventory.py
git commit -m "feat: expose meeting coordinator operator adapters"
```

### Task 5: Make Prompt Resolution Marketplace-Safe

**Files:**
- Modify: `semantier-skills/plugins/feishu_meeting_coordinator/messages.py`
- Modify: `docs/derived/feishu-meeting-coordinator-plugin-design.md`
- Modify: `tests/test_feishu_meeting_coordinator_messages.py`

- [ ] **Step 1: Add env-injected prompt root test**

Add to `tests/test_feishu_meeting_coordinator_messages.py`:

```python
def test_messages_prompt_root_can_be_injected(monkeypatch, tmp_path):
    prompt_root = tmp_path / "prompts"
    prompt_root.mkdir()
    (prompt_root / "FOLLOWUP_MESSAGE.md").write_text("Hello {{attendee_name}}", encoding="utf-8")
    messages = load_messages_module()

    monkeypatch.setenv("SEMANTIER_MEETING_COORDINATOR_PROMPT_ROOT", str(prompt_root))

    rendered = messages.render_followup_message(
        attendee_name="Amy",
        meeting_title="Planning",
        start_time="2026-06-18T01:00:00Z",
        organizer_name="Chris",
        response_status="needs_action",
    )

    assert rendered == "Hello Amy"
```

- [ ] **Step 2: Run test and verify failure**

Run:

```bash
pytest -v tests/test_feishu_meeting_coordinator_messages.py::test_messages_prompt_root_can_be_injected
```

Expected: FAIL because `messages.py` does not read `SEMANTIER_MEETING_COORDINATOR_PROMPT_ROOT`.

- [ ] **Step 3: Implement env prompt root**

In `messages.py`, add this module docstring, import `os`, and update `_prompt_root`:

```python
"""Prompt rendering for Feishu meeting coordinator messages.

Set SEMANTIER_MEETING_COORDINATOR_PROMPT_ROOT to the directory containing
meeting-coordinator prompt assets when this plugin is installed outside the
repo-local layout.
"""
```

```python
import os
```

```python
def _prompt_root() -> Path:
    injected = os.environ.get("SEMANTIER_MEETING_COORDINATOR_PROMPT_ROOT")
    if injected:
        root = Path(injected).expanduser().resolve()
        if root.exists():
            return root
        raise RuntimeError(f"meeting coordinator prompt root does not exist: {root}")
    for parent in Path(__file__).resolve().parents:
        candidate = parent / "src" / "prompts" / "meeting_coordinator"
        if candidate.exists():
            return candidate
    raise RuntimeError("meeting coordinator prompt assets not found")
```

- [ ] **Step 4: Document the prompt-root deployment knob**

In `docs/derived/feishu-meeting-coordinator-plugin-design.md`, update the prompt deployment caveat to mention:

```text
Repo-local installs discover src/prompts/meeting_coordinator by walking parent directories. Marketplace or copied installs may instead set SEMANTIER_MEETING_COORDINATOR_PROMPT_ROOT to a directory containing the same prompt assets.
```

- [ ] **Step 5: Run focused tests**

Run:

```bash
pytest -v tests/test_feishu_meeting_coordinator_messages.py
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add semantier-skills/plugins/feishu_meeting_coordinator/messages.py docs/derived/feishu-meeting-coordinator-plugin-design.md tests/test_feishu_meeting_coordinator_messages.py
git commit -m "fix: allow injected meeting coordinator prompt root"
```

### Task 6: Expand The Existing Operations Panel

**Files:**
- Modify: `hermes-workspace/src/screens/agents/components/meeting-coordinator-panel.tsx`
- Modify: `hermes-workspace/src/lib/meeting-coordinator-api.ts`
- Modify: `docs/derived/feishu-meeting-coordinator-plugin-design.md`
- Read: `hermes-workspace/src/screens/agents/operations-screen.tsx`
- Add: `hermes-workspace/src/screens/agents/components/meeting-coordinator-panel.test.tsx`

- [ ] **Step 1: Confirm existing panel wiring**

Run:

```bash
sed -n '1,180p' hermes-workspace/src/screens/agents/operations-screen.tsx
sed -n '1,260p' hermes-workspace/src/screens/agents/components/meeting-coordinator-panel.tsx
sed -n '1,260p' hermes-workspace/src/lib/meeting-coordinator-api.ts
```

Expected: `OperationsScreen` already renders `<MeetingCoordinatorPanel />`, and the API helper already calls `/api/meeting-coordinator`.

- [ ] **Step 2: Confirm response casing and extend frontend API types**

The existing API helper returns camelCase `deliveryTasks` and a top-level `scheduler` object, matching `src/agents/webapi_gateway.py` and `tests/test_meeting_coordinator_webapi.py`.

Update `hermes-workspace/src/lib/meeting-coordinator-api.ts` types to include the fields the panel displays:

```ts
export type MeetingCoordinatorMonitor = {
  monitor_id: string
  meeting_title?: string
  status: string
  event_id?: string
  calendar_id?: string
  cron_job_id?: string | null
  last_checked_at?: string | null
  pending_delivery_tasks?: number
}

export type MeetingCoordinatorDeliveryTask = {
  delivery_task_id: string
  status: string
  task_type: string
  attempt_count?: number
  next_attempt_at?: string | null
}
```

- [ ] **Step 3: Add a frontend test for displayed design fields**

Create `hermes-workspace/src/screens/agents/components/meeting-coordinator-panel.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MeetingCoordinatorPanel } from './meeting-coordinator-panel'

vi.mock('@/lib/meeting-coordinator-api', () => ({
  fetchMeetingCoordinatorState: vi.fn(async () => ({
    monitors: [
      {
        monitor_id: 'm_1',
        status: 'active',
        event_id: 'event_1',
        calendar_id: 'cal_1',
        cron_job_id: 'cron_1',
        meeting_title: 'Planning',
        pending_delivery_tasks: 1,
        last_checked_at: '2026-06-18T01:00:00Z',
      },
    ],
    deliveryTasks: [
      {
        delivery_task_id: 'dt_1',
        task_type: 'creator_escalation',
        status: 'failed_retryable',
        attempt_count: 2,
        next_attempt_at: '2026-06-18T01:02:00Z',
      },
    ],
    scheduler: {
      delivery_retry_scheduler_status: 'ok',
      delivery_retry_scheduler_detail: null,
    },
  })),
  requeueDeliveryTask: vi.fn(),
  runDeliveryRetryNow: vi.fn(),
}))

describe('MeetingCoordinatorPanel', () => {
  it('renders monitor and delivery task operator fields', async () => {
    const queryClient = new QueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <MeetingCoordinatorPanel />
      </QueryClientProvider>,
    )

    expect(await screen.findByText('Planning')).toBeTruthy()
    expect(screen.getByText(/event_1/)).toBeTruthy()
    expect(screen.getByText(/cal_1/)).toBeTruthy()
    expect(screen.getByText(/cron_1/)).toBeTruthy()
    expect(screen.getByText(/2026-06-18T01:00:00Z/)).toBeTruthy()
    expect(screen.getByText(/creator_escalation/)).toBeTruthy()
    expect(screen.getByText(/failed_retryable/)).toBeTruthy()
    expect(screen.getByTestId('delivery-task-dt_1-attempt-count').textContent).toContain('2')
    expect(screen.getByText(/2026-06-18T01:02:00Z/)).toBeTruthy()
  })
})
```

Run:

```bash
cd hermes-workspace && pnpm test -- meeting-coordinator-panel
```

Expected: FAIL because the existing panel only shows title/status for monitors and task type/status for delivery tasks.

- [ ] **Step 4: Expand the existing panel**

Update `hermes-workspace/src/screens/agents/components/meeting-coordinator-panel.tsx` to render these backend fields:

```text
monitor_id
status
event_id
calendar_id
cron_job_id
last_checked_at
pending_delivery_tasks
delivery_task_id
task_type
delivery task status
attempt_count
next_attempt_at
```

Keep the existing actions:

```text
Run delivery retry now
Requeue failed delivery task
```

Use compact rows inside the current panel. Do not add a route and do not mutate SQLite directly.

For the delivery task attempt count, render a stable test id so the test does not accidentally match `2026`, `m_1`, or another unrelated `2`:

```tsx
<span data-testid={`delivery-task-${task.delivery_task_id}-attempt-count`}>
  {task.attempt_count ?? 0}
</span>
```

- [ ] **Step 5: Document the Web API response wrapper**

In `docs/derived/feishu-meeting-coordinator-plugin-design.md`, update the Observability section for `GET /system/meeting-coordinator/monitors` with the response shape used by the Web API and frontend proxy:

```json
{
  "monitors": [
    {
      "monitor_id": "string",
      "status": "active|pending_start|complete|cancelled|failed|replaced",
      "event_id": "string",
      "calendar_id": "string",
      "cron_job_id": "string|null",
      "meeting_title": "string|null",
      "last_checked_at": "UTC ISO-8601|null",
      "pending_delivery_tasks": 0
    }
  ],
  "deliveryTasks": [
    {
      "delivery_task_id": "string",
      "task_type": "creator_escalation",
      "status": "pending|sent|failed_retryable|failed_permanent",
      "attempt_count": 0,
      "next_attempt_at": "UTC ISO-8601|null"
    }
  ],
  "scheduler": {
    "delivery_retry_scheduler_status": "ok|unavailable",
    "delivery_retry_scheduler_detail": "string|null",
    "updated_at": "UTC ISO-8601|null"
  }
}
```

- [ ] **Step 6: Run frontend verification**

Run:

```bash
cd hermes-workspace && pnpm test -- meeting-coordinator-panel
cd hermes-workspace && pnpm lint
cd hermes-workspace && pnpm build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add hermes-workspace/src/screens/agents/components/meeting-coordinator-panel.tsx hermes-workspace/src/lib/meeting-coordinator-api.ts hermes-workspace/src/screens/agents/components/meeting-coordinator-panel.test.tsx docs/derived/feishu-meeting-coordinator-plugin-design.md
git commit -m "feat: expand meeting coordinator operations panel"
```

### Task 7: Run Full Regression And Architecture Checks

**Files:**
- Read: `docs/canonical/architecture.md`
- Run: Python test suite focused on Feishu meeting coordinator and gateway policy.

- [ ] **Step 1: Re-read architecture constraints before final verification**

Run:

```bash
sed -n '1,220p' docs/canonical/architecture.md
```

Expected: confirm no change violates governed authority, UTC timestamp, prompt boundary, deterministic replay/audit, or ASCII schema identifier constraints.

- [ ] **Step 2: Preflight expected regression files**

Run:

```bash
ls \
  tests/test_feishu_meeting_coordinator_package_inventory.py \
  tests/test_feishu_meeting_coordinator_plugin.py \
  tests/test_feishu_meeting_coordinator_tools.py \
  tests/test_feishu_meeting_coordinator_messages.py \
  tests/test_meeting_coordinator_store.py \
  tests/test_meeting_coordinator_gateway.py \
  tests/test_meeting_coordinator_webapi.py \
  tests/test_feishu_ingress_identity.py
```

Expected: all files exist. If any file is missing, create or restore the missing test file before running the regression command; do not silently remove it from the regression list.

- [ ] **Step 3: Run focused backend regression tests**

Run:

```bash
pytest -v \
  tests/test_feishu_meeting_coordinator_package_inventory.py \
  tests/test_feishu_meeting_coordinator_plugin.py \
  tests/test_feishu_meeting_coordinator_tools.py \
  tests/test_feishu_meeting_coordinator_messages.py \
  tests/test_meeting_coordinator_store.py \
  tests/test_meeting_coordinator_gateway.py \
  tests/test_meeting_coordinator_webapi.py \
  tests/test_feishu_ingress_identity.py
```

Expected: PASS.

- [ ] **Step 4: Run route-policy regression tests**

Run:

```bash
pytest -v tests/test_meeting_coordinator_webapi.py::test_meeting_coordinator_routes_are_registered
```

Expected: PASS. If Task 6 added or changed routes, also update `src/agents/route_policy.py` and `docs/derived/gateway-unified-multitenant-design.md` section `8.1.1` in the same commit.

- [ ] **Step 5: Run full suite if time permits**

Run:

```bash
pytest -v
```

Expected: PASS. If unrelated failures exist, capture exact failing test names and first failure messages in the handoff.

- [ ] **Step 6: Commit any final test/doc sync**

```bash
git status --short
git add docs/derived/feishu-meeting-coordinator-plugin-design.md docs/derived/gateway-unified-multitenant-design.md src/agents/route_policy.py tests/test_feishu_meeting_coordinator_package_inventory.py tests/test_feishu_meeting_coordinator_plugin.py tests/test_feishu_meeting_coordinator_tools.py tests/test_feishu_meeting_coordinator_messages.py tests/test_meeting_coordinator_store.py tests/test_meeting_coordinator_gateway.py tests/test_meeting_coordinator_webapi.py tests/test_feishu_ingress_identity.py
git commit -m "test: cover meeting coordinator design alignment"
```

---

## Self-Review

Spec coverage:

- Package shape, marketplace contract, registration contract: preserved and covered by package/plugin tests.
- Booking flow, requester authority, requester exclusion: covered by existing tool tests plus Task 1 hardening.
- RSVP monitor start idempotency and replacement: preserved by existing store/gateway tests.
- Cron job profile and prompt asset contract: Task 2.
- Follow-up cadence, max follow-ups, escalation, all-exhausted completion: preserved by existing gateway tests.
- Delivery retry separation and scheduler healing: preserved by existing gateway/Web API tests.
- Durable state tables and UTC timestamps: preserved by store tests; Task 3 adds terminal states.
- Prompt boundary and marketplace prompt-root caveat: Task 5.
- Operator CLI/Web API/dashboard/UI: Tasks 4 and 6.
- Route policy sync: Task 7.

Intentional non-scope:

- Recurrence support remains v0.2 and should stay rejected or clarified.
- Governed cross-platform attendee home-channel routing remains v0.2 because no authoritative directory exists.
- Negotiation durable workflow remains out of scope; negotiation tools stay synchronous helpers.
- Feishu event deletion/cancellation-specific handling is not implemented here beyond manual monitor cancellation state.

Implementation order:

1. Authority hardening.
2. Cron-shape alignment.
3. Terminal-state hardening.
4. Operator adapters.
5. Prompt resolver portability.
6. Optional UI panel.
7. Full regression.
