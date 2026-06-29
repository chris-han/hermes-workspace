# Dokploy Two-Container Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy this repository to Dokploy as two containers: a Semantier backend built from `src/` plus the local `hermes-agent` dependency, and a `hermes-workspace` frontend that talks only to that backend using `SEMANTIER_AGENT_API_URL` as the single backend URL variable.

**Architecture:** Keep the existing repo boundaries intact. The backend container owns the Semantier runtime, embedded Hermes API, and persistent `.semantier-home` state on port `8899`; the frontend container owns the workspace SSR/UI on port `3000` and is refactored to resolve its backend exclusively from `SEMANTIER_AGENT_API_URL`. No folder refactor is required, so do not create branch `5-18` unless implementation scope expands into structural moves.

**Tech Stack:** Dokploy Docker Compose, Python 3.12, FastAPI/Uvicorn, local editable dependency `hermes-agent`, Node 22, pnpm, TanStack Start SSR

**Dokploy Behavior Verified:** As of 2026-05-20, the live Dokploy service at `docker.semantier.com` is already configured as a **Docker Compose** app named `semantier` in the `production` environment, sourced from `git@github.com:chris-han/semantier-runtime.git` on branch `main`, with compose path `deploy/dokploy/docker-compose.yml` and **Enable Submodules** turned on. That means Dokploy is not using Stack mode for this service. The live Environment tab also confirms the intended container wiring: `SEMANTIER_AGENT_API_URL=http://backend:8899`, `SEMANTIER_AGENT_FORWARD_BROWSER_COOKIES=true`, `HERMES_WORKSPACE_MODE=semantier-unicell`, and a live override `PORT=3300`. The last recent deployments include multiple failures on commits that changed `hermes-agent` and `hermes-workspace` submodule references, which is consistent with Dokploy rebuilding from the repo checkout plus submodules rather than installing only from a package index.

---

## File Structure

Planned deployment files and responsibilities:

- Create: `deploy/dokploy/backend.Dockerfile`
  Purpose: Build the Semantier runtime image from repo root with `src/` and `hermes-agent` available in one Python environment.
- Modify: `hermes-workspace/vite.config.ts`
  Purpose: Stop treating `HERMES_API_URL` as the primary backend variable and standardize frontend runtime resolution on `SEMANTIER_AGENT_API_URL`.
- Modify: `hermes-workspace/src/server/gateway-capabilities.ts`
  Purpose: Make the server-side workspace capability probes use `SEMANTIER_AGENT_API_URL`.
- Modify: `hermes-workspace/docker/workspace/Dockerfile`
  Purpose: Update the workspace image default to use `SEMANTIER_AGENT_API_URL` for container-to-container wiring.
- Create: `deploy/dokploy/docker-compose.yml`
  Purpose: Define the two-service Dokploy stack, internal service wiring, named volume persistence, health checks, and exposed ports.
- Create: `deploy/dokploy/.env.example`
  Purpose: Document required runtime variables for Dokploy UI or local compose smoke tests.
- Create: `deploy/dokploy/README.md`
  Purpose: Explain how this Dokploy stack maps to the repo and how to configure domains, volumes, and secrets.
- Optional create: `.dockerignore`
  Purpose: Reduce backend build context size if root-level image builds are too slow.
- Reuse without modification: `hermes-workspace/Dockerfile`
  Purpose: Production workspace image already builds and serves the frontend on `PORT`.

## Implementation Notes

- Backend entrypoint should be `semantier run --host 0.0.0.0 --port 8899 --replace`, not `hermes gateway run`, because Semantier already embeds Hermes-compatible API surfaces under the canonical runtime.
- Dokploy service type must be **Docker Compose**. Do not use **Stack** for this repo because Stack mode does not support `build`.
- The checked-in compose file lives at `deploy/dokploy/docker-compose.yml`, so the backend `build.context` must remain `../..` to give Docker access to the repo root and the local `hermes-agent/` path dependency.
- Persist backend runtime state with a named Docker volume mounted at `/app/.semantier-home`.
- Do not mount runtime state or config from repo-relative paths such as `./` or `./config/...`; Dokploy AutoDeploy reclones the repository and those mounts become unstable across deployments.
- Refactor the frontend so `SEMANTIER_AGENT_API_URL` is the only backend URL variable used by runtime server code and deployment manifests.
- Variables entered in Dokploy's Environment tab are only guaranteed to exist in the compose-side `.env` file. Keep `env_file: - .env` and/or explicit `${VAR}` interpolation in the compose file so the containers actually receive them.
- The current live Dokploy service is using `PORT=3300` for the workspace container. Keep the compose contract flexible enough for a non-default public workspace port override.
- Treat `SEMANTIER_SESSION_SECRET` as required in production. The default dev fallback in code is not acceptable for Dokploy.
- Do not refactor source directories as part of this deployment unless a later implementation step proves a hard blocker. Current layout is deployable as-is.

### Task 1: Collapse Frontend Backend Wiring Onto `SEMANTIER_AGENT_API_URL`

**Files:**
- Modify: `hermes-workspace/vite.config.ts`
- Modify: `hermes-workspace/src/server/gateway-capabilities.ts`
- Modify: `hermes-workspace/docker/workspace/Dockerfile`
- Optional modify: `hermes-workspace/install.sh`
- Optional modify: `hermes-workspace/src/components/onboarding/setup-step-content.tsx`
- Optional modify: `hermes-workspace/src/components/onboarding/hermes-onboarding.tsx`
- Optional modify: `hermes-workspace/src/screens/chat/utils.ts`

- [ ] **Step 1: Update `vite.config.ts` to resolve the backend URL from `SEMANTIER_AGENT_API_URL`**

```ts
  const semantierAgentUrl = normalizeServiceUrl(
    env.SEMANTIER_AGENT_API_URL || process.env.SEMANTIER_AGENT_API_URL,
    'http://127.0.0.1:8899',
  )
```

Replace downstream uses of `hermesApiUrl` in the Semantier-unicell runtime path so proxying and health checks point to `semantierAgentUrl`.

- [ ] **Step 2: Update client-side env replacement in `vite.config.ts`**

```ts
          result = result.replace(
            /process\\.env\\.SEMANTIER_AGENT_API_URL/g,
            JSON.stringify(semantierAgentUrl),
          )
```

Remove the `process.env.HERMES_API_URL` replacement once no browser bundle depends on it.

- [ ] **Step 3: Update `gateway-capabilities.ts` to use the new primary env**

```ts
export let HERMES_API =
  process.env.SEMANTIER_AGENT_API_URL || 'http://127.0.0.1:8899'
export let HERMES_DASHBOARD_URL = HERMES_API
```

Also update the runtime refresh path later in the file:

```ts
  HERMES_API = process.env.SEMANTIER_AGENT_API_URL || 'http://127.0.0.1:8899'
```

- [ ] **Step 4: Update the workspace container default**

```dockerfile
ENV SEMANTIER_AGENT_API_URL=http://backend:8899
```

Do not bake `HERMES_API_URL` into the container image anymore.

- [ ] **Step 5: Sweep user-facing setup text**

Replace text that tells operators to set `HERMES_API_URL` with `SEMANTIER_AGENT_API_URL` in the onboarding/install surfaces listed above.

- [ ] **Step 6: Verify no functional code still depends on `HERMES_API_URL`**

Run: `rg -n "HERMES_API_URL" hermes-workspace -g '!**/node_modules/**'`
Expected: only historical docs or compatibility comments remain; no runtime server/config code still requires the old variable

- [ ] **Step 7: Commit**

```bash
git add hermes-workspace/vite.config.ts hermes-workspace/src/server/gateway-capabilities.ts hermes-workspace/docker/workspace/Dockerfile hermes-workspace/install.sh hermes-workspace/src/components/onboarding/setup-step-content.tsx hermes-workspace/src/components/onboarding/hermes-onboarding.tsx hermes-workspace/src/screens/chat/utils.ts
git commit -m "refactor: standardize workspace backend env on semantier agent api url"
```

### Task 2: Add Dokploy Deployment Skeleton

**Files:**
- Create: `deploy/dokploy/.env.example`
- Create: `deploy/dokploy/README.md`

- [ ] **Step 1: Create the environment template**

```dotenv
# Backend
SEMANTIER_RUNTIME_PORT=8899
SEMANTIER_LOCAL_STATE_DIR=/app/.semantier-home
HERMES_HOME=/app/.semantier-home
SEMANTIER_AUTH_DB_PATH=/app/.semantier-home/auth.db
SEMANTIER_SESSION_SECRET=replace-with-a-long-random-secret

# Provider credentials
ANTHROPIC_API_KEY=
OPENROUTER_API_KEY=
OPENAI_API_KEY=

# Frontend -> backend wiring
SEMANTIER_AGENT_API_URL=http://backend:8899
HERMES_WORKSPACE_MODE=semantier-unicell
PORT=3000
HOST=0.0.0.0
```

- [ ] **Step 2: Create the deployment README**

```md
# Dokploy Deployment

This stack deploys:

- `backend`: Semantier runtime + embedded Hermes API on port `8899`
- `workspace`: Hermes Workspace SSR frontend on port `3000`

Key rule: the workspace must talk to the Semantier backend, not to a separate Hermes API container.

Secrets should be set in Dokploy's Environment tab, not committed to git.
Persist runtime data with the named volume declared in `docker-compose.yml`.
```

- [ ] **Step 3: Verify the files exist**

Run: `ls -la deploy/dokploy`
Expected: `.env.example` and `README.md` are present

- [ ] **Step 4: Commit**

```bash
git add deploy/dokploy/.env.example deploy/dokploy/README.md
git commit -m "docs: add dokploy deployment skeleton"
```

### Task 3: Add the Backend Dockerfile

**Files:**
- Create: `deploy/dokploy/backend.Dockerfile`
- Optional create: `.dockerignore`
- Test: local backend image build

- [ ] **Step 1: Write the backend Dockerfile**

```dockerfile
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY pyproject.toml /app/pyproject.toml
COPY src /app/src
COPY hermes-agent /app/hermes-agent
COPY bootstrap /app/bootstrap
COPY docs /app/docs
COPY README.md /app/README.md
COPY how-to-run.md /app/how-to-run.md

RUN pip install --no-cache-dir -e .

ENV HERMES_HOME=/app/.semantier-home
ENV SEMANTIER_LOCAL_STATE_DIR=/app/.semantier-home
ENV SEMANTIER_AUTH_DB_PATH=/app/.semantier-home/auth.db
ENV SEMANTIER_RUNTIME_PORT=8899

EXPOSE 8899

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=5 \
  CMD curl -fsS http://127.0.0.1:8899/health >/dev/null || exit 1

CMD ["semantier", "run", "--host", "0.0.0.0", "--port", "8899", "--replace"]
```

- [ ] **Step 2: Add a root `.dockerignore` if the repo does not already have one**

```gitignore
.git
.venv
__pycache__/
*.pyc
.pytest_cache/
.mypy_cache/
node_modules/
hermes-agent/web/node_modules/
hermes-workspace/node_modules/
hermes-workspace/.output/
hermes-workspace/dist/
.semantier-home/
workspaces/
bootstrap/output/
texput.log
```

- [ ] **Step 3: Build the backend image**

Run: `docker build -f deploy/dokploy/backend.Dockerfile -t semantier-backend:dokploy .`
Expected: build completes and installs both `semantier` and the local `hermes-agent` dependency

- [ ] **Step 4: Smoke test the backend container**

Run: `docker run --rm -p 8899:8899 -e SEMANTIER_SESSION_SECRET=test-secret semantier-backend:dokploy`
Expected: container starts and `curl http://127.0.0.1:8899/health` returns success from another shell

- [ ] **Step 5: Commit**

```bash
git add deploy/dokploy/backend.Dockerfile .dockerignore
git commit -m "feat: add dokploy backend image"
```

### Task 4: Define the Two-Service Compose Stack

**Files:**
- Create: `deploy/dokploy/docker-compose.yml`
- Test: `docker compose config`

- [ ] **Step 1: Write the compose file**

```yaml
services:
  backend:
    build:
      context: ../..
      dockerfile: deploy/dokploy/backend.Dockerfile
    env_file:
      - .env
    environment:
      SEMANTIER_RUNTIME_PORT: ${SEMANTIER_RUNTIME_PORT:-8899}
      SEMANTIER_LOCAL_STATE_DIR: ${SEMANTIER_LOCAL_STATE_DIR:-/app/.semantier-home}
      HERMES_HOME: ${HERMES_HOME:-/app/.semantier-home}
      SEMANTIER_AUTH_DB_PATH: ${SEMANTIER_AUTH_DB_PATH:-/app/.semantier-home/auth.db}
      SEMANTIER_SESSION_SECRET: ${SEMANTIER_SESSION_SECRET}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:-}
      OPENROUTER_API_KEY: ${OPENROUTER_API_KEY:-}
      OPENAI_API_KEY: ${OPENAI_API_KEY:-}
    volumes:
      - semantier_runtime_data:/app/.semantier-home
    healthcheck:
      test: ["CMD", "curl", "-f", "http://127.0.0.1:8899/health"]
      interval: 30s
      timeout: 5s
      retries: 5
      start_period: 20s
    ports:
      - "8899:8899"

  workspace:
    build:
      context: ../../hermes-workspace
      dockerfile: Dockerfile
    env_file:
      - .env
    environment:
      PORT: ${PORT:-3000}
      HOST: ${HOST:-0.0.0.0}
      SEMANTIER_AGENT_API_URL: ${SEMANTIER_AGENT_API_URL:-http://backend:8899}
      HERMES_WORKSPACE_MODE: ${HERMES_WORKSPACE_MODE:-semantier-unicell}
      SEMANTIER_AGENT_FORWARD_BROWSER_COOKIES: "true"
    depends_on:
      backend:
        condition: service_healthy
    ports:
      - "3000:3000"

volumes:
  semantier_runtime_data:
```

Why this shape:
- `context: ../..` is required so the backend image can `COPY` repo-root files including `src/` and `hermes-agent/`.
- `env_file: .env` is required because Dokploy stores UI variables in a compose-local `.env` file but does not inject them automatically into containers.
- `semantier_runtime_data` must stay a named volume so Dokploy Volume Backups can protect `.semantier-home`.

- [ ] **Step 2: Render the resolved compose config**

Run: `cd deploy/dokploy && cp .env.example .env && docker compose config`
Expected: compose renders two services, one named volume, and no unresolved required variables except secrets you intentionally left blank

- [ ] **Step 3: Validate the service contract**

Run: `cd deploy/dokploy && docker compose config --services`
Expected:

```text
backend
workspace
```

- [ ] **Step 4: Commit**

```bash
git add deploy/dokploy/docker-compose.yml
git commit -m "feat: add dokploy compose stack"
```

### Task 5: Run the Full Stack Locally Before Dokploy

**Files:**
- Test only: `deploy/dokploy/docker-compose.yml`

- [ ] **Step 1: Start the stack**

Run: `cd deploy/dokploy && cp .env.example .env && docker compose up --build`
Expected: both containers start; `backend` becomes healthy; `workspace` listens on `3000`

- [ ] **Step 2: Verify backend health**

Run: `curl -fsS http://127.0.0.1:8899/health`
Expected: HTTP 200

- [ ] **Step 3: Verify backend capability surface**

Run: `curl -fsS http://127.0.0.1:8899/gateway/channels`
Expected: JSON response containing gateway metadata and compatible API surfaces

- [ ] **Step 4: Verify the frontend can reach the backend**

Run: `curl -I http://127.0.0.1:3000`
Expected: HTTP 200 or HTTP 302 from the workspace SSR server

- [ ] **Step 5: Check container logs for backend URL mistakes**

Run: `cd deploy/dokploy && docker compose logs workspace backend`
Expected: no attempts to call `127.0.0.1:8642`; frontend should resolve backend from `SEMANTIER_AGENT_API_URL=http://backend:8899`

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "test: validate dokploy stack locally"
```

### Task 6: Document the Dokploy Deployment Procedure

**Files:**
- Modify: `deploy/dokploy/README.md`

- [ ] **Step 1: Expand the README with Dokploy-specific instructions**

```md
## Dokploy Setup

1. Create a new **Docker Compose** application in Dokploy.
2. Point Dokploy at this repository.
3. Set the compose file path to `deploy/dokploy/docker-compose.yml`.
4. Enable submodules so Dokploy checks out both `hermes-agent` and `hermes-workspace` revisions referenced by the repo.
5. Add the environment variables from `.env.example` in Dokploy's Environment tab.
6. Keep `SEMANTIER_SESSION_SECRET` non-empty and production-grade.
7. Expose the `workspace` service with your public domain.
8. Keep `backend` internal unless you explicitly want direct API access.

## Persistence

The backend mounts a named Docker volume at `/app/.semantier-home`.
That volume stores:

- `eos.db`
- `auth.db`
- Hermes runtime config and session state

## Dokploy Notes

- Use **Docker Compose**, not **Stack**, because this deployment builds images from source.
- Use Dokploy named volumes for backup support.
- Do not mount repo-relative runtime state into the app directory.
- If you configure variables in the Dokploy UI, keep `env_file: - .env` in compose so they are loaded into the containers.
- AutoDeploy reclones the repository on each deployment, so treat the checked-out repo as ephemeral build input rather than a persistence surface.
- Keep **Enable Submodules** on in the Dokploy service settings; the live service already depends on that behavior.
- The frontend deployment contract uses `SEMANTIER_AGENT_API_URL` as the single backend URL variable.
```

- [ ] **Step 2: Verify the final deployment docs**

Run: `sed -n '1,240p' deploy/dokploy/README.md`
Expected: README explains Dokploy compose app creation, env setup, domain routing, and persistence

- [ ] **Step 3: Commit**

```bash
git add deploy/dokploy/README.md
git commit -m "docs: add dokploy deployment instructions"
```

### Task 7: Deploy in Dokploy

**Files:**
- No repo changes required

- [ ] **Step 1: Push the implementation branch**

Run: `git push origin <your-branch-name>`
Expected: branch is available to Dokploy's Git source

- [ ] **Step 2: Create the Dokploy compose application**

Run in Dokploy UI: create a **Docker Compose** app, connect the repo, and select `deploy/dokploy/docker-compose.yml`
Expected: Dokploy reads the compose file and lists `backend` and `workspace`

- [ ] **Step 3: Add environment variables in Dokploy**

Use these minimum variables:

```text
SEMANTIER_SESSION_SECRET=<long-random-secret>
SEMANTIER_AGENT_API_URL=http://backend:8899
HERMES_WORKSPACE_MODE=semantier-unicell
```

Add provider/API variables only for the models you actually use.

- [ ] **Step 4: Deploy and verify**

Run in Dokploy UI: `Deploy`
Expected: `backend` passes health check, `workspace` starts after `backend`, and the public domain loads the workspace

- [ ] **Step 5: Post-deploy smoke tests**

Run:

```bash
curl -I https://<workspace-domain>
curl -fsS https://<workspace-domain>/api/ping
```

Expected: public workspace responds and reports backend connectivity

## Risks And Decisions

- Backend image context is the repo root because the Python package depends on both `src/` and the local `hermes-agent` path dependency declared in `pyproject.toml`.
- Dokploy Compose can build this repo from source, but only when the compose app uses `build` with the repo root in scope; if the context is narrowed to `deploy/dokploy` or the service is created as Stack, the local `hermes-agent` dependency will not resolve.
- The live Dokploy service already has submodules enabled. Disabling that setting would break the deployment path for repo-pinned `hermes-agent` and `hermes-workspace` revisions even if the Python dependency metadata stayed unchanged.
- The existing `hermes-workspace/docker-compose.yml` is a legacy standalone workspace/agent compose path and is not part of the Semantier deployment contract. Dokploy deployments for this repo must use `semantier run` on port `8899`.
- Production login/session behavior depends on `SEMANTIER_SESSION_SECRET`; leaving it unset would silently fall back to the dev secret in `src/agents/auth_session.py`, which must be avoided.
- `.semantier-home` is runtime state and must be persisted outside the image; otherwise `eos.db`, `auth.db`, sessions, and runtime config are lost on redeploy.

## Self-Review

- Spec coverage:
- Single frontend backend URL env on `SEMANTIER_AGENT_API_URL`: covered by Task 1.
- Two containers: covered by Tasks 3 and 4.
- Backend includes `src` and `hermes-agent`: covered by Task 3 backend Dockerfile.
- Other container is `hermes-workspace`: covered by Task 4 workspace service.
- Dokploy deployment flow: covered by Tasks 6 and 7.
- Optional folder-structure refactor before Docker work: evaluated and intentionally rejected because current structure is already deployable.
- Placeholder scan:
  - No `TODO`, `TBD`, or implicit "figure it out later" steps remain.
- Type consistency:
- Backend is consistently `8899`.
- Frontend consistently points `SEMANTIER_AGENT_API_URL` to `http://backend:8899`.
- Persistent runtime path is consistently `/app/.semantier-home`.
