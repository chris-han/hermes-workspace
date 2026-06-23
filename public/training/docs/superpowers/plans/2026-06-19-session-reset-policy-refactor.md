# Session Reset Policy Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor Hermes gateway session reset into a deterministic boundary policy layer that uses UTC midnight reset, inactivity timeout, explicit reset commands, and a guarded intent-shift signal without allowing LLM inference to become session authority.

**Architecture:** Keep `SessionStore` responsible for session records and source-key lookup. Move reset/boundary decisions into a dedicated evaluator that returns auditable `SessionBoundaryDecision` objects. Treat intent shift as a configurable task-boundary signal: deterministic rules can force a new task/session, while LLM-assisted classification may only contribute evidence unless policy explicitly enables high-confidence automatic reset.

**Tech Stack:** Python 3.12, Hermes gateway, dataclasses, timezone-aware UTC `datetime`, pytest

---

## Current Behavior Summary

Native Hermes currently decides session reuse this way:

- `hermes-agent/gateway/session.py::build_session_key` builds a deterministic key from workspace/platform/chat/thread/user identity.
- `SessionStore.get_or_create_session()` reuses an existing `SessionEntry` unless `force_new=True`, the entry is suspended, or reset policy fires.
- `SessionResetPolicy` supports `none`, `idle`, `daily`, and `both`.
- Daily reset is now expected to use UTC hour `0`.
- Explicit reset is handled by command paths such as `/new` and `/reset`.
- Message timestamp, message content, and semantic intent are not currently part of session-boundary decisions.

This is why two Feishu DM meeting requests can share one session: same deterministic source key, no idle/daily reset boundary, and no explicit reset.

## Target Policy

The new policy has two layers:

1. **Hard deterministic boundaries**
   - Explicit reset/new/branch commands.
   - Suspended session.
   - Inactivity timeout.
   - UTC daily reset at configured `at_hour`, default `0`.
   - Source-key change caused by platform/chat/thread/user identity.

2. **Task-boundary signals**
   - Intent shift detection.
   - Tool workflow completion state.
   - High-risk tool domains such as calendar, finance, identity, governance, or external side effects.

Intent shift must not be hidden inside prompt behavior. It must produce structured evidence and be testable without a live LLM.

## Non-Goals

- Do not weaken deterministic timestamp handling.
- Do not make LLM inference the sole authority for user identity, organization, permissions, or persisted runtime continuity.
- Do not add live LLM calls to replay or audit paths.
- Do not change source-key construction in this refactor unless a test proves it is necessary.
- Do not remove explicit `/new`, `/reset`, `/resume`, or `/branch` behavior.

## File Structure

**Create**

- `hermes-agent/gateway/session_boundary.py`  
  Owns boundary input models, deterministic UTC reset evaluation, intent-shift signal evaluation, and final boundary decision composition.

- `hermes-agent/tests/gateway/test_session_boundary_policy.py`  
  Unit coverage for idle reset, UTC daily reset, suspended reset, no-reset reuse, and intent-shift decisions.

**Modify**

- `hermes-agent/gateway/config.py`  
  Adds `IntentShiftPolicy` and nests it under `SessionResetPolicy` without breaking existing config files.

- `hermes-agent/gateway/session.py`  
  Delegates `_should_reset()` and `_is_session_expired()` calculations to `session_boundary.py`; keeps session persistence and source-key lookup local.

- `hermes-agent/gateway/run.py`  
  Builds `SessionBoundaryInput` from inbound gateway event metadata and passes it to session acquisition. Uses boundary decisions for notifications and agent-cache invalidation.

- `hermes-agent/tests/gateway/test_config.py`  
  Verifies defaults and YAML roundtrip for the new intent-shift policy.

- `hermes-agent/tests/gateway/test_session_reset_notify.py`  
  Verifies existing idle/daily notification behavior still works with the extracted evaluator.

- `docs/derived/gateway-unified-multitenant-design.md`  
  Documents the executable session-boundary contract after implementation.

---

### Task 1: Add Boundary Decision Data Model

**Files:**
- Create: `hermes-agent/gateway/session_boundary.py`
- Test: `hermes-agent/tests/gateway/test_session_boundary_policy.py`

- [ ] **Step 1: Write failing tests for deterministic boundary decisions**

```python
from datetime import datetime, timezone
from types import SimpleNamespace

from gateway.config import Platform, SessionResetPolicy
from gateway.session_boundary import (
    SessionBoundaryInput,
    evaluate_deterministic_boundary,
)


def _entry(updated_at: datetime, suspended: bool = False):
    return SimpleNamespace(
        updated_at=updated_at,
        suspended=suspended,
        resume_pending=False,
    )


def test_idle_boundary_fires_after_inactivity_timeout():
    policy = SessionResetPolicy(mode="idle", idle_minutes=30, at_hour=0)
    decision = evaluate_deterministic_boundary(
        entry=_entry(datetime(2026, 6, 19, 0, 0, tzinfo=timezone.utc)),
        policy=policy,
        boundary_input=SessionBoundaryInput(
            platform=Platform.FEISHU,
            chat_type="dm",
            event_time_utc=datetime(2026, 6, 19, 0, 31, tzinfo=timezone.utc),
        ),
    )

    assert decision.should_reset is True
    assert decision.reason == "idle"
    assert decision.is_hard_boundary is True


def test_daily_boundary_uses_utc_midnight():
    policy = SessionResetPolicy(mode="daily", idle_minutes=1440, at_hour=0)
    decision = evaluate_deterministic_boundary(
        entry=_entry(datetime(2026, 6, 18, 23, 59, tzinfo=timezone.utc)),
        policy=policy,
        boundary_input=SessionBoundaryInput(
            platform=Platform.FEISHU,
            chat_type="dm",
            event_time_utc=datetime(2026, 6, 19, 0, 1, tzinfo=timezone.utc),
        ),
    )

    assert decision.should_reset is True
    assert decision.reason == "daily"
    assert decision.boundary_time_utc == datetime(2026, 6, 19, 0, 0, tzinfo=timezone.utc)


def test_daily_boundary_does_not_use_local_midnight():
    policy = SessionResetPolicy(mode="daily", idle_minutes=1440, at_hour=0)
    decision = evaluate_deterministic_boundary(
        entry=_entry(datetime(2026, 6, 19, 0, 10, tzinfo=timezone.utc)),
        policy=policy,
        boundary_input=SessionBoundaryInput(
            platform=Platform.FEISHU,
            chat_type="dm",
            event_time_utc=datetime(2026, 6, 19, 8, 1, tzinfo=timezone.utc),
        ),
    )

    assert decision.should_reset is False
    assert decision.reason is None


def test_suspended_boundary_wins_before_time_policy():
    policy = SessionResetPolicy(mode="none", idle_minutes=1440, at_hour=0)
    decision = evaluate_deterministic_boundary(
        entry=_entry(datetime(2026, 6, 19, 0, 0, tzinfo=timezone.utc), suspended=True),
        policy=policy,
        boundary_input=SessionBoundaryInput(
            platform=Platform.FEISHU,
            chat_type="dm",
            event_time_utc=datetime(2026, 6, 19, 0, 1, tzinfo=timezone.utc),
        ),
    )

    assert decision.should_reset is True
    assert decision.reason == "suspended"
```

- [ ] **Step 2: Run the new tests and verify they fail**

Run:

```bash
pytest -q hermes-agent/tests/gateway/test_session_boundary_policy.py
```

Expected: import failure for `gateway.session_boundary`.

- [ ] **Step 3: Implement the boundary data model and deterministic evaluator**

Add this file:

```python
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from gateway.config import Platform, SessionResetPolicy


@dataclass(frozen=True)
class SessionBoundaryInput:
    platform: Platform
    chat_type: str
    event_time_utc: datetime
    message_text: str = ""
    active_processes: bool = False
    metadata: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if self.event_time_utc.tzinfo is None:
            raise ValueError("event_time_utc must be timezone-aware UTC")
        normalized = self.event_time_utc.astimezone(timezone.utc)
        object.__setattr__(self, "event_time_utc", normalized)


@dataclass(frozen=True)
class SessionBoundaryDecision:
    should_reset: bool
    reason: Optional[str] = None
    is_hard_boundary: bool = False
    boundary_time_utc: Optional[datetime] = None
    evidence: dict[str, Any] = field(default_factory=dict)


def _daily_boundary(now_utc: datetime, at_hour: int) -> datetime:
    boundary = now_utc.replace(hour=at_hour, minute=0, second=0, microsecond=0)
    if now_utc.hour < at_hour:
        boundary -= timedelta(days=1)
    return boundary


def evaluate_deterministic_boundary(
    *,
    entry: Any,
    policy: SessionResetPolicy,
    boundary_input: SessionBoundaryInput,
) -> SessionBoundaryDecision:
    if boundary_input.active_processes:
        return SessionBoundaryDecision(
            should_reset=False,
            evidence={"active_processes": True},
        )

    if getattr(entry, "suspended", False):
        return SessionBoundaryDecision(
            should_reset=True,
            reason="suspended",
            is_hard_boundary=True,
        )

    if getattr(entry, "resume_pending", False):
        return SessionBoundaryDecision(
            should_reset=False,
            evidence={"resume_pending": True},
        )

    if policy.mode == "none":
        return SessionBoundaryDecision(should_reset=False)

    now_utc = boundary_input.event_time_utc
    updated_at = entry.updated_at.astimezone(timezone.utc)

    if policy.mode in {"idle", "both"}:
        idle_deadline = updated_at + timedelta(minutes=policy.idle_minutes)
        if now_utc > idle_deadline:
            return SessionBoundaryDecision(
                should_reset=True,
                reason="idle",
                is_hard_boundary=True,
                boundary_time_utc=idle_deadline,
                evidence={"idle_minutes": policy.idle_minutes},
            )

    if policy.mode in {"daily", "both"}:
        boundary = _daily_boundary(now_utc, policy.at_hour)
        if updated_at < boundary:
            return SessionBoundaryDecision(
                should_reset=True,
                reason="daily",
                is_hard_boundary=True,
                boundary_time_utc=boundary,
                evidence={"at_hour_utc": policy.at_hour},
            )

    return SessionBoundaryDecision(should_reset=False)
```

- [ ] **Step 4: Run the boundary tests**

Run:

```bash
pytest -q hermes-agent/tests/gateway/test_session_boundary_policy.py
```

Expected: PASS.

---

### Task 2: Delegate Existing Session Reset Logic To The Evaluator

**Files:**
- Modify: `hermes-agent/gateway/session.py`
- Test: `hermes-agent/tests/gateway/test_session_reset_notify.py`
- Test: `hermes-agent/tests/gateway/test_session_boundary_policy.py`

- [ ] **Step 1: Verify existing auto-reset fields are present and round-trip**

Before adding new behavior, confirm the current `SessionEntry` already exposes the fields used by the store-level reset tests. If either field is missing, add it before continuing so later tests fail for boundary-policy regressions rather than `AttributeError`.

Append to `hermes-agent/tests/gateway/test_session_boundary_policy.py`:

```python
from gateway.session import SessionEntry


def test_session_entry_auto_reset_fields_roundtrip():
    entry = SessionEntry(
        session_key="key-1",
        session_id="session-1",
        created_at=datetime(2026, 6, 19, 0, 0, tzinfo=timezone.utc),
        updated_at=datetime(2026, 6, 19, 0, 1, tzinfo=timezone.utc),
        platform=Platform.FEISHU,
        chat_type="dm",
        was_auto_reset=True,
        auto_reset_reason="daily",
    )

    restored = SessionEntry.from_dict(entry.to_dict())

    assert restored.was_auto_reset is True
    assert restored.auto_reset_reason == "daily"
```

If this fails because fields are missing, add these fields to `SessionEntry`:

```python
    was_auto_reset: bool = False
    auto_reset_reason: Optional[str] = None
```

Then add them to `to_dict()` and `from_dict()`:

```python
            "was_auto_reset": self.was_auto_reset,
            "auto_reset_reason": self.auto_reset_reason,
```

```python
            was_auto_reset=data.get("was_auto_reset", False),
            auto_reset_reason=data.get("auto_reset_reason"),
```

- [ ] **Step 2: Add regression tests for existing store behavior**

Append to `hermes-agent/tests/gateway/test_session_boundary_policy.py`:

```python
from pathlib import Path

from gateway.config import GatewayConfig
from gateway.session import SessionSource, SessionStore


def _source():
    return SessionSource(
        platform=Platform.FEISHU,
        chat_type="dm",
        chat_id="chat-1",
        user_id="user-1",
        chat_name="Feishu DM",
    )


def test_session_store_reuses_entry_when_no_boundary_fires(tmp_path, monkeypatch):
    config = GatewayConfig(session_reset=SessionResetPolicy(mode="both", at_hour=0, idle_minutes=1440))
    store = SessionStore(tmp_path / "sessions", config)
    source = _source()

    monkeypatch.setattr("gateway.session._now", lambda: datetime(2026, 6, 19, 0, 0, tzinfo=timezone.utc))
    first = store.get_or_create_session(source)

    monkeypatch.setattr("gateway.session._now", lambda: datetime(2026, 6, 19, 0, 30, tzinfo=timezone.utc))
    second = store.get_or_create_session(source)

    assert second.session_id == first.session_id
    assert second.was_auto_reset is False


def test_session_store_creates_new_entry_when_utc_daily_boundary_fires(tmp_path, monkeypatch):
    config = GatewayConfig(session_reset=SessionResetPolicy(mode="daily", at_hour=0, idle_minutes=1440))
    store = SessionStore(tmp_path / "sessions", config)
    source = _source()

    monkeypatch.setattr("gateway.session._now", lambda: datetime(2026, 6, 18, 23, 59, tzinfo=timezone.utc))
    first = store.get_or_create_session(source)

    monkeypatch.setattr("gateway.session._now", lambda: datetime(2026, 6, 19, 0, 1, tzinfo=timezone.utc))
    second = store.get_or_create_session(source)

    assert second.session_id != first.session_id
    assert second.was_auto_reset is True
    assert second.auto_reset_reason == "daily"
```

- [ ] **Step 3: Add non-midnight UTC boundary edge-case coverage**

Append to `hermes-agent/tests/gateway/test_session_boundary_policy.py`:

```python
def test_daily_boundary_supports_non_midnight_utc_hour():
    policy = SessionResetPolicy(mode="daily", idle_minutes=1440, at_hour=6)
    before_boundary = evaluate_deterministic_boundary(
        entry=_entry(datetime(2026, 6, 18, 6, 30, tzinfo=timezone.utc)),
        policy=policy,
        boundary_input=SessionBoundaryInput(
            platform=Platform.FEISHU,
            chat_type="dm",
            event_time_utc=datetime(2026, 6, 19, 3, 0, tzinfo=timezone.utc),
        ),
    )
    after_boundary = evaluate_deterministic_boundary(
        entry=_entry(datetime(2026, 6, 18, 6, 30, tzinfo=timezone.utc)),
        policy=policy,
        boundary_input=SessionBoundaryInput(
            platform=Platform.FEISHU,
            chat_type="dm",
            event_time_utc=datetime(2026, 6, 19, 6, 1, tzinfo=timezone.utc),
        ),
    )

    assert before_boundary.should_reset is False
    assert after_boundary.should_reset is True
    assert after_boundary.boundary_time_utc == datetime(2026, 6, 19, 6, 0, tzinfo=timezone.utc)
```

- [ ] **Step 4: Run regression tests before refactor**

Run:

```bash
pytest -q hermes-agent/tests/gateway/test_session_boundary_policy.py hermes-agent/tests/gateway/test_session_reset_notify.py
```

Expected: PASS after Task 1, proving behavior before the internal delegation.

- [ ] **Step 5: Update `SessionStore` to call `evaluate_deterministic_boundary()`**

In `hermes-agent/gateway/session.py`, import:

```python
from gateway.session_boundary import SessionBoundaryInput, evaluate_deterministic_boundary
```

Replace the body of `_should_reset()` after policy lookup with:

```python
        now = _now()
        decision = evaluate_deterministic_boundary(
            entry=entry,
            policy=policy,
            boundary_input=SessionBoundaryInput(
                platform=source.platform,
                chat_type=source.chat_type,
                event_time_utc=now,
                active_processes=False,
            ),
        )
        return decision.reason if decision.should_reset else None
```

Replace the body of `_is_session_expired()` after policy lookup with:

```python
        now = _now()
        decision = evaluate_deterministic_boundary(
            entry=entry,
            policy=policy,
            boundary_input=SessionBoundaryInput(
                platform=entry.platform,
                chat_type=entry.chat_type,
                event_time_utc=now,
                active_processes=False,
            ),
        )
        return decision.should_reset
```

Keep the existing active-process guards at the top of each method so no behavior changes for running background work.

- [ ] **Step 6: Run gateway session tests**

Run:

```bash
pytest -q hermes-agent/tests/gateway/test_session_boundary_policy.py hermes-agent/tests/gateway/test_session_reset_notify.py hermes-agent/tests/gateway/test_restart_resume_pending.py
```

Expected: PASS.

---

### Task 3: Add Configurable Intent-Shift Policy

**Files:**
- Modify: `hermes-agent/gateway/config.py`
- Modify: `hermes-agent/gateway/session_boundary.py`
- Test: `hermes-agent/tests/gateway/test_config.py`
- Test: `hermes-agent/tests/gateway/test_session_boundary_policy.py`

- [ ] **Step 1: Write failing tests for intent-shift config defaults and roundtrip**

Append to `hermes-agent/tests/gateway/test_config.py`:

```python
from gateway.config import IntentShiftPolicy, SessionResetPolicy


def test_intent_shift_policy_defaults_to_advisory_disabled():
    policy = IntentShiftPolicy()

    assert policy.enabled is False
    assert policy.mode == "advisory"
    assert policy.min_confidence == 0.85
    assert policy.incomplete_task_stale_minutes == 1440
    assert "calendar" in policy.high_risk_domains


def test_session_reset_policy_roundtrips_intent_shift_config():
    policy = SessionResetPolicy.from_dict(
        {
            "mode": "both",
            "at_hour": 0,
            "idle_minutes": 120,
            "intent_shift": {
                "enabled": True,
                "mode": "auto_high_confidence",
                "min_confidence": 0.9,
                "incomplete_task_stale_minutes": 60,
                "high_risk_domains": ["calendar", "finance"],
            },
        }
    )

    assert policy.intent_shift.enabled is True
    assert policy.intent_shift.mode == "auto_high_confidence"
    assert policy.intent_shift.min_confidence == 0.9
    assert policy.intent_shift.incomplete_task_stale_minutes == 60
    assert policy.to_dict()["intent_shift"]["high_risk_domains"] == ["calendar", "finance"]
```

- [ ] **Step 2: Write failing tests for intent-shift decisions**

Append to `hermes-agent/tests/gateway/test_session_boundary_policy.py`:

```python
from gateway.config import IntentShiftPolicy
from gateway.session_boundary import IntentShiftEvidence, evaluate_intent_shift_boundary


def test_intent_shift_is_advisory_by_default():
    decision = evaluate_intent_shift_boundary(
        policy=IntentShiftPolicy(enabled=False),
        evidence=IntentShiftEvidence(
            previous_domain="calendar",
            current_domain="calendar",
            previous_action="create_meeting",
            current_action="create_meeting",
            confidence=0.99,
            explicit_new_task_phrase=True,
            previous_task_complete=True,
        ),
    )

    assert decision.should_reset is False
    assert decision.reason is None
    assert decision.evidence["intent_shift_detected"] is True


def test_intent_shift_auto_reset_requires_enabled_high_confidence_and_completed_previous_task():
    decision = evaluate_intent_shift_boundary(
        policy=IntentShiftPolicy(
            enabled=True,
            mode="auto_high_confidence",
            min_confidence=0.85,
            high_risk_domains=("calendar", "finance"),
        ),
        evidence=IntentShiftEvidence(
            previous_domain="calendar",
            current_domain="calendar",
            previous_action="create_meeting",
            current_action="create_meeting",
            confidence=0.92,
            explicit_new_task_phrase=True,
            previous_task_complete=True,
        ),
    )

    assert decision.should_reset is True
    assert decision.reason == "intent_shift"
    assert decision.is_hard_boundary is False


def test_intent_shift_does_not_reset_when_previous_task_is_incomplete():
    decision = evaluate_intent_shift_boundary(
        policy=IntentShiftPolicy(
            enabled=True,
            mode="auto_high_confidence",
            min_confidence=0.85,
            high_risk_domains=("calendar",),
        ),
        evidence=IntentShiftEvidence(
            previous_domain="calendar",
            current_domain="calendar",
            previous_action="create_meeting",
            current_action="create_meeting",
            confidence=0.95,
            explicit_new_task_phrase=True,
            previous_task_complete=False,
        ),
    )

    assert decision.should_reset is False
    assert decision.evidence["blocked_by_previous_task_complete"] is True


def test_stale_incomplete_previous_task_does_not_block_intent_shift_forever():
    decision = evaluate_intent_shift_boundary(
        policy=IntentShiftPolicy(
            enabled=True,
            mode="auto_high_confidence",
            min_confidence=0.85,
            incomplete_task_stale_minutes=60,
            high_risk_domains=("calendar",),
        ),
        evidence=IntentShiftEvidence(
            previous_domain="calendar",
            current_domain="calendar",
            previous_action="create_meeting",
            current_action="create_meeting",
            confidence=0.95,
            explicit_new_task_phrase=True,
            previous_task_complete=False,
            previous_task_updated_at=datetime(2026, 6, 19, 0, 0, tzinfo=timezone.utc),
            event_time_utc=datetime(2026, 6, 19, 1, 1, tzinfo=timezone.utc),
        ),
    )

    assert decision.should_reset is True
    assert decision.evidence["previous_task_complete_stale"] is True


def test_intent_shift_auto_reset_is_gated_by_current_high_risk_domain():
    decision = evaluate_intent_shift_boundary(
        policy=IntentShiftPolicy(
            enabled=True,
            mode="auto_high_confidence",
            min_confidence=0.85,
            high_risk_domains=("calendar",),
        ),
        evidence=IntentShiftEvidence(
            previous_domain="calendar",
            current_domain="general",
            previous_action="create_meeting",
            current_action="message",
            confidence=0.95,
            explicit_new_task_phrase=True,
            previous_task_complete=True,
        ),
    )

    assert decision.should_reset is False
    assert decision.evidence["blocked_by_domain"] is True
```

- [ ] **Step 3: Run tests and verify they fail**

Run:

```bash
pytest -q hermes-agent/tests/gateway/test_config.py hermes-agent/tests/gateway/test_session_boundary_policy.py
```

Expected: import or attribute failures for `IntentShiftPolicy` and `IntentShiftEvidence`.

- [ ] **Step 4: Add `IntentShiftPolicy` to config**

In `hermes-agent/gateway/config.py`, add before `SessionResetPolicy`:

```python
@dataclass
class IntentShiftPolicy:
    enabled: bool = False
    mode: str = "advisory"  # "advisory" or "auto_high_confidence"
    min_confidence: float = 0.85
    incomplete_task_stale_minutes: int = 1440
    high_risk_domains: tuple[str, ...] = ("calendar", "finance", "identity", "governance")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "enabled": self.enabled,
            "mode": self.mode,
            "min_confidence": self.min_confidence,
            "incomplete_task_stale_minutes": self.incomplete_task_stale_minutes,
            "high_risk_domains": list(self.high_risk_domains),
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "IntentShiftPolicy":
        if not isinstance(data, dict):
            return cls()
        domains = data.get("high_risk_domains")
        return cls(
            enabled=_coerce_bool(data.get("enabled"), False),
            mode=str(data.get("mode") or "advisory"),
            min_confidence=_coerce_float(data.get("min_confidence"), 0.85),
            incomplete_task_stale_minutes=_coerce_int(data.get("incomplete_task_stale_minutes"), 1440),
            high_risk_domains=tuple(domains) if domains is not None else ("calendar", "finance", "identity", "governance"),
        )
```

Add this field to `SessionResetPolicy`:

```python
    intent_shift: IntentShiftPolicy = field(default_factory=IntentShiftPolicy)
```

Add this key to `SessionResetPolicy.to_dict()`:

```python
            "intent_shift": self.intent_shift.to_dict(),
```

In `SessionResetPolicy.from_dict()`, read and pass:

```python
        intent_shift = data.get("intent_shift")
```

```python
            intent_shift=IntentShiftPolicy.from_dict(intent_shift or {}),
```

- [ ] **Step 5: Add intent-shift evidence evaluation**

In `hermes-agent/gateway/session_boundary.py`, add:

```python
from gateway.config import IntentShiftPolicy
```

Then add:

```python
@dataclass(frozen=True)
class IntentShiftEvidence:
    previous_domain: str
    current_domain: str
    previous_action: str
    current_action: str
    confidence: float
    explicit_new_task_phrase: bool
    previous_task_complete: bool
    previous_task_updated_at: Optional[datetime] = None
    event_time_utc: Optional[datetime] = None


def _previous_task_blocks_shift(
    *,
    policy: IntentShiftPolicy,
    evidence: IntentShiftEvidence,
    decision_evidence: dict[str, Any],
) -> bool:
    if evidence.previous_task_complete:
        return False
    if evidence.previous_task_updated_at is None or evidence.event_time_utc is None:
        return True

    updated_at = evidence.previous_task_updated_at.astimezone(timezone.utc)
    event_time = evidence.event_time_utc.astimezone(timezone.utc)
    stale_after = updated_at + timedelta(minutes=policy.incomplete_task_stale_minutes)
    if event_time > stale_after:
        decision_evidence["previous_task_complete_stale"] = True
        return False
    return True


def _intent_shift_detected(evidence: IntentShiftEvidence) -> bool:
    if evidence.explicit_new_task_phrase:
        return True
    if evidence.previous_domain != evidence.current_domain:
        return True
    if evidence.previous_action != evidence.current_action and evidence.current_domain in {
        "calendar",
        "finance",
        "identity",
        "governance",
    }:
        return True
    return False


def evaluate_intent_shift_boundary(
    *,
    policy: IntentShiftPolicy,
    evidence: IntentShiftEvidence,
) -> SessionBoundaryDecision:
    detected = _intent_shift_detected(evidence)
    decision_evidence = {
        "intent_shift_detected": detected,
        "previous_domain": evidence.previous_domain,
        "current_domain": evidence.current_domain,
        "previous_action": evidence.previous_action,
        "current_action": evidence.current_action,
        "confidence": evidence.confidence,
        "explicit_new_task_phrase": evidence.explicit_new_task_phrase,
        "previous_task_complete": evidence.previous_task_complete,
    }

    if not detected:
        return SessionBoundaryDecision(should_reset=False, evidence=decision_evidence)

    if not policy.enabled or policy.mode != "auto_high_confidence":
        return SessionBoundaryDecision(should_reset=False, evidence=decision_evidence)

    if evidence.confidence < policy.min_confidence:
        decision_evidence["blocked_by_min_confidence"] = True
        return SessionBoundaryDecision(should_reset=False, evidence=decision_evidence)

    if _previous_task_blocks_shift(
        policy=policy,
        evidence=evidence,
        decision_evidence=decision_evidence,
    ):
        decision_evidence["blocked_by_previous_task_complete"] = True
        return SessionBoundaryDecision(should_reset=False, evidence=decision_evidence)

    # Auto reset is intentionally gated by the current domain. Entering a
    # side-effecting domain such as calendar is risky; leaving it for general
    # chat should not destroy context unless an explicit deterministic boundary
    # also fires.
    if evidence.current_domain not in set(policy.high_risk_domains):
        decision_evidence["blocked_by_domain"] = True
        return SessionBoundaryDecision(should_reset=False, evidence=decision_evidence)

    return SessionBoundaryDecision(
        should_reset=True,
        reason="intent_shift",
        is_hard_boundary=False,
        evidence=decision_evidence,
    )
```

- [ ] **Step 6: Run config and boundary tests**

Run:

```bash
pytest -q hermes-agent/tests/gateway/test_config.py hermes-agent/tests/gateway/test_session_boundary_policy.py
```

Expected: PASS.

---

### Task 4: Wire Boundary Input Into Gateway Session Acquisition

**Files:**
- Modify: `hermes-agent/gateway/session.py`
- Modify: `hermes-agent/gateway/run.py`
- Test: `hermes-agent/tests/gateway/test_session_boundary_policy.py`
- Test: `hermes-agent/tests/gateway/test_agent_cache.py`

- [ ] **Step 1: Add tests for force-new reason preservation**

Append to `hermes-agent/tests/gateway/test_session_boundary_policy.py`:

```python
def test_force_new_reason_is_stored_on_new_session(tmp_path, monkeypatch):
    config = GatewayConfig(session_reset=SessionResetPolicy(mode="none"))
    store = SessionStore(tmp_path / "sessions", config)
    source = _source()

    monkeypatch.setattr("gateway.session._now", lambda: datetime(2026, 6, 19, 0, 0, tzinfo=timezone.utc))
    first = store.get_or_create_session(source)

    monkeypatch.setattr("gateway.session._now", lambda: datetime(2026, 6, 19, 0, 1, tzinfo=timezone.utc))
    second = store.get_or_create_session(source, force_new=True, force_new_reason="intent_shift")

    assert second.session_id != first.session_id
    assert second.was_auto_reset is True
    assert second.auto_reset_reason == "intent_shift"
```

- [ ] **Step 2: Run the targeted test and verify it fails**

Run:

```bash
pytest -q hermes-agent/tests/gateway/test_session_boundary_policy.py::test_force_new_reason_is_stored_on_new_session
```

Expected: `TypeError` because `force_new_reason` is not accepted yet.

- [ ] **Step 3: Extend `SessionStore.get_or_create_session()`**

Change the signature in `hermes-agent/gateway/session.py`:

```python
    def get_or_create_session(
        self,
        source: SessionSource,
        force_new: bool = False,
        force_new_reason: Optional[str] = None,
    ) -> SessionEntry:
```

In the branch where no existing session is reused, set:

```python
                was_auto_reset = bool(force_new and force_new_reason)
                auto_reset_reason = force_new_reason if force_new else None
                reset_had_activity = False
```

When replacing an existing entry because `force_new=True`, end the old DB session with:

```python
                    db_end_session_id = entry.session_id
```

and set:

```python
                    was_auto_reset = bool(force_new_reason)
                    auto_reset_reason = force_new_reason
                    reset_had_activity = entry.total_tokens > 0
```

- [ ] **Step 4: Add gateway helper for event UTC timestamp**

In `hermes-agent/gateway/run.py`, add a small helper near existing session environment helpers:

```python
def _event_time_utc(event) -> datetime:
    raw = getattr(event, "timestamp", None)
    if isinstance(raw, datetime):
        if raw.tzinfo is None:
            return raw.replace(tzinfo=timezone.utc)
        return raw.astimezone(timezone.utc)
    return datetime.now(timezone.utc)
```

Use this helper wherever a future `SessionBoundaryInput` is built.

- [ ] **Step 5: Run gateway cache and boundary tests**

Run:

```bash
pytest -q hermes-agent/tests/gateway/test_session_boundary_policy.py hermes-agent/tests/gateway/test_agent_cache.py
```

Expected: PASS.

---

### Task 5: Add Deterministic Intent Signature Extraction

**Files:**
- Modify: `hermes-agent/gateway/session_boundary.py`
- Modify: `hermes-agent/gateway/session.py`
- Test: `hermes-agent/tests/gateway/test_session_boundary_policy.py`

- [ ] **Step 1: Add tests for rule-based intent signatures**

Append to `hermes-agent/tests/gateway/test_session_boundary_policy.py`:

```python
from gateway.session_boundary import extract_intent_signature


def test_extract_intent_signature_detects_calendar_create_meeting():
    signature = extract_intent_signature("给我约个10:00am的赛事大会，半个小时线上with amy q")

    assert signature.domain == "calendar"
    assert signature.action == "create_meeting"
    assert signature.confidence >= 0.8


def test_extract_intent_signature_detects_explicit_new_task_phrase():
    signature = extract_intent_signature("另外，帮我约明天上午10点和Amy开会")

    assert signature.explicit_new_task_phrase is True
    assert signature.domain == "calendar"
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
pytest -q hermes-agent/tests/gateway/test_session_boundary_policy.py::test_extract_intent_signature_detects_calendar_create_meeting hermes-agent/tests/gateway/test_session_boundary_policy.py::test_extract_intent_signature_detects_explicit_new_task_phrase
```

Expected: import failure for `extract_intent_signature`.

- [ ] **Step 3: Implement deterministic extractor**

In `hermes-agent/gateway/session_boundary.py`, add:

```python
@dataclass(frozen=True)
class IntentSignature:
    domain: str
    action: str
    confidence: float
    explicit_new_task_phrase: bool = False


def extract_intent_signature(message_text: str) -> IntentSignature:
    text = (message_text or "").strip().lower()
    explicit_new_task = any(marker in text for marker in ("另外", "另一个", "新任务", "new task", "another thing"))

    calendar_markers = ("约", "会议", "大会", "meeting", "calendar", "日程", "invite")
    create_markers = ("约", "安排", "创建", "create", "schedule", "book")

    if any(marker in text for marker in calendar_markers):
        action = "create_meeting" if any(marker in text for marker in create_markers) else "calendar_request"
        # Confidence is a policy threshold input, not a model probability. Keep
        # rule-based values below the default 0.85 auto-reset threshold until the
        # extractor has broader locale and gateway coverage.
        return IntentSignature(
            domain="calendar",
            action=action,
            confidence=0.82 if action == "create_meeting" else 0.7,
            explicit_new_task_phrase=explicit_new_task,
        )

    return IntentSignature(
        domain="general",
        action="message",
        confidence=0.5,
        explicit_new_task_phrase=explicit_new_task,
    )
```

- [ ] **Step 4: Add last intent fields to `SessionEntry`**

In `hermes-agent/gateway/session.py`, add fields to `SessionEntry`:

```python
    last_intent_domain: Optional[str] = None
    last_intent_action: Optional[str] = None
    last_task_complete: bool = True
    last_task_updated_at: Optional[datetime] = None
```

Extend `SessionEntry.__setattr__()` so the new timestamp uses the same UTC-aware coercion path as existing session timestamps:

```python
        if name in {"created_at", "updated_at", "last_resume_marked_at", "last_task_updated_at"} and value is not None:
            value = _coerce_session_datetime(value)
```

Add these keys to `to_dict()` and `from_dict()`:

```python
            "last_intent_domain": self.last_intent_domain,
            "last_intent_action": self.last_intent_action,
            "last_task_complete": self.last_task_complete,
            "last_task_updated_at": self.last_task_updated_at.isoformat() if self.last_task_updated_at else None,
```

```python
            last_intent_domain=data.get("last_intent_domain"),
            last_intent_action=data.get("last_intent_action"),
            last_task_complete=data.get("last_task_complete", True),
            last_task_updated_at=(
                datetime.fromisoformat(data["last_task_updated_at"]).astimezone(timezone.utc)
                if data.get("last_task_updated_at")
                else None
            ),
```

- [ ] **Step 5: Add locked session intent update and snapshot helpers**

Add to `SessionStore`:

```python
from dataclasses import replace


    def peek_session(self, source: SessionSource) -> Optional[SessionEntry]:
        session_key = self._generate_session_key(source)
        with self._lock:
            self._ensure_loaded_locked()
            entry = self._entries.get(session_key)
            return replace(entry) if entry is not None else None

    def update_session_intent(
        self,
        session_key: str,
        *,
        domain: str,
        action: str,
        task_complete: bool,
    ) -> None:
        with self._lock:
            self._ensure_loaded_locked()
            entry = self._entries.get(session_key)
            if not entry:
                return
            entry.last_intent_domain = domain
            entry.last_intent_action = action
            entry.last_task_complete = task_complete
            entry.last_task_updated_at = _now()
            self._save()
```

- [ ] **Step 6: Run boundary tests**

Run:

```bash
pytest -q hermes-agent/tests/gateway/test_session_boundary_policy.py
```

Expected: PASS.

---

### Task 6: Apply Intent-Shift Boundary At Gateway Ingress

**Files:**
- Modify: `hermes-agent/gateway/run.py`
- Modify: `hermes-agent/gateway/session.py`
- Test: `hermes-agent/tests/gateway/test_session_boundary_policy.py`
- Test: `hermes-agent/tests/gateway/test_session_reset_notify.py`

- [ ] **Step 1: Add store-level test for intent-shift force-new flow**

Append to `hermes-agent/tests/gateway/test_session_boundary_policy.py`:

```python
def test_intent_shift_can_start_new_session_without_waiting_for_idle(tmp_path, monkeypatch):
    config = GatewayConfig(
        session_reset=SessionResetPolicy(
            mode="both",
            at_hour=0,
            idle_minutes=1440,
            intent_shift=IntentShiftPolicy(
                enabled=True,
                mode="auto_high_confidence",
                min_confidence=0.8,
                high_risk_domains=("calendar",),
            ),
        )
    )
    store = SessionStore(tmp_path / "sessions", config)
    source = _source()

    monkeypatch.setattr("gateway.session._now", lambda: datetime(2026, 6, 19, 0, 0, tzinfo=timezone.utc))
    first = store.get_or_create_session(source)
    store.update_session_intent(
        first.session_key,
        domain="calendar",
        action="create_meeting",
        task_complete=True,
    )
    previous = store.peek_session(source)

    current = extract_intent_signature("另外，帮我约明天上午10点和Amy开会")
    decision = evaluate_intent_shift_boundary(
        policy=config.session_reset.intent_shift,
        evidence=IntentShiftEvidence(
            previous_domain=previous.last_intent_domain or "general",
            current_domain=current.domain,
            previous_action=previous.last_intent_action or "message",
            current_action=current.action,
            confidence=current.confidence,
            explicit_new_task_phrase=current.explicit_new_task_phrase,
            previous_task_complete=previous.last_task_complete,
        ),
    )

    assert decision.should_reset is True

    monkeypatch.setattr("gateway.session._now", lambda: datetime(2026, 6, 19, 0, 2, tzinfo=timezone.utc))
    second = store.get_or_create_session(source, force_new=True, force_new_reason=decision.reason)

    assert second.session_id != first.session_id
    assert second.auto_reset_reason == "intent_shift"
```

- [ ] **Step 2: Add gateway integration logic**

In `hermes-agent/gateway/run.py`, immediately before the primary inbound message path calls `self.session_store.get_or_create_session(source)`, add logic equivalent to:

```python
from gateway.session_boundary import (
    IntentShiftEvidence,
    evaluate_intent_shift_boundary,
    extract_intent_signature,
)
```

```python
        force_new = False
        force_new_reason = None
        existing_entry = self.session_store.peek_session(source)
        if existing_entry is not None:
            current_signature = extract_intent_signature(getattr(event, "text", "") or "")
            decision = evaluate_intent_shift_boundary(
                policy=self.config.session_reset.intent_shift,
                evidence=IntentShiftEvidence(
                    previous_domain=existing_entry.last_intent_domain or "general",
                    current_domain=current_signature.domain,
                    previous_action=existing_entry.last_intent_action or "message",
                    current_action=current_signature.action,
                    confidence=current_signature.confidence,
                    explicit_new_task_phrase=current_signature.explicit_new_task_phrase,
                    previous_task_complete=existing_entry.last_task_complete,
                    previous_task_updated_at=existing_entry.last_task_updated_at,
                    event_time_utc=_event_time_utc(event),
                ),
            )
            if decision.should_reset:
                force_new = True
                force_new_reason = decision.reason

        session_entry = self.session_store.get_or_create_session(
            source,
            force_new=force_new,
            force_new_reason=force_new_reason,
        )
```

Add this regression test:

```python
def test_peek_session_returns_copy_not_live_entry(tmp_path, monkeypatch):
    config = GatewayConfig(session_reset=SessionResetPolicy(mode="none"))
    store = SessionStore(tmp_path / "sessions", config)
    source = _source()

    monkeypatch.setattr("gateway.session._now", lambda: datetime(2026, 6, 19, 0, 0, tzinfo=timezone.utc))
    entry = store.get_or_create_session(source)
    store.update_session_intent(entry.session_key, domain="calendar", action="create_meeting", task_complete=True)

    snapshot = store.peek_session(source)
    snapshot.last_intent_domain = "finance"

    fresh_snapshot = store.peek_session(source)
    assert fresh_snapshot.last_intent_domain == "calendar"
```

- [ ] **Step 3: Update intent metadata after successful turn**

After a user turn completes successfully and `update_session()` is called, use the `update_session_intent()` method added in Task 5.

Call it from `run.py` using the current deterministic signature:

```python
        self.session_store.update_session_intent(
            session_entry.session_key,
            domain=current_signature.domain,
            action=current_signature.action,
            task_complete=True,
        )
```

For failed or interrupted turns, call `update_session_intent(..., task_complete=False)` so `last_task_updated_at` records when the incomplete marker was written. The boundary evaluator must use `policy.incomplete_task_stale_minutes` to prevent an old interrupted turn from blocking intent-shift reset forever.

- [ ] **Step 4: Run gateway tests**

Run:

```bash
pytest -q hermes-agent/tests/gateway/test_session_boundary_policy.py hermes-agent/tests/gateway/test_session_reset_notify.py hermes-agent/tests/gateway/test_agent_cache.py
```

Expected: PASS.

---

### Task 7: Add Boundary Audit Logging

**Files:**
- Modify: `hermes-agent/gateway/session_boundary.py`
- Modify: `hermes-agent/gateway/run.py`
- Test: `hermes-agent/tests/gateway/test_session_boundary_policy.py`

- [ ] **Step 1: Add serialization test**

Append to `hermes-agent/tests/gateway/test_session_boundary_policy.py`:

```python
from gateway.session_boundary import serialize_boundary_decision


def test_boundary_decision_serializes_utc_timestamp():
    decision = SessionBoundaryDecision(
        should_reset=True,
        reason="daily",
        is_hard_boundary=True,
        boundary_time_utc=datetime(2026, 6, 19, 0, 0, tzinfo=timezone.utc),
        evidence={"at_hour_utc": 0},
    )

    payload = serialize_boundary_decision(decision)

    assert payload["should_reset"] is True
    assert payload["reason"] == "daily"
    assert payload["boundary_time_utc"] == "2026-06-19T00:00:00+00:00"
```

- [ ] **Step 2: Implement serializer**

In `hermes-agent/gateway/session_boundary.py`, add:

```python
def serialize_boundary_decision(decision: SessionBoundaryDecision) -> dict[str, Any]:
    return {
        "should_reset": decision.should_reset,
        "reason": decision.reason,
        "is_hard_boundary": decision.is_hard_boundary,
        "boundary_time_utc": (
            decision.boundary_time_utc.astimezone(timezone.utc).isoformat()
            if decision.boundary_time_utc
            else None
        ),
        "evidence": decision.evidence,
    }
```

- [ ] **Step 3: Log boundary decisions in gateway run path**

In `hermes-agent/gateway/run.py`, log non-empty decisions:

```python
logger.info(
    "session boundary decision session_key=%s decision=%s",
    session_key,
    serialize_boundary_decision(decision),
)
```

For privacy, do not log raw message text. Log only signature fields and evidence booleans.

- [ ] **Step 4: Run boundary tests**

Run:

```bash
pytest -q hermes-agent/tests/gateway/test_session_boundary_policy.py
```

Expected: PASS.

---

### Task 8: Document The Runtime Contract

**Files:**
- Modify: `docs/derived/gateway-unified-multitenant-design.md`
- Modify: `hermes-agent/cli-config.yaml.example`
- Test: documentation/search verification

- [ ] **Step 1: Add session-boundary contract section**

Add this section to `docs/derived/gateway-unified-multitenant-design.md`:

```markdown
### Session Boundary Policy

Gateway session continuity is based on deterministic source keys plus explicit
boundary policy. The source key identifies the outer conversation lane; it does
not imply that every user request in that lane belongs to the same task.

Hard reset boundaries are deterministic:

- explicit `/new` and `/reset`
- suspended session recovery
- inactivity timeout
- UTC daily reset, default midnight UTC
- platform/chat/thread/user source-key changes

Intent shift is a task-boundary signal. It may start a new session only when the
configured policy enables automatic high-confidence reset, the previous task is
complete or stale, the current request enters a configured high-risk domain,
and the detector evidence is logged. LLM-assisted classifiers must not be the
sole authority for identity, organization, permissions, or replay state.

Tool-specific deterministic guards remain mandatory. Calendar date resolution,
for example, must use platform inbound event time and timezone even when the
outer gateway session is reused.
```

- [ ] **Step 2: Add example config**

In `hermes-agent/cli-config.yaml.example`, update the `session_reset` example:

```yaml
session_reset:
  mode: both
  at_hour: 0          # Daily reset hour, 0-23 UTC
  idle_minutes: 1440  # Inactivity timeout
  notify: true
  intent_shift:
    enabled: false
    mode: advisory
    min_confidence: 0.85
    incomplete_task_stale_minutes: 1440
    high_risk_domains:
      - calendar
      - finance
      - identity
      - governance
```

- [ ] **Step 3: Verify stale wording is gone**

Run:

```bash
rg -n "local midnight|local time|at_hour.*local|intent shift" hermes-agent docs
```

Expected: no references describing session reset as local time. Intent-shift references should match the new policy language.

---

## Validation Commands

Run the focused suite:

```bash
pytest -q \
  hermes-agent/tests/gateway/test_session_boundary_policy.py \
  hermes-agent/tests/gateway/test_config.py \
  hermes-agent/tests/gateway/test_session_reset_notify.py \
  hermes-agent/tests/gateway/test_agent_cache.py \
  hermes-agent/tests/gateway/test_restart_resume_pending.py
```

Run the broader gateway suite before merge:

```bash
pytest -q hermes-agent/tests/gateway
```

Run compile checks for edited runtime files:

```bash
python -m py_compile \
  hermes-agent/gateway/config.py \
  hermes-agent/gateway/session.py \
  hermes-agent/gateway/session_boundary.py \
  hermes-agent/gateway/run.py
```

## Review Checklist

- [ ] Daily reset uses UTC consistently and defaults to midnight UTC.
- [ ] Inactivity timeout remains deterministic and timezone-aware.
- [ ] Existing explicit reset commands still work.
- [ ] Active background processes still suppress automatic reset.
- [ ] Intent shift is configurable and disabled/advisory by default.
- [ ] Intent-shift evidence is structured and does not log raw message text.
- [ ] LLM inference is not required for the default detector.
- [ ] Calendar/date-sensitive tools still use deterministic platform event time.
- [ ] Tests cover same Feishu DM with different meeting requests.
- [ ] Docs describe source session, task boundary, and deterministic guard separation.

## Open Design Decision For Review

The safest default is `intent_shift.enabled: false` and `mode: advisory`. For Feishu meeting workflows, we can enable `auto_high_confidence` only after we confirm the deterministic extractor and task-completion markers are stable enough. That keeps native Hermes behavior intact while giving Semantier a controlled path toward task isolation.
