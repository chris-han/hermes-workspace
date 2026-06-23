# Feishu Meeting Coordinator Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Feishu Meeting Coordinator as one installable plugin package with bundled skill, SQLite-backed RSVP monitoring, cron-driven follow-ups, creator escalation delivery retries, and an Operations Web UI.

**Architecture:** The installable package lives under `semantier-skills/plugins/feishu_meeting_coordinator/` and bundles `SKILL.md` plus plugin tools. Semantier-owned gateway/state code lives under `src/agents/` and owns workspace authority, SQLite persistence, cron creation/repair, and Web UI API routes. Prompt prose lives under `src/prompts/meeting_coordinator/`.

**Tech Stack:** Python 3.12, SQLite, pytest, FastAPI route handlers in `src/agents/webapi_gateway.py`, Hermes cron/job APIs, Feishu/Lark SDK helper code, React/TanStack Query in `hermes-workspace`.

---

## Source Spec

Implementation target: `docs/derived/feishu-meeting-coordinator-plugin-design.md`

Architecture constraints:

- Resolve creator/user/workspace authority only through governed sources.
- Persist runtime timestamps as timezone-aware UTC ISO-8601.
- Use ASCII machine identifiers.
- Store prompt wording under `src/prompts/meeting_coordinator/`, not inline runtime code.
- Use SQLite for durable monitor/follow-up/delivery task state.
- Do not keep a separately installed skill-only copy after package promotion.

## File Structure

Create:

- `src/agents/meeting_coordinator_store.py` - SQLite schema and state transitions for monitors, attendees, followups, escalations, and delivery tasks.
- `src/agents/meeting_coordinator_gateway.py` - workspace-authorized orchestration helpers for monitor start/tick/stop, cron repair, and delivery retry.
- `src/prompts/meeting_coordinator/RSVP_MONITOR_JOB.md` - prompt asset for RSVP monitor cron job.
- `src/prompts/meeting_coordinator/FOLLOWUP_MESSAGE.md` - prompt asset for attendee follow-up message generation.
- `src/prompts/meeting_coordinator/CREATOR_ESCALATION.md` - prompt asset for creator escalation messages.
- `semantier-skills/plugins/feishu_meeting_coordinator/plugin.yaml` - single installable plugin manifest.
- `semantier-skills/plugins/feishu_meeting_coordinator/SKILL.md` - bundled companion skill.
- `semantier-skills/plugins/feishu_meeting_coordinator/__init__.py` - plugin registration.
- `semantier-skills/plugins/feishu_meeting_coordinator/tools.py` - Hermes tool handlers that call Semantier gateway helpers.
- `semantier-skills/plugins/feishu_meeting_coordinator/feishu_calendar.py` - Feishu calendar/attendee adapter wrapping current helper behavior.
- `semantier-skills/plugins/feishu_meeting_coordinator/messages.py` - structured message rendering from prompt assets.
- `semantier-skills/plugins/feishu_meeting_coordinator/cli.py` - operator CLI.
- `semantier-skills/plugins/feishu_meeting_coordinator/dashboard/plugin_api.py` - plugin dashboard surface if needed by Hermes plugin discovery.
- `tests/test_meeting_coordinator_store.py` - SQLite unit tests.
- `tests/test_meeting_coordinator_gateway.py` - orchestration and cron healing tests.
- `tests/test_feishu_meeting_coordinator_plugin.py` - plugin registration/tool tests.
- `hermes-workspace/src/routes/api/meeting-coordinator.ts` - TanStack Start API proxy from the Web UI to the Semantier gateway.
- `hermes-workspace/src/lib/meeting-coordinator-api.ts` - Web UI API client.
- `hermes-workspace/src/screens/agents/components/meeting-coordinator-panel.tsx` - Operations panel.
- `hermes-workspace/src/screens/agents/components/meeting-coordinator-panel.test.tsx` - UI tests.

Modify:

- `src/agents/webapi_gateway.py` - add `/system/meeting-coordinator/*` routes.
- `src/agents/route_policy.py` - add route policy entries for new routes.
- `docs/derived/gateway-unified-multitenant-design.md` - update tenant route matrix if routes are tenant-facing.
- `hermes-workspace/src/screens/agents/operations-screen.tsx` - render Meeting Coordinator panel.
- `hermes-workspace/src/screens/skills/skills-screen.tsx` only if install/update screen needs to show bundled plugin skill metadata.
- `semantier-skills/marketplace/index.json` - replace skill-only listing with single plugin package listing.

## Task 1: SQLite Store Schema and Core Transitions

**Files:**
- Create: `src/agents/meeting_coordinator_store.py`
- Test: `tests/test_meeting_coordinator_store.py`

- [ ] **Step 1: Write failing schema and idempotency tests**

Create `tests/test_meeting_coordinator_store.py`:

```python
from __future__ import annotations

import json
from datetime import datetime, timezone

import pytest

from agents import meeting_coordinator_store as store


def _binding() -> dict[str, str | None]:
    return {
        "workspace_owner_id": "ws_1",
        "creator_user_id": "user_1",
        "platform": "feishu",
        "chat_id": "oc_creator",
        "thread_id": None,
        "session_id": "sess_1",
        "session_key": "key_1",
        "hermes_home": "/tmp/hermes",
        "delivery_adapter_key": None,
        "source": "cron_origin",
        "captured_at": "2026-06-15T00:00:00Z",
    }


def _monitor_payload() -> dict:
    return {
        "workspace_id": "ws_1",
        "creator_user_id": "user_1",
        "event_id": "event_1",
        "event_revision_id": "rev_1",
        "calendar_id": "cal_1",
        "creator_delivery_binding": _binding(),
        "meeting_title": "Planning",
        "start_time": "2026-06-15T01:00:00Z",
        "end_time": "2026-06-15T01:30:00Z",
        "timezone": "Asia/Shanghai",
        "attendees": [
            {
                "user_id": "ou_a",
                "message_user_id": "ou_a",
                "display_name": "Amy",
            }
        ],
    }


@pytest.fixture
def db(tmp_path, monkeypatch):
    monkeypatch.setenv("SEMANTIER_LOCAL_STATE_DIR", str(tmp_path))
    return store.MeetingCoordinatorStore()


def test_start_monitor_is_idempotent_by_event_revision(db):
    first = db.start_monitor(_monitor_payload())
    second = db.start_monitor(_monitor_payload())

    assert first["monitor_id"] == second["monitor_id"]
    assert second["status"] == "pending_start"
    assert second["event_revision_id"] == "rev_1"
    assert json.loads(second["creator_delivery_binding_json"])["chat_id"] == "oc_creator"


def test_start_new_revision_replaces_previous_active_monitor(db):
    first = db.start_monitor(_monitor_payload())
    db.attach_cron_job(first["monitor_id"], "cron_1")
    payload = _monitor_payload()
    payload["event_revision_id"] = "rev_2"

    second = db.start_monitor(payload)
    replaced = db.get_monitor(first["monitor_id"])

    assert second["monitor_id"] != first["monitor_id"]
    assert replaced["status"] == "replaced"
    assert second["status"] == "pending_start"


def test_mark_monitor_start_failed_keeps_pending_start_with_error(db):
    monitor = db.start_monitor(_monitor_payload())

    failed = db.mark_monitor_start_failed(
        monitor["monitor_id"],
        detail="cron unavailable",
    )

    assert failed["status"] == "pending_start"
    assert failed["cron_job_id"] is None
    assert failed["last_start_error"] == "cron unavailable"
    assert datetime.fromisoformat(failed["updated_at"].replace("Z", "+00:00")).tzinfo is not None


def test_delivery_task_requeue_preserves_attempt_count_and_is_due_now(db):
    monitor = db.start_monitor(_monitor_payload())
    task = db.create_delivery_task(
        monitor_id=monitor["monitor_id"],
        task_type="creator_escalation",
        target_user_id="user_1",
        delivery_binding=_binding(),
        payload={"reason": "followup_limit_reached"},
    )
    db.mark_delivery_task_failed(
        task["delivery_task_id"],
        retryable=False,
        detail="blocked",
    )
    failed = db.get_delivery_task(task["delivery_task_id"])

    requeued = db.requeue_delivery_task(
        task["delivery_task_id"],
        reason="manual_requeue",
    )

    assert requeued["status"] == "pending"
    assert requeued["attempt_count"] == failed["attempt_count"]
    assert datetime.fromisoformat(requeued["next_attempt_at"].replace("Z", "+00:00")).tzinfo is not None


def test_due_delivery_tasks_include_pending_and_due_retryable(db):
    monitor = db.start_monitor(_monitor_payload())
    task = db.create_delivery_task(
        monitor_id=monitor["monitor_id"],
        task_type="creator_escalation",
        target_user_id="user_1",
        delivery_binding=_binding(),
        payload={"reason": "declined"},
    )

    due = db.list_due_delivery_tasks(workspace_id="ws_1", limit=10)

    assert [item["delivery_task_id"] for item in due] == [task["delivery_task_id"]]


def test_non_terminal_delivery_tasks_include_future_retryable(db):
    monitor = db.start_monitor(_monitor_payload())
    task = db.create_delivery_task(
        monitor_id=monitor["monitor_id"],
        task_type="creator_escalation",
        target_user_id="user_1",
        delivery_binding=_binding(),
        payload={"reason": "declined"},
    )
    failed = db.mark_delivery_task_failed(
        task["delivery_task_id"],
        retryable=True,
        detail="temporary delivery error",
    )

    due = db.list_due_delivery_tasks(workspace_id="ws_1", limit=10)
    non_terminal = db.list_non_terminal_delivery_tasks(workspace_id="ws_1", limit=10)

    assert failed["status"] == "failed_retryable"
    assert due == []
    assert [item["delivery_task_id"] for item in non_terminal] == [task["delivery_task_id"]]


def test_delivery_task_success_is_terminal_and_not_due(db):
    monitor = db.start_monitor(_monitor_payload())
    task = db.create_delivery_task(
        monitor_id=monitor["monitor_id"],
        task_type="creator_escalation",
        target_user_id="user_1",
        delivery_binding=_binding(),
        payload={"reason": "declined"},
    )

    sent = db.mark_delivery_task_sent(
        task["delivery_task_id"],
        detail="message sent",
    )
    due = db.list_due_delivery_tasks(workspace_id="ws_1", limit=10)

    assert sent["status"] == "sent"
    assert sent["attempt_count"] == 1
    assert sent["next_attempt_at"] is None
    assert due == []


def test_delivery_task_retryable_failure_increments_attempt_and_sets_backoff(db):
    monitor = db.start_monitor(_monitor_payload())
    task = db.create_delivery_task(
        monitor_id=monitor["monitor_id"],
        task_type="creator_escalation",
        target_user_id="user_1",
        delivery_binding=_binding(),
        payload={"reason": "declined"},
    )

    failed = db.mark_delivery_task_attempt_failed(
        task["delivery_task_id"],
        retryable=True,
        detail="temporary send failure",
    )

    assert failed["status"] == "failed_retryable"
    assert failed["attempt_count"] == 1
    assert datetime.fromisoformat(failed["next_attempt_at"].replace("Z", "+00:00")).tzinfo is not None


def test_operations_state_includes_completed_monitor_with_non_terminal_delivery_task(db):
    monitor = db.start_monitor(_monitor_payload())
    db.create_delivery_task(
        monitor_id=monitor["monitor_id"],
        task_type="creator_escalation",
        target_user_id="user_1",
        delivery_binding=_binding(),
        payload={"reason": "declined"},
    )
    db.mark_monitor_complete(monitor["monitor_id"])

    monitors = db.list_operation_monitors(workspace_id="ws_1", limit=10)
    tasks = db.list_operation_delivery_tasks(workspace_id="ws_1", limit=10)

    assert monitors[0]["monitor_id"] == monitor["monitor_id"]
    assert monitors[0]["status"] == "complete"
    assert monitors[0]["pending_delivery_tasks"] == 1
    assert tasks[0]["task_type"] == "creator_escalation"
    assert tasks[0]["status"] == "pending"


def test_schema_includes_followups_escalations_and_scheduler_state(db):
    with db._connect() as conn:
        tables = {
            row["name"]
            for row in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ).fetchall()
        }

    assert "meeting_rsvp_followups" in tables
    assert "meeting_rsvp_escalations" in tables
    assert "meeting_rsvp_workspace_state" in tables


def test_delivery_retry_scheduler_unavailable_is_persisted(db):
    db.mark_delivery_retry_scheduler_unavailable(
        workspace_id="ws_1",
        detail="cron service unavailable",
    )

    state = db.get_workspace_state("ws_1")

    assert state["delivery_retry_scheduler_status"] == "unavailable"
    assert state["delivery_retry_scheduler_detail"] == "cron service unavailable"
    assert datetime.fromisoformat(state["updated_at"].replace("Z", "+00:00")).tzinfo is not None
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pytest -q tests/test_meeting_coordinator_store.py
```

Expected: FAIL with `ImportError: cannot import name 'meeting_coordinator_store'`.

- [ ] **Step 3: Implement minimal store**

Create `src/agents/meeting_coordinator_store.py`:

```python
from __future__ import annotations

import hashlib
import json
import os
import sqlite3
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _db_path() -> Path:
    root = Path(os.environ.get("SEMANTIER_LOCAL_STATE_DIR") or ".semantier-home").expanduser().resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root / "state.db"


def _json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True)


def _monitor_id(workspace_id: str, event_id: str, event_revision_id: str) -> str:
    raw = f"{workspace_id}\0{event_id}\0{event_revision_id}".encode("utf-8")
    return f"m_{hashlib.sha256(raw).hexdigest()[:24]}"


class MeetingCoordinatorStore:
    def __init__(self, path: str | Path | None = None):
        self.path = Path(path) if path is not None else _db_path()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._ensure_schema()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.path))
        conn.row_factory = sqlite3.Row
        return conn

    def _ensure_schema(self) -> None:
        with self._connect() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS meeting_rsvp_monitors (
                    monitor_id TEXT PRIMARY KEY,
                    workspace_id TEXT NOT NULL,
                    creator_user_id TEXT NOT NULL,
                    platform TEXT NOT NULL,
                    event_id TEXT NOT NULL,
                    event_revision_id TEXT NOT NULL,
                    calendar_id TEXT NOT NULL,
                    cron_job_id TEXT,
                    creator_delivery_binding_json TEXT NOT NULL,
                    status TEXT NOT NULL,
                    last_start_error TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    completed_at TEXT,
                    last_checked_at TEXT,
                    payload_json TEXT NOT NULL,
                    UNIQUE(workspace_id, event_id, event_revision_id)
                );
                CREATE TABLE IF NOT EXISTS meeting_rsvp_attendees (
                    monitor_id TEXT NOT NULL,
                    attendee_user_id TEXT NOT NULL,
                    message_user_id TEXT,
                    display_name TEXT,
                    response_status TEXT NOT NULL,
                    last_response_at TEXT,
                    last_followup_at TEXT,
                    followup_count INTEGER NOT NULL DEFAULT 0,
                    delivery_status TEXT NOT NULL,
                    escalated_at TEXT,
                    PRIMARY KEY(monitor_id, attendee_user_id)
                );
                CREATE TABLE IF NOT EXISTS meeting_rsvp_followups (
                    followup_id TEXT PRIMARY KEY,
                    monitor_id TEXT NOT NULL,
                    attendee_user_id TEXT NOT NULL,
                    round_number INTEGER NOT NULL,
                    status TEXT NOT NULL,
                    message_channel TEXT NOT NULL,
                    message_id TEXT,
                    error_detail TEXT,
                    created_at TEXT NOT NULL,
                    sent_at TEXT
                );
                CREATE TABLE IF NOT EXISTS meeting_rsvp_escalations (
                    escalation_id TEXT PRIMARY KEY,
                    monitor_id TEXT NOT NULL,
                    attendee_user_id TEXT NOT NULL,
                    creator_user_id TEXT NOT NULL,
                    reason TEXT NOT NULL,
                    delivery_task_id TEXT,
                    status TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS meeting_rsvp_delivery_tasks (
                    delivery_task_id TEXT PRIMARY KEY,
                    monitor_id TEXT NOT NULL,
                    workspace_id TEXT NOT NULL,
                    task_type TEXT NOT NULL,
                    target_user_id TEXT NOT NULL,
                    delivery_binding_json TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    status TEXT NOT NULL,
                    attempt_count INTEGER NOT NULL DEFAULT 0,
                    next_attempt_at TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    result_detail TEXT
                );
                CREATE TABLE IF NOT EXISTS meeting_rsvp_workspace_state (
                    workspace_id TEXT PRIMARY KEY,
                    delivery_retry_scheduler_status TEXT NOT NULL,
                    delivery_retry_scheduler_detail TEXT,
                    updated_at TEXT NOT NULL
                );
                """
            )

    def _row(self, row: sqlite3.Row | None) -> dict[str, Any] | None:
        return dict(row) if row is not None else None

    def start_monitor(self, payload: dict[str, Any]) -> dict[str, Any]:
        now = utc_now_iso()
        monitor_id = _monitor_id(payload["workspace_id"], payload["event_id"], payload["event_revision_id"])
        with self._connect() as conn:
            existing = conn.execute(
                "SELECT * FROM meeting_rsvp_monitors WHERE monitor_id=?",
                (monitor_id,),
            ).fetchone()
            if existing is not None:
                return dict(existing)
            conn.execute(
                """
                UPDATE meeting_rsvp_monitors
                SET status='replaced', updated_at=?
                WHERE workspace_id=? AND event_id=? AND status IN ('active', 'pending_start', 'error')
                """,
                (now, payload["workspace_id"], payload["event_id"]),
            )
            conn.execute(
                """
                INSERT INTO meeting_rsvp_monitors(
                    monitor_id, workspace_id, creator_user_id, platform, event_id,
                    event_revision_id, calendar_id, cron_job_id,
                    creator_delivery_binding_json, status, created_at, updated_at,
                    payload_json
                )
                VALUES (?, ?, ?, 'feishu', ?, ?, ?, NULL, ?, 'pending_start', ?, ?, ?)
                """,
                (
                    monitor_id,
                    payload["workspace_id"],
                    payload["creator_user_id"],
                    payload["event_id"],
                    payload["event_revision_id"],
                    payload["calendar_id"],
                    _json(payload["creator_delivery_binding"]),
                    now,
                    now,
                    _json(payload),
                ),
            )
            for attendee in payload.get("attendees") or []:
                user_id = str(attendee.get("user_id") or "").strip()
                if not user_id:
                    continue
                conn.execute(
                    """
                    INSERT OR REPLACE INTO meeting_rsvp_attendees(
                        monitor_id, attendee_user_id, message_user_id, display_name,
                        response_status, delivery_status
                    )
                    VALUES (?, ?, ?, ?, 'unknown', 'ready')
                    """,
                    (
                        monitor_id,
                        user_id,
                        str(attendee.get("message_user_id") or ""),
                        str(attendee.get("display_name") or ""),
                    ),
                )
            return dict(conn.execute("SELECT * FROM meeting_rsvp_monitors WHERE monitor_id=?", (monitor_id,)).fetchone())

    def get_monitor(self, monitor_id: str) -> dict[str, Any]:
        with self._connect() as conn:
            row = conn.execute("SELECT * FROM meeting_rsvp_monitors WHERE monitor_id=?", (monitor_id,)).fetchone()
        if row is None:
            raise KeyError(monitor_id)
        return dict(row)

    def attach_cron_job(self, monitor_id: str, cron_job_id: str) -> dict[str, Any]:
        now = utc_now_iso()
        with self._connect() as conn:
            conn.execute(
                "UPDATE meeting_rsvp_monitors SET cron_job_id=?, status='active', last_start_error=NULL, updated_at=? WHERE monitor_id=?",
                (cron_job_id, now, monitor_id),
            )
        return self.get_monitor(monitor_id)

    def mark_monitor_start_failed(self, monitor_id: str, *, detail: str) -> dict[str, Any]:
        now = utc_now_iso()
        with self._connect() as conn:
            conn.execute(
                """
                UPDATE meeting_rsvp_monitors
                SET status='pending_start', last_start_error=?, updated_at=?
                WHERE monitor_id=?
                """,
                (detail, now, monitor_id),
            )
        return self.get_monitor(monitor_id)

    def mark_monitor_complete(self, monitor_id: str) -> dict[str, Any]:
        now = utc_now_iso()
        with self._connect() as conn:
            conn.execute(
                """
                UPDATE meeting_rsvp_monitors
                SET status='complete', completed_at=?, updated_at=?
                WHERE monitor_id=?
                """,
                (now, now, monitor_id),
            )
        return self.get_monitor(monitor_id)

    def create_delivery_task(self, *, monitor_id: str, task_type: str, target_user_id: str, delivery_binding: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
        monitor = self.get_monitor(monitor_id)
        now = utc_now_iso()
        task_id = f"dt_{uuid.uuid4().hex}"
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO meeting_rsvp_delivery_tasks(
                    delivery_task_id, monitor_id, workspace_id, task_type,
                    target_user_id, delivery_binding_json, payload_json,
                    status, attempt_count, next_attempt_at, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?, ?)
                """,
                (
                    task_id,
                    monitor_id,
                    monitor["workspace_id"],
                    task_type,
                    target_user_id,
                    _json(delivery_binding),
                    _json(payload),
                    now,
                    now,
                    now,
                ),
            )
            return dict(conn.execute("SELECT * FROM meeting_rsvp_delivery_tasks WHERE delivery_task_id=?", (task_id,)).fetchone())

    def get_delivery_task(self, delivery_task_id: str) -> dict[str, Any]:
        with self._connect() as conn:
            row = conn.execute("SELECT * FROM meeting_rsvp_delivery_tasks WHERE delivery_task_id=?", (delivery_task_id,)).fetchone()
        if row is None:
            raise KeyError(delivery_task_id)
        return dict(row)

    def mark_delivery_task_failed(self, delivery_task_id: str, *, retryable: bool, detail: str) -> dict[str, Any]:
        now = utc_now_iso()
        status = "failed_retryable" if retryable else "failed_permanent"
        next_attempt_at = (datetime.now(timezone.utc) + timedelta(minutes=2)).isoformat().replace("+00:00", "Z") if retryable else None
        with self._connect() as conn:
            conn.execute(
                """
                UPDATE meeting_rsvp_delivery_tasks
                SET status=?, result_detail=?, next_attempt_at=?, updated_at=?
                WHERE delivery_task_id=?
                """,
                (status, detail, next_attempt_at, now, delivery_task_id),
            )
        return self.get_delivery_task(delivery_task_id)

    def mark_delivery_task_sent(self, delivery_task_id: str, *, detail: str) -> dict[str, Any]:
        now = utc_now_iso()
        with self._connect() as conn:
            conn.execute(
                """
                UPDATE meeting_rsvp_delivery_tasks
                SET status='sent',
                    attempt_count=attempt_count + 1,
                    result_detail=?,
                    next_attempt_at=NULL,
                    updated_at=?
                WHERE delivery_task_id=?
                """,
                (detail, now, delivery_task_id),
            )
        return self.get_delivery_task(delivery_task_id)

    def mark_delivery_task_attempt_failed(self, delivery_task_id: str, *, retryable: bool, detail: str) -> dict[str, Any]:
        now = utc_now_iso()
        status = "failed_retryable" if retryable else "failed_permanent"
        next_attempt_at = (datetime.now(timezone.utc) + timedelta(minutes=2)).isoformat().replace("+00:00", "Z") if retryable else None
        with self._connect() as conn:
            conn.execute(
                """
                UPDATE meeting_rsvp_delivery_tasks
                SET status=?,
                    attempt_count=attempt_count + 1,
                    result_detail=?,
                    next_attempt_at=?,
                    updated_at=?
                WHERE delivery_task_id=?
                """,
                (status, detail, next_attempt_at, now, delivery_task_id),
            )
        return self.get_delivery_task(delivery_task_id)

    def requeue_delivery_task(self, delivery_task_id: str, *, reason: str) -> dict[str, Any]:
        task = self.get_delivery_task(delivery_task_id)
        if task["status"] not in {"failed_retryable", "failed_permanent"}:
            raise ValueError("only failed delivery tasks can be requeued")
        now = utc_now_iso()
        with self._connect() as conn:
            conn.execute(
                """
                UPDATE meeting_rsvp_delivery_tasks
                SET status='pending', next_attempt_at=?, result_detail=?, updated_at=?
                WHERE delivery_task_id=?
                """,
                (now, reason, now, delivery_task_id),
            )
        return self.get_delivery_task(delivery_task_id)

    def list_due_delivery_tasks(self, *, workspace_id: str, limit: int) -> list[dict[str, Any]]:
        now = utc_now_iso()
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT * FROM meeting_rsvp_delivery_tasks
                WHERE workspace_id=?
                  AND status IN ('pending', 'failed_retryable')
                  AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
                ORDER BY created_at
                LIMIT ?
                """,
                (workspace_id, now, int(limit)),
            ).fetchall()
        return [dict(row) for row in rows]

    def list_non_terminal_delivery_tasks(self, *, workspace_id: str, limit: int) -> list[dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT * FROM meeting_rsvp_delivery_tasks
                WHERE workspace_id=?
                  AND status IN ('pending', 'failed_retryable')
                ORDER BY created_at
                LIMIT ?
                """,
                (workspace_id, int(limit)),
            ).fetchall()
        return [dict(row) for row in rows]

    def mark_delivery_retry_scheduler_unavailable(self, *, workspace_id: str, detail: str) -> dict[str, Any]:
        now = utc_now_iso()
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO meeting_rsvp_workspace_state(
                    workspace_id, delivery_retry_scheduler_status,
                    delivery_retry_scheduler_detail, updated_at
                )
                VALUES (?, 'unavailable', ?, ?)
                ON CONFLICT(workspace_id) DO UPDATE SET
                    delivery_retry_scheduler_status='unavailable',
                    delivery_retry_scheduler_detail=excluded.delivery_retry_scheduler_detail,
                    updated_at=excluded.updated_at
                """,
                (workspace_id, detail, now),
            )
        return self.get_workspace_state(workspace_id)

    def get_workspace_state(self, workspace_id: str) -> dict[str, Any]:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM meeting_rsvp_workspace_state WHERE workspace_id=?",
                (workspace_id,),
            ).fetchone()
        if row is None:
            return {
                "workspace_id": workspace_id,
                "delivery_retry_scheduler_status": "ok",
                "delivery_retry_scheduler_detail": None,
                "updated_at": None,
            }
        return dict(row)

    def list_operation_monitors(self, *, workspace_id: str, limit: int) -> list[dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT m.*,
                       COUNT(t.delivery_task_id) AS pending_delivery_tasks
                FROM meeting_rsvp_monitors m
                LEFT JOIN meeting_rsvp_delivery_tasks t
                  ON t.monitor_id = m.monitor_id
                 AND t.status IN ('pending', 'failed_retryable')
                WHERE m.workspace_id=?
                  AND (
                    m.status IN ('pending_start', 'active', 'error')
                    OR t.delivery_task_id IS NOT NULL
                  )
                GROUP BY m.monitor_id
                ORDER BY m.updated_at DESC
                LIMIT ?
                """,
                (workspace_id, int(limit)),
            ).fetchall()
        return [dict(row) for row in rows]

    def list_operation_delivery_tasks(self, *, workspace_id: str, limit: int) -> list[dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT * FROM meeting_rsvp_delivery_tasks
                WHERE workspace_id=?
                  AND status IN ('pending', 'failed_retryable', 'failed_permanent')
                ORDER BY updated_at DESC
                LIMIT ?
                """,
                (workspace_id, int(limit)),
            ).fetchall()
        return [dict(row) for row in rows]
```

- [ ] **Step 4: Run store tests to verify pass**

Run:

```bash
pytest -q tests/test_meeting_coordinator_store.py
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/agents/meeting_coordinator_store.py tests/test_meeting_coordinator_store.py
git commit -m "feat: add meeting coordinator sqlite store"
```

## Task 2: Gateway Orchestration and Cron Repair

**Files:**
- Create: `src/agents/meeting_coordinator_gateway.py`
- Test: `tests/test_meeting_coordinator_gateway.py`

- [ ] **Step 1: Write failing orchestration tests**

Create `tests/test_meeting_coordinator_gateway.py`:

```python
from __future__ import annotations

from agents.meeting_coordinator_store import MeetingCoordinatorStore
from agents import meeting_coordinator_gateway as gateway


class FakeCronClient:
    def __init__(self):
        self.created = []
        self.existing = set()

    def ensure_job(self, *, name, schedule, profile, prompt, skills, deliver, repeat):
        self.created.append(
            {
                "name": name,
                "schedule": schedule,
                "profile": profile,
                "prompt": prompt,
                "skills": skills,
                "deliver": deliver,
                "repeat": repeat,
            }
        )
        self.existing.add(name)
        return f"cron_{len(self.created)}"

    def job_exists(self, cron_job_id):
        return cron_job_id in {"cron_1", "cron_2"} or cron_job_id in self.existing


class FailingCronClient(FakeCronClient):
    def ensure_job(self, **_kwargs):
        raise RuntimeError("cron unavailable")


class FakeFeishuClient:
    def get_attendee_response_statuses(self, *, calendar_id, event_id):
        return [{"user_id": "ou_a", "response_status": "accepted"}]


class FakeDeliveryClient:
    def __init__(self):
        self.sent = []
        self.fail = False

    def send_creator_escalation(self, task):
        if self.fail:
            raise RuntimeError("delivery failed")
        self.sent.append(task["delivery_task_id"])


def payload():
    return {
        "workspace_id": "ws_1",
        "creator_user_id": "user_1",
        "event_id": "event_1",
        "event_revision_id": "rev_1",
        "calendar_id": "cal_1",
        "creator_delivery_binding": {
            "workspace_owner_id": "ws_1",
            "creator_user_id": "user_1",
            "platform": "feishu",
            "chat_id": "oc_creator",
            "thread_id": None,
            "session_id": "sess_1",
            "session_key": "key_1",
            "hermes_home": "/tmp/hermes",
            "delivery_adapter_key": None,
            "source": "cron_origin",
            "captured_at": "2026-06-15T00:00:00Z",
        },
        "meeting_title": "Planning",
        "start_time": "2026-06-15T01:00:00Z",
        "end_time": "2026-06-15T01:30:00Z",
        "timezone": "Asia/Shanghai",
        "attendees": [{"user_id": "ou_a", "message_user_id": "ou_a", "display_name": "Amy"}],
    }


def test_start_monitor_creates_profile_cron(tmp_path):
    store = MeetingCoordinatorStore(tmp_path / "state.db")
    cron = FakeCronClient()

    result = gateway.start_monitor(payload(), store=store, cron=cron)

    assert result["status"] == "active"
    assert result["cron_job_id"] == "cron_1"
    assert cron.created[0]["name"].startswith("meeting-rsvp-monitor:")
    assert cron.created[0]["schedule"] == "every 2m"
    assert cron.created[0]["profile"] == "meeting-coordinator"
    assert cron.created[0]["deliver"] == "local"


def test_start_monitor_heals_missing_cron(tmp_path):
    store = MeetingCoordinatorStore(tmp_path / "state.db")
    cron = FakeCronClient()
    first = gateway.start_monitor(payload(), store=store, cron=cron)
    monitor = store.get_monitor(first["monitor_id"])
    store.attach_cron_job(monitor["monitor_id"], "missing_cron")

    healed = gateway.start_monitor(payload(), store=store, cron=cron)

    assert healed["cron_job_id"] == "cron_2"
    assert len(cron.created) == 2


def test_start_monitor_cron_failure_keeps_pending_start(tmp_path):
    store = MeetingCoordinatorStore(tmp_path / "state.db")

    result = gateway.start_monitor(payload(), store=store, cron=FailingCronClient())

    assert result["status"] == "pending_start"
    assert result["cron_job_id"] is None
    assert result["last_start_error"] == "cron unavailable"


def test_delivery_task_creation_ensures_retry_cron(tmp_path):
    store = MeetingCoordinatorStore(tmp_path / "state.db")
    cron = FakeCronClient()
    monitor = gateway.start_monitor(payload(), store=store, cron=cron)

    task = gateway.create_creator_escalation_task(
        monitor_id=monitor["monitor_id"],
        attendee_user_id="ou_a",
        reason="followup_limit_reached",
        store=store,
        cron=cron,
    )

    assert task["status"] == "pending"
    assert cron.created[-1]["name"] == "meeting-rsvp-delivery-retry:ws_1"
    assert cron.created[-1]["profile"] == "meeting-coordinator-delivery"


def test_delivery_retry_scheduler_failure_is_persisted(tmp_path):
    store = MeetingCoordinatorStore(tmp_path / "state.db")
    cron = FakeCronClient()
    monitor = gateway.start_monitor(payload(), store=store, cron=cron)

    task = gateway.create_creator_escalation_task(
        monitor_id=monitor["monitor_id"],
        attendee_user_id="ou_a",
        reason="declined",
        store=store,
        cron=FailingCronClient(),
    )
    state = store.get_workspace_state("ws_1")

    assert task["status"] == "pending"
    assert state["delivery_retry_scheduler_status"] == "unavailable"
    assert "cron unavailable" in state["delivery_retry_scheduler_detail"]


def test_requeue_delivery_task_heals_retry_cron(tmp_path):
    store = MeetingCoordinatorStore(tmp_path / "state.db")
    cron = FakeCronClient()
    monitor = gateway.start_monitor(payload(), store=store, cron=cron)
    task = store.create_delivery_task(
        monitor_id=monitor["monitor_id"],
        task_type="creator_escalation",
        target_user_id="user_1",
        delivery_binding=payload()["creator_delivery_binding"],
        payload={"reason": "declined"},
    )
    store.mark_delivery_task_failed(
        task["delivery_task_id"],
        retryable=False,
        detail="blocked",
    )

    requeued = gateway.requeue_delivery_task(
        delivery_task_id=task["delivery_task_id"],
        reason="operator retry",
        store=store,
        cron=cron,
    )

    assert requeued["status"] == "pending"
    assert cron.created[-1]["name"] == "meeting-rsvp-delivery-retry:ws_1"


def test_repair_delivery_retry_scheduler_heals_when_non_terminal_tasks_exist(tmp_path):
    store = MeetingCoordinatorStore(tmp_path / "state.db")
    cron = FakeCronClient()
    monitor = gateway.start_monitor(payload(), store=store, cron=cron)
    task = store.create_delivery_task(
        monitor_id=monitor["monitor_id"],
        task_type="creator_escalation",
        target_user_id="user_1",
        delivery_binding=payload()["creator_delivery_binding"],
        payload={"reason": "declined"},
    )
    store.mark_delivery_task_failed(
        task["delivery_task_id"],
        retryable=True,
        detail="temporary delivery error",
    )

    repaired = gateway.repair_delivery_retry_scheduler(
        workspace_id="ws_1",
        store=store,
        cron=cron,
    )

    assert repaired is True
    assert cron.created[-1]["name"] == "meeting-rsvp-delivery-retry:ws_1"


def test_repair_delivery_retry_scheduler_noops_without_due_tasks(tmp_path):
    store = MeetingCoordinatorStore(tmp_path / "state.db")
    cron = FakeCronClient()

    repaired = gateway.repair_delivery_retry_scheduler(
        workspace_id="ws_1",
        store=store,
        cron=cron,
    )

    assert repaired is False
    assert cron.created == []


def test_monitor_tick_reads_live_feishu_status(tmp_path):
    store = MeetingCoordinatorStore(tmp_path / "state.db")
    monitor = store.start_monitor(payload())

    result = gateway.monitor_tick(
        {"monitor_id": monitor["monitor_id"]},
        store=store,
        feishu_client=FakeFeishuClient(),
    )

    assert result == {"monitor_id": monitor["monitor_id"], "checked": 1}


def test_monitor_stop_disables_cron_when_supported(tmp_path):
    store = MeetingCoordinatorStore(tmp_path / "state.db")
    cron = FakeCronClient()
    cron.disabled = []
    cron.disable_job = lambda cron_job_id: cron.disabled.append(cron_job_id)
    monitor = gateway.start_monitor(payload(), store=store, cron=cron)

    result = gateway.monitor_stop(
        {"monitor_id": monitor["monitor_id"]},
        store=store,
        cron=cron,
    )

    assert result["stopped"] is True
    assert cron.disabled == ["cron_1"]


def test_escalation_retry_tick_marks_success_terminal(tmp_path):
    store = MeetingCoordinatorStore(tmp_path / "state.db")
    delivery = FakeDeliveryClient()
    monitor = store.start_monitor(payload())
    task = store.create_delivery_task(
        monitor_id=monitor["monitor_id"],
        task_type="creator_escalation",
        target_user_id="user_1",
        delivery_binding=payload()["creator_delivery_binding"],
        payload={"reason": "declined"},
    )

    result = gateway.escalation_retry_tick(
        {"workspace_id": "ws_1"},
        store=store,
        delivery_client=delivery,
    )

    assert result == {"workspace_id": "ws_1", "processed": 1, "sent": 1}
    assert delivery.sent == [task["delivery_task_id"]]
    assert store.get_delivery_task(task["delivery_task_id"])["status"] == "sent"
    assert store.list_due_delivery_tasks(workspace_id="ws_1", limit=10) == []


def test_escalation_retry_tick_marks_retryable_failure(tmp_path):
    store = MeetingCoordinatorStore(tmp_path / "state.db")
    delivery = FakeDeliveryClient()
    delivery.fail = True
    monitor = store.start_monitor(payload())
    task = store.create_delivery_task(
        monitor_id=monitor["monitor_id"],
        task_type="creator_escalation",
        target_user_id="user_1",
        delivery_binding=payload()["creator_delivery_binding"],
        payload={"reason": "declined"},
    )

    result = gateway.escalation_retry_tick(
        {"workspace_id": "ws_1"},
        store=store,
        delivery_client=delivery,
    )

    failed = store.get_delivery_task(task["delivery_task_id"])
    assert result == {"workspace_id": "ws_1", "processed": 1, "sent": 0}
    assert failed["status"] == "failed_retryable"
    assert failed["attempt_count"] == 1
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pytest -q tests/test_meeting_coordinator_gateway.py
```

Expected: FAIL with `ImportError: cannot import name 'meeting_coordinator_gateway'`.

- [ ] **Step 3: Implement gateway helpers**

Create `src/agents/meeting_coordinator_gateway.py`:

```python
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Protocol

from agents.meeting_coordinator_store import MeetingCoordinatorStore

_PROMPTS_ROOT = Path(__file__).resolve().parents[1] / "prompts" / "meeting_coordinator"


class CronClient(Protocol):
    def ensure_job(self, *, name: str, schedule: str, profile: str, prompt: str, skills: list[str], deliver: str, repeat: int) -> str: ...
    def job_exists(self, cron_job_id: str) -> bool: ...


def _prompt(name: str, **values: str) -> str:
    text = (_PROMPTS_ROOT / name).read_text(encoding="utf-8")
    for key, value in values.items():
        text = text.replace("{{" + key + "}}", str(value))
    return text


def start_monitor(payload: dict[str, Any], *, store: MeetingCoordinatorStore, cron: CronClient) -> dict[str, Any]:
    monitor = store.start_monitor(payload)
    cron_id = str(monitor.get("cron_job_id") or "")
    if cron_id and cron.job_exists(cron_id):
        return monitor
    prompt = _prompt(
        "RSVP_MONITOR_JOB.md",
        monitor_id=monitor["monitor_id"],
        workspace_id=monitor["workspace_id"],
        event_id=monitor["event_id"],
        calendar_id=monitor["calendar_id"],
    )
    try:
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
        return store.mark_monitor_start_failed(
            monitor["monitor_id"],
            detail=str(exc),
        )
    return store.attach_cron_job(monitor["monitor_id"], new_cron_id)


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


def repair_delivery_retry_scheduler(*, workspace_id: str, store: MeetingCoordinatorStore, cron: CronClient) -> bool:
    non_terminal_tasks = store.list_non_terminal_delivery_tasks(workspace_id=workspace_id, limit=1)
    if not non_terminal_tasks:
        return False
    try:
        ensure_delivery_retry_cron(workspace_id=workspace_id, cron=cron)
    except Exception as exc:
        store.mark_delivery_retry_scheduler_unavailable(
            workspace_id=workspace_id,
            detail=str(exc),
        )
        return False
    return True


def create_creator_escalation_task(*, monitor_id: str, attendee_user_id: str, reason: str, store: MeetingCoordinatorStore, cron: CronClient) -> dict[str, Any]:
    monitor = store.get_monitor(monitor_id)
    binding = json.loads(monitor["creator_delivery_binding_json"])
    task = store.create_delivery_task(
        monitor_id=monitor_id,
        task_type="creator_escalation",
        target_user_id=monitor["creator_user_id"],
        delivery_binding=binding,
        payload={"attendee_user_id": attendee_user_id, "reason": reason},
    )
    try:
        ensure_delivery_retry_cron(workspace_id=monitor["workspace_id"], cron=cron)
    except Exception as exc:
        store.mark_delivery_retry_scheduler_unavailable(
            workspace_id=monitor["workspace_id"],
            detail=str(exc),
        )
    return task


def requeue_delivery_task(*, delivery_task_id: str, reason: str, store: MeetingCoordinatorStore, cron: CronClient) -> dict[str, Any]:
    task = store.requeue_delivery_task(delivery_task_id, reason=reason)
    try:
        ensure_delivery_retry_cron(workspace_id=task["workspace_id"], cron=cron)
    except Exception as exc:
        store.mark_delivery_retry_scheduler_unavailable(
            workspace_id=task["workspace_id"],
            detail=str(exc),
        )
    return task


def monitor_tick(payload: dict[str, Any], *, store: MeetingCoordinatorStore, feishu_client: Any) -> dict[str, Any]:
    monitor = store.get_monitor(str(payload["monitor_id"]))
    live_status = feishu_client.get_attendee_response_statuses(
        calendar_id=monitor["calendar_id"],
        event_id=monitor["event_id"],
    )
    return {"monitor_id": monitor["monitor_id"], "checked": len(live_status)}


def monitor_stop(payload: dict[str, Any], *, store: MeetingCoordinatorStore, cron: CronClient) -> dict[str, Any]:
    monitor_id = str(payload["monitor_id"])
    monitor = store.get_monitor(monitor_id)
    cron_job_id = str(monitor.get("cron_job_id") or "")
    if cron_job_id and hasattr(cron, "disable_job"):
        cron.disable_job(cron_job_id)
    return {"monitor_id": monitor_id, "stopped": True}


def escalation_retry_tick(payload: dict[str, Any], *, store: MeetingCoordinatorStore, delivery_client: Any) -> dict[str, Any]:
    workspace_id = str(payload["workspace_id"])
    due_tasks = store.list_due_delivery_tasks(workspace_id=workspace_id, limit=25)
    sent = 0
    for task in due_tasks:
        try:
            delivery_client.send_creator_escalation(task)
        except Exception as exc:
            store.mark_delivery_task_attempt_failed(
                task["delivery_task_id"],
                retryable=True,
                detail=str(exc),
            )
            continue
        store.mark_delivery_task_sent(
            task["delivery_task_id"],
            detail="creator escalation sent",
        )
        sent += 1
    return {"workspace_id": workspace_id, "processed": len(due_tasks), "sent": sent}
```

- [ ] **Step 4: Add prompt asset needed by gateway test**

Create `src/prompts/meeting_coordinator/RSVP_MONITOR_JOB.md`:

```markdown
Run one RSVP monitor tick.

Monitor id: {{monitor_id}}
Workspace id: {{workspace_id}}
Event id: {{event_id}}
Calendar id: {{calendar_id}}

Use only the Feishu meeting coordinator tools. Do not infer attendee identity or delivery channels.
```

- [ ] **Step 5: Run tests to verify pass**

Run:

```bash
pytest -q tests/test_meeting_coordinator_gateway.py tests/test_meeting_coordinator_store.py
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/agents/meeting_coordinator_gateway.py src/prompts/meeting_coordinator/RSVP_MONITOR_JOB.md tests/test_meeting_coordinator_gateway.py
git commit -m "feat: orchestrate meeting coordinator cron monitors"
```

## Task 3: Feishu Plugin Package and Bundled Skill

**Files:**
- Create: `semantier-skills/plugins/feishu_meeting_coordinator/*`
- Test: `tests/test_feishu_meeting_coordinator_plugin.py`

- [ ] **Step 1: Write failing plugin registration test**

Create `tests/test_feishu_meeting_coordinator_plugin.py`:

```python
from __future__ import annotations

import importlib
import sys
from pathlib import Path


PLUGIN_ROOT = Path("semantier-skills/plugins/feishu_meeting_coordinator").resolve()


class FakePluginContext:
    def __init__(self):
        self.tools = {}
        self.cli = {}

    def register_tool(self, *, name, handler, description="", schema=None, toolset=None):
        self.tools[name] = {
            "handler": handler,
            "description": description,
            "schema": schema,
            "toolset": toolset,
        }

    def register_cli_command(self, *, name, help, setup_fn, handler_fn, description=""):
        self.cli[name] = {
            "help": help,
            "setup_fn": setup_fn,
            "handler_fn": handler_fn,
            "description": description,
        }


def load_plugin_module():
    plugin_parent = str(PLUGIN_ROOT.parent)
    if plugin_parent not in sys.path:
        sys.path.insert(0, plugin_parent)
    return importlib.import_module("feishu_meeting_coordinator")


def test_plugin_registers_tools_and_cli():
    module = load_plugin_module()
    ctx = FakePluginContext()

    module.register(ctx)

    assert "feishu_meeting_monitor_start" in ctx.tools
    assert "feishu_meeting_monitor_tick" in ctx.tools
    assert "feishu_meeting_escalation_retry_tick" in ctx.tools
    assert "feishu_meeting_delivery_task_requeue" in ctx.tools
    assert "feishu-meeting-coordinator" in ctx.cli


def test_plugin_bundles_skill_and_manifest():
    skill = (PLUGIN_ROOT / "SKILL.md").read_text(encoding="utf-8")
    manifest = (PLUGIN_ROOT / "plugin.yaml").read_text(encoding="utf-8")

    assert "feishu_meeting_coordinator" in manifest
    assert "RSVP" in skill
    assert "feishu_meeting_monitor_start" in skill
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
pytest -q tests/test_feishu_meeting_coordinator_plugin.py
```

Expected: FAIL because plugin package files do not exist.

- [ ] **Step 3: Create plugin manifest**

Create `semantier-skills/plugins/feishu_meeting_coordinator/plugin.yaml`:

```yaml
name: feishu_meeting_coordinator
version: 0.1.0
description: Feishu meeting RSVP monitoring and follow-up orchestration.
author: Semantier
kind: standalone
platforms:
  - linux
  - macos
  - windows
```

- [ ] **Step 4: Create bundled skill**

Create `semantier-skills/plugins/feishu_meeting_coordinator/SKILL.md`:

```markdown
---
name: feishu-bot-meeting-coordinator
description: Book Feishu meetings, query RSVP status, and start automatic RSVP monitoring through the bundled plugin.
---

# Feishu Bot Meeting Coordinator

When a user books or updates a Feishu meeting, create or update the calendar event and then call `feishu_meeting_monitor_start` with the returned `event_id`, `calendar_id`, `event_revision_id`, attendees, and captured `creator_delivery_binding`.

When a user asks for RSVP status, call live Feishu attendee status first. Do not infer RSVP state from memory.

The plugin handles follow-up reminders, creator escalation, delivery retry, and cron repair.
```

- [ ] **Step 5: Create plugin registration**

Create `semantier-skills/plugins/feishu_meeting_coordinator/__init__.py`:

```python
from __future__ import annotations

from .cli import register_cli, command
from .tools import (
    feishu_meeting_delivery_task_requeue,
    feishu_meeting_escalation_retry_tick,
    feishu_meeting_monitor_start,
    feishu_meeting_monitor_stop,
    feishu_meeting_monitor_tick,
)


def register(ctx) -> None:
    ctx.register_tool(
        name="feishu_meeting_monitor_start",
        handler=feishu_meeting_monitor_start,
        description="Start or repair RSVP monitoring for a Feishu meeting revision.",
        schema=None,
        toolset="meeting-coordinator",
    )
    ctx.register_tool(
        name="feishu_meeting_monitor_tick",
        handler=feishu_meeting_monitor_tick,
        description="Run one RSVP monitor tick.",
        schema=None,
        toolset="meeting-coordinator",
    )
    ctx.register_tool(
        name="feishu_meeting_monitor_stop",
        handler=feishu_meeting_monitor_stop,
        description="Stop one RSVP monitor and remove its cron job.",
        schema=None,
        toolset="meeting-coordinator",
    )
    ctx.register_tool(
        name="feishu_meeting_escalation_retry_tick",
        handler=feishu_meeting_escalation_retry_tick,
        description="Retry pending creator escalation delivery tasks.",
        schema=None,
        toolset="meeting-coordinator",
    )
    ctx.register_tool(
        name="feishu_meeting_delivery_task_requeue",
        handler=feishu_meeting_delivery_task_requeue,
        description="Requeue a failed creator escalation delivery task and heal the retry cron.",
        schema=None,
        toolset="meeting-coordinator",
    )
    ctx.register_cli_command(
        name="feishu-meeting-coordinator",
        help="Inspect and operate Feishu meeting RSVP monitors",
        setup_fn=register_cli,
        handler_fn=command,
        description="Operator CLI for Feishu meeting RSVP monitoring.",
    )
```

- [ ] **Step 6: Create minimal tool and CLI modules**

Create `semantier-skills/plugins/feishu_meeting_coordinator/tools.py`:

```python
from __future__ import annotations

import json


def feishu_meeting_monitor_start(args, **_kwargs):
    return json.dumps({"ok": False, "error": "Semantier gateway binding required"})


def feishu_meeting_monitor_tick(args, **_kwargs):
    return json.dumps({"ok": False, "error": "Semantier gateway binding required"})


def feishu_meeting_monitor_stop(args, **_kwargs):
    return json.dumps({"ok": False, "error": "Semantier gateway binding required"})


def feishu_meeting_escalation_retry_tick(args, **_kwargs):
    return json.dumps({"ok": False, "error": "Semantier gateway binding required"})


def feishu_meeting_delivery_task_requeue(args, **_kwargs):
    return json.dumps({"ok": False, "error": "Semantier gateway binding required"})
```

Create `semantier-skills/plugins/feishu_meeting_coordinator/cli.py`:

```python
from __future__ import annotations


def register_cli(parser) -> None:
    parser.add_parser("monitors")


def command(args) -> int:
    print("feishu meeting coordinator")
    return 0
```

Create `semantier-skills/plugins/feishu_meeting_coordinator/feishu_calendar.py`:

```python
from __future__ import annotations
```

Create `semantier-skills/plugins/feishu_meeting_coordinator/messages.py`:

```python
from __future__ import annotations
```

Create `semantier-skills/plugins/feishu_meeting_coordinator/dashboard/plugin_api.py`:

```python
from __future__ import annotations
```

- [ ] **Step 7: Run plugin tests**

Run:

```bash
pytest -q tests/test_feishu_meeting_coordinator_plugin.py
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add semantier-skills/plugins/feishu_meeting_coordinator tests/test_feishu_meeting_coordinator_plugin.py
git commit -m "feat: add installable feishu meeting coordinator plugin"
```

## Task 4: Follow-Up and Escalation Message Rendering

**Files:**
- Create: `src/prompts/meeting_coordinator/FOLLOWUP_MESSAGE.md`
- Create: `src/prompts/meeting_coordinator/CREATOR_ESCALATION.md`
- Modify: `semantier-skills/plugins/feishu_meeting_coordinator/messages.py`
- Test: `tests/test_feishu_meeting_coordinator_messages.py`

- [ ] **Step 1: Write failing message rendering tests**

Create `tests/test_feishu_meeting_coordinator_messages.py`:

```python
from __future__ import annotations

import importlib.util
from pathlib import Path


MODULE_PATH = Path("semantier-skills/plugins/feishu_meeting_coordinator/messages.py").resolve()


def load_messages():
    spec = importlib.util.spec_from_file_location("fc_messages", MODULE_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def test_followup_message_uses_structured_inputs_only():
    messages = load_messages()
    text = messages.render_followup_message(
        attendee_name="Amy",
        meeting_title="Planning",
        start_time="2026-06-15T01:00:00Z",
        organizer_name="Chris",
        response_status="needs_action",
    )

    assert "Amy" in text
    assert "Planning" in text
    assert "needs_action" in text
    assert "{{" not in text


def test_creator_escalation_message_names_reason_and_attendee():
    messages = load_messages()
    text = messages.render_creator_escalation(
        creator_name="Chris",
        attendee_name="Amy",
        meeting_title="Planning",
        reason="followup_limit_reached",
    )

    assert "Chris" in text
    assert "Amy" in text
    assert "followup_limit_reached" in text
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pytest -q tests/test_feishu_meeting_coordinator_messages.py
```

Expected: FAIL because functions are missing.

- [ ] **Step 3: Add prompt assets**

Create `src/prompts/meeting_coordinator/FOLLOWUP_MESSAGE.md`:

```markdown
Hi {{attendee_name}}, please respond to the meeting invitation for "{{meeting_title}}".

Start time: {{start_time}}
Organizer: {{organizer_name}}
Current RSVP status: {{response_status}}

Please accept, decline, or mark tentative so the organizer can confirm attendance.
```

Create `src/prompts/meeting_coordinator/CREATOR_ESCALATION.md`:

```markdown
Hi {{creator_name}}, {{attendee_name}} still needs your attention for "{{meeting_title}}".

Escalation reason: {{reason}}

Please contact the attendee directly or decide whether the meeting should be rescheduled.
```

- [ ] **Step 4: Implement renderer**

Replace `semantier-skills/plugins/feishu_meeting_coordinator/messages.py`:

```python
from __future__ import annotations

from pathlib import Path


def _prompt_root() -> Path:
    for parent in Path(__file__).resolve().parents:
        candidate = parent / "src" / "prompts" / "meeting_coordinator"
        if candidate.exists():
            return candidate
    raise RuntimeError("meeting coordinator prompt assets not found")


def _render(template_name: str, values: dict[str, str]) -> str:
    text = (_prompt_root() / template_name).read_text(encoding="utf-8")
    for key, value in values.items():
        text = text.replace("{{" + key + "}}", str(value))
    return text


def render_followup_message(*, attendee_name: str, meeting_title: str, start_time: str, organizer_name: str, response_status: str) -> str:
    return _render(
        "FOLLOWUP_MESSAGE.md",
        {
            "attendee_name": attendee_name,
            "meeting_title": meeting_title,
            "start_time": start_time,
            "organizer_name": organizer_name,
            "response_status": response_status,
        },
    )


def render_creator_escalation(*, creator_name: str, attendee_name: str, meeting_title: str, reason: str) -> str:
    return _render(
        "CREATOR_ESCALATION.md",
        {
            "creator_name": creator_name,
            "attendee_name": attendee_name,
            "meeting_title": meeting_title,
            "reason": reason,
        },
    )
```

- [ ] **Step 5: Run tests**

Run:

```bash
pytest -q tests/test_feishu_meeting_coordinator_messages.py
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/prompts/meeting_coordinator/FOLLOWUP_MESSAGE.md src/prompts/meeting_coordinator/CREATOR_ESCALATION.md semantier-skills/plugins/feishu_meeting_coordinator/messages.py tests/test_feishu_meeting_coordinator_messages.py
git commit -m "feat: render meeting coordinator messages from prompt assets"
```

## Task 5: Web API Routes

**Files:**
- Modify: `src/agents/webapi_gateway.py`
- Modify: `src/agents/route_policy.py`
- Test: `tests/test_meeting_coordinator_webapi.py`

- [ ] **Step 1: Write failing API handler tests**

Create `tests/test_meeting_coordinator_webapi.py`:

```python
from __future__ import annotations

import sys
import types

from fastapi import FastAPI
from fastapi.testclient import TestClient

from agents.webapi_gateway import router


def test_meeting_coordinator_routes_are_registered():
    app = FastAPI()
    app.include_router(router)
    paths = {route.path for route in app.routes}

    assert "/system/meeting-coordinator/monitors" in paths
    assert "/system/meeting-coordinator/delivery-tasks/retry" in paths
    assert "/system/meeting-coordinator/delivery-tasks/{delivery_task_id}/requeue" in paths


def test_meeting_coordinator_monitors_requires_authentication():
    app = FastAPI()
    app.include_router(router)
    client = TestClient(app)

    response = client.get("/system/meeting-coordinator/monitors")

    assert response.status_code == 401


def test_meeting_coordinator_monitors_payload_includes_scheduler_state(authenticated_client):
    response = authenticated_client.get("/system/meeting-coordinator/monitors")

    assert response.status_code == 200
    payload = response.json()
    assert "scheduler" in payload
    assert "delivery_retry_scheduler_status" in payload["scheduler"]


def test_meeting_coordinator_monitors_payload_includes_store_rows(authenticated_client, monkeypatch):
    class FakeStore:
        def get_workspace_state(self, workspace_id):
            return {
                "workspace_id": workspace_id,
                "delivery_retry_scheduler_status": "ok",
                "delivery_retry_scheduler_detail": None,
                "updated_at": None,
            }

        def list_non_terminal_delivery_tasks(self, *, workspace_id, limit):
            return [{"delivery_task_id": "dt_1"}]

        def list_operation_monitors(self, *, workspace_id, limit):
            return [
                {
                    "monitor_id": "m_1",
                    "meeting_title": "Planning",
                    "status": "complete",
                    "pending_delivery_tasks": 1,
                }
            ]

        def list_operation_delivery_tasks(self, *, workspace_id, limit):
            return [
                {
                    "delivery_task_id": "dt_1",
                    "task_type": "creator_escalation",
                    "status": "pending",
                }
            ]

    monkeypatch.setattr(
        "agents.meeting_coordinator_store.MeetingCoordinatorStore",
        lambda: FakeStore(),
    )
    monkeypatch.setattr(
        "agents.meeting_coordinator_gateway.repair_delivery_retry_scheduler",
        lambda *, workspace_id, store, cron: False,
    )

    response = authenticated_client.get("/system/meeting-coordinator/monitors")

    assert response.status_code == 200
    payload = response.json()
    assert payload["monitors"][0]["monitor_id"] == "m_1"
    assert payload["monitors"][0]["pending_delivery_tasks"] == 1
    assert payload["deliveryTasks"][0]["delivery_task_id"] == "dt_1"


def test_meeting_coordinator_monitors_surfaces_persisted_scheduler_unavailable(authenticated_client, monkeypatch):
    class FakeStore:
        def get_workspace_state(self, workspace_id):
            return {
                "workspace_id": workspace_id,
                "delivery_retry_scheduler_status": "unavailable",
                "delivery_retry_scheduler_detail": "cron service unavailable",
                "updated_at": "2026-06-15T00:00:00Z",
            }

        def list_non_terminal_delivery_tasks(self, *, workspace_id, limit):
            return []

        def list_operation_monitors(self, *, workspace_id, limit):
            return []

        def list_operation_delivery_tasks(self, *, workspace_id, limit):
            return []

    monkeypatch.setattr(
        "agents.meeting_coordinator_store.MeetingCoordinatorStore",
        lambda: FakeStore(),
    )

    response = authenticated_client.get("/system/meeting-coordinator/monitors")

    assert response.status_code == 200
    assert response.json()["scheduler"]["delivery_retry_scheduler_status"] == "unavailable"
    assert response.json()["scheduler"]["delivery_retry_scheduler_detail"] == "cron service unavailable"


def test_meeting_coordinator_monitors_repairs_delivery_retry_scheduler(authenticated_client, monkeypatch):
    calls = []

    def fake_repair_delivery_retry_scheduler(*, workspace_id, store, cron):
        calls.append(workspace_id)
        return True

    monkeypatch.setattr(
        "agents.meeting_coordinator_gateway.repair_delivery_retry_scheduler",
        fake_repair_delivery_retry_scheduler,
    )

    response = authenticated_client.get("/system/meeting-coordinator/monitors")

    assert response.status_code == 200
    assert calls


def test_meeting_coordinator_retry_route_calls_gateway(authenticated_client, monkeypatch):
    calls = []

    def fake_escalation_retry_tick(payload, *, store, delivery_client):
        calls.append(payload)
        return {"workspace_id": payload["workspace_id"], "processed": 1, "sent": 1}

    monkeypatch.setattr(
        "agents.meeting_coordinator_gateway.escalation_retry_tick",
        fake_escalation_retry_tick,
    )

    response = authenticated_client.post("/system/meeting-coordinator/delivery-tasks/retry")

    assert response.status_code == 200
    assert response.json()["processed"] == 1
    assert len(calls) == 1
    assert isinstance(calls[0]["workspace_id"], str)
    assert calls[0]["workspace_id"]
    assert response.json()["workspace_id"] == calls[0]["workspace_id"]


def test_meeting_coordinator_requeue_route_calls_gateway(authenticated_client, monkeypatch):
    calls = []

    def fake_requeue_delivery_task(*, delivery_task_id, reason, store, cron):
        calls.append((delivery_task_id, reason))
        return {"delivery_task_id": delivery_task_id, "status": "pending"}

    monkeypatch.setattr(
        "agents.meeting_coordinator_gateway.requeue_delivery_task",
        fake_requeue_delivery_task,
    )

    response = authenticated_client.post(
        "/system/meeting-coordinator/delivery-tasks/dt_1/requeue",
        json={"reason": "operator retry"},
    )

    assert response.status_code == 200
    assert response.json()["delivery_task"]["status"] == "pending"
    assert calls == [("dt_1", "operator retry")]


def test_meeting_coordinator_webapi_cron_client_uses_existing_job_helpers(monkeypatch):
    from agents import webapi_gateway

    created = []

    class Ctx:
        workspace_id = "ws_1"
        hermes_home = "/tmp/hermes"

    monkeypatch.setattr(webapi_gateway, "_list_workspace_cron_jobs", lambda ctx, include_disabled=True: [])
    monkeypatch.setattr(
        webapi_gateway,
        "_create_workspace_cron_job",
        lambda ctx, body: created.append(body) or {"id": "cron_1", **body},
    )

    client = webapi_gateway.MeetingCoordinatorWebApiCronClient(Ctx())
    cron_id = client.ensure_job(
        name="meeting-rsvp-delivery-retry:ws_1",
        schedule="every 2m",
        profile="meeting-coordinator-delivery",
        prompt="Run retry",
        skills=["feishu_meeting_coordinator"],
        deliver="local",
        repeat=0,
    )

    assert cron_id == "cron_1"
    assert created[0]["name"] == "meeting-rsvp-delivery-retry:ws_1"
    assert created[0]["profile"] == "meeting-coordinator-delivery"
    assert created[0]["skills"] == ["feishu_meeting_coordinator"]


def test_create_workspace_cron_job_preserves_profile(monkeypatch):
    from agents import webapi_gateway

    captured = {}

    class Ctx:
        hermes_home = "/tmp/hermes"

    class NoopHome:
        def __init__(self, _path):
            pass

        def __enter__(self):
            return None

        def __exit__(self, exc_type, exc, tb):
            return False

    def fake_create_job(**kwargs):
        captured.update(kwargs)
        return {"id": "cron_1", "name": kwargs["name"], "profile": kwargs["profile"]}

    cron_module = types.ModuleType("cron")
    cron_jobs_module = types.ModuleType("cron.jobs")
    cron_jobs_module.create_job = fake_create_job
    monkeypatch.setattr(webapi_gateway, "_temporary_hermes_home", NoopHome)
    monkeypatch.setitem(sys.modules, "cron", cron_module)
    monkeypatch.setitem(sys.modules, "cron.jobs", cron_jobs_module)

    job = webapi_gateway._create_workspace_cron_job(
        Ctx(),
        {
            "name": "meeting-rsvp-monitor:m_1",
            "schedule": "every 2m",
            "prompt": "Run monitor",
            "profile": "meeting-coordinator",
            "skills": ["feishu_meeting_coordinator"],
            "deliver": "local",
            "repeat": 0,
        },
    )

    assert job["profile"] == "meeting-coordinator"
    assert captured["profile"] == "meeting-coordinator"


def test_meeting_coordinator_delivery_client_uses_send_message_tool(monkeypatch):
    from agents import webapi_gateway

    sent = []

    class Ctx:
        hermes_home = "/tmp/hermes"

    class NoopHome:
        def __init__(self, _path):
            pass

        def __enter__(self):
            return None

        def __exit__(self, exc_type, exc, tb):
            return False

    def fake_send_message_tool(args):
        sent.append(args)
        return '{"ok": true, "message_id": "msg_1"}'

    tools_module = types.ModuleType("tools")
    send_message_module = types.ModuleType("tools.send_message_tool")
    send_message_module.send_message_tool = fake_send_message_tool
    monkeypatch.setattr(webapi_gateway, "_temporary_hermes_home", NoopHome)
    monkeypatch.setitem(sys.modules, "tools", tools_module)
    monkeypatch.setitem(sys.modules, "tools.send_message_tool", send_message_module)

    client = webapi_gateway.MeetingCoordinatorWebApiDeliveryClient(Ctx())
    result = client.send_creator_escalation(
        {
            "delivery_binding_json": '{"platform": "feishu", "chat_id": "oc_creator", "thread_id": null}',
            "payload_json": '{"message": "Please contact Amy"}',
        }
    )

    assert result["message_id"] == "msg_1"
    assert sent == [
        {
            "action": "send",
            "target": "feishu:oc_creator",
            "message": "Please contact Amy",
        }
    ]
```

Use the repository's existing authenticated gateway test fixture if one exists. If the fixture name differs from `authenticated_client`, adapt only the fixture name, not the assertions.

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
pytest -q tests/test_meeting_coordinator_webapi.py
```

Expected: FAIL because routes do not exist.

- [ ] **Step 3: Add route stubs**

Modify `src/agents/webapi_gateway.py` near existing `/system/skills` routes:

```python
# First extend the existing _create_workspace_cron_job helper so meeting
# coordinator jobs keep their worker profile.
def _create_workspace_cron_job(ctx: RequestContext, body: dict[str, Any]) -> dict[str, Any]:
    with _temporary_hermes_home(str(ctx.hermes_home)):
        from cron.jobs import create_job as create_cron_job

        job = create_cron_job(
            prompt=body.get("prompt"),
            schedule=str(body.get("schedule") or "* * * * *"),
            name=body.get("name"),
            repeat=body.get("repeat") if isinstance(body.get("repeat"), int) else None,
            deliver=_normalize_job_deliver_for_cron(body.get("deliver")),
            skills=body.get("skills") if isinstance(body.get("skills"), list) else None,
            script=body.get("script") if isinstance(body.get("script"), str) else None,
            profile=body.get("profile") if isinstance(body.get("profile"), str) else None,
            no_agent=bool(body.get("no_agent", False)),
        )
    return _cron_job_for_api(job)


class MeetingCoordinatorWebApiCronClient:
    def __init__(self, ctx: RequestContext):
        self.ctx = ctx

    def ensure_job(self, *, name: str, schedule: str, profile: str, prompt: str, skills: list[str], deliver: str, repeat: int) -> str:
        for job in _list_workspace_cron_jobs(self.ctx, include_disabled=True):
            if str(job.get("name") or "") == name:
                job_id = str(job.get("id") or "")
                if job.get("enabled") is False:
                    _update_workspace_cron_job(self.ctx, job_id, {"enabled": True})
                return job_id
        job = _create_workspace_cron_job(
            self.ctx,
            {
                "name": name,
                "schedule": schedule,
                "profile": profile,
                "prompt": prompt,
                "skills": skills,
                "deliver": deliver,
                "repeat": repeat,
            },
        )
        return str(job["id"])

    def job_exists(self, cron_job_id: str) -> bool:
        return _get_workspace_cron_job(self.ctx, cron_job_id) is not None

    def disable_job(self, cron_job_id: str) -> None:
        _update_workspace_cron_job(self.ctx, cron_job_id, {"enabled": False})


class MeetingCoordinatorWebApiDeliveryClient:
    def __init__(self, ctx: RequestContext):
        self.ctx = ctx

    def send_creator_escalation(self, task: dict[str, Any]) -> dict[str, Any]:
        import json

        delivery_binding = json.loads(str(task.get("delivery_binding_json") or "{}"))
        payload = json.loads(str(task.get("payload_json") or "{}"))
        platform = str(delivery_binding.get("platform") or "feishu").strip()
        chat_id = str(delivery_binding.get("chat_id") or "").strip()
        thread_id = str(delivery_binding.get("thread_id") or "").strip()
        message = str(payload.get("message") or payload.get("reason") or "Meeting RSVP escalation").strip()
        if not chat_id:
            raise RuntimeError("creator delivery binding missing chat_id")
        target = f"{platform}:{chat_id}:{thread_id}" if thread_id else f"{platform}:{chat_id}"
        with _temporary_hermes_home(str(self.ctx.hermes_home)):
            from tools.send_message_tool import send_message_tool

            raw = send_message_tool(
                {
                    "action": "send",
                    "target": target,
                    "message": message,
                }
            )
        result = json.loads(str(raw or "{}"))
        if result.get("error"):
            raise RuntimeError(str(result["error"]))
        return result


def meeting_coordinator_delivery_client_from_context(ctx: RequestContext) -> MeetingCoordinatorWebApiDeliveryClient:
    return MeetingCoordinatorWebApiDeliveryClient(ctx)


@router.get("/system/meeting-coordinator/monitors")
async def system_meeting_coordinator_monitors(request: Request):
    ctx = request_context_from_request(request)
    if not ctx.authenticated:
        raise HTTPException(status_code=401, detail="authentication required")
    store = meeting_coordinator_store.MeetingCoordinatorStore()
    meeting_coordinator_gateway.repair_delivery_retry_scheduler(
        workspace_id=ctx.workspace_id,
        store=store,
        cron=MeetingCoordinatorWebApiCronClient(ctx),
    )
    return {
        "ok": True,
        "monitors": store.list_operation_monitors(workspace_id=ctx.workspace_id, limit=100),
        "deliveryTasks": store.list_operation_delivery_tasks(workspace_id=ctx.workspace_id, limit=100),
        "scheduler": store.get_workspace_state(ctx.workspace_id),
    }


@router.post("/system/meeting-coordinator/delivery-tasks/retry")
async def system_meeting_coordinator_delivery_retry(request: Request):
    ctx = request_context_from_request(request)
    if not ctx.authenticated:
        raise HTTPException(status_code=401, detail="authentication required")
    result = meeting_coordinator_gateway.escalation_retry_tick(
        {"workspace_id": ctx.workspace_id},
        store=meeting_coordinator_store.MeetingCoordinatorStore(),
        delivery_client=meeting_coordinator_delivery_client_from_context(ctx),
    )
    return {"ok": True, **result}


@router.post("/system/meeting-coordinator/delivery-tasks/{delivery_task_id}/requeue")
async def system_meeting_coordinator_delivery_task_requeue(delivery_task_id: str, request: Request):
    ctx = request_context_from_request(request)
    if not ctx.authenticated:
        raise HTTPException(status_code=401, detail="authentication required")
    body = await request.json()
    reason = str(body.get("reason") or "").strip()
    if not reason:
        raise HTTPException(status_code=400, detail="reason is required")
    task = meeting_coordinator_gateway.requeue_delivery_task(
        delivery_task_id=delivery_task_id,
        reason=reason,
        store=meeting_coordinator_store.MeetingCoordinatorStore(),
        cron=MeetingCoordinatorWebApiCronClient(ctx),
    )
    return {"ok": True, "delivery_task": task}
```

- [ ] **Step 4: Add route policy entries**

Modify `src/agents/route_policy.py` so these routes are treated as authenticated workspace/system operations. Add exact entries matching the file's existing `ROUTE_POLICY_MAP` style:

```python
("GET", "/system/meeting-coordinator/monitors"): RouteAuthorizationClass.AUTHENTICATED,
("POST", "/system/meeting-coordinator/delivery-tasks/retry"): RouteAuthorizationClass.AUTHENTICATED,
("POST", "/system/meeting-coordinator/delivery-tasks/{delivery_task_id}/requeue"): RouteAuthorizationClass.AUTHENTICATED,
```

- [ ] **Step 5: Run API tests**

Run:

```bash
pytest -q tests/test_meeting_coordinator_webapi.py
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/agents/webapi_gateway.py src/agents/route_policy.py tests/test_meeting_coordinator_webapi.py
git commit -m "feat: expose meeting coordinator web api routes"
```

## Task 6: Operations Web UI Panel

**Files:**
- Create: `hermes-workspace/src/routes/api/meeting-coordinator.ts`
- Create: `hermes-workspace/src/lib/meeting-coordinator-api.ts`
- Create: `hermes-workspace/src/screens/agents/components/meeting-coordinator-panel.tsx`
- Modify: `hermes-workspace/src/screens/agents/operations-screen.tsx`
- Test: `hermes-workspace/src/screens/agents/components/meeting-coordinator-panel.test.tsx`

- [ ] **Step 1: Write failing UI test**

Create `hermes-workspace/src/screens/agents/components/meeting-coordinator-panel.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MeetingCoordinatorPanel } from './meeting-coordinator-panel'
import { describe, expect, it, vi } from 'vitest'

describe('MeetingCoordinatorPanel', () => {
  it('shows active monitors and non-terminal delivery tasks', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          scheduler: {
            delivery_retry_scheduler_status: 'unavailable',
            delivery_retry_scheduler_detail: 'cron service unavailable',
          },
          monitors: [
            {
              monitor_id: 'm_1',
              meeting_title: 'Planning',
              status: 'complete',
              pending_delivery_tasks: 1,
            },
          ],
          deliveryTasks: [
            {
              delivery_task_id: 'dt_1',
              status: 'failed_retryable',
              task_type: 'creator_escalation',
            },
          ],
        }),
      })),
    )
    const client = new QueryClient()

    render(
      <QueryClientProvider client={client}>
        <MeetingCoordinatorPanel />
      </QueryClientProvider>,
    )

    expect(await screen.findByText('Meeting Coordinator')).toBeInTheDocument()
    expect(await screen.findByText('Planning')).toBeInTheDocument()
    expect(await screen.findByText('failed_retryable')).toBeInTheDocument()
    expect(await screen.findByText('cron service unavailable')).toBeInTheDocument()
  })

  it('runs delivery retry and requeues failed delivery tasks', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => ({
      ok: true,
      json: async () =>
        init?.method === 'POST'
          ? { ok: true }
          : {
              monitors: [],
              scheduler: { delivery_retry_scheduler_status: 'ok' },
              deliveryTasks: [
                {
                  delivery_task_id: 'dt_1',
                  status: 'failed_permanent',
                  task_type: 'creator_escalation',
                },
              ],
            },
    }))
    vi.stubGlobal('fetch', fetchMock)
    const client = new QueryClient()

    render(
      <QueryClientProvider client={client}>
        <MeetingCoordinatorPanel />
      </QueryClientProvider>,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Run delivery retry now' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Requeue delivery task dt_1' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/meeting-coordinator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run_delivery_retry' }),
      })
      expect(fetchMock).toHaveBeenCalledWith('/api/meeting-coordinator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'requeue_delivery_task',
          delivery_task_id: 'dt_1',
          reason: 'operator requested requeue',
        }),
      })
    })
  })
})
```

- [ ] **Step 2: Run UI test to verify failure**

Run:

```bash
cd hermes-workspace
pnpm exec vitest run src/screens/agents/components/meeting-coordinator-panel.test.tsx
```

Expected: FAIL because component does not exist.

- [ ] **Step 3: Add TanStack Start API proxy**

Create `hermes-workspace/src/routes/api/meeting-coordinator.ts` using the existing route-proxy pattern from `src/routes/api/hermes-jobs.ts`:

```ts
import { createFileRoute } from '@tanstack/react-router'
import {
  BEARER_TOKEN,
  HERMES_API,
  dashboardFetch,
  ensureGatewayProbed,
} from '../../server/gateway-capabilities'

function authHeaders(): Record<string, string> {
  return BEARER_TOKEN ? { Authorization: `Bearer ${BEARER_TOKEN}` } : {}
}

export const Route = createFileRoute('/api/meeting-coordinator')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const capabilities = ensureGatewayProbed()
        const url = '/system/meeting-coordinator/monitors'
        const res = capabilities.dashboard.available
          ? await dashboardFetch(url, {}, { requestHeaders: request.headers })
          : await fetch(`${HERMES_API}${url}`, { headers: authHeaders() })
        return new Response(res.body, {
          status: res.status,
          headers: { 'Content-Type': 'application/json' },
        })
      },
      POST: async ({ request }) => {
        const capabilities = ensureGatewayProbed()
        const payload = await request.json()
        const action = typeof payload.action === 'string' ? payload.action : ''
        const deliveryTaskId =
          typeof payload.delivery_task_id === 'string' ? payload.delivery_task_id : ''
        const url =
          action === 'requeue_delivery_task'
            ? `/system/meeting-coordinator/delivery-tasks/${encodeURIComponent(deliveryTaskId)}/requeue`
            : '/system/meeting-coordinator/delivery-tasks/retry'
        const body =
          action === 'requeue_delivery_task'
            ? JSON.stringify({
                reason:
                  typeof payload.reason === 'string'
                    ? payload.reason
                    : 'operator requested requeue',
              })
            : JSON.stringify({ reason: 'operator requested retry tick' })
        const res = capabilities.dashboard.available
          ? await dashboardFetch(
              url,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body,
              },
              { requestHeaders: request.headers },
            )
          : await fetch(`${HERMES_API}${url}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...authHeaders() },
              body,
            })
        return new Response(await res.text(), {
          status: res.status,
          headers: { 'Content-Type': 'application/json' },
        })
      },
    },
  },
})
```

- [ ] **Step 4: Add API client**

Create `hermes-workspace/src/lib/meeting-coordinator-api.ts`:

```ts
export type MeetingCoordinatorMonitor = {
  monitor_id: string
  meeting_title?: string
  status: string
  pending_delivery_tasks?: number
}

export type MeetingCoordinatorDeliveryTask = {
  delivery_task_id: string
  status: string
  task_type: string
}

export type MeetingCoordinatorSchedulerState = {
  delivery_retry_scheduler_status: string
  delivery_retry_scheduler_detail?: string | null
  updated_at?: string | null
}

export async function fetchMeetingCoordinatorState(): Promise<{
  monitors: Array<MeetingCoordinatorMonitor>
  deliveryTasks: Array<MeetingCoordinatorDeliveryTask>
  scheduler: MeetingCoordinatorSchedulerState
}> {
  const response = await fetch('/api/meeting-coordinator')
  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload.error || payload.detail || 'Failed to load meeting coordinator state')
  }
  return {
    monitors: Array.isArray(payload.monitors) ? payload.monitors : [],
    deliveryTasks: Array.isArray(payload.deliveryTasks) ? payload.deliveryTasks : [],
    scheduler:
      payload.scheduler && typeof payload.scheduler === 'object'
        ? payload.scheduler
        : { delivery_retry_scheduler_status: 'unknown' },
  }
}

export async function runDeliveryRetryNow(): Promise<void> {
  const response = await fetch('/api/meeting-coordinator', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'run_delivery_retry' }),
  })
  if (!response.ok) {
    const payload = await response.json()
    throw new Error(payload.error || payload.detail || 'Failed to run delivery retry')
  }
}

export async function requeueDeliveryTask(deliveryTaskId: string): Promise<void> {
  const response = await fetch('/api/meeting-coordinator', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'requeue_delivery_task',
      delivery_task_id: deliveryTaskId,
      reason: 'operator requested requeue',
    }),
  })
  if (!response.ok) {
    const payload = await response.json()
    throw new Error(payload.error || payload.detail || 'Failed to requeue delivery task')
  }
}
```

- [ ] **Step 5: Add panel component**

Create `hermes-workspace/src/screens/agents/components/meeting-coordinator-panel.tsx`:

```tsx
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchMeetingCoordinatorState,
  requeueDeliveryTask,
  runDeliveryRetryNow,
} from '@/lib/meeting-coordinator-api'

export function MeetingCoordinatorPanel() {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ['meeting-coordinator'],
    queryFn: fetchMeetingCoordinatorState,
  })
  const retryMutation = useMutation({
    mutationFn: runDeliveryRetryNow,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['meeting-coordinator'] }),
  })
  const requeueMutation = useMutation({
    mutationFn: requeueDeliveryTask,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['meeting-coordinator'] }),
  })

  const monitors = query.data?.monitors ?? []
  const deliveryTasks = query.data?.deliveryTasks ?? []
  const scheduler = query.data?.scheduler

  return (
    <section className="rounded-md border border-[var(--theme-border)] bg-[var(--theme-card)] p-5 shadow-[0_16px_50px_var(--theme-shadow)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--theme-text)]">
            Meeting Coordinator
          </h2>
          <p className="mt-1 text-sm text-[var(--theme-muted-2)]">
            Active RSVP monitors and pending creator escalation delivery tasks
          </p>
        </div>
        <button
          type="button"
          onClick={() => retryMutation.mutate()}
          className="rounded-md border border-[var(--theme-border)] px-3 py-2 text-sm text-[var(--theme-text)]"
        >
          Run delivery retry now
        </button>
      </div>

      {query.isPending ? (
        <p className="mt-4 text-sm text-[var(--theme-muted)]">Loading meeting monitors...</p>
      ) : query.error ? (
        <p className="mt-4 text-sm text-[var(--theme-danger)]">
          {query.error instanceof Error ? query.error.message : 'Failed to load meeting monitors'}
        </p>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {scheduler?.delivery_retry_scheduler_detail ? (
            <p className="md:col-span-2 rounded-md border border-[var(--theme-danger)] p-3 text-sm text-[var(--theme-danger)]">
              {scheduler.delivery_retry_scheduler_detail}
            </p>
          ) : null}
          <div className="rounded-md border border-[var(--theme-border)] p-3">
            <h3 className="text-sm font-medium text-[var(--theme-text)]">Monitors</h3>
            {monitors.length === 0 ? (
              <p className="mt-2 text-xs text-[var(--theme-muted)]">No meeting monitors</p>
            ) : (
              monitors.map((monitor) => (
                <div key={monitor.monitor_id} className="mt-2 rounded-md bg-[var(--theme-card2)] p-2">
                  <p className="text-sm text-[var(--theme-text)]">
                    {monitor.meeting_title || monitor.monitor_id}
                  </p>
                  <p className="text-xs text-[var(--theme-muted)]">
                    {monitor.status}
                    {monitor.pending_delivery_tasks ? ` · ${monitor.pending_delivery_tasks} delivery task` : ''}
                  </p>
                </div>
              ))
            )}
          </div>
          <div className="rounded-md border border-[var(--theme-border)] p-3">
            <h3 className="text-sm font-medium text-[var(--theme-text)]">Delivery Tasks</h3>
            {deliveryTasks.length === 0 ? (
              <p className="mt-2 text-xs text-[var(--theme-muted)]">No pending delivery tasks</p>
            ) : (
              deliveryTasks.map((task) => (
                <div key={task.delivery_task_id} className="mt-2 rounded-md bg-[var(--theme-card2)] p-2">
                  <p className="text-sm text-[var(--theme-text)]">{task.task_type}</p>
                  <p className="text-xs text-[var(--theme-muted)]">{task.status}</p>
                  {task.status.startsWith('failed_') ? (
                    <button
                      type="button"
                      onClick={() => requeueMutation.mutate(task.delivery_task_id)}
                      className="mt-2 rounded-md border border-[var(--theme-border)] px-2 py-1 text-xs text-[var(--theme-text)]"
                    >
                      Requeue delivery task {task.delivery_task_id}
                    </button>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 6: Render panel in Operations**

Modify `hermes-workspace/src/screens/agents/operations-screen.tsx`:

```tsx
import { MeetingCoordinatorPanel } from './components/meeting-coordinator-panel'
```

Render it near `Recent Activity`:

```tsx
<MeetingCoordinatorPanel />
```

- [ ] **Step 7: Run UI tests and typecheck**

Run:

```bash
cd hermes-workspace
pnpm exec vitest run src/screens/agents/components/meeting-coordinator-panel.test.tsx
pnpm exec tsc --noEmit
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add hermes-workspace/src/routes/api/meeting-coordinator.ts hermes-workspace/src/lib/meeting-coordinator-api.ts hermes-workspace/src/screens/agents/components/meeting-coordinator-panel.tsx hermes-workspace/src/screens/agents/components/meeting-coordinator-panel.test.tsx hermes-workspace/src/screens/agents/operations-screen.tsx
git commit -m "feat: show meeting coordinator operations panel"
```

## Task 7: Bind Plugin Tools to Gateway Methods

**Files:**
- Modify: `semantier-skills/plugins/feishu_meeting_coordinator/tools.py`
- Test: `tests/test_feishu_meeting_coordinator_tools.py`

- [ ] **Step 1: Write failing tool binding tests**

Create `tests/test_feishu_meeting_coordinator_tools.py`:

```python
from __future__ import annotations

import importlib.util
import json
from pathlib import Path


TOOLS_PATH = Path("semantier-skills/plugins/feishu_meeting_coordinator/tools.py").resolve()


def load_tools():
    spec = importlib.util.spec_from_file_location("fc_tools", TOOLS_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


class FakeGateway:
    def __init__(self):
        self.calls = []

    def start_monitor(self, payload):
        self.calls.append(("start_monitor", payload))
        return {"monitor_id": "m_1", "status": "active"}

    def monitor_tick(self, payload):
        self.calls.append(("monitor_tick", payload))
        return {"processed": 1}

    def monitor_stop(self, payload):
        self.calls.append(("monitor_stop", payload))
        return {"stopped": True}

    def escalation_retry_tick(self, payload):
        self.calls.append(("escalation_retry_tick", payload))
        return {"processed": 1}

    def requeue_delivery_task(self, *, delivery_task_id, reason):
        self.calls.append(("requeue_delivery_task", delivery_task_id, reason))
        return {"delivery_task_id": delivery_task_id, "status": "pending"}


def test_monitor_start_calls_gateway_binding():
    tools = load_tools()
    gateway = FakeGateway()

    result = json.loads(
        tools.feishu_meeting_monitor_start(
            {"event_id": "event_1", "event_revision_id": "rev_1"},
            gateway=gateway,
        )
    )

    assert result["ok"] is True
    assert result["monitor"]["status"] == "active"
    assert gateway.calls[0][0] == "start_monitor"


def test_monitor_tick_calls_gateway_binding():
    tools = load_tools()
    gateway = FakeGateway()

    result = json.loads(
        tools.feishu_meeting_monitor_tick({"monitor_id": "m_1"}, gateway=gateway)
    )

    assert result["ok"] is True
    assert result["result"]["processed"] == 1
    assert gateway.calls == [("monitor_tick", {"monitor_id": "m_1"})]


def test_monitor_stop_calls_gateway_binding():
    tools = load_tools()
    gateway = FakeGateway()

    result = json.loads(
        tools.feishu_meeting_monitor_stop({"monitor_id": "m_1"}, gateway=gateway)
    )

    assert result["ok"] is True
    assert result["result"]["stopped"] is True
    assert gateway.calls == [("monitor_stop", {"monitor_id": "m_1"})]


def test_escalation_retry_tick_calls_gateway_binding():
    tools = load_tools()
    gateway = FakeGateway()

    result = json.loads(
        tools.feishu_meeting_escalation_retry_tick(
            {"workspace_id": "ws_1"},
            gateway=gateway,
        )
    )

    assert result["ok"] is True
    assert result["result"]["processed"] == 1
    assert gateway.calls == [("escalation_retry_tick", {"workspace_id": "ws_1"})]


def test_delivery_task_requeue_calls_gateway_binding():
    tools = load_tools()
    gateway = FakeGateway()

    result = json.loads(
        tools.feishu_meeting_delivery_task_requeue(
            {"delivery_task_id": "dt_1", "reason": "operator retry"},
            gateway=gateway,
        )
    )

    assert result["ok"] is True
    assert result["delivery_task"]["status"] == "pending"
    assert gateway.calls == [("requeue_delivery_task", "dt_1", "operator retry")]
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
pytest -q tests/test_feishu_meeting_coordinator_tools.py
```

Expected: FAIL because the stubs do not call the provided gateway binding.

- [ ] **Step 3: Replace stubs with gateway-bound handlers**

Replace `semantier-skills/plugins/feishu_meeting_coordinator/tools.py`:

```python
from __future__ import annotations

import json
from typing import Any


def _ok(key: str, value: Any) -> str:
    return json.dumps({"ok": True, key: value}, ensure_ascii=False, sort_keys=True)


def _error(message: str) -> str:
    return json.dumps({"ok": False, "error": message}, ensure_ascii=False, sort_keys=True)


def _gateway(kwargs: dict[str, Any]):
    gateway = kwargs.get("gateway")
    if gateway is None:
        raise RuntimeError("Semantier gateway binding required")
    return gateway


def feishu_meeting_monitor_start(args, **kwargs):
    try:
        monitor = _gateway(kwargs).start_monitor(dict(args or {}))
    except Exception as exc:
        return _error(str(exc))
    return _ok("monitor", monitor)


def feishu_meeting_monitor_tick(args, **kwargs):
    try:
        result = _gateway(kwargs).monitor_tick(dict(args or {}))
    except Exception as exc:
        return _error(str(exc))
    return _ok("result", result)


def feishu_meeting_monitor_stop(args, **kwargs):
    try:
        result = _gateway(kwargs).monitor_stop(dict(args or {}))
    except Exception as exc:
        return _error(str(exc))
    return _ok("result", result)


def feishu_meeting_escalation_retry_tick(args, **kwargs):
    try:
        result = _gateway(kwargs).escalation_retry_tick(dict(args or {}))
    except Exception as exc:
        return _error(str(exc))
    return _ok("result", result)


def feishu_meeting_delivery_task_requeue(args, **kwargs):
    payload = dict(args or {})
    delivery_task_id = str(payload.get("delivery_task_id") or "").strip()
    reason = str(payload.get("reason") or "operator requested requeue").strip()
    if not delivery_task_id:
        return _error("delivery_task_id is required")
    try:
        task = _gateway(kwargs).requeue_delivery_task(
            delivery_task_id=delivery_task_id,
            reason=reason,
        )
    except Exception as exc:
        return _error(str(exc))
    return _ok("delivery_task", task)
```

- [ ] **Step 4: Run tool tests**

Run:

```bash
pytest -q tests/test_feishu_meeting_coordinator_tools.py tests/test_feishu_meeting_coordinator_plugin.py
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add semantier-skills/plugins/feishu_meeting_coordinator/tools.py tests/test_feishu_meeting_coordinator_tools.py
git commit -m "feat: bind feishu meeting coordinator tools to gateway"
```

## Task 8: Package Migration and Marketplace Index

**Files:**
- Modify: `semantier-skills/marketplace/index.json`
- Delete or deprecate: `semantier-skills/skills/productivity/feishu-bot-meeting-coordinator/SKILL.md`
- Test: `tests/test_feishu_meeting_coordinator_package_inventory.py`

- [ ] **Step 1: Write failing package inventory test**

Create `tests/test_feishu_meeting_coordinator_package_inventory.py`:

```python
from __future__ import annotations

import json
from pathlib import Path


def test_feishu_coordinator_is_single_plugin_package():
    plugin_root = Path("semantier-skills/plugins/feishu_meeting_coordinator")
    skill_only = Path("semantier-skills/skills/productivity/feishu-bot-meeting-coordinator/SKILL.md")

    assert (plugin_root / "plugin.yaml").exists()
    assert (plugin_root / "SKILL.md").exists()
    assert not skill_only.exists()


def test_marketplace_points_to_plugin_package():
    index = json.loads(Path("semantier-skills/marketplace/index.json").read_text(encoding="utf-8"))
    encoded = json.dumps(index)

    assert "plugins/feishu_meeting_coordinator" in encoded
    assert "skills/productivity/feishu-bot-meeting-coordinator" not in encoded
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
pytest -q tests/test_feishu_meeting_coordinator_package_inventory.py
```

Expected: FAIL while the skill-only file still exists or marketplace still points at it.

- [ ] **Step 3: Move old skill content into bundled plugin skill**

Copy any still-relevant instructions from `semantier-skills/skills/productivity/feishu-bot-meeting-coordinator/SKILL.md` into `semantier-skills/plugins/feishu_meeting_coordinator/SKILL.md`, keeping the new rule that meeting creation/update calls `feishu_meeting_monitor_start`.

- [ ] **Step 4: Remove skill-only file**

Run:

```bash
git rm semantier-skills/skills/productivity/feishu-bot-meeting-coordinator/SKILL.md
```

- [ ] **Step 5: Update marketplace index**

Edit `semantier-skills/marketplace/index.json` so the Feishu coordinator entry points to:

```json
{
  "name": "feishu_meeting_coordinator",
  "type": "plugin",
  "path": "plugins/feishu_meeting_coordinator",
  "description": "Feishu meeting RSVP monitoring and follow-up orchestration"
}
```

- [ ] **Step 6: Run package tests**

Run:

```bash
pytest -q tests/test_feishu_meeting_coordinator_package_inventory.py
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add semantier-skills/marketplace/index.json semantier-skills/plugins/feishu_meeting_coordinator tests/test_feishu_meeting_coordinator_package_inventory.py
git commit -m "chore: package feishu coordinator as single plugin"
```

## Task 9: Full Verification

**Files:**
- All files above.

- [ ] **Step 1: Run Python focused tests**

Run:

```bash
pytest -q \
  tests/test_meeting_coordinator_store.py \
  tests/test_meeting_coordinator_gateway.py \
  tests/test_feishu_meeting_coordinator_plugin.py \
  tests/test_feishu_meeting_coordinator_tools.py \
  tests/test_feishu_meeting_coordinator_messages.py \
  tests/test_meeting_coordinator_webapi.py \
  tests/test_feishu_meeting_coordinator_package_inventory.py
```

Expected: PASS.

- [ ] **Step 2: Run frontend focused tests**

Run:

```bash
cd hermes-workspace
pnpm exec vitest run src/screens/agents/components/meeting-coordinator-panel.test.tsx
pnpm exec tsc --noEmit
```

Expected: PASS.

- [ ] **Step 3: Run smoke import checks**

Run:

```bash
python -m py_compile \
  src/agents/meeting_coordinator_store.py \
  src/agents/meeting_coordinator_gateway.py \
  semantier-skills/plugins/feishu_meeting_coordinator/__init__.py \
  semantier-skills/plugins/feishu_meeting_coordinator/tools.py \
  semantier-skills/plugins/feishu_meeting_coordinator/messages.py \
  semantier-skills/plugins/feishu_meeting_coordinator/cli.py
```

Expected: no output and exit code 0.

- [ ] **Step 4: Run broader regression tests if time permits**

Run:

```bash
pytest -q tests/test_runtime_inventory_skill_hashes.py tests/test_feishu_bot_meeting_coordinator_helper.py
```

Expected: PASS.

- [ ] **Step 5: Commit final verification fixes**

If any verification-only fixes were needed:

```bash
git add <fixed-files>
git commit -m "test: verify feishu meeting coordinator plugin"
```

## Self-Review Checklist

- [ ] The single installable package lives under `semantier-skills/plugins/feishu_meeting_coordinator/`.
- [ ] The bundled `SKILL.md` is the only Feishu meeting coordinator skill install surface.
- [ ] Plugin registration tests import `feishu_meeting_coordinator` as a package so relative imports are exercised correctly.
- [ ] SQLite state uses ASCII identifiers and timezone-aware UTC strings.
- [ ] SQLite state includes `meeting_rsvp_followups`, `meeting_rsvp_escalations`, and workspace scheduler state.
- [ ] RSVP monitor lifecycle and creator escalation delivery lifecycle are separate.
- [ ] RSVP cron creation failure leaves the monitor in `pending_start` with `last_start_error`.
- [ ] Missing RSVP cron and missing delivery retry cron both heal deterministically; delivery retry repair checks all non-terminal delivery tasks and runs from at least one periodic or operator read-side entrypoint.
- [ ] Requeue preserves `attempt_count` and makes the task immediately due.
- [ ] Delivery retry tick marks successful tasks terminal and marks failed attempts retryable/permanent so tasks are not resent indefinitely.
- [ ] Requeue is exposed through plugin tool, Web API route, route policy, and Operations UI action.
- [ ] Web API retry and requeue routes call gateway methods and are not constant no-op responses.
- [ ] Plugin tools are bound to gateway methods and do not finish as permanent "binding required" stubs.
- [ ] Tool-binding tests cover monitor start, monitor tick, monitor stop, escalation retry tick, and delivery task requeue.
- [ ] Delivery retry scheduler unavailable state is persisted and visible in the Operations payload.
- [ ] Monitors API returns persisted workspace scheduler state instead of hardcoded scheduler status.
- [ ] Monitors API returns store-backed monitor and delivery-task rows for Operations visibility.
- [ ] Web API uses a concrete `MeetingCoordinatorWebApiCronClient`; no undefined cron-client helper remains.
- [ ] Workspace cron creation preserves the `profile` field for meeting coordinator worker jobs.
- [ ] Gateway task code defines the monitor tick, monitor stop, and escalation retry methods called by plugin tools.
- [ ] Recurring worker profiles do not need cron-management tools.
- [ ] Prompt prose is stored under `src/prompts/meeting_coordinator/`.
- [ ] Operations UI shows completed monitors that still have non-terminal delivery tasks.
