# Unified Runtime Message Flow And Port Mapping

## Scope

This document unifies the runtime architecture view across:

- Hermes Workspace (web UI)
- Weixin channel
- Feishu channel
- Semantier agent wrapper (public ingress)
- Hermes-agent runtime components (embedded under Semantier runtime)

It clarifies end-to-end message flow and exact port responsibilities.

## Deployment mode

This repository's active architecture is integrated Semantier runtime mode:

- Public ingress is Semantier wrapper on `:8899`.
- Hermes gateway runtime is embedded in-process under `semantier run`.
- Embedded startup disables Hermes `api_server` platform listener.
- Standalone Hermes API-server mode is not part of the active Semantier runtime contract.

## Original Unified component flow (upstream Hermes-agent)

```mermaid
flowchart LR
    subgraph Clients[Client and channel ingress]
        APIClient[OpenAI-compatible client\nHTTP to api_server]
        FX[Feishu channel]
        WX[Weixin channel]
    end

    subgraph Hermes[Single hermes gateway run process]
        GR[GatewayRunner]
        APIS[api_server adapter\nHTTP listener default :8642]
        FEA[Feishu adapter\nwebhook or websocket]
        WXA[Weixin adapter\nlong-poll getupdates]
        AG[AIAgent core]
    end

    OSTATE[(Hermes runtime state\n~/.hermes state.db and sessions)]

    APIClient --> APIS
    FX --> FEA
    WX --> WXA

    APIS --> GR
    FEA --> GR
    WXA --> GR

    GR --> AG
    GR --> OSTATE
    AG --> OSTATE

    style GR fill:#fff7ed,stroke:#ea580c,stroke-width:2px
    style APIS fill:#fef3c7,stroke:#d97706,stroke-width:1px
```

## Unified component flow (Semantier integrated)

```mermaid
flowchart LR
    subgraph Clients[Client and channel ingress]
        HW[Hermes Workspace UI\n:3000 or :3300]
        FX[Feishu channel]
        WX[Weixin channel]
    end

    subgraph Semantier[Semantier agent wrapper]
        SW[Semantier Runtime API\nPublic ingress :8899\n/api/* /v1/* /sessions]
        GOV["Governance and identity resolution<br/>org and workspace authority"]
    end

    subgraph Hermes[Hermes-agent runtime]
        EG[Embedded GatewayRunner\ninside semantier run]
        FEA[Feishu adapter\nwebhook default :8765 or websocket]
        WXA[Weixin adapter\nlong-poll getupdates]
        AG[AIAgent core]
    end

    PSTORE[(.semantier-home platform state\neos.db auth.db etc.)]
    HSTATE[(workspaces/<workspace_id>/.hermes/sessions\ncanonical session artifacts)]
    SDB[(.semantier-home/state.db\nshared SessionDB cache/index)]
    KDB[(.semantier-home/kanban.db\nshared Kanban queue\nuser_id/workspace_id segments)]

    HW -->|SEMANTIER_AGENT_API_URL| SW
    SW --> GOV
    SW --> EG

    FX --> FEA
    WX --> WXA
    FEA --> EG
    WXA --> EG
    EG --> AG

    EG --> GOV
    EG --> PSTORE
    SW --> PSTORE
    EG --> HSTATE
    EG --> SDB
    EG --> KDB

    style SW fill:#e8f3ff,stroke:#2563eb,stroke-width:2px
    style EG fill:#fff7ed,stroke:#ea580c,stroke-width:2px
```

## Design comparison: upstream api_server adapter vs Semantier Runtime API

This section compares architectural roles, not only HTTP shape.

| Dimension | Upstream Hermes `api_server` adapter | Semantier Runtime API wrapper | Design delta |
|---|---|---|---|
| Primary role | Transport adapter under gateway platforms | Canonical public ingress for integrated runtime | Major |
| Runtime placement | Inside `hermes gateway run` adapter set | Wrapper layer that embeds/controls Hermes gateway lifecycle | Major |
| Endpoint scope | OpenAI-compatible and gateway run/status endpoints | OpenAI-compatible routes plus Semantier web/session/org/auth/messaging/governance surfaces | Major |
| Identity and organization authority | Not the primary authority resolution boundary | First-class authority resolution boundary (org/workspace/user context) | Major |
| Governance responsibility | Downstream execution path | Direct ingress responsibility plus downstream orchestration | Major |
| Store interaction pattern | Primarily Hermes home runtime state | Split between shared platform state (`.semantier-home`) and workspace Hermes state (`workspaces/<workspace_id>/.hermes`) | Moderate to major |
| Port contract in this repository | Adapter default listener model (`:8642`) | Integrated ingress contract on `:8899`; embedded startup disables `api_server` listener | Major |

Overall conclusion for this repository: the difference is substantial (architectural, not cosmetic), so current integrated Semantier runtime mode keeps the wrapper as the system ingress boundary.

## Message flow sequences

### A) Hermes Workspace web request

```mermaid
sequenceDiagram
    participant U as User Browser
    participant W as Hermes Workspace UI
    participant S as Semantier wrapper :8899
    participant G as Embedded Hermes runtime

    U->>W: Open app and send chat message
    W->>S: POST /v1/chat/completions (or /api/*)
    S->>G: Route into Hermes-compatible runtime surface
    G-->>S: Tool and model response
    S-->>W: Normalized API response
    W-->>U: Render assistant output
```

### B) Feishu inbound event

```mermaid
sequenceDiagram
    participant F as Feishu platform
    participant A as Hermes Feishu adapter
    participant G as Embedded Hermes runtime
    participant S as Semantier wrapper

    F->>A: Webhook event (default :8765) or websocket event
    A->>G: Normalize to gateway MessageEvent
    G->>S: Execute through Semantier-governed runtime path
    S-->>G: Governed response payload
    G->>A: Outbound message instruction
    A-->>F: Send reply to Feishu
```

### C) Weixin inbound polling cycle

```mermaid
sequenceDiagram
    participant WXP as Weixin iLink API
    participant A as Hermes Weixin adapter
    participant G as Embedded Hermes runtime
    participant S as Semantier wrapper

    A->>WXP: Long-poll getupdates
    WXP-->>A: New message payload
    A->>G: Normalize to gateway MessageEvent
    G->>S: Execute through Semantier-governed runtime path
    S-->>G: Governed response payload
    G->>A: Outbound message instruction
    A->>WXP: sendmessage
```

## Port mapping

| Surface | Default port | Used in integrated `semantier run` mode | Notes |
|---|---:|---|---|
| Hermes Workspace UI | `3000` (or `3300` in Dokploy workspace container) | Yes | Browser-facing UI server |
| Semantier wrapper ingress | `8899` | Yes (primary public API) | Exposes Semantier and Hermes-compatible web routes |
| Feishu webhook listener | `8765` | Optional (when Feishu webhook mode enabled) | Feishu can also run websocket transport |
| Weixin adapter ingress | N/A (long-poll client) | Yes when enabled | Uses outbound polling to iLink endpoints |

## Current repository contracts

- Dokploy compose path uses `SEMANTIER_AGENT_API_URL=http://backend:8899` and keeps backend internal on `:8899`.
- `semantier run` starts embedded gateway lifecycle on app startup.
- Embedded gateway startup disables Hermes `api_server` adapter listener by default.
- Integrated Semantier deployments do not require publishing `8642`.

## Source anchors

- `deploy/dokploy/docker-compose.yml`
- `hermes-workspace/docker-compose.yml`
- `how-to-run.md`
- `src/agents/gateway.py`
- `src/agents/hermes_embedded_gateway.py`
- `src/agents/launcher.py`
- `hermes-agent/gateway/platforms/api_server.py`
- `hermes-agent/gateway/platforms/feishu.py`
- `hermes-agent/gateway/platforms/weixin.py`
