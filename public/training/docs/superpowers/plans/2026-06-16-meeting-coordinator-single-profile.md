# Meeting Coordinator Single Profile Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse Feishu meeting coordinator cron execution from two Hermes profiles to one `meeting-coordinator` profile while preserving separate RSVP monitor and delivery retry cron lifecycles.

**Architecture:** Keep two cron jobs and two tool entrypoints, but run both under the same narrow Hermes profile. The lifecycle boundary remains in job names, prompts, gateway functions, and store state transitions: `meeting-rsvp-monitor:<monitor_id>` calls `feishu_meeting_monitor_tick`, while `meeting-rsvp-delivery-retry:<workspace_id>` calls `feishu_meeting_escalation_retry_tick`. Bootstrap should create only the `meeting-coordinator` profile when the coordinator plugin is installed.

**Tech Stack:** Python, SQLite-backed Semantier state, Hermes cron profiles, pytest, Markdown docs

---

## Context

The design spec has already been updated in `docs/derived/feishu-meeting-coordinator-plugin-design.md` to require one profile:

- `meeting-rsvp-monitor:<monitor_id>` runs with `profile="meeting-coordinator"`.
- `meeting-rsvp-delivery-retry:<workspace_id>` also runs with `profile="meeting-coordinator"`.
- The implementation must not create `meeting-coordinator-delivery`.

Historical plan files under `docs/superpowers/plans/` may still mention `meeting-coordinator-delivery`; treat those as archived planning context, not current design authority.

## Alignment With Original Implementation Plan

Original plan: `docs/superpowers/plans/2026-06-15-feishu-meeting-coordinator-plugin.md`

This refactor plan intentionally preserves the original plan's core contracts:

- one installable plugin package under `semantier-skills/plugins/feishu_meeting_coordinator/`
- Semantier-owned gateway/state code under `src/agents/`
- SQLite-backed monitor, attendee, follow-up, escalation, delivery-task, and workspace scheduler state
- separate RSVP monitor and creator escalation delivery retry lifecycles
- two distinct cron jobs:
  - `meeting-rsvp-monitor:<monitor_id>`
  - `meeting-rsvp-delivery-retry:<workspace_id>`
- delivery retry scheduler healing for non-terminal delivery tasks
- Web API cron creation must preserve the `profile` field
- recurring worker profiles must not need cron-management tools

This refactor plan supersedes exactly one original-plan assumption:

```text
Old: delivery retry cron uses profile "meeting-coordinator-delivery"
New: delivery retry cron uses profile "meeting-coordinator"
```

The following original-plan snippets are therefore superseded by this plan:

- `tests/test_meeting_coordinator_gateway.py` assertion:

```python
assert cron.created[-1]["profile"] == "meeting-coordinator-delivery"
```

- `src/agents/meeting_coordinator_gateway.py` delivery retry implementation:

```python
profile="meeting-coordinator-delivery",
```

- `tests/test_meeting_coordinator_webapi.py` delivery retry cron client test:

```python
profile="meeting-coordinator-delivery",
assert created[0]["profile"] == "meeting-coordinator-delivery"
```

All other original-plan work remains compatible with this refactor unless it relies on creating, validating, or cleaning up a separate `meeting-coordinator-delivery` Hermes profile.

## Files

- Modify: `src/agents/meeting_coordinator_gateway.py`
  - Change delivery retry cron profile from `meeting-coordinator-delivery` to `meeting-coordinator`.
- Modify: `src/agents/launcher.py`
  - Collapse `_MEETING_COORDINATOR_PROFILE_NAMES` to only `("meeting-coordinator",)`.
- Modify: `tests/test_meeting_coordinator_gateway.py`
  - Update delivery retry cron profile assertions.
- Modify: `tests/test_meeting_coordinator_webapi.py`
  - Update Web API cron client preservation assertions.
- Modify: `tests/test_agents_launcher.py`
  - Update bootstrap assertions so only `meeting-coordinator` is created.
- Optional runtime cleanup after code passes:
  - Existing local runtime homes may contain `profiles/meeting-coordinator-delivery`; remove or ignore it only after confirming no cron job still references that profile.

---

### Task 1: Delivery Retry Cron Uses `meeting-coordinator`

**Files:**
- Modify: `src/agents/meeting_coordinator_gateway.py`
- Test: `tests/test_meeting_coordinator_gateway.py`
- Test: `tests/test_meeting_coordinator_webapi.py`

- [ ] **Step 1: Update failing test expectation in gateway unit test**

In `tests/test_meeting_coordinator_gateway.py`, change:

```python
assert cron.created[-1]["profile"] == "meeting-coordinator-delivery"
```

to:

```python
assert cron.created[-1]["profile"] == "meeting-coordinator"
```

- [ ] **Step 2: Update failing Web API cron client expectation**

In `tests/test_meeting_coordinator_webapi.py`, change the delivery retry `ensure_job` call from:

```python
profile="meeting-coordinator-delivery",
```

to:

```python
profile="meeting-coordinator",
```

Then change:

```python
assert created[0]["profile"] == "meeting-coordinator-delivery"
```

to:

```python
assert created[0]["profile"] == "meeting-coordinator"
```

- [ ] **Step 3: Run the focused tests and verify they fail before implementation**

Run:

```bash
pytest -q tests/test_meeting_coordinator_gateway.py tests/test_meeting_coordinator_webapi.py
```

Expected before implementation: failure showing delivery retry cron still creates `profile == "meeting-coordinator-delivery"`.

- [ ] **Step 4: Update implementation**

In `src/agents/meeting_coordinator_gateway.py`, change `ensure_delivery_retry_cron` from:

```python
def ensure_delivery_retry_cron(*, workspace_id: str, cron: CronClient) -> str:
    return cron.ensure_job(
        name=f"meeting-rsvp-delivery-retry:{workspace_id}",
        schedule="every 2m",
        profile="meeting-coordinator-delivery",
        prompt=f"Run feishu_meeting_escalation_retry_tick for workspace_id={workspace_id}.",
        skills=["feishu_meeting_coordinator"],
        deliver="local",
        repeat=0,
    )
```

to:

```python
def ensure_delivery_retry_cron(*, workspace_id: str, cron: CronClient) -> str:
    return cron.ensure_job(
        name=f"meeting-rsvp-delivery-retry:{workspace_id}",
        schedule="every 2m",
        profile="meeting-coordinator",
        prompt=f"Run feishu_meeting_escalation_retry_tick for workspace_id={workspace_id}.",
        skills=["feishu_meeting_coordinator"],
        deliver="local",
        repeat=0,
    )
```

- [ ] **Step 5: Run focused tests**

Run:

```bash
pytest -q tests/test_meeting_coordinator_gateway.py tests/test_meeting_coordinator_webapi.py
```

Expected: all tests pass.

---

### Task 2: Bootstrap Creates Only One Coordinator Profile

**Files:**
- Modify: `src/agents/launcher.py`
- Test: `tests/test_agents_launcher.py`

- [ ] **Step 1: Update launcher test expectations**

In `tests/test_agents_launcher.py`, keep this assertion in the “does not preinstall” test:

```python
assert not (workspace_home / "profiles" / "meeting-coordinator").exists()
```

Remove the assertion that checks `meeting-coordinator-delivery` is absent.

In `test_bootstrap_repairs_skill_for_user_installed_feishu_meeting_plugin`, change:

```python
for profile_name in ("meeting-coordinator", "meeting-coordinator-delivery"):
```

to:

```python
for profile_name in ("meeting-coordinator",):
```

Add this assertion after the loop:

```python
assert not (workspace_home / "profiles" / "meeting-coordinator-delivery").exists()
```

- [ ] **Step 2: Run launcher test and verify failure before implementation**

Run:

```bash
pytest -q tests/test_agents_launcher.py::test_bootstrap_repairs_skill_for_user_installed_feishu_meeting_plugin
```

Expected before implementation: failure because bootstrap still creates `profiles/meeting-coordinator-delivery`.

- [ ] **Step 3: Update launcher profile list**

In `src/agents/launcher.py`, change:

```python
_MEETING_COORDINATOR_PROFILE_NAMES: tuple[str, ...] = (
    "meeting-coordinator",
    "meeting-coordinator-delivery",
)
```

to:

```python
_MEETING_COORDINATOR_PROFILE_NAMES: tuple[str, ...] = (
    "meeting-coordinator",
)
```

- [ ] **Step 4: Run launcher tests**

Run:

```bash
pytest -q tests/test_agents_launcher.py
```

Expected: all tests pass.

---

### Task 3: Search for Stale Active References

**Files:**
- Inspect: `src/`
- Inspect: `tests/`
- Inspect: `docs/derived/feishu-meeting-coordinator-plugin-design.md`

- [ ] **Step 1: Search active implementation and current spec references**

Run:

```bash
rg -n "meeting-coordinator-delivery" src tests docs/derived/feishu-meeting-coordinator-plugin-design.md -S
```

Expected after Tasks 1-2: only guard references may remain:

```text
docs/derived/feishu-meeting-coordinator-plugin-design.md:<line>:The implementation must not create a separate delivery profile such as `meeting-coordinator-delivery`.
tests/test_agents_launcher.py:<line>:    assert not (workspace_home / "profiles" / "meeting-coordinator-delivery").exists()
```

- [ ] **Step 2: Decide whether to keep the explicit forbidden-profile sentence**

Keep this sentence in `docs/derived/feishu-meeting-coordinator-plugin-design.md`:

```markdown
The implementation must not create a separate delivery profile such as `meeting-coordinator-delivery`.
```

Reason: it prevents regression to the two-profile design.

- [ ] **Step 3: Run the focused meeting coordinator suite**

Run:

```bash
pytest -q tests/test_agents_launcher.py tests/test_meeting_coordinator_gateway.py tests/test_meeting_coordinator_webapi.py tests/test_feishu_meeting_coordinator_tools.py tests/test_feishu_meeting_coordinator_plugin.py
```

Expected: all tests pass.

---

### Task 4: Runtime State Cleanup Check

**Files:**
- Inspect: `.semantier-home/state.db`
- Inspect: `workspaces/*/.hermes/config.yaml`
- Inspect: `workspaces/*/.hermes/profiles/`

- [ ] **Step 1: Check whether any persisted cron jobs still reference the old profile**

Run:

```bash
sqlite3 .semantier-home/state.db "SELECT scope_id, job_id, json_extract(payload_json,'$.name'), json_extract(payload_json,'$.profile') FROM semantier_cron_jobs WHERE json_extract(payload_json,'$.profile')='meeting-coordinator-delivery';"
```

Expected: no rows.

- [ ] **Step 2: If rows exist, update them through the cron API path**

Use the existing workspace cron update path rather than raw SQL. For each returned `job_id`, call the same helper used by `MeetingCoordinatorWebApiCronClient` through `src/agents/webapi_gateway.py` so payload normalization and scope authority remain intact.

The expected final row shape is:

```text
profile = meeting-coordinator
name = meeting-rsvp-delivery-retry:<workspace_id>
enabled = true or existing enabled state
```

- [ ] **Step 3: Remove stale local profile directory only after no cron rows reference it**

Run:

```bash
find workspaces -path "*/.hermes/profiles/meeting-coordinator-delivery" -type d -print
```

If the command prints paths and Step 1 returned no rows, remove the stale generated profile directories:

```bash
rm -rf workspaces/*/.hermes/profiles/meeting-coordinator-delivery
```

Do not remove any directory if a persisted cron job still references `meeting-coordinator-delivery`.

---

## Verification

Run:

```bash
pytest -q tests/test_agents_launcher.py tests/test_meeting_coordinator_gateway.py tests/test_meeting_coordinator_webapi.py tests/test_feishu_meeting_coordinator_tools.py tests/test_feishu_meeting_coordinator_plugin.py
```

Expected:

```text
65 passed
```

Run:

```bash
rg -n "meeting-coordinator-delivery" src tests docs/derived/feishu-meeting-coordinator-plugin-design.md -S
```

Expected:

```text
docs/derived/feishu-meeting-coordinator-plugin-design.md:<line>:The implementation must not create a separate delivery profile such as `meeting-coordinator-delivery`.
tests/test_agents_launcher.py:<line>:    assert not (workspace_home / "profiles" / "meeting-coordinator-delivery").exists()
```

## Commit Plan

Commit after implementation and verification:

```bash
git add \
  docs/derived/feishu-meeting-coordinator-plugin-design.md \
  docs/superpowers/plans/2026-06-16-meeting-coordinator-single-profile.md \
  src/agents/meeting_coordinator_gateway.py \
  src/agents/launcher.py \
  tests/test_meeting_coordinator_gateway.py \
  tests/test_meeting_coordinator_webapi.py \
  tests/test_agents_launcher.py
git commit -m "refactor: use single meeting coordinator cron profile"
```
