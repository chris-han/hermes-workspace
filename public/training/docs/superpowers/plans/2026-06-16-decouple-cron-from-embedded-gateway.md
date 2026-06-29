# Decouple Cron From Embedded Gateway Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Semantier cron run as a workspace-aware scheduler service without starting a second Hermes gateway runner when the user is already inside a Feishu gateway.

**Architecture:** Extract cron ticking into a Semantier-owned service that can run independently of `GatewayRunner`. The Feishu gateway remains responsible for Feishu ingress/adapters; the Web/API runtime starts the cron ticker only when `SEMANTIER_ENABLE_CRON_TICKER=1`, and never starts embedded channel adapters just to make cron work.

**Tech Stack:** Python, FastAPI lifespan, Hermes `cron.scheduler.tick_known_homes`, pytest.

---

## File Structure

- Modify `src/agents/gateway.py`: replace unconditional embedded gateway startup in FastAPI lifespan with feature-flagged cron-service startup.
- Create `src/agents/hermes_cron_service.py`: own a process-local cron ticker thread that calls `cron.scheduler.tick_known_homes`, records status, retries import/tick failures, and fails strict shutdown if the thread does not stop.
- Do not modify `src/agents/hermes_embedded_gateway.py` for this refactor unless tests expose a direct dependency; embedded gateway remains available for explicit adapter operations only.
- Modify `src/agents/webapi_gateway.py`: keep reconnect/setup paths explicit when they truly need adapter startup; coordinator cron creation must not call embedded gateway.
- Test `tests/test_gateway_lifespan_cron_service.py`: prove FastAPI startup does not start cron by default, starts cron only when `SEMANTIER_ENABLE_CRON_TICKER=1`, and never starts embedded gateway.
- Test `tests/test_hermes_cron_service.py`: prove the new ticker calls `tick_known_homes`, binds no gateway runner, records degraded status on import/tick errors, and shuts down strictly.
- Test `tests/test_meeting_coordinator_webapi.py`: keep workspace plugin skill-path regression already added.

## Task 1: Add Standalone Cron Ticker Service

**Files:**
- Create: `src/agents/hermes_cron_service.py`
- Test: `tests/test_hermes_cron_service.py`

- [x] **Step 1: Write failing service tests**

Create `tests/test_hermes_cron_service.py`:

```python
from __future__ import annotations

import sys
import threading
import types


def test_cron_service_ticks_known_homes_without_gateway_runner(monkeypatch):
    from agents.hermes_cron_service import HermesCronTickerService

    calls = []
    tick_released = threading.Event()

    scheduler = types.ModuleType("cron.scheduler")

    def tick_known_homes(*, verbose=True, adapters=None, loop=None):
        calls.append({"verbose": verbose, "adapters": adapters, "loop": loop})
        tick_released.set()
        return 1

    scheduler.tick_known_homes = tick_known_homes
    monkeypatch.setitem(sys.modules, "cron.scheduler", scheduler)

    service = HermesCronTickerService(interval_seconds=0.01)
    service.start()
    assert tick_released.wait(timeout=2)
    service.shutdown()

    assert calls
    assert calls[0]["adapters"] is None
    assert calls[0]["loop"] is None


def test_cron_service_records_import_failure_and_retries(monkeypatch):
    from agents.hermes_cron_service import HermesCronTickerService

    attempts = {"count": 0}
    tick_released = threading.Event()

    def fake_import(name, globals=None, locals=None, fromlist=(), level=0):
        if name != "cron.scheduler":
            return real_import(name, globals, locals, fromlist, level)
        attempts["count"] += 1
        if attempts["count"] == 1:
            raise ImportError("scheduler unavailable")
        scheduler = types.ModuleType("cron.scheduler")
        scheduler.tick_known_homes = lambda **_kwargs: tick_released.set() or 0
        return scheduler

    real_import = __import__
    monkeypatch.setattr("builtins.__import__", fake_import)

    service = HermesCronTickerService(interval_seconds=0.01)
    service.start()
    assert tick_released.wait(timeout=2)
    service.shutdown()

    status = service.status()
    assert attempts["count"] >= 2
    assert status.last_error is None
    assert status.last_tick_at is not None


def test_cron_service_status_includes_exception_detail(monkeypatch):
    from agents.hermes_cron_service import HermesCronTickerService

    tick_attempted = threading.Event()

    scheduler = types.ModuleType("cron.scheduler")

    def tick_known_homes(**_kwargs):
        tick_attempted.set()
        raise RuntimeError("database locked")

    scheduler.tick_known_homes = tick_known_homes
    monkeypatch.setitem(sys.modules, "cron.scheduler", scheduler)

    service = HermesCronTickerService(interval_seconds=60)
    service.start()
    assert tick_attempted.wait(timeout=2)
    service.shutdown()

    status = service.status()
    assert status.last_error == "RuntimeError: database locked"
    assert status.last_tick_at is None


def test_cron_service_shutdown_raises_if_thread_stays_alive(monkeypatch):
    from agents.hermes_cron_service import HermesCronTickerService

    service = HermesCronTickerService(interval_seconds=60, shutdown_timeout_seconds=0.01)
    service._thread = type(
        "Thread",
        (),
        {
            "is_alive": lambda self: True,
            "join": lambda self, timeout=None: None,
        },
    )()

    try:
        service.shutdown()
    except RuntimeError as exc:
        assert "cron ticker thread did not stop" in str(exc)
    else:
        raise AssertionError("expected strict shutdown failure")


def test_cron_service_start_is_idempotent(monkeypatch):
    from agents.hermes_cron_service import HermesCronTickerService

    service = HermesCronTickerService(interval_seconds=10)
    fake_thread = type(
        "Thread",
        (),
        {
            "is_alive": lambda self: True,
        },
    )()
    service._thread = fake_thread
    service._last_tick_at = "2026-06-16T00:00:00Z"
    service._last_error = "RuntimeError: previous failure"

    status = service.start()

    assert service._thread is fake_thread
    assert status.running is True
    assert status.last_tick_at == "2026-06-16T00:00:00Z"
    assert status.last_error == "RuntimeError: previous failure"
```

- [x] **Step 2: Run tests to verify they fail**

Run:

```bash
pytest -q tests/test_hermes_cron_service.py
```

Expected: import failure for `agents.hermes_cron_service`.

- [x] **Step 3: Implement the service**

Create `src/agents/hermes_cron_service.py`:

```python
from __future__ import annotations

import logging
import threading
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class HermesCronStatus:
    running: bool
    last_tick_at: str | None = None
    last_error: str | None = None


class HermesCronTickerService:
    def __init__(
        self,
        *,
        interval_seconds: float = 60.0,
        shutdown_timeout_seconds: float = 5.0,
    ) -> None:
        self.interval_seconds = interval_seconds
        self.shutdown_timeout_seconds = shutdown_timeout_seconds
        self._stop_event = threading.Event()
        self._thread: threading.Thread | None = None
        self._lock = threading.Lock()
        self._status_lock = threading.Lock()
        self._last_tick_at: str | None = None
        self._last_error: str | None = None

    def start(self) -> HermesCronStatus:
        with self._lock:
            if self._thread is not None and self._thread.is_alive():
                return self.status()
            self._stop_event.clear()
            self._thread = threading.Thread(
                target=self._run,
                daemon=True,
                name="semantier-cron-ticker",
            )
            self._thread.start()
            return self.status()

    def shutdown(self) -> None:
        thread = self._thread
        self._stop_event.set()
        if thread is not None:
            thread.join(timeout=self.shutdown_timeout_seconds)
            if thread.is_alive():
                message = "Semantier cron ticker thread did not stop"
                logger.error(message)
                raise RuntimeError(message)
        self._thread = None

    def _set_status(
        self,
        *,
        last_tick_at: str | None = None,
        last_error: str | None = None,
    ) -> None:
        with self._status_lock:
            if last_tick_at is not None:
                self._last_tick_at = last_tick_at
            self._last_error = last_error

    def status(self) -> HermesCronStatus:
        thread = self._thread
        running = bool(thread is not None and thread.is_alive())
        with self._status_lock:
            return HermesCronStatus(
                running=running,
                last_tick_at=self._last_tick_at,
                last_error=self._last_error,
            )

    def _run(self) -> None:
        from datetime import datetime, timezone

        while not self._stop_event.is_set():
            try:
                from cron.scheduler import tick_known_homes

                tick_known_homes(verbose=False, adapters=None, loop=None)
                self._set_status(
                    last_tick_at=datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                    last_error=None,
                )
            except Exception as exc:
                error_text = f"{type(exc).__name__}: {exc}"
                self._set_status(last_error=error_text)
                logger.exception("Semantier cron ticker failed: %s", error_text)
            self._stop_event.wait(self.interval_seconds)


_SERVICE = HermesCronTickerService()


def get_hermes_cron_ticker_service() -> HermesCronTickerService:
    return _SERVICE
```

- [x] **Step 4: Run tests to verify they pass**

Run:

```bash
pytest -q tests/test_hermes_cron_service.py
```

Expected: pass.

## Task 2: Gate FastAPI Cron Startup and Stop Embedded Gateway Startup

**Files:**
- Modify: `src/agents/gateway.py`
- Test: `tests/test_gateway_lifespan_cron_service.py`

- [x] **Step 1: Write failing lifespan test**

Create `tests/test_gateway_lifespan_cron_service.py`:

```python
from __future__ import annotations

from fastapi.testclient import TestClient


def test_fastapi_lifespan_does_not_start_cron_or_embedded_gateway_by_default(monkeypatch):
    from agents import gateway

    calls = []

    class FakeCronService:
        def start(self):
            calls.append("cron_start")

        def shutdown(self):
            calls.append("cron_shutdown")

    class FakeGatewayService:
        async def ensure_started(self):
            calls.append("gateway_started")

        async def shutdown(self):
            calls.append("gateway_shutdown")

    class FakeApiService:
        async def shutdown(self):
            calls.append("api_shutdown")

    monkeypatch.setattr(
        "agents.hermes_cron_service.get_hermes_cron_ticker_service",
        lambda: FakeCronService(),
    )
    monkeypatch.setattr(
        "agents.hermes_embedded_gateway.get_embedded_hermes_gateway_service",
        lambda: FakeGatewayService(),
    )
    monkeypatch.setattr(
        "agents.hermes_embedded_api.get_embedded_hermes_api_service",
        lambda: FakeApiService(),
    )
    monkeypatch.delenv("SEMANTIER_ENABLE_CRON_TICKER", raising=False)

    with TestClient(gateway.create_app()):
        pass

    assert calls == ["api_shutdown"]


def test_fastapi_lifespan_starts_cron_only_when_enabled(monkeypatch):
    from agents import gateway

    calls = []

    class FakeCronService:
        def start(self):
            calls.append("cron_start")

        def shutdown(self):
            calls.append("cron_shutdown")

    class FakeGatewayService:
        async def ensure_started(self):
            calls.append("gateway_started")

        async def shutdown(self):
            calls.append("gateway_shutdown")

    class FakeApiService:
        async def shutdown(self):
            calls.append("api_shutdown")

    monkeypatch.setattr(
        "agents.hermes_cron_service.get_hermes_cron_ticker_service",
        lambda: FakeCronService(),
    )
    monkeypatch.setattr(
        "agents.hermes_embedded_gateway.get_embedded_hermes_gateway_service",
        lambda: FakeGatewayService(),
    )
    monkeypatch.setattr(
        "agents.hermes_embedded_api.get_embedded_hermes_api_service",
        lambda: FakeApiService(),
    )
    monkeypatch.setenv("SEMANTIER_ENABLE_CRON_TICKER", "1")

    with TestClient(gateway.create_app()):
        pass

    assert calls == ["cron_start", "cron_shutdown", "api_shutdown"]


def test_fastapi_lifespan_logs_cron_shutdown_failure_and_continues(monkeypatch, caplog):
    from agents import gateway

    calls = []

    class FakeCronService:
        def start(self):
            calls.append("cron_start")

        def shutdown(self):
            calls.append("cron_shutdown")
            raise RuntimeError("Semantier cron ticker thread did not stop")

    class FakeApiService:
        async def shutdown(self):
            calls.append("api_shutdown")

    class FakeGatewayService:
        async def ensure_started(self):
            calls.append("gateway_started")

        async def shutdown(self):
            calls.append("gateway_shutdown")

    monkeypatch.setattr(
        "agents.hermes_cron_service.get_hermes_cron_ticker_service",
        lambda: FakeCronService(),
    )
    monkeypatch.setattr(
        "agents.hermes_embedded_gateway.get_embedded_hermes_gateway_service",
        lambda: FakeGatewayService(),
    )
    monkeypatch.setattr(
        "agents.hermes_embedded_api.get_embedded_hermes_api_service",
        lambda: FakeApiService(),
    )
    monkeypatch.setenv("SEMANTIER_ENABLE_CRON_TICKER", "1")

    with TestClient(gateway.create_app()):
        pass

    assert calls == ["cron_start", "cron_shutdown", "api_shutdown"]
    assert "cron ticker shutdown failed" in caplog.text
```

- [x] **Step 2: Run test to verify it fails**

Run:

```bash
pytest -q tests/test_gateway_lifespan_cron_service.py
```

Expected: failure because current lifespan calls `gateway_started`.

- [x] **Step 3: Update FastAPI lifespan**

Modify `src/agents/gateway.py` lifespan to:

```python
    def _cron_ticker_enabled() -> bool:
        value = os.environ.get("SEMANTIER_ENABLE_CRON_TICKER", "").strip().lower()
        return value in {"1", "true", "yes", "on"}


    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        cron_service = None
        if _cron_ticker_enabled():
            from agents.hermes_cron_service import get_hermes_cron_ticker_service

            cron_service = get_hermes_cron_ticker_service()
            cron_service.start()
        try:
            yield
        finally:
            from agents.hermes_embedded_api import get_embedded_hermes_api_service

            if cron_service is not None:
                try:
                    cron_service.shutdown()
                except Exception:
                    logging.getLogger(__name__).exception("cron ticker shutdown failed")
            await get_embedded_hermes_api_service().shutdown()
```

Add `import logging` and `import os` to `src/agents/gateway.py`. Do not call `get_embedded_hermes_gateway_service().ensure_started()` from this lifespan.

- [x] **Step 4: Run lifespan test**

Run:

```bash
pytest -q tests/test_gateway_lifespan_cron_service.py
```

Expected: pass.

## Task 3: Keep Explicit Adapter Startup Only Where Needed

**Files:**
- Modify: `src/agents/webapi_gateway.py`
- Test: `tests/test_meeting_coordinator_webapi.py`
- Test: `tests/test_gateway_lifespan_cron_service.py`

- [x] **Step 1: Audit adapter startup callers**

Run:

```bash
rg -n "ensure_started\\(|_restart_embedded_gateway_for_|get_embedded_hermes_gateway_service" src tests
```

Expected callers that remain valid:
- Weixin reconnect/setup paths.
- Feishu account setup/reconnect paths if they intentionally start a channel adapter.
- Tests that directly cover embedded gateway behavior.

- [x] **Step 2: Add a coordinator guard test**

Add to `tests/test_meeting_coordinator_webapi.py`:

```python
def test_meeting_coordinator_routes_do_not_start_embedded_gateway(authenticated_client, monkeypatch):
    calls = []

    class FakeStore:
        def get_workspace_state(self, workspace_id):
            return {
                "workspace_id": workspace_id,
                "delivery_retry_scheduler_status": "ok",
                "delivery_retry_scheduler_detail": None,
                "updated_at": None,
            }

        def list_non_terminal_delivery_tasks(self, *, workspace_id, limit):
            return []

        def list_operation_monitors(self, *, workspace_id, limit):
            return []

        def list_operation_delivery_tasks(self, *, workspace_id, limit):
            return []

    async def forbidden_start(*_args, **_kwargs):
        calls.append("gateway_started")

    monkeypatch.setattr(
        "agents.meeting_coordinator_store.MeetingCoordinatorStore",
        lambda: FakeStore(),
    )
    monkeypatch.setattr(
        "agents.hermes_embedded_gateway.get_embedded_hermes_gateway_service",
        lambda: type("Svc", (), {"ensure_started": forbidden_start})(),
    )

    response = authenticated_client.get("/system/meeting-coordinator/monitors")

    assert response.status_code == 200
    assert calls == []
```

- [x] **Step 3: Run coordinator Web API tests**

Run:

```bash
pytest -q tests/test_meeting_coordinator_webapi.py
```

Expected: pass.

- [x] **Step 4: Add global non-adapter route invariant**

Add to `tests/test_gateway_lifespan_cron_service.py`:

```python
def test_runtime_lifespan_never_starts_embedded_gateway_for_non_adapter_routes(monkeypatch):
    from agents import gateway

    calls = []

    class FakeGatewayService:
        async def ensure_started(self):
            calls.append("gateway_started")

        async def shutdown(self):
            calls.append("gateway_shutdown")

    class FakeCronService:
        def start(self):
            calls.append("cron_start")

        def shutdown(self):
            calls.append("cron_shutdown")

    class FakeApiService:
        async def shutdown(self):
            calls.append("api_shutdown")

    monkeypatch.setattr(
        "agents.hermes_cron_service.get_hermes_cron_ticker_service",
        lambda: FakeCronService(),
    )
    monkeypatch.setattr(
        "agents.hermes_embedded_gateway.get_embedded_hermes_gateway_service",
        lambda: FakeGatewayService(),
    )
    monkeypatch.setattr(
        "agents.hermes_embedded_api.get_embedded_hermes_api_service",
        lambda: FakeApiService(),
    )
    monkeypatch.setenv("SEMANTIER_ENABLE_CRON_TICKER", "1")

    with TestClient(gateway.create_app()) as client:
        response = client.get("/gateway/channels")

    assert response.status_code in {200, 401, 403}
    assert "gateway_started" not in calls
```

Run:

```bash
pytest -q tests/test_gateway_lifespan_cron_service.py
```

Expected: pass.

## Task 4: Preserve Workspace Plugin Skill Resolution

**Files:**
- Modify: `src/agents/webapi_gateway.py`
- Test: `tests/test_meeting_coordinator_webapi.py`

- [x] **Step 1: Keep existing regression tests**

These tests must remain and pass:

```bash
pytest -q \
  tests/test_meeting_coordinator_webapi.py::test_meeting_coordinator_cron_client_uses_workspace_plugin_skill_path \
  tests/test_meeting_coordinator_webapi.py::test_meeting_coordinator_cron_client_heals_existing_bare_skill_job
```

Expected: pass.

- [x] **Step 2: Verify job payload shape manually**

Run a small local smoke test after plugin install:

```bash
sqlite3 .semantier-home/state.db \
  "select payload_json from semantier_cron_jobs where payload_json like '%meeting-rsvp-monitor%' limit 1;"
```

Expected `skills` contains an absolute path ending in:

```text
workspaces/<workspace_id>/.hermes/plugins/feishu_meeting_coordinator
```

## Task 5: Full Verification

**Files:**
- No code changes.

- [x] **Step 1: Run focused Python tests**

Run:

```bash
pytest -q \
  tests/test_hermes_cron_service.py \
  tests/test_gateway_lifespan_cron_service.py \
  tests/test_meeting_coordinator_webapi.py \
  tests/test_meeting_coordinator_gateway.py \
  tests/test_agents_launcher.py \
  tests/test_marketplace_plugin_install.py
```

Expected: pass.

- [x] **Step 2: Runtime check in Feishu mode**

Start only the Feishu gateway flow, then inspect process and thread list:

```bash
ps -eLf | rg "gateway run|semantier-embedded-cron|semantier-cron-ticker"
```

Expected:
- One Feishu gateway process.
- If `SEMANTIER_ENABLE_CRON_TICKER=1`, one `semantier-cron-ticker` thread inside the active runtime process.
- If `SEMANTIER_ENABLE_CRON_TICKER` is unset, no `semantier-cron-ticker` thread.
- No extra Semantier embedded `GatewayRunner` started by FastAPI just for cron.

## Self-Review

- Spec coverage: separates Feishu gateway ingress/adapters from cron ticking; preserves automatic cron execution only when `SEMANTIER_ENABLE_CRON_TICKER=1`; keeps workspace plugin skill path resolution.
- Observability coverage: `last_error` includes exception class and message, `start()` returns the same full status shape as `status()`, and status fields are guarded by `_status_lock`.
- Shutdown coverage: the cron service itself fails strict shutdown, while FastAPI lifespan logs cron shutdown failure and still shuts down the embedded API service.
- Placeholder scan: no TBD/TODO placeholders.
- Type consistency: service method names are `start()`, `shutdown()`, and `get_hermes_cron_ticker_service()` throughout.
