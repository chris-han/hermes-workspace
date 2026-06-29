# Feishu Meeting Coordinator Design Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the Feishu meeting coordinator plugin and Semantier gateway/store implementation with `docs/derived/feishu-meeting-coordinator-plugin-design.md`.

**Architecture:** Keep Feishu API access in the plugin helper, deterministic monitor orchestration in `src/agents/meeting_coordinator_gateway.py`, and durable RSVP/follow-up state in `src/agents/meeting_coordinator_store.py`. The monitor tick becomes the state machine boundary: it reads live Feishu RSVP truth, mutates persisted attendee state, sends due reminders, creates creator escalation tasks, and removes the monitor cron when complete.

**Tech Stack:** Python 3.12, SQLite, pytest, Feishu `lark_oapi`, Hermes plugin tool registration, Semantier gateway/store layers.

---

## Files And Responsibilities

- Modify `semantier-skills/plugins/feishu_meeting_coordinator/tools.py`
  - Keep invitee-only attendee filtering at the tool boundary.
  - Reject recurrent meeting requests until v0.2 recurrence support exists.
  - Avoid accepting requester identity from unsafe prompt-derived values when Feishu session context is unavailable.

- Modify `semantier-skills/plugins/feishu_meeting_coordinator/scripts/feishu_bot_api.py`
  - Keep helper-level meeting creation invitee-only even when called by negotiation finalization.
  - Return monitor-ready event metadata without adding requester to invitees.

- Modify `src/agents/meeting_coordinator_store.py`
  - Add attendee status update methods.
  - Add due follow-up selection and follow-up persistence methods.
  - Add attendee escalation marking and monitor completion helpers.

- Modify `src/agents/meeting_coordinator_gateway.py`
  - Implement `monitor_tick` as the RSVP state machine.
  - Add configurable follow-up interval and maximum reminder count inputs with defaults of 2 minutes and 3 reminders.
  - Send attendee reminders through a provided Feishu/message client.
  - Disable/remove monitor cron when follow-up list is empty.

- Modify `tests/test_feishu_meeting_coordinator_tools.py`
  - Cover recurrent meeting rejection and unsafe requester fallback behavior.

- Modify `tests/test_feishu_bot_meeting_coordinator_helper.py`
  - Cover negotiation finalization not adding requester to invitees.

- Modify `tests/test_meeting_coordinator_store.py`
  - Cover status updates, due follow-up selection, follow-up persistence, and escalation marking.

- Modify `tests/test_meeting_coordinator_gateway.py`
  - Cover monitor tick terminal-status removal, reminder sending, reminder-limit escalation, and cron disable on completion.

---

## Task 1: Lock The Booking Boundary To Invitees Only

**Files:**
- Modify: `semantier-skills/plugins/feishu_meeting_coordinator/tools.py`
- Modify: `semantier-skills/plugins/feishu_meeting_coordinator/scripts/feishu_bot_api.py`
- Test: `tests/test_feishu_meeting_coordinator_tools.py`
- Test: `tests/test_feishu_bot_meeting_coordinator_helper.py`

- [ ] **Step 1: Add failing test for recurrent meeting rejection at the tool boundary**

Add this test to `tests/test_feishu_meeting_coordinator_tools.py` near the existing meeting create tests:

```python
def test_meeting_create_rejects_recurrent_meeting_until_supported(monkeypatch):
    tools = load_tools()
    calls = []

    def create_meeting(**kwargs):
        calls.append(kwargs)
        return {"event_id": "event-1", "calendar_id": "calendar-1"}

    monkeypatch.setattr(
        tools,
        "_feishu_helper",
        lambda: SimpleNamespace(create_meeting=create_meeting),
    )

    result = json.loads(
        tools.feishu_meeting_create(
            {
                "title": "产品研发会",
                "start_time": "2026-06-16 16:15",
                "end_time": "2026-06-16 17:15",
                "attendees": ["ou_a"],
                "requester_open_id": "ou_requester",
                "is_recurrent_meeting": True,
            }
        )
    )

    assert result == {
        "error": "recurrent meetings are not supported by the v0.1 RSVP monitor flow",
        "ok": False,
    }
    assert calls == []
```

- [ ] **Step 2: Add failing test for helper-level negotiation finalization excluding requester**

Add this test to `tests/test_feishu_bot_meeting_coordinator_helper.py` after the existing helper tests:

```python
def test_finalize_negotiation_excludes_requester_from_calendar_invitees(monkeypatch):
    helper = _load_helper()
    captured = {}

    state = {
        "negotiation_id": "neg-1",
        "title": "产品研发会",
        "requester_open_id": "ou_requester",
        "timezone": "Asia/Shanghai",
        "duration_minutes": 60,
        "max_rounds": 3,
        "current_round": 1,
        "candidate_slots": ["2026-06-16T21:30:00+08:00"],
        "status": "agreed",
        "agreed_slot": "2026-06-16T21:30:00+08:00",
        "attendees": {
            "ou_a": {
                "attendee_open_id": "ou_a",
                "display_name": "Amy",
                "accepted_slots": ["2026-06-16T21:30:00+08:00"],
                "declined_slots": [],
                "rounds_responded": [1],
                "notes": [],
            }
        },
    }

    def fake_create_meeting(**kwargs):
        captured.update(kwargs)
        return {"event_id": "event-1", "calendar_id": "calendar-1", "join_url": "https://vc"}

    monkeypatch.setattr(helper, "_primary_calendar_id_for_user", lambda user_open_id: "cal-requester")
    monkeypatch.setattr(helper, "create_meeting", fake_create_meeting)
    monkeypatch.setattr(
        helper,
        "send_final_invitations",
        lambda **kwargs: {"delivered": kwargs["attendee_open_ids"], "failed": []},
    )

    result = helper.finalize_negotiation_and_create_meeting(state)

    assert result["meeting_owner_open_id"] == "ou_requester"
    assert captured["requester_open_id"] == "ou_requester"
    assert captured["requester_calendar_id"] == "cal-requester"
    assert captured["attendees"] == ["ou_a"]
```

- [ ] **Step 3: Run the failing tests**

Run:

```bash
pytest -q tests/test_feishu_meeting_coordinator_tools.py::test_meeting_create_rejects_recurrent_meeting_until_supported tests/test_feishu_bot_meeting_coordinator_helper.py::test_finalize_negotiation_excludes_requester_from_calendar_invitees
```

Expected: at least one targeted test fails on unimplemented branches.
If both tests already pass in your branch, treat this as pre-existing implementation and continue with the identity hardening step below before re-running full Task 1 tests.

- [ ] **Step 4: Enforce strict fail-closed requester identity resolution**

In `semantier-skills/plugins/feishu_meeting_coordinator/tools.py`, define an explicit exception and make `_requester_open_id` fail closed when no trusted Feishu session context is available.

```python
class RequesterIdentityError(RuntimeError):
    pass


def _requester_open_id(payload: dict[str, Any]) -> str:
    del payload
    requester_open_id = _feishu_chat_initiator_open_id()
    if requester_open_id:
        return requester_open_id
    raise RequesterIdentityError("missing trusted Feishu session requester identity")
```

Add this test to `tests/test_feishu_meeting_coordinator_tools.py`:

```python
def test_meeting_create_fails_closed_without_trusted_feishu_session(monkeypatch):
    tools = load_tools()
    monkeypatch.setattr(tools, "_feishu_chat_initiator_open_id", lambda: "")

    result = json.loads(
        tools.feishu_meeting_create(
            {
                "title": "产品研发会",
                "start_time": "2026-06-16 16:15",
                "end_time": "2026-06-16 17:15",
                "attendees": ["ou_a"],
                "requester_open_id": "ou_untrusted_payload",
            }
        )
    )

    assert result["ok"] is False
    assert "缺少受信的飞书会话上下文" in result["error"]
```

- [ ] **Step 5: Implement recurrent meeting rejection**

In `semantier-skills/plugins/feishu_meeting_coordinator/tools.py`, update `feishu_meeting_create` before `_requester_open_id(payload)`:

```python
def feishu_meeting_create(args, **kwargs):
    payload = _payload(args)
    if payload.get("is_recurrent_meeting") is True:
        return _error("recurrent meetings are not supported by the v0.1 RSVP monitor flow")
    try:
        requester_open_id = _requester_open_id(payload)
    except RequesterIdentityError:
        return _error(
            "无法确定会议发起人身份：缺少受信的飞书会话上下文。"
            "请在飞书聊天中发起会议请求。"
        )
    attendees = _attendees_without_requester(
        _list_arg(payload, "attendees", "attendee", "participants", "participant"),
        requester_open_id,
    )
    return _helper_call(
        "create_meeting",
        title=str(payload.get("title") or ""),
        start_time=str(payload.get("start_time") or ""),
        end_time=str(payload.get("end_time") or ""),
        attendees=attendees,
        timezone=str(payload.get("timezone") or "Asia/Shanghai"),
        description=payload.get("description"),
        location=payload.get("location"),
        idempotency_key=payload.get("idempotency_key"),
        requester_open_id=requester_open_id,
        requester_calendar_id=payload.get("requester_calendar_id"),
    )
```

> **Identity authority:** strict fail-closed is mandatory for all non-Feishu-session calls to meeting creation.
> `payload["requester_open_id"]` is always untrusted unless matched to governed/session identity; no direct fallback acceptance.

- [ ] **Step 6: Implement helper-level invitee-only finalization**

In `semantier-skills/plugins/feishu_meeting_coordinator/scripts/feishu_bot_api.py`, replace this block inside `finalize_negotiation_and_create_meeting`:

```python
attendee_open_ids = sorted(set(state.attendees.keys()))
participant_open_ids = sorted(set(attendee_open_ids + [state.requester_open_id]))
```

with:

```python
attendee_open_ids = sorted(
    attendee_id
    for attendee_id in set(state.attendees.keys())
    if attendee_id and attendee_id != state.requester_open_id
)
```

Then replace the `create_meeting` call argument:

```python
attendees=participant_open_ids,
```

with:

```python
attendees=attendee_open_ids,
```

- [ ] **Step 7: Run tests and commit**

Run:

```bash
pytest -q tests/test_feishu_meeting_coordinator_tools.py tests/test_feishu_bot_meeting_coordinator_helper.py
```

Expected: all tests pass.

Commit:

```bash
git add semantier-skills/plugins/feishu_meeting_coordinator/tools.py semantier-skills/plugins/feishu_meeting_coordinator/scripts/feishu_bot_api.py tests/test_feishu_meeting_coordinator_tools.py tests/test_feishu_bot_meeting_coordinator_helper.py
git commit -m "fix: keep Feishu meeting booking invitee-only"
```

---

## Task 2: Add Store Operations For RSVP State And Follow-Ups

**Files:**
- Modify: `src/agents/meeting_coordinator_store.py`
- Test: `tests/test_meeting_coordinator_store.py`

- [ ] **Step 1: Add failing store tests for attendee RSVP updates**

Add this test to `tests/test_meeting_coordinator_store.py`:

```python
def test_update_attendee_statuses_tracks_terminal_and_pending_states(db):
    monitor = db.start_monitor(
        {
            **_monitor_payload(),
            "attendees": [
                {"user_id": "ou_a", "message_user_id": "ou_a", "display_name": "Amy"},
                {"user_id": "ou_b", "message_user_id": "ou_b", "display_name": "Bob"},
            ],
        }
    )

    updated = db.update_attendee_statuses(
        monitor["monitor_id"],
        [
            {"user_id": "ou_a", "message_user_id": "ou_a", "display_name": "Amy", "response_status": "accepted"},
            {"user_id": "ou_b", "message_user_id": "ou_b", "display_name": "Bob", "response_status": "needs_action"},
        ],
    )
    pending = db.list_pending_followup_attendees(monitor["monitor_id"])

    assert updated == {"accepted": 1, "declined": 0, "tentative": 0, "needs_action": 1, "unknown": 0}
    assert [item["attendee_user_id"] for item in pending] == ["ou_b"]
    assert pending[0]["response_status"] == "needs_action"
```

- [ ] **Step 2: Add failing store tests for due follow-ups and escalation marking**

Add this test to `tests/test_meeting_coordinator_store.py`:

```python
def test_followup_attempt_and_escalation_state_are_persisted(db):
    monitor = db.start_monitor(_monitor_payload())

    attempt = db.record_followup_attempt(
        monitor["monitor_id"],
        attendee_user_id="ou_a",
        channel="feishu",
        target_id="ou_a",
        status="sent",
        message_id="msg_1",
        error_detail=None,
    )
    attendee = db.get_attendee(monitor["monitor_id"], "ou_a")

    assert attempt["status"] == "sent"
    assert attempt["round_number"] == 1
    assert attendee["followup_count"] == 1
    assert attendee["last_followup_at"] is not None

    escalated = db.mark_attendee_escalated(
        monitor["monitor_id"],
        attendee_user_id="ou_a",
        creator_user_id="user_1",
        reason="followup_limit_reached",
        delivery_task_id="dt_1",
    )
    attendee = db.get_attendee(monitor["monitor_id"], "ou_a")

    assert escalated["status"] == "pending"
    assert escalated["delivery_task_id"] == "dt_1"
    assert attendee["delivery_status"] == "escalated"
    assert attendee["escalated_at"] is not None
```

- [ ] **Step 3: Run the targeted tests (verify-first)**

Run:

```bash
pytest -q tests/test_meeting_coordinator_store.py::test_update_attendee_statuses_tracks_terminal_and_pending_states tests/test_meeting_coordinator_store.py::test_followup_attempt_and_escalation_state_are_persisted
```

Expected: tests may already pass if the store methods are present in your branch.
If they fail due to missing/incomplete methods, apply Step 4 and Step 5; if they pass, skip direct code insertion and proceed.

- [ ] **Step 4: Add RSVP status helpers to store**

In `src/agents/meeting_coordinator_store.py`, add these constants near `_monitor_id`:

```python
TERMINAL_RSVP_STATUSES = {"accepted", "declined", "tentative"}
NON_TERMINAL_RSVP_STATUSES = {"needs_action", "unknown"}
ALL_RSVP_STATUSES = TERMINAL_RSVP_STATUSES | NON_TERMINAL_RSVP_STATUSES
```

Inside `MeetingCoordinatorStore`, add:

```python
    def _normalize_rsvp_status(self, value: Any) -> str:
        status = str(value or "unknown").strip().lower()
        if status in {"accept", "accepted"}:
            return "accepted"
        if status in {"decline", "declined"}:
            return "declined"
        if status in {"tentative", "maybe"}:
            return "tentative"
        if status in {"needs_action", "needsaction", "pending", "none", "null"}:
            return "needs_action"
        if status in ALL_RSVP_STATUSES:
            return status
        return "unknown"

    def update_attendee_statuses(
        self,
        monitor_id: str,
        live_attendees: list[dict[str, Any]],
    ) -> dict[str, int]:
        now = utc_now_iso()
        counts = {status: 0 for status in sorted(ALL_RSVP_STATUSES)}
        with self._connect() as conn:
            conn.execute(
                """
                UPDATE meeting_rsvp_monitors
                SET last_checked_at=?, updated_at=?
                WHERE monitor_id=?
                """,
                (now, now, monitor_id),
            )
            for item in live_attendees:
                attendee_user_id = str(item.get("user_id") or item.get("attendee_user_id") or "").strip()
                if not attendee_user_id:
                    continue
                status = self._normalize_rsvp_status(item.get("response_status"))
                counts[status] += 1
                last_response_at = now if status in TERMINAL_RSVP_STATUSES else None
                conn.execute(
                    """
                    UPDATE meeting_rsvp_attendees
                    SET response_status=?,
                        message_user_id=COALESCE(NULLIF(?, ''), message_user_id),
                        display_name=COALESCE(NULLIF(?, ''), display_name),
                        last_response_at=COALESCE(?, last_response_at),
                        updated_at=updated_at
                    WHERE monitor_id=? AND attendee_user_id=?
                    """,
                    (
                        status,
                        str(item.get("message_user_id") or ""),
                        str(item.get("display_name") or ""),
                        last_response_at,
                        monitor_id,
                        attendee_user_id,
                    ),
                )
        return counts

    def get_attendee(self, monitor_id: str, attendee_user_id: str) -> dict[str, Any]:
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT * FROM meeting_rsvp_attendees
                WHERE monitor_id=? AND attendee_user_id=?
                """,
                (monitor_id, attendee_user_id),
            ).fetchone()
        if row is None:
            raise KeyError(f"{monitor_id}:{attendee_user_id}")
        return dict(row)

    def list_pending_followup_attendees(self, monitor_id: str) -> list[dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT * FROM meeting_rsvp_attendees
                WHERE monitor_id=?
                  AND response_status IN ('needs_action', 'unknown')
                  AND delivery_status != 'escalated'
                ORDER BY attendee_user_id
                """,
                (monitor_id,),
            ).fetchall()
        return [dict(row) for row in rows]
```

Note: if SQLite raises `no such column: updated_at` for attendee updates, remove `updated_at=updated_at` from the SQL. The attendee table does not currently define `updated_at`; the clause is intentionally a no-op only if the column exists. Prefer removing it for the current schema:

```sql
SET response_status=?,
    message_user_id=COALESCE(NULLIF(?, ''), message_user_id),
    display_name=COALESCE(NULLIF(?, ''), display_name),
    last_response_at=COALESCE(?, last_response_at)
```

- [ ] **Step 5: Add follow-up and escalation store methods**

In `MeetingCoordinatorStore`, add:

```python
    def record_followup_attempt(
        self,
        monitor_id: str,
        *,
        attendee_user_id: str,
        channel: str,
        target_id: str,
        status: str,
        message_id: str | None,
        error_detail: str | None,
    ) -> dict[str, Any]:
        now = utc_now_iso()
        followup_id = f"fu_{uuid.uuid4().hex}"
        attendee = self.get_attendee(monitor_id, attendee_user_id)
        round_number = int(attendee["followup_count"] or 0) + 1
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO meeting_rsvp_followups(
                    followup_id, monitor_id, attendee_user_id, round_number,
                    status, message_channel, message_id, error_detail,
                    created_at, sent_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    followup_id,
                    monitor_id,
                    attendee_user_id,
                    round_number,
                    status,
                    channel,
                    message_id,
                    error_detail,
                    now,
                    now if status == "sent" else None,
                ),
            )
            if status == "sent":
                conn.execute(
                    """
                    UPDATE meeting_rsvp_attendees
                    SET followup_count=followup_count + 1,
                        last_followup_at=?
                    WHERE monitor_id=? AND attendee_user_id=?
                    """,
                    (now, monitor_id, attendee_user_id),
                )
            row = conn.execute(
                "SELECT * FROM meeting_rsvp_followups WHERE followup_id=?",
                (followup_id,),
            ).fetchone()
        return dict(row)

    def mark_attendee_escalated(
        self,
        monitor_id: str,
        *,
        attendee_user_id: str,
        creator_user_id: str,
        reason: str,
        delivery_task_id: str,
    ) -> dict[str, Any]:
        now = utc_now_iso()
        escalation_id = f"esc_{uuid.uuid4().hex}"
        with self._connect() as conn:
            conn.execute(
                """
                UPDATE meeting_rsvp_attendees
                SET delivery_status='escalated', escalated_at=?
                WHERE monitor_id=? AND attendee_user_id=?
                """,
                (now, monitor_id, attendee_user_id),
            )
            conn.execute(
                """
                INSERT INTO meeting_rsvp_escalations(
                    escalation_id, monitor_id, attendee_user_id, creator_user_id,
                    reason, delivery_task_id, status, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)
                """,
                (
                    escalation_id,
                    monitor_id,
                    attendee_user_id,
                    creator_user_id,
                    reason,
                    delivery_task_id,
                    now,
                    now,
                ),
            )
            row = conn.execute(
                "SELECT * FROM meeting_rsvp_escalations WHERE escalation_id=?",
                (escalation_id,),
            ).fetchone()
        return dict(row)
```

- [ ] **Step 6: Run tests and commit**

Run:

```bash
pytest -q tests/test_meeting_coordinator_store.py
```

Expected: all tests pass.

Commit:

```bash
git add src/agents/meeting_coordinator_store.py tests/test_meeting_coordinator_store.py
git commit -m "feat: add RSVP follow-up store operations"
```

---

## Task 3: Implement Monitor Tick RSVP State Machine

**Files:**
- Modify: `src/agents/meeting_coordinator_gateway.py`
- Test: `tests/test_meeting_coordinator_gateway.py`

- [ ] **Step 1: Add failing test for all attendees responded**

Add this test to `tests/test_meeting_coordinator_gateway.py`:

```python
class CompletionCronClient(FakeCronClient):
    def __init__(self):
        super().__init__()
        self.disabled = []

    def disable_job(self, cron_job_id):
        self.disabled.append(cron_job_id)


class AcceptedFeishuClient:
    def __init__(self):
        self.messages = []

    def get_attendee_response_statuses(self, *, calendar_id, event_id):
        return [{"user_id": "ou_a", "message_user_id": "ou_a", "display_name": "Amy", "response_status": "accepted"}]

    def send_attendee_message(self, *, attendee_open_ids, message):
        self.messages.append({"attendee_open_ids": attendee_open_ids, "message": message})
        return {"delivered": attendee_open_ids, "failed": []}


def test_monitor_tick_completes_and_disables_cron_when_all_responded(tmp_path):
    store = MeetingCoordinatorStore(tmp_path / "state.db")
    cron = CompletionCronClient()
    monitor = gateway.start_monitor(payload(), store=store, cron=cron)

    result = gateway.monitor_tick(
        {"monitor_id": monitor["monitor_id"]},
        store=store,
        feishu_client=AcceptedFeishuClient(),
        cron=cron,
    )

    assert result["status"] == "complete"
    assert result["all_responded"] is True
    assert result["pending_attendees"] == []
    assert cron.disabled == ["cron_1"]
    assert store.get_monitor(monitor["monitor_id"])["status"] == "complete"
```

- [ ] **Step 2: Add failing test for reminder sending**

Add this test to `tests/test_meeting_coordinator_gateway.py`:

```python
class NeedsActionFeishuClient:
    def __init__(self):
        self.messages = []

    def get_attendee_response_statuses(self, *, calendar_id, event_id):
        return [{"user_id": "ou_a", "message_user_id": "ou_a", "display_name": "Amy", "response_status": "needs_action"}]

    def send_attendee_message(self, *, attendee_open_ids, message):
        self.messages.append({"attendee_open_ids": attendee_open_ids, "message": message})
        return {"delivered": attendee_open_ids, "failed": []}


def test_monitor_tick_sends_due_reminder_and_keeps_monitor_active(tmp_path):
    store = MeetingCoordinatorStore(tmp_path / "state.db")
    monitor = store.start_monitor(payload())
    client = NeedsActionFeishuClient()

    result = gateway.monitor_tick(
        {"monitor_id": monitor["monitor_id"], "followup_interval_minutes": 0},
        store=store,
        feishu_client=client,
    )
    attendee = store.get_attendee(monitor["monitor_id"], "ou_a")

    assert result["status"] == "active"
    assert result["all_responded"] is False
    assert result["pending_attendees"] == ["ou_a"]
    assert result["followups_sent"] == 1
    assert attendee["followup_count"] == 1
    assert client.messages[0]["attendee_open_ids"] == ["ou_a"]
    assert "Planning" in client.messages[0]["message"]
```

- [ ] **Step 3: Add failing test for reminder-limit escalation**

Add this test to `tests/test_meeting_coordinator_gateway.py`:

```python
def test_monitor_tick_escalates_after_reminder_limit(tmp_path):
    store = MeetingCoordinatorStore(tmp_path / "state.db")
    cron = FakeCronClient()
    monitor = store.start_monitor(payload())
    store.record_followup_attempt(
        monitor["monitor_id"],
        attendee_user_id="ou_a",
        channel="feishu",
        target_id="ou_a",
        status="sent",
        message_id="msg_1",
        error_detail=None,
    )

    result = gateway.monitor_tick(
        {"monitor_id": monitor["monitor_id"], "followup_interval_minutes": 0, "max_followups": 1},
        store=store,
        feishu_client=NeedsActionFeishuClient(),
        cron=cron,
    )
    attendee = store.get_attendee(monitor["monitor_id"], "ou_a")
    tasks = store.list_operation_delivery_tasks(workspace_id="ws_1", limit=10)

    assert result["escalations_sent"] == 1
    assert result["followups_sent"] == 0
    assert attendee["delivery_status"] == "escalated"
    assert tasks[0]["task_type"] == "creator_escalation"
    assert json.loads(tasks[0]["payload_json"])["reason"] == "followup_limit_reached"
    assert cron.created[-1]["name"] == "meeting-rsvp-delivery-retry:ws_1"
```

- [ ] **Step 4: Run the failing tests**

Run:

```bash
pytest -q tests/test_meeting_coordinator_gateway.py::test_monitor_tick_completes_and_disables_cron_when_all_responded tests/test_meeting_coordinator_gateway.py::test_monitor_tick_sends_due_reminder_and_keeps_monitor_active tests/test_meeting_coordinator_gateway.py::test_monitor_tick_escalates_after_reminder_limit
```

Expected: fail because `monitor_tick` only returns `checked`.

- [ ] **Step 5: Implement monitor tick state machine**

In `src/agents/meeting_coordinator_gateway.py`, add imports:

```python
from datetime import datetime, timedelta, timezone
```

Add helper functions above `monitor_tick`:

```python
def _parse_utc(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _followup_due(attendee: dict[str, Any], *, interval_minutes: int) -> bool:
    last_followup = _parse_utc(attendee.get("last_followup_at"))
    if last_followup is None:
        return True
    return _now_utc() - last_followup >= timedelta(minutes=interval_minutes)


def _render_reminder(monitor: dict[str, Any], attendee: dict[str, Any]) -> str:
    try:
        payload = json.loads(str(monitor.get("payload_json") or "{}"))
    except json.JSONDecodeError:
        payload = {}
    title = str(payload.get("meeting_title") or payload.get("title") or monitor.get("event_id"))
    start_time = str(payload.get("start_time") or payload.get("meeting_start_time") or "")
    return _prompt(
        "FOLLOWUP_MESSAGE.md",
        attendee_name=str(attendee.get("display_name") or attendee.get("attendee_user_id")),
        meeting_title=title,
        start_time=start_time,
        organizer_name=str(payload.get("creator_user_id") or monitor.get("creator_user_id")),
        response_status=str(attendee.get("response_status") or "unknown"),
    )
```

> **Prompt boundary:** Do not inline reminder prose in Python code. `_render_reminder` must delegate to `src/prompts/meeting_coordinator/FOLLOWUP_MESSAGE.md`. This preserves Architecture Law 3 / Semantier Prompt-Boundary Law.
```

Replace `monitor_tick` with:

```python
def monitor_tick(
    payload: dict[str, Any],
    *,
    store: MeetingCoordinatorStore,
    feishu_client: Any,
    cron: CronClient | None = None,
) -> dict[str, Any]:
    monitor = store.get_monitor(str(payload["monitor_id"]))
    interval_minutes = int(payload.get("followup_interval_minutes") or 2)
    max_followups = int(payload.get("max_followups") or 3)
    live_status = feishu_client.get_attendee_response_statuses(
        calendar_id=monitor["calendar_id"],
        event_id=monitor["event_id"],
    )
    store.update_attendee_statuses(monitor["monitor_id"], live_status)
    pending = store.list_pending_followup_attendees(monitor["monitor_id"])

    if not pending:
        completed = store.mark_monitor_complete(monitor["monitor_id"])
        cron_job_id = str(completed.get("cron_job_id") or "")
        if cron_job_id and cron is not None and hasattr(cron, "disable_job"):
            cron.disable_job(cron_job_id)
        return {
            "monitor_id": monitor["monitor_id"],
            "status": "complete",
            "all_responded": True,
            "pending_attendees": [],
            "followups_sent": 0,
            "escalations_sent": 0,
        }

    followups_sent = 0
    escalations_sent = 0
    for attendee in pending:
        attendee_user_id = str(attendee["attendee_user_id"])
        if int(attendee["followup_count"] or 0) >= max_followups:
            task = create_creator_escalation_task(
                monitor_id=monitor["monitor_id"],
                attendee_user_id=attendee_user_id,
                reason="followup_limit_reached",
                store=store,
                cron=cron,
            ) if cron is not None else store.create_delivery_task(
                monitor_id=monitor["monitor_id"],
                task_type="creator_escalation",
                target_user_id=monitor["creator_user_id"],
                delivery_binding=json.loads(monitor["creator_delivery_binding_json"]),
                payload={"attendee_user_id": attendee_user_id, "reason": "followup_limit_reached"},
            )
            store.mark_attendee_escalated(
                monitor["monitor_id"],
                attendee_user_id=attendee_user_id,
                creator_user_id=monitor["creator_user_id"],
                reason="followup_limit_reached",
                delivery_task_id=task["delivery_task_id"],
            )
            escalations_sent += 1
            continue

        if not _followup_due(attendee, interval_minutes=interval_minutes):
            continue

        target_id = str(attendee.get("message_user_id") or attendee_user_id)
        message = _render_reminder(monitor, attendee)
        result = feishu_client.send_attendee_message(
            attendee_open_ids=[target_id],
            message=message,
        )
        delivered = result.get("delivered") or []
        failed = result.get("failed") or []
        if delivered:
            store.record_followup_attempt(
                monitor["monitor_id"],
                attendee_user_id=attendee_user_id,
                channel="feishu",
                target_id=target_id,
                status="sent",
                message_id=None,
                error_detail=None,
            )
            followups_sent += 1
        elif failed:
            store.record_followup_attempt(
                monitor["monitor_id"],
                attendee_user_id=attendee_user_id,
                channel="feishu",
                target_id=target_id,
                status="failed",
                message_id=None,
                error_detail=json.dumps(failed, ensure_ascii=False, sort_keys=True),
            )

    remaining = store.list_pending_followup_attendees(monitor["monitor_id"])
    return {
        "monitor_id": monitor["monitor_id"],
        "status": "active",
        "all_responded": False,
        "pending_attendees": [str(item["attendee_user_id"]) for item in remaining],
        "followups_sent": followups_sent,
        "escalations_sent": escalations_sent,
    }
```

- [ ] **Step 6: Run tests and commit**

Run:

```bash
pytest -q tests/test_meeting_coordinator_gateway.py tests/test_meeting_coordinator_store.py
```

Expected: all tests pass.

Commit:

```bash
git add src/agents/meeting_coordinator_gateway.py tests/test_meeting_coordinator_gateway.py
git commit -m "feat: implement Feishu RSVP monitor tick flow"
```

---

## Task 4: Align Outputs, Limits, And Regression Coverage

**Files:**
- Modify: `src/agents/meeting_coordinator_gateway.py`
- Modify: `tests/test_meeting_coordinator_gateway.py`
- Modify: `tests/test_feishu_meeting_coordinator_plugin.py`
- Modify: `docs/derived/feishu-meeting-coordinator-plugin-design.md` only if implementation chooses a different accepted contract.

- [ ] **Step 1: Add failing test for delivery retry output contract**

Add this test to `tests/test_meeting_coordinator_gateway.py`:

```python
def test_escalation_retry_tick_returns_design_output_contract(tmp_path):
    store = MeetingCoordinatorStore(tmp_path / "state.db")
    delivery = FakeDeliveryClient()
    monitor = store.start_monitor(payload())
    store.create_delivery_task(
        monitor_id=monitor["monitor_id"],
        task_type="creator_escalation",
        target_user_id="user_1",
        delivery_binding=payload()["creator_delivery_binding"],
        payload={"reason": "declined"},
    )

    result = gateway.escalation_retry_tick(
        {"workspace_id": "ws_1", "limit": 20},
        store=store,
        delivery_client=delivery,
    )

    assert result == {
        "workspace_id": "ws_1",
        "processed": 1,
        "sent": 1,
        "failed_retryable": 0,
        "failed_permanent": 0,
        "remaining_non_terminal": 0,
    }
```

- [ ] **Step 2: Add failing schema regression for recurrence field**

Add this test to `tests/test_feishu_meeting_coordinator_plugin.py`:

```python
def test_feishu_meeting_create_schema_exposes_recurrence_as_unsupported_flag():
    module = load_plugin_module()
    ctx = FakePluginContext()

    module.register(ctx)

    schema = ctx.tools["feishu_meeting_create"]["schema"]
    assert schema["properties"]["is_recurrent_meeting"] == {
        "type": "boolean",
        "description": "Unsupported in v0.1; true requests must be clarified or rejected.",
    }
```

- [ ] **Step 3: Run targeted tests (verify-first)**

Run:

```bash
pytest -q tests/test_meeting_coordinator_gateway.py::test_escalation_retry_tick_returns_design_output_contract tests/test_feishu_meeting_coordinator_plugin.py::test_feishu_meeting_create_schema_exposes_recurrence_as_unsupported_flag
```

Expected: tests may already pass if the output contract/schema updates were previously implemented.
If either test fails, apply Step 4/Step 5 accordingly; if both pass, skip replacement code and continue.

- [ ] **Step 4: Update delivery retry output**

In `src/agents/meeting_coordinator_gateway.py`, replace `escalation_retry_tick` with:

```python
def escalation_retry_tick(
    payload: dict[str, Any],
    *,
    store: MeetingCoordinatorStore,
    delivery_client: Any,
) -> dict[str, Any]:
    workspace_id = str(payload["workspace_id"])
    limit = int(payload.get("limit") or 20)
    due_tasks = store.list_due_delivery_tasks(workspace_id=workspace_id, limit=limit)
    sent = 0
    failed_retryable = 0
    failed_permanent = 0
    for task in due_tasks:
        try:
            delivery_client.send_creator_escalation(task)
        except Exception as exc:
            store.mark_delivery_task_attempt_failed(
                task["delivery_task_id"],
                retryable=True,
                detail=str(exc),
            )
            failed_retryable += 1
            continue
        store.mark_delivery_task_sent(
            task["delivery_task_id"],
            detail="creator escalation sent",
        )
        sent += 1
    remaining = store.list_non_terminal_delivery_tasks(workspace_id=workspace_id, limit=1_000_000)
    return {
        "workspace_id": workspace_id,
        "processed": len(due_tasks),
        "sent": sent,
        "failed_retryable": failed_retryable,
        "failed_permanent": failed_permanent,
        "remaining_non_terminal": len(remaining),
    }
```

- [ ] **Step 5: Update meeting-create schema for recurrence**

In `semantier-skills/plugins/feishu_meeting_coordinator/__init__.py`, add this property under `feishu_meeting_create` properties:

```python
"is_recurrent_meeting": {
    "type": "boolean",
    "description": "Unsupported in v0.1; true requests must be clarified or rejected.",
},
```

- [ ] **Step 6: Run focused and full coordinator tests**

Run:

```bash
pytest -q tests/test_feishu_meeting_coordinator_plugin.py tests/test_feishu_meeting_coordinator_tools.py tests/test_feishu_bot_meeting_coordinator_helper.py tests/test_meeting_coordinator_store.py tests/test_meeting_coordinator_gateway.py tests/test_meeting_coordinator_webapi.py
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/agents/meeting_coordinator_gateway.py semantier-skills/plugins/feishu_meeting_coordinator/__init__.py tests/test_meeting_coordinator_gateway.py tests/test_feishu_meeting_coordinator_plugin.py
git commit -m "test: align Feishu coordinator contracts with design"
```

---

## Task 5: Final Architecture And Design Verification

**Files:**
- Read: `docs/canonical/architecture.md`
- Read: `docs/derived/feishu-meeting-coordinator-plugin-design.md`
- Modify: `docs/derived/feishu-meeting-coordinator-plugin-design.md` only if tests prove the design needs wording corrections.

- [ ] **Step 1: Verify architecture constraints**

Run:

```bash
rg -n "datetime\\.now\\(\\)|datetime\\.now\\(timezone\\.utc\\)|timezone-aware|prompt policy|src/prompts|Feishu|authority" docs/canonical/architecture.md src/agents/meeting_coordinator_gateway.py src/agents/meeting_coordinator_store.py semantier-skills/plugins/feishu_meeting_coordinator
```

Expected:

- New persisted timestamps use `datetime.now(timezone.utc)` through `utc_now_iso()`.
- No prompt prose for follow-up/escalation is introduced inline beyond deterministic fallback test strings.
- Feishu requester identity is not inferred from attendee names.

- [ ] **Step 2: Run final coordinator suite**

Run:

```bash
pytest -q tests/test_feishu_meeting_coordinator_plugin.py tests/test_feishu_meeting_coordinator_tools.py tests/test_feishu_bot_meeting_coordinator_helper.py tests/test_meeting_coordinator_store.py tests/test_meeting_coordinator_gateway.py tests/test_meeting_coordinator_webapi.py tests/test_feishu_meeting_coordinator_package_inventory.py
```

Expected: all tests pass.

- [ ] **Step 3: Inspect final diff**

Run:

```bash
git diff --stat
git diff -- docs/derived/feishu-meeting-coordinator-plugin-design.md src/agents/meeting_coordinator_gateway.py src/agents/meeting_coordinator_store.py semantier-skills/plugins/feishu_meeting_coordinator tests/test_meeting_coordinator_gateway.py tests/test_meeting_coordinator_store.py tests/test_feishu_meeting_coordinator_tools.py tests/test_feishu_bot_meeting_coordinator_helper.py tests/test_feishu_meeting_coordinator_plugin.py
```

Expected:

- Monitor tick implements design sequence.
- Store contains tested RSVP/follow-up mutations.
- Helper and tool paths keep requester out of invitees.
- No unrelated refactors.

- [ ] **Step 4: Commit final doc-only correction if needed**

If implementation exposed a deliberate design correction, commit that documentation update separately:

```bash
git add docs/derived/feishu-meeting-coordinator-plugin-design.md
git commit -m "docs: align Feishu coordinator design with implementation"
```

Skip this commit when the design doc remains unchanged after implementation.

---

## Self-Review

Spec coverage:

- Governed requester identity: Task 1 keeps requester out of invitees and Task 5 audits inference boundaries.
- Invitee-only attendee list: Task 1 covers tool and helper paths.
- Recurrent meeting v0.1 rejection: Task 1 and Task 4 cover behavior and schema.
- RSVP status normalization and follow-up list: Task 2 adds store methods, Task 3 uses them in monitor tick.
- Reminder cadence and max reminder count: Task 3 implements configurable interval and max follow-ups.
- Creator escalation after max reminders: Task 3 creates delivery tasks and marks attendees escalated.
- Delivery retry output contract: Task 4 aligns returned fields.
- Architecture constraints: Task 5 verifies timestamp and prompt-boundary risks.

Placeholder scan:

- No task uses placeholder markers or unspecified implementation instructions.
- Each code-changing task includes concrete snippets and exact test commands.

Type consistency:

- `attendee_user_id`, `message_user_id`, `response_status`, `followup_count`, and `delivery_status` match existing SQLite columns.
- `monitor_id`, `workspace_id`, `event_id`, and `event_revision_id` match current store/gateway payloads.
- `feishu_client.get_attendee_response_statuses` and `feishu_client.send_attendee_message` match the fake clients introduced in tests and the helper semantics.
