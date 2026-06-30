# Semantier Runtime

Semantier is a **verification-first execution system**.

This repository contains the reference runtime and tools that implement the core idea from the paper: correctness is enforced per decision through verifiable justifications rather than through system structure or model internalization.

---

## Paper introduction

This project implements Semantier, a semantic governance framework that enforces constraints at execution time by validating structured justification objects attached to each candidate action. Validation is performed against semantic contracts; execution proceeds only if justifications satisfy contracts and required approvals are present. The paper formalizes this model and presents an execution protocol that enforces approval and idempotency at a single authority boundary. The repository includes a reference implementation focused on financial transfer workflows and a short case study illustrating failure modes.

![Execution pipeline](paper/semantier_v13/figures/execution.png)

*Figure: Semantier execution pipeline — validation, approval, idempotency, and authority commit.*

![Failure modes](paper/semantier_v13/figures/failure.png)

*Figure: Failure modes for justification-based validation — inconsistency is detectable; incompleteness (fail-open) and misrepresentation are not generally detectable.*

**Paper (PDF):** [paper/semantier_v13/main.pdf](paper/semantier_v13/main.pdf)

**Citation:** Kai Han. "Semantier: Justification-Gated Execution for Semantic Governance in Agentic Systems." 2026.

---

## Quickstart

Install and run the CLI as an editable package:

```bash
pip install -e .
semantier examples/internal_transfer.phi.json examples/types/internal_transfer.yaml
```

See the paper in `paper/semantier_v13/main.tex` for details and formal definitions.

## Multitenancy Roadmap Notes

For SaaS multitenancy implementation status, P0/P1/P2 checklists, and post-P2
stabilization notes (including tenant backup/restore hardening and explicit
org-remap disablement), see:

- [docs/operational/saas-multitenancy-roadmap.md](docs/operational/saas-multitenancy-roadmap.md)

## Governed Analytics Query

For user-facing analytics, use `governed_query`. It resolves the active
workspace organization from governed authorization records and exposes only
organization-scoped views.

The plugin source is tracked in git at
`src/plugins/business_analytics` and is auto-installed into
`.semantier-home/plugins/business_analytics` whenever `semantier` starts with
repo-local runtime defaults.
The real-company onboarding plugin is tracked at
`src/plugins/real_company_onboarding` and is installed into
`.semantier-home/plugins/real_company_onboarding` as a shared built-in runtime
toolset for setup status, admission, COA/projection, lifecycle, and lakehouse
refresh workflows.
The Excel automation plugin is tracked at
`semantier-skills/plugins/automate_excel` and is likewise installed into
`.semantier-home/plugins/automate_excel` as a platform-wide default plugin.

- Authoritative runtime source: `.semantier-home/eos.db`
- Access path in `governed_query`: org-scoped DuckDB views over governed EOS data
- Analytics views exposed by the tool: `org_rea_claims`,
  `org_journal_voucher_projections`, `org_general_ledger_views`,
  `org_financial_statement_packages`, `org_tax_filing_packages`,
  `org_accounting_archive_packages`

Raw external SQL MCP tools, terminal SQL, general code, file/search tools, raw
`eos.*` tables, and unscoped lakehouse files are not user-facing governed data
access paths.

Recommended sequence:

```bash
# 1) Generate synthetic SMB dataset
uv run semantier-industry-sim --dataset construction_3_year --output all

# 2) Seed EOS runtime records with unified dataset (v8 + v8.1 + v8.5)
semantier bootstrap --replace

# 3) Query via governed_query
```

## Bootstrap Runbook (v8.1 and v8.5)

The repository ships deterministic bootstrap scripts under `bootstrap/`.

The default bootstrap now seeds a single unified dataset that covers v8, v8.1, and v8.5 artifacts in one run.

### Script matrix

- `bootstrap/bootstrap.sh`
	- Canonical unified seed entrypoint for one combined dataset.
- `bootstrap/cleanup.sh`
	- Unified cleanup entrypoint for the combined dataset.
- `bootstrap/bootstrap_cleanup_v85.py`
	- Internal cleanup implementation used by `bootstrap/cleanup.sh`.

### Typical commands

```bash
# unified single-dataset commands
semantier bootstrap --replace
semantier bootstrap --dry-run

semantier bootstrap cleanup --dry-run
semantier bootstrap cleanup

# top-level make shortcuts
make bootstrap ARGS="--replace"
make bootstrap ARGS="--dry-run"

make cleanup-dry-run
make cleanup
```

### Notes

- All bootstrap scripts are designed for local/dev/demo use and rely on pinned artifacts.
- Prefer cleanup scripts over manual SQL deletes to preserve deterministic teardown behavior.
- For custom DB locations, pass `--db-path` to the script wrappers.

## CI integration — seeding demo org for integration tests

To ensure demo organizations (for example, the “索阳 示例公司” demo) are
available during CI runs or integration tests, run the seed script in a
non-interactive mode and capture its JSON output. Below is a minimal GitHub
Actions example that checks out the repo, installs the package, and runs the
seed script non-interactively.

Example workflow: .github/workflows/seed-demo.yml

```yaml
name: Seed demo org for integration

on:
	workflow_dispatch:
	# optional: run weekly to refresh demo metadata
	schedule:
		- cron: '0 3 * * 0'

jobs:
	seed-demo:
		runs-on: ubuntu-latest
		steps:
			- uses: actions/checkout@v6
			- name: Set up Python
				uses: actions/setup-python@v6
				with:
					python-version: '3.12'
			- name: Install package
				run: |
					python -m venv .venv
					source .venv/bin/activate
					pip install -e .
			- name: Run seed script (non-interactive)
				run: |
					source .venv/bin/activate
					python bootstrap/bootstrap_seed_suoyang_cn.py -y --json
```

Notes:
- The seed script prints a structured JSON summary when `--json` is used — you
	can persist it as an artifact for auditability or use its exit code to gate
	subsequent CI steps.
- If your CI environment uses an ephemeral database or a custom runtime root,
	set appropriate environment variables (for example `SEMANTIER_DB_URL` or
	`HERMES_HOME`) in the workflow prior to running the script.

## Reviewer Guide — Paper Claims and Test Mappings

This guide enumerates the principal claims and formal properties advanced in
the paper and maps each claim to the specific test(s) in `tests/test_workflows.py`
that exercise or validate the property. Use these mappings as a reviewer
checklist to assess empirical coverage and to identify verification gaps
that may warrant additional tests or specification refinement.

- Execution Protocol / Execution Rule:
	- What must hold: validation of justification objects, approval threshold,
		and execution only at the authority boundary (see paper sections
		"Execution Protocol" and "Execution Rule").
	- Tests: `tests/test_workflows.py::test_workflow_1_pending_approval`,
		`tests/test_workflows.py::test_workflow_2_approve_and_status`, and
		`tests/test_workflows.py::test_workflow_3_commit_after_approval`.

- Idempotency Semantics:
	- What must hold: identical `(a_t, phi_t)` pairs are detected as duplicates
		after commit; idempotency does not block pre-commit pending intents.
	- Tests: `tests/test_workflows.py::test_workflow_4_duplicate` and
		`tests/test_workflows.py::test_invariant_duplicate_blocked_before_idempotency`.

- Multi-signature approvals (approval threshold `k`):
	- What must hold: partial approvals reflect `PARTIALLY_APPROVED` and full
		approvals reach `APPROVED` and allow commit when `k` satisfied.
	- Tests: `tests/test_workflows.py::test_workflow_6_partial_approval_multisig`,
		`tests/test_workflows.py::test_workflow_7_full_approval_multisig`, and
		`tests/test_workflows.py::test_workflow_8_commit_multisig`.

- Event logging and replay:
	- What must hold: lifecycle events are append-only, include intent
		creation/validation/commit, and replay reconstructs committed decisions.
	- Tests: `tests/test_workflows.py::test_workflow_9_events`,
		`tests/test_workflows.py::test_workflow_10_replay`,
		`tests/test_workflows.py::test_invariant_events_are_append_only`, and
		`tests/test_workflows.py::test_invariant_replay_reconstructs_state`.

- Execution Intent identity binding:
	- What must hold: approvals bind to the deterministic intent identity
		`I_t = H(a_t, phi_t)` so approving a different key does not unlock the
		real intent.
	- Test: `tests/test_workflows.py::test_invariant_approval_binds_to_key`.

- Conditional Commit Safety (theorem):
	- What must hold: under the authority boundary assumptions, no action may
		be committed unless it satisfies validation, approval threshold, and
		uniqueness.
	- Test: `tests/test_workflows.py::test_invariant_no_approval_no_commit`.

If you'd like, you can also:

- Run the test-suite now and report coverage for the items above. A
	convenience helper script is provided at `scripts/run_tests.sh`.

	Usage:

	```bash
	# run the full test-suite
    set -euo pipefail
    chmod +x scripts/run_tests.sh
	./scripts/run_tests.sh

	# pass pytest args, e.g. run a single test
	./scripts/run_tests.sh tests/test_workflows.py::test_workflow_1_pending_approval
	```
