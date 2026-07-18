# semantier-runtime

Runtime for evaluating semantic phi documents against type definitions, running
the Semantier wrapper web surface, and bootstrapping the local EOS runtime.

> Training copy policy: this file mirrors the root `how-to-run.md` operational
> contract. Keep startup, bootstrap, session artifact, output path, and
> lakehouse guidance synchronized with the root guide.

## Setup

```bash
uv venv
source .venv/bin/activate
uv pip install -e .
```

## Runtime evaluation CLI

Use the module form for direct phi/type evaluation:

```bash
python -m semantier.cli <phi.json> <type.yaml>
```

Example:

```bash
python -m semantier.cli examples/internal_transfer.phi.json examples/types/internal_transfer.yaml
```

The installed `semantier` command is not this evaluation CLI. It is the
Semantier wrapper around hermes-agent plus Semantier-native runtime commands.

## Primary runtime command

The primary local runtime entrypoint is now:

```bash
source .venv/bin/activate
semantier run --replace
```

Current behavior:

- starts the Semantier FastAPI runtime on port `8899` by default
- uses the repo-local runtime root at `.semantier-home/` unless you override
  `HERMES_HOME` / `SEMANTIER_LOCAL_STATE_DIR`
- seeds `SEMANTIER_AUTH_DB_PATH` to the active shared runtime root so the
  embedded Hermes gateway and pairing store resolve the same `auth.db` during
  startup
- acquires a wrapper-owned runtime ownership file to prevent dual writers for
  the same runtime root
- replaces an existing Semantier web runtime when `--replace` is used

Supported variants:

```bash
semantier run --replace --host 0.0.0.0 --port 9000
```

Integrated-runtime note:

- Use `semantier run --replace` as the only supported runtime start command
  for Semantier deployments.
- Do not document or automate non-`--replace` runtime starts in operational
  runbooks. Local debugging without `--replace` is outside the supported
  deployment contract.
- `semantier webapi run --replace` remains a legacy alias path and should not
  be used in operational runbooks, deployment automation, or docs.

## What the runtime exposes

The Semantier wrapper on port `8899` currently exposes:

- Semantier-native routes such as `/execute` and `/semantic/*`
- normalized session routes such as `/sessions`
- Hermes-compatible routes such as `/api/sessions*`, `/health`,
  `/health/detailed`, and `/v1/*`
- system inventory and auth inspection routes such as `/system/skills`,
  `/system/tools`, `/system/plugins`, and authenticated `/system/auth/state`

Important boundary note:

- `/sessions` is the Semantier normalized DTO projection over Hermes session
  truth
- `/api/sessions*` stays Hermes-compatible
- no separate public Hermes API process is part of the Semantier deployment
  contract for these web surfaces
- use `/system/skills`, `/system/tools`, `/system/plugins`, and
  `/system/auth/state` for runtime capability and auth-state inspection
- do not use ad hoc `python -c` import probing to determine whether a required
  runtime capability exists; required Python dependencies must load
  deterministically at startup, while runtime-exposed capabilities must be
  inspected through the system inventory surfaces

## Session trajectory artifacts

Session trajectories are stored as workspace-owned, session-scoped JSONL logs
under the session `logs/` directory (for example,
`workspaces/<workspace_id>/sessions/<session_id>/logs/session_<file_key>.trajectory.jsonl`).

Legacy root-level files such as `trajectory_samples.jsonl` and
`failed_trajectories.jsonl` are not part of the supported Semantier runtime
artifact contract and should not be used for operational reads.

## Gateway commands

Messaging gateway commands are still separate from `semantier run` at the
moment. Use them for Weixin and Feishu runtime channels until the unified
single-process channel embedding work is finished.

Available entrypoints:

| Command | Purpose |
|---|---|
| `semantier gateway run --replace` | Run the Hermes gateway through the Semantier wrapper |
| `semantier-gateway run --replace` | Convenience shorthand for `semantier gateway run --replace` |
| `python -m semantier.agents gateway run --replace` | Python-module wrapper entrypoint |
| `semantier pairing ...` | Pairing and approval commands routed to Hermes |

Examples:

```bash
semantier gateway run --replace
semantier-gateway run --replace
python -m semantier.agents gateway run --replace
```

Pairing examples:

```bash
semantier pairing list
semantier pairing approve weixin <CODE>
semantier pairing revoke weixin <user_id>
```

## Weixin pairing workflow

If you want new Weixin users to request access via pairing codes, set:

```bash
WEIXIN_DM_POLICY=pairing
```

in `.semantier-home/.env`, then:

```bash
source .venv/bin/activate
semantier gateway run --replace
semantier pairing list
semantier pairing approve weixin <CODE>
```

Approved users are stored under:

```text
.semantier-home/platforms/pairing/weixin-approved.json
```

## Interactive gateway setup

Use interactive setup only when you need to register or configure a messaging
platform account such as Weixin or Feishu.

```bash
source .venv/bin/activate
semantier gateway setup
```

That setup flow writes repo-local Hermes runtime state under `.semantier-home/`,
including config, pairing metadata, and live gateway credential cache.

For Weixin, the canonical persisted credential store is
`.semantier-home/auth.db` table `weixin_runtime_accounts`. Gateway startup uses
that store directly and does not fall back to `WEIXIN_ACCOUNT_ID` /
`WEIXIN_TOKEN` env vars for Weixin enablement.

After setup, start the actual gateway runtime separately:

```bash
semantier gateway run --replace
```

## SMB Analytics (v8.5)

The 3-year SMB financial simulator is bootstrapped into the EOS runtime and
queried through DuckDB-attached SQLite. The workflow seeds governed records
from synthetic simulation data.

### Workflow sequence

1. Generate simulation data (`.semantier-home/sim.json`):

```bash
uv run semantier-industry-sim --dataset construction_3_year --output all
```

2. Seed EOS runtime (`.semantier-home/eos.db`) and refresh the local
   lakehouse (`.semantier-home/lakehouse`):

```bash
cd /home/chris/repo/semantier-runtime
uv run semantier bootstrap --replace
```

This runs `bash bootstrap/bootstrap.sh --replace`. The script seeds SQLite demo
records and runs a final lakehouse materialization step after all demo
organizations are seeded.

This populates the SQLite database with:

- `rea_claims`
- `journal_voucher_projections`
- `general_ledger_views`
- `financial_statement_packages`
- `tax_filing_packages`
- `accounting_archive_packages`

3. Query via `governed_query`:

```bash
governed_query: "SELECT COUNT(*) FROM org_rea_claims"
```

Data source semantics:

- authoritative source: `.semantier-home/eos.db`
- bootstrap artifact: `.semantier-home/sim.json`
- access path: organization-scoped governed views resolved from active authorization context

## Bootstrap quick guide

Use this section when you want deterministic demo data in EOS SQLite and a
fresh local lakehouse manifest for `governed_query`.

```bash
source .venv/bin/activate
cd /home/chris/repo/semantier-runtime
uv run semantier bootstrap --replace
uv run semantier bootstrap cleanup --dry-run
uv run semantier bootstrap cleanup
```

The bootstrap command seeds demo/runtime artifacts and refreshes
`.semantier-home/lakehouse` at the end of the script. It does not upload or
promote REAL company source files. For demo status checks, use demo mode:

```python
real_company_setup_status_payload(
    organization_id="org_construction_3_year_cn",
    dataset_type="DEMO",
)
```

That should return `DEMO_ACTIVE`.

If `eos.db` changes after bootstrap, run the lakehouse materializer once more
to refresh the manifest hash:

```bash
uv run python bootstrap/bootstrap_materialize_lakehouse.py \
  --db-path .semantier-home/eos.db \
  --sim-json .semantier-home/sim.json \
  --output-dir .semantier-home/lakehouse \
  --replace
```

Equivalent make shortcuts:

```bash
make bootstrap ARGS="--replace"
make cleanup-dry-run
make cleanup
```

Expected outputs:

- runtime DB: `.semantier-home/eos.db`
- bootstrap output: `.semantier-home/bootstrap-output/`
- reports: `.semantier-home/bootstrap-output/reports/`

Safety notes:

- prefer cleanup scripts over ad-hoc deletes
- start with `--dry-run` before cleanup in shared environments

## User Artifact Cleanup

Use `scripts/cleanup_users.py` to remove user-scoped runtime artifacts from
`workspaces/` and `.semantier-home/`.

Always start with a dry run:

```bash
source .venv/bin/activate
python scripts/cleanup_users.py --all --dry-run
```

Delete all user artifacts but keep `workspaces/public`:

```bash
python scripts/cleanup_users.py --all --yes
```

Delete all user artifacts including `workspaces/public`:

```bash
python scripts/cleanup_users.py --all --include-public --yes
```

Target a specific user/workspace instead of all users:

```bash
python scripts/cleanup_users.py --user-id <USER_ID> --dry-run
python scripts/cleanup_users.py --workspace-id <WORKSPACE_ID> --yes
python scripts/cleanup_users.py --workspace-slug <WORKSPACE_SLUG> --yes
```

Notes:

- run commands from the repository root
- `--yes` is required for destructive mode
- `--all` is equivalent to `--all-users`
