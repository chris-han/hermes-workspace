# Deterministic Temporal Normalizer Adoption Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Adopt one deterministic temporal normalization library across Semantier-owned tool and prompt-context boundaries so user-facing calendar, meeting, schedule, and analytics relative-period times are resolved from inbound event time/timezone instead of LLM memory or stale session context.

**Architecture:** Keep `src/agents/temporal_resolution.py` as the shared Semantier temporal boundary library. Tool-facing code calls this library before invoking Feishu Calendar, meeting negotiation, RSVP follow-up scheduling, or cron one-shot scheduling. Semantier governed-context prompt assembly calls the same library before emitting analytics period guidance. Internal monotonic timers, epoch TTLs, and already-UTC persistence helpers remain out of scope unless they parse user/tool-supplied or prompt-facing relative time.

**Tech Stack:** Python 3.12, `datetime`, `zoneinfo`, Hermes gateway contextvars, Feishu meeting coordinator plugin, Hermes cron tools, pytest

---

## Scan Summary

The scan found five high-risk adoption targets:

- `semantier-skills/plugins/feishu_meeting_coordinator/tools.py`
  - `feishu_meeting_create` already calls `normalize_calendar_window`.
  - Other tool wrappers still pass `candidate_slots`, `accepted_slots`, `start_time`, and `end_time` through to the helper unchanged.

- `semantier-skills/plugins/feishu_meeting_coordinator/scripts/feishu_bot_api.py`
  - `_parse_time()` parses ISO or `%Y-%m-%d %H:%M` directly.
  - `start_negotiation()`, `submit_attendee_response()`, `propose_new_time()`, `update_meeting_time()`, and `create_meeting()` use `_parse_time()`.
  - `finalize_negotiation_and_create_meeting()` uses `datetime.fromisoformat(state.agreed_slot)` directly.

- `hermes-agent/tools/cronjob_tools.py` and `hermes-agent/cron/jobs.py`
  - Structured `schedule_mode="once_at"` accepts `run_at` and eventually `parse_schedule()` parses the timestamp.
  - `parse_schedule()` currently treats naive timestamps as local process time via `dt.astimezone()`.
  - Cron intervals and cron expressions are deterministic and should not be replaced.

- `src/agents/meeting_coordinator_gateway.py`
  - `_parse_utc()` parses persisted UTC timestamps for RSVP follow-up due checks.
  - This is lower risk because persisted store timestamps are already UTC, but it should use the shared UTC parser for consistency.

- `src/agents/governed_context.py`
  - `_relative_period_guidance()` resolves `本月`, `上月`, `去年同期`, `最近12个月`, and similar analytics periods deterministically today.
  - It still anchors to `datetime.now(timezone.utc).date()` instead of the inbound message timestamp.
  - It emits the resolved periods as prompt guidance only. This is acceptable as a transition, but the period math should live in `temporal_resolution.py` and be anchored to `HERMES_SESSION_MESSAGE_CREATED_AT`.

Out of scope for this adoption pass:

- `time.time()` TTLs, rate limits, process uptime, retry age, and stopwatch metrics.
- Internal UTC write helpers such as `auth_db._now_iso()`, `cron_store._now_iso()`, and `meeting_coordinator_store._now_iso()`.
- Historical compatibility parsers that read legacy persisted timestamps but do not resolve user-facing dates.
- The new session reset policy plan. Do not implement intent-shift reset in this pass.

## Target Contract

All Semantier-owned user/tool boundary time normalization must follow these rules:

- If inbound platform event time exists, use `HERMES_SESSION_MESSAGE_CREATED_AT` as the anchor.
- If the platform event time is missing, use `HERMES_SESSION_TURN_TIMESTAMP`.
- If no platform anchor exists, keep current helper/test compatibility only where the call path is not a live gateway tool call.
- Persisted and cross-boundary normalized timestamps must be timezone-aware ISO-8601.
- Calendar windows are normalized in the requested IANA timezone, defaulting to `Asia/Shanghai` for Feishu meeting tools.
- Past meeting/calendar starts are rejected unless `allow_past=true`.
- One-shot cron `run_at` values are normalized deterministically; naive `run_at` is interpreted in the configured/request timezone, not in process-local timezone.
- Analytics relative-period terms are resolved deterministically before prompt assembly, anchored to inbound event time when available.
- Free-text natural language remains outside the tool boundary. The normalizer accepts structured temporal fields, simple relative date tokens, and clock strings; it does not ask an LLM to infer dates.

---

## File Structure

**Modify**

- `src/agents/temporal_resolution.py`  
  Extend the current calendar-window normalizer into a small shared temporal boundary library.

- `tests/test_temporal_resolution.py`  
  Add coverage for clock-only inputs, relative date tokens, UTC parsing, candidate slots, and one-shot schedule normalization.

- `semantier-skills/plugins/feishu_meeting_coordinator/tools.py`  
  Normalize all tool-facing meeting and negotiation temporal payloads before passing them to the bundled helper.

- `semantier-skills/plugins/feishu_meeting_coordinator/scripts/feishu_bot_api.py`  
  Replace local `_parse_time()` behavior with the shared normalizer, and normalize agreed slots before final meeting creation.

- `tests/test_feishu_meeting_coordinator_tools.py`  
  Add wrapper-level regressions for candidate slots, accepted slots, final invitations, time update, and stale past rejection.

- `tests/test_feishu_bot_meeting_coordinator_helper.py`  
  Add helper-level regressions for create/update/propose/negotiation paths.

- `hermes-agent/tools/cronjob_tools.py`  
  Normalize structured `once_at` `run_at` at the tool boundary.

- `hermes-agent/cron/jobs.py`  
  Use the shared normalizer for timestamp schedules while preserving interval and cron-expression semantics.

- `hermes-agent/tests/tools/test_cronjob_tools.py`  
  Add tool-level tests for `once_at` anchor/timezone behavior.

- `hermes-agent/tests/cron/test_jobs.py`  
  Add scheduler-level tests for naive timestamp handling and UTC output.

- `src/agents/meeting_coordinator_gateway.py`  
  Use `parse_aware_utc()` for persisted follow-up timestamps.

- `tests/test_meeting_coordinator_gateway.py`  
  Add a malformed/non-UTC follow-up timestamp regression.

- `src/agents/governed_context.py`  
  Replace local relative-period date math with structured results from `agents.temporal_resolution`.

- `src/prompts/agents/governed_context.json`  
  Label relative-period guidance with the resolver timezone instead of a hard-coded UTC suffix.

- `tests/test_governed_context.py`  
  Add inbound-event-anchor regressions for analytics relative-period prompt guidance.

**Create**

- No new modules. Keep the common library at `src/agents/temporal_resolution.py`.

---

### Task 1: Expand The Shared Temporal Normalizer

**Files:**
- Modify: `src/agents/temporal_resolution.py`
- Test: `tests/test_temporal_resolution.py`

- [x] **Step 1: Add failing tests for clock-only and relative-date calendar inputs**

Append to `tests/test_temporal_resolution.py`:

```python
from agents.temporal_resolution import (
    normalize_calendar_instant,
    normalize_calendar_slots,
    normalize_once_run_at,
    parse_aware_utc,
)


def test_normalize_calendar_instant_resolves_clock_only_on_anchor_date():
    instant = normalize_calendar_instant(
        value="10:00am",
        timezone_name="Asia/Shanghai",
        anchor_utc=datetime(2026, 6, 19, 0, 42, tzinfo=timezone.utc),
    )

    assert instant == "2026-06-19T10:00:00+08:00"


def test_normalize_calendar_instant_resolves_relative_date_token():
    instant = normalize_calendar_instant(
        value="明天 10:00",
        timezone_name="Asia/Shanghai",
        anchor_utc=datetime(2026, 6, 19, 0, 42, tzinfo=timezone.utc),
    )

    assert instant == "2026-06-20T10:00:00+08:00"


def test_normalize_calendar_instant_rejects_yesterday_without_allow_past():
    with pytest.raises(ValueError, match="before the current turn time"):
        normalize_calendar_instant(
            value="昨天 10:00",
            timezone_name="Asia/Shanghai",
            anchor_utc=datetime(2026, 6, 19, 0, 42, tzinfo=timezone.utc),
        )


def test_normalize_calendar_slots_preserves_order_and_dedupes():
    slots = normalize_calendar_slots(
        ["10:00", "2026-06-19 10:00", "明天 11:00"],
        timezone_name="Asia/Shanghai",
        anchor_utc=datetime(2026, 6, 19, 0, 42, tzinfo=timezone.utc),
    )

    assert slots == [
        "2026-06-19T10:00:00+08:00",
        "2026-06-20T11:00:00+08:00",
    ]


def test_parse_aware_utc_rejects_naive_for_persisted_boundaries():
    assert parse_aware_utc("2026-06-19T00:42:37") is None


def test_normalize_once_run_at_interprets_naive_in_requested_timezone():
    run_at = normalize_once_run_at(
        "2026-06-19 10:00",
        timezone_name="Asia/Shanghai",
        anchor_utc=datetime(2026, 6, 19, 0, 42, tzinfo=timezone.utc),
    )

    assert run_at == "2026-06-19T10:00:00+08:00"


def test_resolve_relative_period_context_uses_anchor_local_date():
    from agents.temporal_resolution import resolve_relative_period_context

    context = resolve_relative_period_context(
        anchor_utc=datetime(2026, 6, 18, 16, 30, tzinfo=timezone.utc),
        timezone_name="Asia/Shanghai",
    )

    assert context.as_of_date == "2026-06-19"
    assert context.timezone_name == "Asia/Shanghai"
    assert context.current_month == "2026-06"
    assert context.previous_month == "2026-05"
    assert context.current_quarter_start == "2026-04"
    assert context.previous_quarter_start == "2026-01"
    assert context.ltm_start == "2025-06"
```

- [x] **Step 2: Run the tests and verify they fail**

Run:

```bash
pytest -q tests/test_temporal_resolution.py
```

Expected: FAIL with import errors for `normalize_calendar_instant`, `normalize_calendar_slots`, `normalize_once_run_at`, and `resolve_relative_period_context`.

- [x] **Step 3: Implement deterministic instant parsing**

In `src/agents/temporal_resolution.py`, add imports:

```python
import re
from dataclasses import dataclass
from datetime import date, time, timedelta
```

Add these helpers below `current_turn_anchor_utc()`:

```python
_RELATIVE_DATE_OFFSETS = {
    "today": 0,
    "tonight": 0,
    "今天": 0,
    "今日": 0,
    "tomorrow": 1,
    "tmr": 1,
    "明天": 1,
    "明日": 1,
    "yesterday": -1,
    "昨天": -1,
    "昨日": -1,
}


def _anchor_for_resolution(anchor_utc: datetime | None) -> datetime | None:
    return anchor_utc.astimezone(timezone.utc) if anchor_utc is not None else current_turn_anchor_utc()


def _parse_clock(text: str) -> time | None:
    normalized = text.strip().lower().replace("上午", "am").replace("下午", "pm")
    match = re.fullmatch(r"(\d{1,2})(?::(\d{2}))?\s*(am|pm)?", normalized)
    if not match:
        return None
    hour = int(match.group(1))
    minute = int(match.group(2) or "0")
    suffix = match.group(3)
    if minute > 59:
        return None
    if suffix == "pm" and hour < 12:
        hour += 12
    elif suffix == "am" and hour == 12:
        hour = 0
    if hour > 23:
        return None
    return time(hour=hour, minute=minute)


def _split_relative_datetime(value: str) -> tuple[int | None, str]:
    text = value.strip()
    for token, offset in _RELATIVE_DATE_OFFSETS.items():
        if text.lower().startswith(token):
            return offset, text[len(token):].strip()
    return None, text
```

Then add:

```python
def normalize_calendar_instant(
    *,
    value: str,
    timezone_name: str,
    anchor_utc: datetime | None = None,
    allow_past: bool = False,
) -> str:
    local_tz = ZoneInfo(timezone_name)
    anchor = _anchor_for_resolution(anchor_utc)
    anchor_local = anchor.astimezone(local_tz) if anchor is not None else None
    text = str(value or "").strip()
    if not text:
        raise ValueError("datetime value is required")

    relative_offset, remainder = _split_relative_datetime(text)
    if relative_offset is not None:
        if anchor_local is None:
            raise ValueError("relative date requires platform turn timestamp")
        clock = _parse_clock(remainder)
        if clock is None:
            raise ValueError(f"Unsupported relative datetime format: {value}")
        target_date = anchor_local.date() + timedelta(days=relative_offset)
        parsed = datetime.combine(target_date, clock, tzinfo=local_tz)
    else:
        clock = _parse_clock(text)
        if clock is not None:
            if anchor_local is None:
                raise ValueError("clock-only datetime requires platform turn timestamp")
            parsed = datetime.combine(anchor_local.date(), clock, tzinfo=local_tz)
        else:
            parsed = parse_local_datetime(text, timezone_name)

    if anchor_local is not None and not allow_past and parsed < anchor_local:
        raise ValueError(
            "datetime value is before the current turn time "
            f"({anchor_local.isoformat()}); resolve relative dates from the "
            "inbound message timestamp or pass allow_past=true for explicit past events"
        )
    return parsed.astimezone(local_tz).isoformat()


def normalize_calendar_slots(
    values: list[str],
    *,
    timezone_name: str,
    anchor_utc: datetime | None = None,
    allow_past: bool = False,
) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()
    for value in values:
        item = normalize_calendar_instant(
            value=value,
            timezone_name=timezone_name,
            anchor_utc=anchor_utc,
            allow_past=allow_past,
        )
        if item not in seen:
            seen.add(item)
            normalized.append(item)
    return normalized


def normalize_once_run_at(
    value: str,
    *,
    timezone_name: str,
    anchor_utc: datetime | None = None,
    allow_past: bool = False,
) -> str:
    return normalize_calendar_instant(
        value=value,
        timezone_name=timezone_name,
        anchor_utc=anchor_utc,
        allow_past=allow_past,
    )
```

Add the analytics period context dataclass and resolver:

```python
@dataclass(frozen=True)
class RelativePeriodContext:
    as_of_date: str
    timezone_name: str
    current_month: str
    previous_month: str
    same_month_last_year: str
    current_quarter_start: str
    current_quarter_number: int
    current_year: int
    previous_quarter_start: str
    previous_quarter_end: str
    previous_quarter_number: int
    previous_quarter_year: int
    same_quarter_last_year_start: str
    same_quarter_last_year_end: str
    current_year_start: str
    previous_year_start: str
    previous_year_end: str
    ltm_start: str


def _quarter(month: int) -> int:
    return ((month - 1) // 3) + 1


def _month_shift(value: date, offset: int) -> date:
    month_index = (value.year * 12 + (value.month - 1)) + offset
    year = month_index // 12
    month = (month_index % 12) + 1
    return date(year, month, 1)


def _quarter_start(value: date) -> date:
    return date(value.year, ((_quarter(value.month) - 1) * 3) + 1, 1)


def resolve_relative_period_context(
    *,
    anchor_utc: datetime | None = None,
    timezone_name: str = "UTC",
) -> RelativePeriodContext:
    local_tz = ZoneInfo(timezone_name)
    anchor = _anchor_for_resolution(anchor_utc) or datetime.now(timezone.utc)
    current = anchor.astimezone(local_tz).date()
    current_month = date(current.year, current.month, 1)
    previous_month = _month_shift(current_month, -1)
    same_month_last_year = _month_shift(current_month, -12)
    current_quarter_start = _quarter_start(current)
    previous_quarter_start = _month_shift(current_quarter_start, -3)
    same_quarter_last_year = _month_shift(current_quarter_start, -12)
    current_year_start = date(current.year, 1, 1)
    previous_year_start = date(current.year - 1, 1, 1)
    return RelativePeriodContext(
        as_of_date=current.isoformat(),
        timezone_name=timezone_name,
        current_month=current_month.strftime("%Y-%m"),
        previous_month=previous_month.strftime("%Y-%m"),
        same_month_last_year=same_month_last_year.strftime("%Y-%m"),
        current_quarter_start=current_quarter_start.strftime("%Y-%m"),
        current_quarter_number=_quarter(current.month),
        current_year=current.year,
        previous_quarter_start=previous_quarter_start.strftime("%Y-%m"),
        previous_quarter_end=_month_shift(previous_quarter_start, 2).strftime("%Y-%m"),
        previous_quarter_number=_quarter(previous_quarter_start.month),
        previous_quarter_year=previous_quarter_start.year,
        same_quarter_last_year_start=same_quarter_last_year.strftime("%Y-%m"),
        same_quarter_last_year_end=_month_shift(same_quarter_last_year, 2).strftime("%Y-%m"),
        current_year_start=current_year_start.strftime("%Y-%m"),
        previous_year_start=previous_year_start.strftime("%Y-%m"),
        previous_year_end=date(current.year - 1, 12, 1).strftime("%Y-%m"),
        ltm_start=same_month_last_year.strftime("%Y-%m"),
    )
```

- [x] **Step 4: Refactor `normalize_calendar_window()` to use `normalize_calendar_instant()`**

Replace the parsing block in `normalize_calendar_window()` with:

```python
    anchor = _anchor_for_resolution(anchor_utc)
    start_dt = parse_local_datetime(
        normalize_calendar_instant(
            value=start_time,
            timezone_name=timezone_name,
            anchor_utc=anchor,
            allow_past=allow_past,
        ),
        timezone_name,
    )
    end_dt = parse_local_datetime(
        normalize_calendar_instant(
            value=end_time,
            timezone_name=timezone_name,
            anchor_utc=anchor,
            allow_past=allow_past,
        ),
        timezone_name,
    )
```

Keep the existing `end_dt <= start_dt` validation and return shape.

- [x] **Step 5: Run temporal tests**

Run:

```bash
pytest -q tests/test_temporal_resolution.py
```

Expected: PASS.

---

### Task 2: Normalize Feishu Tool Wrapper Temporal Payloads

**Files:**
- Modify: `semantier-skills/plugins/feishu_meeting_coordinator/tools.py`
- Test: `tests/test_feishu_meeting_coordinator_tools.py`

- [x] **Step 1: Add failing wrapper tests for negotiation and update payload normalization**

Append to `tests/test_feishu_meeting_coordinator_tools.py`:

```python
def test_negotiation_start_normalizes_candidate_slots_against_turn_anchor(monkeypatch):
    tools = load_tools()
    calls = []
    monkeypatch.setenv("HERMES_SESSION_MESSAGE_CREATED_AT", "2026-06-19T00:42:37Z")

    def start_negotiation(**kwargs):
        calls.append(kwargs)
        return {"negotiation_id": "n_1"}

    monkeypatch.setattr(
        tools,
        "_feishu_helper",
        lambda: SimpleNamespace(start_negotiation=start_negotiation),
    )

    result = json.loads(
        tools.feishu_meeting_negotiation_start(
            {
                "title": "产品研发会",
                "requester_open_id": "ou_requester",
                "attendee_open_ids": ["ou_a"],
                "candidate_slots": ["10:00am", "明天 11:00"],
                "duration_minutes": 60,
                "timezone": "Asia/Shanghai",
            }
        )
    )

    assert result["ok"] is True
    assert calls[0]["candidate_slots"] == [
        "2026-06-19T10:00:00+08:00",
        "2026-06-20T11:00:00+08:00",
    ]


def test_negotiation_start_rejects_stale_candidate_slot(monkeypatch):
    tools = load_tools()
    monkeypatch.setenv("HERMES_SESSION_MESSAGE_CREATED_AT", "2026-06-19T00:42:37Z")

    result = json.loads(
        tools.feishu_meeting_negotiation_start(
            {
                "title": "产品研发会",
                "requester_open_id": "ou_requester",
                "attendee_open_ids": ["ou_a"],
                "candidate_slots": ["昨天 10:00"],
                "duration_minutes": 60,
                "timezone": "Asia/Shanghai",
            }
        )
    )

    assert result["ok"] is False
    assert "before the current turn time" in result["error"]


def test_meeting_update_normalizes_window_against_turn_anchor(monkeypatch):
    tools = load_tools()
    calls = []
    monkeypatch.setenv("HERMES_SESSION_MESSAGE_CREATED_AT", "2026-06-19T00:42:37Z")

    def update_meeting_time(**kwargs):
        calls.append(kwargs)
        return {"event_id": "event-1"}

    monkeypatch.setattr(
        tools,
        "_feishu_helper",
        lambda: SimpleNamespace(update_meeting_time=update_meeting_time),
    )

    result = json.loads(
        tools.feishu_meeting_time_update(
            {
                "event_id": "event-1",
                "calendar_id": "calendar-1",
                "start_time": "10:00",
                "end_time": "10:30",
                "timezone": "Asia/Shanghai",
            }
        )
    )

    assert result["ok"] is True
    assert calls[0]["start_time"] == "2026-06-19T10:00:00+08:00"
    assert calls[0]["end_time"] == "2026-06-19T10:30:00+08:00"


def test_final_invitations_normalizes_display_window(monkeypatch):
    tools = load_tools()
    calls = []
    monkeypatch.setenv("HERMES_SESSION_MESSAGE_CREATED_AT", "2026-06-19T00:42:37Z")

    def send_final_invitations(**kwargs):
        calls.append(kwargs)
        return {"delivered": kwargs["attendee_open_ids"], "failed": []}

    monkeypatch.setattr(
        tools,
        "_feishu_helper",
        lambda: SimpleNamespace(send_final_invitations=send_final_invitations),
    )

    result = json.loads(
        tools.feishu_final_invitations_send(
            {
                "attendee_open_ids": ["ou_a"],
                "title": "产品研发会",
                "start_time": "10:00",
                "end_time": "10:30",
                "timezone": "Asia/Shanghai",
            }
        )
    )

    assert result["ok"] is True
    assert calls[0]["start_time"] == "2026-06-19T10:00:00+08:00"
    assert calls[0]["end_time"] == "2026-06-19T10:30:00+08:00"


def test_new_time_proposal_normalizes_candidate_slots(monkeypatch):
    tools = load_tools()
    calls = []
    monkeypatch.setenv("HERMES_SESSION_MESSAGE_CREATED_AT", "2026-06-19T00:42:37Z")

    def propose_new_time(**kwargs):
        calls.append(kwargs)
        return {"delivered": kwargs["attendee_open_ids"], "failed": []}

    monkeypatch.setattr(
        tools,
        "_feishu_helper",
        lambda: SimpleNamespace(propose_new_time=propose_new_time),
    )

    result = json.loads(
        tools.feishu_meeting_new_time_propose(
            {
                "attendee_open_ids": ["ou_a"],
                "title": "产品研发会",
                "candidate_slots": ["明天 10:00"],
                "timezone": "Asia/Shanghai",
            }
        )
    )

    assert result["ok"] is True
    assert calls[0]["candidate_slots"] == ["2026-06-20T10:00:00+08:00"]
```

- [x] **Step 2: Run the targeted tests and verify they fail**

Run:

```bash
pytest -q \
  tests/test_feishu_meeting_coordinator_tools.py::test_negotiation_start_normalizes_candidate_slots_against_turn_anchor \
  tests/test_feishu_meeting_coordinator_tools.py::test_negotiation_start_rejects_stale_candidate_slot \
  tests/test_feishu_meeting_coordinator_tools.py::test_meeting_update_normalizes_window_against_turn_anchor \
  tests/test_feishu_meeting_coordinator_tools.py::test_final_invitations_normalizes_display_window \
  tests/test_feishu_meeting_coordinator_tools.py::test_new_time_proposal_normalizes_candidate_slots
```

Expected: FAIL because the wrappers pass raw strings through.

- [x] **Step 3: Add local wrapper helpers**

In `semantier-skills/plugins/feishu_meeting_coordinator/tools.py`, add:

```python
def _normalize_temporal_slots(
    values: list[str],
    *,
    timezone_name: str,
    allow_past: bool = False,
) -> list[str]:
    from agents.temporal_resolution import normalize_calendar_slots

    return normalize_calendar_slots(
        values,
        timezone_name=timezone_name,
        allow_past=allow_past,
    )


def _normalize_temporal_window_payload(payload: dict[str, Any]) -> None:
    from agents.temporal_resolution import normalize_calendar_window

    timezone_name = str(payload.get("timezone") or "Asia/Shanghai")
    window = normalize_calendar_window(
        start_time=str(payload.get("start_time") or ""),
        end_time=str(payload.get("end_time") or ""),
        timezone_name=timezone_name,
        allow_past=bool(payload.get("allow_past")),
    )
    payload["start_time"] = window.start_time
    payload["end_time"] = window.end_time
    payload["timezone"] = window.timezone
```

- [x] **Step 4: Use wrapper helpers in Feishu tools**

In `feishu_meeting_create()`, replace the inline `normalize_calendar_window` block with:

```python
    try:
        _normalize_temporal_window_payload(payload)
    except Exception as exc:
        return _error(str(exc))
```

In `feishu_meeting_negotiation_start()`, normalize candidate slots before `_helper_call()`:

```python
    timezone_name = str(payload.get("timezone") or "Asia/Shanghai")
    try:
        candidate_slots = _normalize_temporal_slots(
            [str(item) for item in _list_arg(payload, "candidate_slots", "candidate_slot")],
            timezone_name=timezone_name,
            allow_past=bool(payload.get("allow_past")),
        )
    except Exception as exc:
        return _error(str(exc))
```

Pass `candidate_slots=candidate_slots` instead of recomputing the raw list.

In `feishu_meeting_time_update()`, normalize the payload before `_helper_call()`:

```python
    try:
        _normalize_temporal_window_payload(payload)
    except Exception as exc:
        return _error(str(exc))
```

In `feishu_final_invitations_send()`, normalize the payload before `_helper_call()` and pass the normalized values:

```python
    try:
        _normalize_temporal_window_payload(payload)
    except Exception as exc:
        return _error(str(exc))
```

In `feishu_meeting_new_time_propose()`, normalize candidate slots before `_helper_call()`:

```python
    timezone_name = str(payload.get("timezone") or "Asia/Shanghai")
    try:
        candidate_slots = _normalize_temporal_slots(
            [str(item) for item in _list_arg(payload, "candidate_slots", "candidate_slot")],
            timezone_name=timezone_name,
            allow_past=bool(payload.get("allow_past")),
        )
    except Exception as exc:
        return _error(str(exc))
```

Pass `candidate_slots=candidate_slots`.

In `feishu_meeting_negotiation_submit_response()`, normalize accepted and declined slots using the state timezone before `_helper_call()`:

```python
    state_payload = payload.get("state") or payload.get("state_payload") or {}
    timezone_name = str(state_payload.get("timezone") or payload.get("timezone") or "Asia/Shanghai")
    try:
        accepted_slots = _normalize_temporal_slots(
            [str(item) for item in _list_arg(payload, "accepted_slots", "accepted_slot")],
            timezone_name=timezone_name,
            # Accepted/declined slots are echoes of previously generated
            # negotiation candidates. They must remain valid even if the
            # attendee responds after that candidate time has passed.
            allow_past=True,
        )
        declined_slots = _normalize_temporal_slots(
            [str(item) for item in _list_arg(payload, "declined_slots", "declined_slot")],
            timezone_name=timezone_name,
            allow_past=True,
        )
    except Exception as exc:
        return _error(str(exc))
```

Pass `state_payload`, `accepted_slots=accepted_slots`, and `declined_slots=declined_slots`.

- [x] **Step 5: Run wrapper tests**

Run:

```bash
pytest -q tests/test_feishu_meeting_coordinator_tools.py
```

Expected: PASS after updating existing expectations that currently assert raw slot strings.

---

### Task 3: Normalize Feishu Helper Temporal Parsing

**Files:**
- Modify: `semantier-skills/plugins/feishu_meeting_coordinator/scripts/feishu_bot_api.py`
- Test: `tests/test_feishu_bot_meeting_coordinator_helper.py`

- [x] **Step 1: Add failing helper-level tests**

Add these imports near the top of `tests/test_feishu_bot_meeting_coordinator_helper.py`:

```python
from datetime import datetime
from zoneinfo import ZoneInfo

import pytest
```

Then append to `tests/test_feishu_bot_meeting_coordinator_helper.py`:

```python
def test_helper_start_negotiation_normalizes_clock_only_candidate_slot(monkeypatch):
    helper = _load_helper()
    monkeypatch.setenv("HERMES_SESSION_MESSAGE_CREATED_AT", "2026-06-19T00:42:37Z")

    state = helper.start_negotiation(
        title="Planning",
        requester_open_id="ou_requester",
        attendee_open_ids=["ou_a"],
        candidate_slots=["10:00am"],
        duration_minutes=30,
        timezone="Asia/Shanghai",
    )

    assert state["candidate_slots"] == ["2026-06-19T10:00:00+08:00"]


def test_helper_create_meeting_rejects_stale_start(monkeypatch):
    helper = _load_helper()
    monkeypatch.setenv("HERMES_SESSION_MESSAGE_CREATED_AT", "2026-06-19T00:42:37Z")

    with pytest.raises(helper.FeishuSkillError, match="before the current turn time"):
        helper.create_meeting(
            title="Planning",
            start_time="昨天 10:00",
            end_time="昨天 10:30",
            attendees=["ou_a"],
            timezone="Asia/Shanghai",
            requester_open_id="ou_requester",
        )


def test_helper_update_meeting_time_normalizes_clock_only_window(monkeypatch):
    helper = _load_helper()
    event_api = _FakeCalendarEventApi()
    client = SimpleNamespace(
        calendar=SimpleNamespace(v4=SimpleNamespace(calendar_event=event_api))
    )
    monkeypatch.setattr(helper, "_get_client", lambda: client)
    monkeypatch.setenv("HERMES_SESSION_MESSAGE_CREATED_AT", "2026-06-19T00:42:37Z")

    result = helper.update_meeting_time(
        event_id="event-1",
        calendar_id="calendar-1",
        start_time="10:00",
        end_time="10:30",
        timezone="Asia/Shanghai",
    )

    assert result["start_time"]["timezone"] == "Asia/Shanghai"
    assert result["start_time"]["timestamp"] == str(int(datetime(2026, 6, 19, 10, 0, tzinfo=ZoneInfo("Asia/Shanghai")).timestamp()))


def test_helper_parse_time_preserves_already_normalized_iso(monkeypatch):
    helper = _load_helper()
    monkeypatch.setenv("HERMES_SESSION_MESSAGE_CREATED_AT", "2026-06-19T00:42:37Z")

    parsed = helper._parse_time("2026-06-20T10:00:00+08:00", "Asia/Shanghai")

    assert parsed.isoformat() == "2026-06-20T10:00:00+08:00"
```

- [x] **Step 2: Run the helper tests and verify they fail**

Run:

```bash
pytest -q \
  tests/test_feishu_bot_meeting_coordinator_helper.py::test_helper_start_negotiation_normalizes_clock_only_candidate_slot \
  tests/test_feishu_bot_meeting_coordinator_helper.py::test_helper_create_meeting_rejects_stale_start \
  tests/test_feishu_bot_meeting_coordinator_helper.py::test_helper_update_meeting_time_normalizes_clock_only_window \
  tests/test_feishu_bot_meeting_coordinator_helper.py::test_helper_parse_time_preserves_already_normalized_iso
```

Expected: FAIL because `_parse_time()` does not support clock-only or relative Chinese dates, and the idempotence behavior for already-normalized ISO inputs is not yet pinned.

- [x] **Step 3: Replace helper `_parse_time()` with shared normalizer**

In `semantier-skills/plugins/feishu_meeting_coordinator/scripts/feishu_bot_api.py`, replace `_parse_time()` with:

```python
def _parse_time(value: str, timezone_name: str, *, allow_past: bool = False) -> datetime:
    try:
        from agents.temporal_resolution import normalize_calendar_instant
    except Exception as exc:
        raise FeishuSkillError("Semantier temporal normalizer is unavailable") from exc

    try:
        normalized = normalize_calendar_instant(
            value=value,
            timezone_name=timezone_name,
            allow_past=allow_past,
        )
    except ValueError as exc:
        raise FeishuSkillError(str(exc)) from exc
    return datetime.fromisoformat(normalized)
```

- [x] **Step 4: Normalize agreed slot finalization**

In `finalize_negotiation_and_create_meeting()`, replace:

```python
    start_dt = datetime.fromisoformat(state.agreed_slot)
```

with:

```python
    start_dt = _parse_time(state.agreed_slot, state.timezone)
```

- [x] **Step 5: Preserve explicit past support only for update paths that need it**

Leave `allow_past=False` for `create_meeting()`, `start_negotiation()`, `submit_attendee_response()`, `propose_new_time()`, and `update_meeting_time()` in this pass. If an operator needs to edit historical events later, add a tool schema field `allow_past` and pass it explicitly through the wrapper.

- [x] **Step 6: Run helper tests**

Run:

```bash
pytest -q tests/test_feishu_bot_meeting_coordinator_helper.py tests/test_feishu_meeting_coordinator_tools.py
```

Expected: PASS.

---

### Task 4: Normalize One-Shot Cron `run_at`

**Files:**
- Modify: `hermes-agent/tools/cronjob_tools.py`
- Modify: `hermes-agent/cron/jobs.py`
- Test: `hermes-agent/tests/tools/test_cronjob_tools.py`
- Test: `hermes-agent/tests/cron/test_jobs.py`

- [x] **Step 1: Add failing cron tool tests for structured `once_at`**

Append to `hermes-agent/tests/tools/test_cronjob_tools.py`:

```python
    def test_create_once_at_normalizes_naive_run_at_in_session_timezone(self, monkeypatch):
        from cron.jobs import get_job

        monkeypatch.setenv("HERMES_SESSION_MESSAGE_CREATED_AT", "2026-06-19T00:42:37Z")
        monkeypatch.setenv("HERMES_TIMEZONE", "Asia/Shanghai")

        created = json.loads(
            cronjob(
                action="create",
                prompt="Check once",
                schedule_mode="once_at",
                run_at="2026-06-19 10:00",
                name="once-at",
            )
        )

        assert created["success"] is True
        stored = get_job(created["job_id"])
        assert stored["schedule"]["kind"] == "once"
        assert stored["schedule"]["run_at"].endswith("+08:00")
        assert stored["schedule"]["run_at"].startswith("2026-06-19T10:00:00")

    def test_create_once_at_rejects_stale_run_at(self, monkeypatch):
        monkeypatch.setenv("HERMES_SESSION_MESSAGE_CREATED_AT", "2026-06-19T00:42:37Z")
        monkeypatch.setenv("HERMES_TIMEZONE", "Asia/Shanghai")

        created = json.loads(
            cronjob(
                action="create",
                prompt="Check once",
                schedule_mode="once_at",
                run_at="昨天 10:00",
                name="stale-once-at",
            )
        )

        assert created["success"] is False
        assert "before the current turn time" in created["error"]
```

- [x] **Step 2: Add failing scheduler parser test**

Append to `hermes-agent/tests/cron/test_jobs.py` inside `TestParseSchedule`:

```python
    def test_parse_schedule_uses_temporal_normalizer_for_naive_timestamp(self, monkeypatch):
        monkeypatch.setenv("HERMES_SESSION_MESSAGE_CREATED_AT", "2026-06-19T00:42:37Z")
        monkeypatch.setenv("HERMES_TIMEZONE", "Asia/Shanghai")

        parsed = parse_schedule("2026-06-19 10:00")

        assert parsed["kind"] == "once"
        assert parsed["run_at"] == "2026-06-19T10:00:00+08:00"
```

- [x] **Step 3: Run targeted cron tests and verify they fail**

Run:

```bash
pytest -q \
  hermes-agent/tests/tools/test_cronjob_tools.py::TestUnifiedCronjobTool::test_create_once_at_normalizes_naive_run_at_in_session_timezone \
  hermes-agent/tests/tools/test_cronjob_tools.py::TestUnifiedCronjobTool::test_create_once_at_rejects_stale_run_at \
  hermes-agent/tests/cron/test_jobs.py::TestParseSchedule::test_parse_schedule_uses_temporal_normalizer_for_naive_timestamp
```

Expected: FAIL because cron timestamp parsing still uses process-local timezone and does not understand relative date tokens.

- [x] **Step 4: Normalize `run_at` in cron tool structured parameters**

In `hermes-agent/tools/cronjob_tools.py`, add:

```python
def _default_temporal_timezone() -> str:
    return os.getenv("HERMES_TIMEZONE", "").strip() or "UTC"
```

In `_schedule_from_structured_params()`, replace the `once_at` branch with:

```python
    if mode == "once_at":
        text = str(run_at or "").strip()
        if not text:
            raise ValueError("run_at is required when schedule_mode='once_at'")
        from agents.temporal_resolution import normalize_once_run_at

        return normalize_once_run_at(
            text,
            timezone_name=_default_temporal_timezone(),
            allow_past=False,
        )
```

- [x] **Step 5: Use the normalizer in `cron.jobs.parse_schedule()` timestamp branch**

In `hermes-agent/cron/jobs.py`, replace the ISO timestamp parsing branch with:

```python
    if 'T' in schedule or re.match(r'^\d{4}-\d{2}-\d{2}', schedule):
        try:
            from agents.temporal_resolution import normalize_once_run_at

            tz_name = os.getenv("HERMES_TIMEZONE", "").strip() or "UTC"
            normalized_run_at = normalize_once_run_at(
                schedule,
                timezone_name=tz_name,
                allow_past=True,
            )
            dt = datetime.fromisoformat(normalized_run_at)
            return {
                "kind": "once",
                "run_at": dt.isoformat(),
                "display": f"once at {dt.strftime('%Y-%m-%d %H:%M')}",
            }
        except ValueError as e:
            raise ValueError(f"Invalid timestamp '{schedule}': {e}")
```

Use `allow_past=True` in `parse_schedule()` because the scheduler also reads legacy/persisted schedules. The tool boundary in `_schedule_from_structured_params()` is the place that rejects newly requested stale one-shots.

- [x] **Step 6: Run cron tests**

Run:

```bash
pytest -q hermes-agent/tests/tools/test_cronjob_tools.py hermes-agent/tests/cron/test_jobs.py hermes-agent/tests/test_timezone.py
```

Expected: PASS.

---

### Task 5: Use Shared UTC Parser For RSVP Follow-Up Timing

**Files:**
- Modify: `src/agents/meeting_coordinator_gateway.py`
- Test: `tests/test_meeting_coordinator_gateway.py`

- [x] **Step 1: Add a malformed timestamp regression**

Append to `tests/test_meeting_coordinator_gateway.py`:

```python
def test_followup_due_ignores_malformed_last_followup_timestamp():
    attendee = {"last_followup_at": "not-a-timestamp"}

    assert gateway._followup_due(attendee, interval_minutes=2) is True
```

- [x] **Step 2: Run the test before implementation**

Run:

```bash
pytest -q tests/test_meeting_coordinator_gateway.py::test_followup_due_ignores_malformed_last_followup_timestamp
```

Expected: FAIL if `_parse_utc()` raises; PASS if current behavior already treats it as due. Continue either way so this behavior is pinned.

- [x] **Step 3: Replace local `_parse_utc()` implementation**

In `src/agents/meeting_coordinator_gateway.py`, replace `_parse_utc()` with:

```python
def _parse_utc(value: str | None) -> datetime | None:
    from agents.temporal_resolution import parse_aware_utc

    return parse_aware_utc(value)
```

- [x] **Step 4: Run meeting coordinator gateway tests**

Run:

```bash
pytest -q tests/test_meeting_coordinator_gateway.py
```

Expected: PASS.

---

### Task 6: Move Governed Analytics Relative Periods Into The Normalizer

**Files:**
- Modify: `src/agents/governed_context.py`
- Modify: `src/prompts/agents/governed_context.json`
- Test: `tests/test_governed_context.py`
- Test: `tests/test_temporal_resolution.py`

- [x] **Step 1: Add failing governed-context anchor regression**

Append to `tests/test_governed_context.py`:

```python
def test_relative_period_guidance_uses_inbound_message_timestamp(monkeypatch, tmp_path):
    monkeypatch.setenv("SEMANTIER_LOCAL_STATE_DIR", str(tmp_path / ".semantier-home"))
    monkeypatch.setenv("HERMES_SESSION_MESSAGE_CREATED_AT", "2026-06-18T16:30:00Z")
    monkeypatch.setattr(governed_context_mod, "_utc_today", lambda: date(2026, 5, 21))
    _write_auth(
        tmp_path / ".semantier-home",
        {
            "user-1": {
                "user_id": "user-1",
                "workspace_id": "ws-1",
                "workspace_slug": "alice",
                "default_organization_id": "org_demo_apparel_trade_cn",
                "organization_memberships": [
                    {
                        "organization_id": "org_demo_apparel_trade_cn",
                        "organization_name": "北京宝库电子商务有限公司",
                        "membership_status": "active",
                        "member_role": "owner",
                        "dataset_type": "DEMO",
                    }
                ],
            }
        },
    )

    prompt = build_governed_runtime_context_prompt(
        user_id="user-1",
        workspace_id="ws-1",
        user_message="本月收入和上月成本",
    )

    assert prompt is not None
    assert "As of 2026-06-19 (Asia/Shanghai)" in prompt
    assert "'本月'/'这个月'/MTD means period_id 2026-06" in prompt
    assert "'上月'/'上个月'/last month means period_id 2026-05" in prompt
    assert "period_id 2026-04" not in prompt
```

- [x] **Step 2: Run the governed-context regression and verify it fails**

Run:

```bash
pytest -q tests/test_governed_context.py::test_relative_period_guidance_uses_inbound_message_timestamp
```

Expected: FAIL because `_relative_period_guidance()` still uses `_utc_today()` and ignores `HERMES_SESSION_MESSAGE_CREATED_AT`.

- [x] **Step 3: Replace local period math with `resolve_relative_period_context()`**

In `src/agents/governed_context.py`, add imports:

```python
from datetime import date, datetime, time, timezone
from zoneinfo import ZoneInfo

from agents.temporal_resolution import current_turn_anchor_utc, resolve_relative_period_context
```

Replace `_relative_period_guidance()` with:

```python
def _relative_period_guidance(
    as_of: date | None = None,
    *,
    anchor_utc: datetime | None = None,
    timezone_name: str = "Asia/Shanghai",
) -> str:
    local_tz = ZoneInfo(timezone_name)
    anchor = anchor_utc or current_turn_anchor_utc()
    if as_of is not None:
        local_midnight = datetime.combine(as_of, time.min, tzinfo=local_tz)
        anchor = local_midnight.astimezone(timezone.utc)
    elif anchor is None:
        today = _utc_today()
        local_midnight = datetime.combine(today, time.min, tzinfo=local_tz)
        anchor = local_midnight.astimezone(timezone.utc)
    context = resolve_relative_period_context(
        anchor_utc=anchor,
        timezone_name=timezone_name,
    )
    if not _RELATIVE_PERIOD_GUIDANCE_TEMPLATE:
        return ""
    return _RELATIVE_PERIOD_GUIDANCE_TEMPLATE.format(**context.__dict__)
```

This keeps older tests deterministic while preserving Shanghai-local month and quarter boundaries. Do not switch to UTC solely because `as_of` is passed explicitly; `as_of` is a local calendar date in `timezone_name`. Use `anchor_utc` only when a test or caller needs to pin an exact instant.

Update the prompt asset `src/prompts/agents/governed_context.json` so the relative-period guidance template labels the date with the context timezone instead of hard-coding UTC:

```json
"As of {as_of_date} ({timezone_name}), ..."
```

Then update existing governed-context assertions that expected `"As of ... UTC"` to expect `"As of ... (Asia/Shanghai)"`, unless the test explicitly passes `timezone_name="UTC"`.

Add a template-format dry-run regression so prompt fields and `RelativePeriodContext` fields cannot drift:

```python
def test_relative_period_guidance_template_fields_align_with_context(monkeypatch):
    monkeypatch.delenv("HERMES_SESSION_MESSAGE_CREATED_AT", raising=False)
    monkeypatch.delenv("HERMES_SESSION_TURN_TIMESTAMP", raising=False)

    text = governed_context_mod._relative_period_guidance(as_of=date(2026, 6, 19))

    assert "As of 2026-06-19 (Asia/Shanghai)" in text
    assert "'本月'/'这个月'/MTD means period_id 2026-06" in text
```

Keep `_utc_today()`, `_month_shift()`, `_quarter_start()`, and `_year_start()` temporarily if existing tests or callers still import/monkeypatch them. After the migration, run `rg "_month_shift|_quarter_start|_year_start"` and remove dead helpers only if they are unused.

- [x] **Step 4: Run governed-context and temporal tests**

Run:

```bash
pytest -q tests/test_governed_context.py tests/test_temporal_resolution.py
```

Expected: PASS.

- [x] **Step 5: Add a note to prompt docs**

In `src/prompts/prompt_engineering.md`, update the governed-context section with:

```markdown
Relative analytics periods are resolved by `agents.temporal_resolution` before
prompt assembly. Prompt text may carry the resolved period IDs for user-facing
guidance, but the date math is not delegated to the LLM.
```

---

### Task 7: Add Static Guardrails For New Temporal Boundary Code

**Files:**
- Create or modify: `tests/test_temporal_normalizer_adoption.py`

- [x] **Step 1: Add static adoption test**

Create `tests/test_temporal_normalizer_adoption.py`:

```python
from pathlib import Path


def test_feishu_helper_does_not_parse_tool_boundary_times_directly():
    source = Path("semantier-skills/plugins/feishu_meeting_coordinator/scripts/feishu_bot_api.py").read_text()

    assert "datetime.strptime(value, \"%Y-%m-%d %H:%M\")" not in source
    assert "datetime.fromisoformat(state.agreed_slot)" not in source
    assert "normalize_calendar_instant" in source


def test_feishu_tools_use_temporal_normalizer_for_tool_boundary_times():
    source = Path("semantier-skills/plugins/feishu_meeting_coordinator/tools.py").read_text()

    assert "_normalize_temporal_window_payload" in source
    assert "_normalize_temporal_slots" in source
    assert "normalize_calendar_window" in source
    assert "normalize_calendar_slots" in source


def test_cron_tool_normalizes_structured_once_at():
    source = Path("hermes-agent/tools/cronjob_tools.py").read_text()

    assert "normalize_once_run_at" in source
    assert "schedule_mode='once_at'" in source


def test_governed_context_uses_temporal_resolution_for_relative_periods():
    source = Path("src/agents/governed_context.py").read_text()

    assert "resolve_relative_period_context" in source
    assert "current_turn_anchor_utc" in source
```

- [x] **Step 2: Run static adoption test**

Run:

```bash
pytest -q tests/test_temporal_normalizer_adoption.py
```

Expected: PASS.

---

## Validation Commands

Run focused tests:

```bash
pytest -q \
  tests/test_temporal_resolution.py \
  tests/test_feishu_meeting_coordinator_tools.py \
  tests/test_feishu_bot_meeting_coordinator_helper.py \
  tests/test_meeting_coordinator_gateway.py \
  tests/test_governed_context.py \
  tests/test_temporal_normalizer_adoption.py
```

Run Hermes cron tests:

```bash
pytest -q \
  hermes-agent/tests/tools/test_cronjob_tools.py \
  hermes-agent/tests/cron/test_jobs.py \
  hermes-agent/tests/test_timezone.py
```

Compile edited runtime files:

```bash
python -m py_compile \
  src/agents/temporal_resolution.py \
  src/agents/meeting_coordinator_gateway.py \
  src/agents/governed_context.py \
  semantier-skills/plugins/feishu_meeting_coordinator/tools.py \
  semantier-skills/plugins/feishu_meeting_coordinator/scripts/feishu_bot_api.py \
  hermes-agent/tools/cronjob_tools.py \
  hermes-agent/cron/jobs.py
```

Search for remaining high-risk direct parsing:

```bash
rg -n "datetime\\.fromisoformat\\(|datetime\\.strptime\\(" \
  semantier-skills/plugins/feishu_meeting_coordinator \
  hermes-agent/tools/cronjob_tools.py \
  hermes-agent/cron/jobs.py \
  src/agents/meeting_coordinator_gateway.py
```

Expected remaining direct parsing:

- `datetime.fromisoformat(normalized)` immediately after a call to `normalize_calendar_instant`.
- legacy scheduler parsing that reads already-normalized persisted timestamps.
- tests asserting compatibility behavior.

Review scheduler awareness helper call sites after the `parse_schedule()` change:

```bash
rg -n "_ensure_aware\\(" hermes-agent/cron/jobs.py hermes-agent/tests
```

Expected: `_ensure_aware()` is either still used by non-parser scheduler paths such as due-job/recovery computations, or it is removed with tests proving those paths now receive already-normalized aware datetimes. Do not leave it as unreviewed dead code.

## Review Checklist

- [x] No live LLM call is introduced into temporal resolution.
- [x] Inbound platform event timestamp is the primary anchor.
- [x] `HERMES_SESSION_TURN_TIMESTAMP` is only fallback anchor.
- [x] Clock-only meeting and negotiation times resolve to the inbound event date.
- [x] Relative tokens `today/tomorrow/yesterday` and `今天/明天/昨天` are deterministic.
- [x] Past meeting/calendar starts reject by default.
- [x] Cron intervals and cron expressions retain existing behavior.
- [x] New one-shot cron `run_at` no longer depends on process-local timezone.
- [x] Cron `_ensure_aware()` call sites were reviewed after parser normalization.
- [x] Governed analytics relative periods use the inbound event timestamp when available.
- [x] Relative-period prompt guidance carries deterministic resolved period IDs, not LLM-derived dates.
- [x] `RelativePeriodContext` fields match `src/prompts/agents/governed_context.json` template variables.
- [x] Already-normalized ISO inputs remain idempotent through Feishu helper parsing.
- [x] All persisted/cross-boundary normalized outputs are timezone-aware ISO-8601.
- [x] The session reset policy plan remains unimplemented.

## Execution Notes

This plan intentionally prioritizes user/tool boundary surfaces over every `datetime.now()` or `time.time()` occurrence. Most of those occurrences are internal TTLs, uptime measurements, generated filenames, or already-UTC persistence helpers. Expanding the migration beyond these boundaries should be a separate audit after the high-risk meeting and cron surfaces are normalized.
