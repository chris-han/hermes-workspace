# Feishu Meeting Coordinator Design Alignment Plan

**Date:** 2026-06-16  
**Status:** Draft — awaiting final approval  
**Scope:** Align `semantier-skills/plugins/feishu_meeting_coordinator/` and `src/agents/meeting_coordinator_*` with `docs/derived/feishu-meeting-coordinator-plugin-design.md`

**Relationship to earlier plans:** This plan supersedes the requester-identity, prompt-boundary, and RSVP-state-machine sections of `docs/superpowers/plans/2026-06-15-feishu-meeting-coordinator-plugin.md`. The original plan's implementation steps for these areas are either already present in the codebase or have been refined here to avoid regressions.

---

## 1. Goal

Bring the current Feishu meeting coordinator implementation into full compliance with the design contract, focusing on three gaps identified in review:

1. **Requester identity authority**: `_requester_open_id()` currently falls back to an unverified `payload["requester_open_id"]`. The design contract requires requester identity to come from governed Feishu session context only.
2. **Prompt boundary**: ensure no inline reminder prose exists in gateway/helper code; all LLM-composed messages use prompt assets.
3. **Stale execution plan**: much of the originally planned implementation (RSVP state machine, delivery retry, monitor tick) is already present. Switch from "implement from scratch" to "verify-and-gap-fix".

---

## 2. Current State

### 2.1 Already implemented and aligned

| Capability | Location | Status |
|---|---|---|
| SQLite schema for monitors, attendees, follow-ups, delivery tasks, escalations | `src/agents/meeting_coordinator_store.py` | ✅ Implemented |
| RSVP status normalization (`accepted/declined/tentative/needs_action/unknown`) | `src/agents/meeting_coordinator_store.py:36-266` | ✅ Implemented |
| Monitor tick state machine + pending attendee follow-ups | `src/agents/meeting_coordinator_gateway.py:182-285` | ✅ Implemented |
| Delivery retry tick output contract (`processed`, `sent`) | `src/agents/meeting_coordinator_gateway.py:175-199` | ✅ Implemented |
| Prompt-asset-based reminder rendering (`FOLLOWUP_MESSAGE.md`) | `src/agents/meeting_coordinator_gateway.py:165-179` | ✅ Implemented |
| Single `meeting-coordinator` profile (no delivery profile) | `src/agents/launcher.py`, `src/agents/meeting_coordinator_gateway.py` | ✅ Implemented |
| Cron job creation preserving `profile` field | `src/agents/webapi_gateway.py` | ✅ Implemented |

### 2.2 Gaps requiring fixes

| Gap | Location | Severity |
|---|---|---|
| `_requester_open_id()` falls back to payload value | `semantier-skills/plugins/feishu_meeting_coordinator/tools.py:153-154` | **High** |
| No explicit rejection/guard behavior when Feishu session context is missing | `tools.py:138-154` | **High** |
| (Planned-only) old inline reminder prose in plan text | This plan Section 7.2 | Medium |

---

## 3. Design Contract References

From `docs/derived/feishu-meeting-coordinator-plugin-design.md`:

> "The requester `open_id` must be resolved from governed Feishu ingress/session context, not from LLM extraction or attendee inference." (line 121)

> "derive `requester_open_id` from active Feishu session context when available" (line 553)  
> "do not infer the requester from attendee names or prompt memory" (line 554)

From `docs/derived/gateway-unified-multitenant-design.md`:

> "Transport identity must not be treated as workspace ownership by itself."  
> "Transport metadata may help route inbound messages only after a configured gateway correlation resolves that transport identity to a Semantier `user_id`."

---

## 4. Required Changes

### 4.1 Harden requester identity resolution

**File:** `semantier-skills/plugins/feishu_meeting_coordinator/tools.py`

**Current code:**

```python
def _requester_open_id(payload: dict[str, Any]) -> Any:
    return _feishu_chat_initiator_open_id() or payload.get("requester_open_id")
```

**Required behavior:**

1. `_feishu_chat_initiator_open_id()` returns a governed `open_id` only when:
   - `HERMES_SESSION_PLATFORM` is `feishu`
   - AND the session has a valid origin/user id starting with `ou_`
2. If no governed context is present, the tool must **not** silently use `payload["requester_open_id"]`.
3. The caller (skill) must receive a clear error so it can either:
   - **Option A (recommended):** hard-fail with a message like "无法确定会议发起人身份：缺少受信的飞书会话上下文。"
   - **Option B (if product requires it):** enter an explicit confirmation flow that does not create/modify any meeting until the requester is governed.

**Proposed implementation (Option A — hard fail):**

```python
class RequesterIdentityError(RuntimeError):
    """Raised when requester open_id cannot be resolved from governed context."""


def _requester_open_id(payload: dict[str, Any]) -> str:
    governed = _feishu_chat_initiator_open_id()
    if governed:
        return governed
    payload_value = _text(payload.get("requester_open_id"))
    if payload_value:
        raise RequesterIdentityError(
            "requester_open_id in payload is not a governed identity source; "
            "must be resolved from active Feishu session context"
        )
    raise RequesterIdentityError(
        "unable to resolve requester open_id from Feishu session context"
    )
```

**Tools affected:**

- `feishu_contacts_search`
- `feishu_meeting_create_or_update`
- any other tool that calls `_requester_open_id`

Each tool should catch `RequesterIdentityError` and return `_error(...)` with a user-facing message.

**Example guard in `feishu_meeting_create_or_update`:**

```python
def feishu_meeting_create_or_update(args, **kwargs):
    payload = _payload(args)
    try:
        requester_open_id = _requester_open_id(payload)
    except RequesterIdentityError as exc:
        return _error(
            "无法确定会议发起人身份：缺少受信的飞书会话上下文。"
            "请在飞书聊天中发起会议请求。"
        )
    ...
```

> Important: `_requester_open_id` must reject `payload["requester_open_id"]` when no governed Feishu session context is present. The payload field may only be used after governed resolution has occurred, never as a fallback identity source.

### 4.2 Add regression test for requester identity hardening

**File:** `tests/test_feishu_meeting_coordinator_tools.py` (or new)

Add tests:

1. When `HERMES_SESSION_PLATFORM=feishu` and origin user id is `ou_xxx`, `_requester_open_id` returns that id.
2. When no Feishu session env is set and payload contains `requester_open_id`, `_requester_open_id` raises `RequesterIdentityError`.
3. When no Feishu session env is set and payload lacks `requester_open_id`, `_requester_open_id` raises `RequesterIdentityError`.
4. `feishu_contacts_search` returns `{"ok": False, "error": "..."}` when requester identity cannot be governed.

### 4.3 Verify prompt boundary

**File:** `src/agents/meeting_coordinator_gateway.py`

Confirm `_render_reminder` uses only `FOLLOWUP_MESSAGE.md` and does not contain inline prose. If any inline prose is found, move it to a prompt asset under `src/prompts/meeting_coordinator/`.

**Checklist:**

- [ ] No hard-coded reminder sentences in `meeting_coordinator_gateway.py`.
- [ ] No hard-coded reminder sentences in `semantier-skills/plugins/feishu_meeting_coordinator/tools.py`.
- [ ] All LLM-composed messages route through `_prompt(...)` loading a file from `src/prompts/meeting_coordinator/`.

### 4.4 Convert already-implemented tasks to verify-and-gap-fix mode

Instead of re-implementing, verify each subsystem and only patch gaps:

| Subsystem | Verification Step | Gap Fix If Needed |
|---|---|---|
| RSVP status normalization | Assert `_normalize_rsvp_status` covers all design statuses | Add missing aliases |
| Monitor tick state machine | Walk through `monitor_tick` logic vs. design flowchart | Patch state transitions |
| Delivery retry output contract | Assert return shape matches design | Patch return dict |
| Single profile | Search `meeting-coordinator-delivery` | Remove any stale references |
| Prompt assets | Search inline prose | Move to prompt asset |
| UTC timestamps | Assert all persisted timestamps use `utc_now_iso()` | Fix any local-time usage |

---

## 5. Files to Touch

| File | Change |
|---|---|
| `semantier-skills/plugins/feishu_meeting_coordinator/tools.py` | Harden `_requester_open_id`; add `RequesterIdentityError`; update callers |
| `tests/test_feishu_meeting_coordinator_tools.py` | Add requester identity regression tests |
| `src/agents/meeting_coordinator_gateway.py` | Verify prompt boundary; patch any inline prose |
| `docs/derived/feishu-meeting-coordinator-plugin-design.md` | Add explicit guard behavior sentence if missing |

---

## 6. Tasks

### Task 1: Implement requester identity guard

**Step 1:** Add `RequesterIdentityError` and update `_requester_open_id` to reject payload fallback.

**Step 2:** Update `feishu_contacts_search`, `feishu_meeting_create_or_update`, and any other affected tools to catch the error and return `_error(...)`.

**Step 3:** Run focused tests:

```bash
pytest -q tests/test_feishu_meeting_coordinator_tools.py tests/test_feishu_meeting_coordinator_plugin.py
```

**Step 4:** Commit.

### Task 2: Add regression tests

**Step 1:** Add tests for governed-context success and both failure modes.

**Step 2:** Run tests and ensure they fail before the fix and pass after.

**Step 3:** Commit.

### Task 3: Verify prompt boundary (NO code changes expected)

**File:** `src/agents/meeting_coordinator_gateway.py`

Confirm `_render_reminder` uses only `FOLLOWUP_MESSAGE.md` and does not contain inline prose. **Do not replace `_render_reminder` with a hard-coded string.** The current implementation already complies:

```python
def _render_reminder(monitor: dict[str, Any], attendee: dict[str, Any]) -> str:
    ...
    return _prompt(
        "FOLLOWUP_MESSAGE.md",
        attendee_name=str(attendee.get("display_name") or attendee.get("attendee_user_id")),
        meeting_title=title,
        start_time=start_time,
        organizer_name=str(payload.get("creator_user_id") or monitor.get("creator_user_id")),
        response_status=str(attendee.get("response_status") or "unknown"),
    )
```

**Checklist:**

- [ ] No hard-coded reminder sentences in `meeting_coordinator_gateway.py`.
- [ ] No hard-coded reminder sentences in `semantier-skills/plugins/feishu_meeting_coordinator/tools.py`.
- [ ] All LLM-composed messages route through `_prompt(...)` loading a file from `src/prompts/meeting_coordinator/`.

**Steps:**

**Step 1:** Search for inline reminder text:

```bash
rg -n "Please respond" src/agents/meeting_coordinator_gateway.py semantier-skills/plugins/feishu_meeting_coordinator/
```

**Step 2:** If any inline prose is found (not expected), move it to a prompt asset. Otherwise, note "no changes needed".

**Step 3:** Confirm `_render_reminder` uses `FOLLOWUP_MESSAGE.md`.

**Step 4:** Commit (or note "no changes needed").

### Task 4: Verify-and-gap-fix already-implemented subsystems

**Step 1:** Compare `meeting_coordinator_store.py` RSVP helpers with design spec Section "RSVP Semantics".

**Step 2:** Compare `meeting_coordinator_gateway.py` `monitor_tick` and `escalation_retry_tick` with design flowcharts.

**Step 3:** Patch only actual gaps; do not rewrite.

**Step 4:** Run full meeting coordinator test suite:

```bash
pytest -q tests/test_agents_launcher.py tests/test_meeting_coordinator_gateway.py tests/test_meeting_coordinator_webapi.py tests/test_feishu_meeting_coordinator_tools.py tests/test_feishu_meeting_coordinator_plugin.py
```

**Step 5:** Commit.

---

## 7. Key Questions Answered

| # | Question | Decision |
|---|---|---|
| 1 | For no-session/no-governed-context requests, hard fail or explicit confirmation? | **Hard fail (Option A)** with a clear error returned to the skill. This enforces Architecture Law 1: identity must come from governed authority sources. If product later requires confirmation flow, it can be added as a separate governed auth step. |
| 2 | Should `payload["requester_open_id"]` be accepted only when verified against governed auth context? | **Yes.** If no governed Feishu session context is present, `payload["requester_open_id"]` is rejected. The payload field may remain for structured passing *after* governed resolution, but not as a fallback source. |
| 3 | Inline reminder text disallowed? | **Yes.** All reminder messages must use `FOLLOWUP_MESSAGE.md` (or future additional prompt assets). Any inline prose found during Task 3 must be moved. |
| 4 | Convert Task 2/3/4 to verify-and-gap-fix? | **Yes.** RSVP state machine, monitor tick, delivery retry, and single-profile are already implemented. This plan verifies them and patches only remaining gaps. |
| 5 | Acceptance checklist tied to architecture laws? | **Yes.** See Section 8. |

---

## 8. Acceptance Checklist

Before this plan is considered complete:

### Identity Authority

- [ ] `_requester_open_id` never returns a value derived solely from LLM/prompt memory or unverified payload.
- [ ] All failure paths return a clear, user-facing error when governed requester context is missing.
- [ ] Regression tests cover governed success, payload-only rejection, and complete-missing-context rejection.

### Prompt Boundary

- [ ] No inline reminder/escalation prose in `tools.py` or `meeting_coordinator_gateway.py`.
- [ ] All LLM-composed messages load a prompt asset from `src/prompts/meeting_coordinator/`.

### Timestamps

- [ ] All persisted timestamps use timezone-aware UTC ISO-8601 (via `utc_now_iso()` or equivalent).

### Determinism / Replay

- [ ] No non-deterministic side effects in requester resolution or monitor tick.
- [ ] Monitor state transitions are durable in SQLite and replayable from stored artifacts.

### Test Coverage

- [ ] `pytest -q tests/test_feishu_meeting_coordinator_tools.py` passes.
- [ ] `pytest -q tests/test_feishu_meeting_coordinator_plugin.py` passes.
- [ ] Full meeting coordinator suite passes.

---

## 9. Out of Scope

- Changing the single-profile design (already aligned).
- Porting bootstrap shell script to Python.
- Adding new meeting coordination features beyond requester identity hardening and prompt-boundary verification.

---

*Plan ready for final approval.*
