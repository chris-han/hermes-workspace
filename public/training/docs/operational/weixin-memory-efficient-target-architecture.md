# Weixin Memory-Efficient Target Architecture

Status: implementation sketch for this repository. This note refines the direction in [gateway-unified-multitenant-design.md](../derived/gateway-unified-multitenant-design.md), [architecture.md](../canonical/architecture.md), and [refactoring_plan_multi_adapter_gateway_runtime.md](../refactoring_plan_multi_adapter_gateway_runtime.md). If this note conflicts with the canonical runtime contract, preserve the canonical docs.

## Goal

Support many concurrently connected Weixin accounts without:

- a single reconnect disconnecting unrelated users
- one full `GatewayRunner` per account
- duplicating runner-wide caches and queues per Weixin account

The target is not `platform-singleton` and not `runner-per-account`.
The target is:

- shared control plane and shared message lane
- `adapter_key`-scoped transport runtimes
- session-scoped execution state

Canonical adapter identity:

```text
adapter_key = platform + workspace_id + account_id
```

For Weixin:

```text
weixin:<workspace_id>:<account_id>
```

## Design Summary

### Keep singleton

These should remain process-wide or service-wide:

- Semantier auth/governance authority:
  - `.semantier-home/auth.db`
  - `gateway_correlations`
  - `weixin_runtime_accounts`
  - request auth resolution in `src/agents/webapi_gateway.py`
- Shared embedded gateway supervisor:
  - `src/agents/hermes_embedded_gateway.py`
  - owns adapter registry, lifecycle coordination, reconnect policy, telemetry
- Shared `GatewayRunner` message lane:
  - one runner for routing inbound events into the common agent/session pipeline
  - one `SessionStore` for canonical session metadata
  - one `DeliveryRouter` control plane
- Shared background maintenance:
  - agent idle sweeps
  - cache cleanup
  - session pruning
  - restart/shutdown orchestration
- Shared provider/model config authority:
  - `.semantier-home/config.yaml`
  - `gateway.run` config-home binding logic

### Make `adapter_key` scoped

These must become per-account runtime objects:

- Weixin transport connection state
  - token
  - poll task
  - reconnect backoff state
  - send/poll `aiohttp.ClientSession`
- Weixin runtime health state
  - `pending | active | reconnecting | degraded | stopping | stopped`
- Weixin transport caches keyed by account/peer
  - sync cursor
  - context token cache
  - typing ticket cache
  - dedup cache
- Reconnect locks and swap state
  - no platform-wide `Platform.WEIXIN` cutover
  - reconnect only replaces `adapter_key`

### Move from runner-global to session-global

Current `GatewayRunner` caches are safe when there is one runner, but become wasteful or wrong if the transport layer is split. The following should stay shared across the message lane and be keyed by canonical session identity, not by adapter instance:

- live agent cache
  - current: `GatewayRunner._agent_cache`
  - target: shared session execution cache keyed by canonical `session_key`
- running-agent registry
  - current: `GatewayRunner._running_agents`
  - target: shared session execution map keyed by canonical `session_key`
- pending/queued message buffers
  - current: `_pending_messages`, `_queued_events`
  - target: session-scoped queue state in shared runner/supervisor
- busy ack / interrupt / generation state
  - current: `_busy_ack_ts`, `_session_run_generation`
  - target: session-scoped execution bookkeeping
- session source cache
  - current: `_session_sources`
  - target: canonical session-source map independent from which Weixin adapter delivered the turn
- session-level overrides
  - current: `_session_model_overrides`, `_session_reasoning_overrides`, voice-mode chat state
  - target: canonical session state, not adapter-local state

The rule is:

- transport lifecycle state belongs to `adapter_key`
- agent execution state belongs to canonical session

## Current Repo Mapping

### Components that should stay shared

- [src/agents/hermes_embedded_gateway.py](/home/chris/repo/semantier-runtime/src/agents/hermes_embedded_gateway.py)
  - becomes the adapter supervisor and registry owner
- [hermes-agent/gateway/run.py](/home/chris/repo/semantier-runtime/hermes-agent/gateway/run.py)
  - remains the shared message-lane runner
- [hermes-agent/gateway/session.py](/home/chris/repo/semantier-runtime/hermes-agent/gateway/session.py)
  - remains canonical session resolution logic
- [src/agents/weixin_ingress_identity.py](/home/chris/repo/semantier-runtime/src/agents/weixin_ingress_identity.py)
  - remains authority-side owner/workspace resolver
- [src/agents/gateway_identity.py](/home/chris/repo/semantier-runtime/src/agents/gateway_identity.py)
  - remains governed binding/correlation authority

### Components that should be split by `adapter_key`

- [hermes-agent/gateway/platforms/weixin.py](/home/chris/repo/semantier-runtime/hermes-agent/gateway/platforms/weixin.py)
  - replace implicit platform-singleton assumptions with account-scoped runtime objects
- live registry
  - previous token/process-scoped live adapter maps were unsafe for multitenant reconnect
  - implemented state uses registry entries keyed by `adapter_key`
- reconnect entrypoints in [src/agents/webapi_gateway.py](/home/chris/repo/semantier-runtime/src/agents/webapi_gateway.py)
  - route to one adapter registry entry, not to `Platform.WEIXIN` globally

## Required Shape

### 1. Shared runner + adapter supervisor

Process layout:

```text
EmbeddedHermesGatewayService
  - shared GatewayRunner
  - adapter registry[adapter_key]
  - adapter supervisor tasks[adapter_key]
  - reconnect locks[adapter_key]
```

The shared `GatewayRunner` is the only owner of:

- canonical `SessionStore`
- shared `DeliveryRouter`
- session execution caches
- shared run-level maintenance tasks

The adapter supervisor owns:

- connect/disconnect of a specific Weixin account
- health checks for that account
- token refresh / reconnect for that account
- emitting inbound messages from that account into the shared runner

### 2. Adapter runtime boundary

Each Weixin adapter runtime should contain only transport concerns:

- account credentials already resolved from governed state
- long-poll loop
- send API client
- context token state for that account
- dedup and typing caches for that account
- adapter-local metrics

It should not own:

- its own `GatewayRunner`
- its own `SessionStore`
- its own `_agent_cache`
- its own session interrupt/queue state

### 3. Inbound event handoff

Inbound flow:

```text
Weixin adapter runtime(adapter_key)
  -> resolve workspace owner identity
  -> build SessionSource with workspace_owner_id
  -> hand event into shared GatewayRunner.handle_message(...)
  -> shared runner resolves canonical session and executes
```

This preserves the architecture contract:

- ownership comes from governed identity resolution
- transport is only input
- session continuity remains channel-agnostic

### 4. Outbound routing

Outbound responses must be routed by canonical session source or explicit delivery target, not by `platform` alone.

Required lookup order:

1. canonical session source
2. source metadata including `adapter_key`
3. explicit delivery target

The `DeliveryRouter` needs an adapter selection surface like:

```text
resolve_adapter(platform, adapter_key=None, source=None)
```

not only:

```text
adapters[Platform.WEIXIN]
```

## Cache Migration Plan

### A. Keep shared, keyed by session

These should remain in the shared runner or a shared session execution manager:

- `_agent_cache`
- `_running_agents`
- `_queued_events`
- `_pending_messages`
- `_busy_ack_ts`
- `_session_run_generation`
- `_session_sources`
- session-level override maps

Key:

```text
session_key or canonical session_id
```

Reason:

- one user may reconnect or switch transport runtime without losing execution context
- identical session should not duplicate LLM/memory/tool state per adapter

### B. Keep adapter-scoped

These stay attached to the Weixin transport runtime:

- `_poll_session`
- `_send_session`
- `_poll_task`
- `_transport_reconnect_lock`
- context token store in-memory hot cache
- typing ticket cache
- message dedup cache
- session-expired counters

Key:

```text
adapter_key + peer/chat identifiers
```

Reason:

- these objects are transport/session-token specific, not semantic-session specific

### C. Persisted operational state

Persist operational Weixin state centrally in `.semantier-home/auth.db`, but keyed so multiple accounts can coexist safely:

- `weixin_runtime_accounts`
- `weixin_sync_state`
- `weixin_context_tokens`

Every row must include enough key material to avoid account collision:

- `account_id`
- `owner_workspace_id`
- if needed, derived `adapter_key`

## Anti-Patterns To Avoid

Do not use these patterns for Weixin multitenancy:

- one full `GatewayRunner` per account as the long-term architecture
  - duplicates agent caches, session store, maintenance loops
- one process-global `Platform.WEIXIN` adapter slot
  - reconnect for one account disconnects all accounts
- process-global env as live authority for account routing
  - `WEIXIN_TOKEN`, `WEIXIN_ACCOUNT_ID`, `WEIXIN_HOME_CHANNEL`
  - acceptable only as bootstrap compatibility inputs, not runtime routing truth
- adapter-local ownership/session authority
  - owner/workspace binding must stay in Semantier governed resolution paths

## Memory-Efficient Scaling Model

Target memory growth should be:

- O(active canonical sessions) for agent execution state
- O(active connected Weixin accounts) for transport state

It should not be:

- O(active accounts * runner caches)

That means:

- connecting 500 accounts should add 500 transport runtimes
- it should not add 500 separate `_agent_cache` pools, 500 session stores, 500 shared maintenance loops

## Suggested Code Refactor Sequence

1. Introduce `AdapterRegistry` in `src/agents/hermes_embedded_gateway.py`
   - owns `adapter_key -> adapter runtime`
2. Keep one shared `GatewayRunner`
   - no per-account runner in steady state
3. Refactor Weixin adapter connect/send/poll logic into a transport runtime object
   - callable by supervisor
4. Add adapter-aware outbound routing
   - shared runner can reply through the correct Weixin account
5. Move any remaining runner-local mutable state that should survive adapter swap to session-scoped shared stores
6. Add regression tests:
   - reconnect A does not disconnect B
   - session continuity survives adapter swap
   - outbound reply after reconnect still uses correct account
   - memory-sensitive caches stay shared by session, not duplicated per account

## Minimal Acceptance Criteria

- One Weixin reconnect affects only one `adapter_key`
- Shared runner remains alive during targeted reconnect
- Session cache and agent reuse remain keyed by canonical session
- Outbound delivery resolves the correct Weixin account after reconnect
- No runtime path requires `adapters[Platform.WEIXIN]` as the only Weixin lookup
- `.semantier-home/auth.db` remains authority-adjacent operational persistence, not LLM-derived identity truth

## Implementation Appendix

This appendix now describes the implemented direct cutover model. There is no
mixed-mode runtime contract in this repo state.

### A. Implemented topology

Current and target repo state:

- one shared `GatewayRunner` message lane for Weixin/Feishu/Web/API session
  execution
- zero long-lived per-account `GatewayRunner` instances for Weixin
- one managed Weixin transport runtime per `adapter_key`
- adapter-aware outbound routing that does not depend on `platform` alone
- no reconnect path depends on a token/process-scoped live adapter map

### B. Cutover contract

The cutover model is direct shared-runner ownership:

- all active Weixin accounts run as supervisor-managed transport adapters
- reconnect replaces only one `adapter_key`
- reconnect rollback is allowed only for same-account replacement failure
- historical sessions without adapter metadata remain readable, but outbound
  delivery must resolve a concrete `delivery_adapter_key` before send
- ambiguous Weixin delivery resolution fails closed

### C. Schema and API delta list

#### 1. `SessionSource`

Add fields to [hermes-agent/gateway/session.py](/home/chris/repo/semantier-runtime/hermes-agent/gateway/session.py):

```python
adapter_key: Optional[str] = None
delivery_adapter_key: Optional[str] = None
```

Definitions:

- `adapter_key`: the inbound transport runtime that delivered the current turn
- `delivery_adapter_key`: the preferred outbound runtime for replies in the
  canonical session

Rules:

- for Weixin, newly created session sources must set both fields on ingress
- for non-Weixin gateways, both fields may remain `None`
- `delivery_adapter_key` defaults to `adapter_key` when first bound unless an
  explicit delivery override changes it

#### 2. Session persistence

Persist `adapter_key` on canonical session metadata and trajectory rows.

Required surfaces:

- workspace session alias/session metadata persisted via
  `src/agents/workspace_session_logs.py`
- trajectory append records in the canonical session trajectory file

New optional persisted fields:

```json
{
  "adapter_key": "weixin:<workspace_id>:<account_id>|null",
  "delivery_adapter_key": "weixin:<workspace_id>:<account_id>|null"
}
```

Compatibility:

- historical sessions may omit these fields
- absence must not rewrite canonical session identity
- absence only affects outbound adapter selection fallback

#### 3. Replay compatibility

Replay and audit semantics remain session-centric.

Rules:

- `adapter_key` is operational metadata only
- replay must not require live adapter resolution
- historical sessions without `adapter_key` remain replayable because the
  canonical session contract is still `session_id`-based

### D. Deterministic fallback when `adapter_key` is absent

Historical sessions may not carry `adapter_key`. Outbound delivery must use a
deterministic fallback chain.

For Weixin sessions:

1. use `delivery_adapter_key` if present
2. else use `adapter_key` if present
3. else resolve by active governed binding for the canonical session owner:
   `workspace_owner_id + platform=weixin`
4. if exactly one active Weixin account exists for that owner/workspace, use it
5. if multiple active accounts exist, prefer the account whose `home_channel`
   or correlated chat binding matches the canonical session source
6. if still ambiguous, fail closed and mark the session as needing rebind

The fallback must be deterministic and must not depend on iteration order of
live adapter maps.

### E. Outbound routing implementation contract

The target routing surface is:

```text
resolve_adapter(platform, adapter_key=None, source=None, session_id=None)
```

Required implementation changes:

- `GatewayRunner.adapters` remains platform-indexed only for non-multitenant
  adapters during migration
- Weixin routing must no longer rely on `self.adapters[Platform.WEIXIN]` as the
  only lookup path
- `DeliveryRouter` must call back into the shared supervisor/registry for
  adapter-key resolution

### F. Measurable rollout gates

Functional acceptance is not sufficient. Rollout requires hard numeric gates.

#### Memory

- max RSS delta per additional connected Weixin account in shared-lane mode:
  `<= 3 MiB/account` at steady idle after warmup
- max RSS delta when reconnecting one account with 50 sibling connected accounts:
  `<= 15 MiB` transient and returns within 5 minutes

#### Latency

- p95 inbound queue-to-dispatch latency under 100 concurrent active Weixin
  accounts: `<= 250 ms`
- p99 outbound adapter resolution latency: `<= 25 ms`
- p95 reconnect cutover time for one account: `<= 5 s`

#### Blast radius

- under 50 connected sibling accounts, reconnecting one account causes:
  - `0` sibling disconnects
  - `0` sibling session resets
  - `0` sibling outbound misroutes in the test window

#### Regression safety

- shared session cache hit rate for repeated turns in the same canonical session
  must not regress by more than `10%` relative to pre-migration baseline
- no increase in cross-workspace session leakage findings
- no replay/audit path may gain a live dependency

### G. Required test matrix

Add explicit tests for:

- `SessionSource` with and without `adapter_key`
- persistence round-trip of `adapter_key` / `delivery_adapter_key`
- deterministic fallback when historical sessions lack `adapter_key`
- reconnect of one account during concurrent traffic on sibling accounts
- outbound reply after reconnect selects the same `delivery_adapter_key`
### H. Direct implementation verdict

This design is implementation-ready only when the PR also includes:

- `SessionSource` and persistence schema deltas
- deterministic historical fallback semantics
- numeric rollout thresholds and tests

Without those pieces, the note is architectural direction only, not an
executable migration contract.

## Short Conclusion

For this repo, the memory-efficient target is:

- singleton Semantier authority and shared message lane
- `adapter_key`-scoped Weixin transport runtimes
- session-global execution caches

This gives the required multitenant isolation without paying the memory cost of one full `GatewayRunner` per connected account.
