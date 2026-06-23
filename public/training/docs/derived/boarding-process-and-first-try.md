# Boarding Process — First Use Guide

Audience: end users who just signed up and want to try the workspace.

1‑line start: After signup and automatic sign‑in, go to https://app.semantier.com.

Purpose: help a newly authenticated user get value quickly — see an analysis,
understand the UI, and decide whether to bring real accounting data into the
product.

## 1. What happens when you first enter

When you first open the workspace you will be guided through a short
onboarding sequence that checks connectivity and helps confirm the chat
experience works. Typical steps are:

- Welcome and quick orientation
- Backend connection check (automatic)
- Optional provider / model configuration (only for advanced setups)
- A short test chat to confirm everything is working

If any step needs your input the app shows simple prompts. Most users do not
need to configure anything — the onboarding is usually a lightweight check.

## 2. Try the demo dataset (recommended)

We provide a realistic seeded demo organization so you can explore without
uploading your own data. The demo commonly appears as “索阳 示例公司” in the
organization selector.

Why use the demo:

- It gives immediate, relevant results so you can try analysis prompts and see
	how the product answers business questions.
- It is safe for exploration — designed to show features and workflows.

Important rules:

- The demo org is not a production ledger. Do not enter, edit, or delete any
	accounting records, journal entries, invoices, payments, or other financial
	transactions in the demo organization.
- Use the demo only for read/query/analysis, learning, and validating workflows
	— never as a source of truth for production bookkeeping.

How to use it:

- In the onboarding modal or on the chat empty state use the **"Try 索阳"**
	action to switch into the demo organization.
- Once in the demo org, open Chat and select one of the example prompts below
	(or paste them directly) to run analyses against the seeded dataset.

Example starter prompts (copy-paste):

- 营业分析 — Business performance summary

	Chinese:
	> 基于当前组织的 demo dataset，生成营业分析，重点说明收入结构、项目毛利、回款节奏、现金压力和需要关注的经营异常。

	English:
	> Generate a business performance summary for the current demo dataset, highlighting revenue mix, project gross margins, collection cadence, cash pressure, and any operational anomalies to watch.

- 费用与凭证分析 — Expense classification & reimbursement analysis

	Chinese:
	> 基于当前组织的 demo dataset，分析日常费用与报销流程，给出费用分类、需要的凭证材料、合规与风险提示。请勿在演示环境中生成或修改任何会计分录或凭证。

	English:
	> Analyze routine expense and reimbursement workflows for the demo dataset; provide expense classifications, required supporting documents, and compliance/risk notes. Do not generate or modify accounting entries or vouchers in the demo environment.

- 报税与合规要点 — Tax & compliance checklist


	## 5. Admins and operators

	Administrators: if you manage demo provisioning or operator tools, see the
	repository operator documentation (for example, [bootstrap/README.md](../../bootstrap/README.md)). End users do not need to run operator tools.
	modifies the auth store, pass `-y` as well to confirm non-interactive
	execution.

Notes:
- The underlying runtime function is `ensure_seeded_demo_organizations()` and
	is idempotent — running the script repeatedly is safe and will only update
	metadata when necessary.
- The script writes a summary JSON file by default; in `--json` mode it will
	instead print a structured JSON doc to stdout suitable for automation.

Examples:
- Interactive local check (no writes unless confirmed):
```bash
python bootstrap/bootstrap_seed_suoyang_cn.py
```

- Dry-run and write planned JSON to disk for review:
```bash
python bootstrap/bootstrap_seed_suoyang_cn.py --dry-run --verbose
```

- CI-friendly non-interactive seed (prints machine JSON):
```bash
python bootstrap/bootstrap_seed_suoyang_cn.py -y --json
```

## Running locally (developer)

To run the backend and frontend locally (developer preview) and exercise the
onboarding CTAs, follow these steps.

- Start the backend (use the virtualenv provided by the repository):
```bash
source .venv/bin/activate
semantier run --replace
```

- Start the frontend (Hermes Workspace dev server). The frontend serves on
	port 3300 by default:
```bash
cd hermes-workspace
pnpm dev
```

- Open the app in your browser: http://localhost:3300
-
Notes:
- If port `3300` is already in use on your machine, Vite will attempt the next
	available port (for example `3301`) and will print the actual URL in the
	terminal as `Local: http://localhost:3301/`. Open the URL shown in the
	dev-server output rather than assuming `3300`.
- Run the `pnpm dev` command from within the `hermes-workspace` directory. In
	some pnpm configurations `pnpm --cwd hermes-workspace dev` may fail; using
	`cd hermes-workspace && pnpm dev` is a reliable alternative.
- The onboarding CTA "试用 索阳 示例公司" and the chat empty-state CTA will
	execute organization-join and session creation calls from the browser, so
	they require an authenticated browser session (the backend `vt_session`
	cookie). If you automate the flow via curl/scripts, ensure you include a
	valid `vt_session` cookie or perform the actions from an authenticated
	browser.

If you'd like, we can also add a short subsection to the repository README or
CI playbooks showing how to call the script during integration tests or demo
provisioning. This helps ensure demo organizations are present when running
end-to-end checks.

