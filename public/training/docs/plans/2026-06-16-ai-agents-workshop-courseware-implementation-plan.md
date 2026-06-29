# AI Agents 工作坊课件 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a single Chinese Markdown courseware manual at `docs/courseware/AI_Agents_Workshop_Courseware.md` that maps the 3-day workshop index to concrete code examples in `semantier-runtime`.

**Architecture:** The manual follows the original `AI_Agents_Workshop_CN.docx` agenda day-by-day. Each time block includes learning objectives, concept explanation, code mappings with exact file paths/snippets, Mermaid diagrams, hands-on labs, and discussion questions.

**Tech Stack:** Markdown, Mermaid diagrams, code snippets from Python source/tests/design docs.

---

## Task 1: Create directory and file skeleton

**Files:**
- Create: `docs/courseware/AI_Agents_Workshop_Courseware.md`

**Step 1: Create directory**

Run: `mkdir -p /home/chris/repo/semantier-runtime/docs/courseware`

**Step 2: Write skeleton**

Create the file with frontmatter, table of contents, and all H2/H3 headings matching the workshop agenda.

Expected structure:
- Title
- 前置说明
- Day 1 (morning + afternoon sections)
- Day 2 (morning + afternoon sections)
- Day 3 (morning + afternoon sections)
- Appendix A/B/C

**Step 3: Verify**

Run: `wc -l /home/chris/repo/semantier-runtime/docs/courseware/AI_Agents_Workshop_Courseware.md`
Expected: > 50 lines

**Step 4: Commit**

```bash
git add docs/courseware/AI_Agents_Workshop_Courseware.md
git commit -m "docs(courseware): add workshop manual skeleton"
```

---

## Task 2: Write 前置说明 and environment setup

**Files:**
- Modify: `docs/courseware/AI_Agents_Workshop_Courseware.md`

**Step 1: Add prerequisites section**

Include:
- Local PC + VSCode
- Codex / Claude / GitHub Copilot
- OpenAI / Azure OpenAI / 通义千问 API Token
- Python 3.12+
- uv + bun

**Step 2: Add project overview**

Summarize Semantier Runtime: verification-first execution system, Hermes agent orchestration, FastAPI web runtime, gateway for Feishu/Weixin.

**Step 3: Add quickstart commands**

```bash
uv venv
source .venv/bin/activate
uv pip install -e .
semantier run --replace
```

**Step 4: Commit**

```bash
git add docs/courseware/AI_Agents_Workshop_Courseware.md
git commit -m "docs(courseware): add prerequisites and quickstart"
```

---

## Task 3: Write Day 1 morning (business vision + use cases)

**Files:**
- Modify: `docs/courseware/AI_Agents_Workshop_Courseware.md`

**Step 1: Write 09:00-09:30 section**

- Learning objectives: understand shift from software tools to AI agents
- Concept: agentic systems, tool use, verification-first execution
- Code mapping: `README.md` intro + `src/agents/launcher.py` CLI entry points

**Step 2: Write 09:30-10:30 section**

- Use cases: HR resume screening, meeting coordination, finance BP
- Code mapping: `src/agents/meeting_coordinator_gateway.py` for meeting coordinator
- Architecture: diagram showing BP agents → Semantier runtime → enterprise channels

**Step 3: Write 10:30-11:30 section**

- Extended scenarios: ticket automation, smart query, document summarization
- Code mapping: `src/agents/runtime_inventory.py` for skills/plugins/toolsets discovery

**Step 4: Write 11:30-12:00 section**

- ROI framework and feedback loop
- Discussion questions

**Step 5: Commit**

```bash
git add docs/courseware/AI_Agents_Workshop_Courseware.md
git commit -m "docs(courseware): add day 1 morning content"
```

---

## Task 4: Write Day 1 afternoon (tech stack + deployment)

**Files:**
- Modify: `docs/courseware/AI_Agents_Workshop_Courseware.md`

**Step 1: Write 13:00-14:30 section**

- OpenClaw / Hermes orchestration roles
- GPT / Qwen routing strategy
- Code mapping: `src/agents/launcher.py` `_SEMANTIER_PLATFORM_TOOLSETS`, `run_hermes_cli`, `run_runtime_cli`
- Diagram: launcher → gateway → embedded Hermes → models

**Step 2: Write 14:30-16:00 section**

- Dev env init, webhook/API deployment, vLLM/self-hosted inference
- Code mapping: `how-to-run.md`, `pyproject.toml` dependencies
- Lab L1: `semantier run --replace`

**Step 3: Write 16:00-17:00 section**

- Feishu developer platform config
- Code mapping: `src/agents/webapi_gateway.py` `_messaging_platforms_payload`, Feishu OAuth flow
- Lab: inspect `/auth/context` and messaging settings

**Step 4: Commit**

```bash
git add docs/courseware/AI_Agents_Workshop_Courseware.md
git commit -m "docs(courseware): add day 1 afternoon content"
```

---

## Task 5: Write Day 2 morning (workspace + API connection)

**Files:**
- Modify: `docs/courseware/AI_Agents_Workshop_Courseware.md`

**Step 1: Write 09:00-10:30 section**

- Workspace init and Persona config
- Code mapping: `src/agents/launcher.py` `_ensure_runtime_profile`, `_bootstrap_runtime_root`, workspace directory layout from `docs/derived/gateway-unified-multitenant-design.md`
- Lab: explore `workspaces/` and `.semantier-home/` after bootstrap

**Step 2: Write 10:30-12:00 section**

- Connect GPT-4 / Qwen API
- Fallback and JSON output standardization
- Code mapping: `src/agents/webapi_gateway.py` `_post_embedded_chat_completion`
- Lab: test API call with curl

**Step 3: Commit**

```bash
git add docs/courseware/AI_Agents_Workshop_Courseware.md
git commit -m "docs(courseware): add day 2 morning content"
```

---

## Task 6: Write Day 2 afternoon (Feishu integration)

**Files:**
- Modify: `docs/courseware/AI_Agents_Workshop_Courseware.md`

**Step 1: Write 13:00-15:00 section**

- Rebuild meeting coordinator demo
- Feishu API integration
- Natural language → calendar function mapping
- Tool Calling / Function Calling
- Code mapping: `semantier-skills/plugins/feishu_meeting_coordinator/tools.py`, `feishu_calendar.py`
- Code mapping: `src/agents/meeting_coordinator_gateway.py` `start_monitor`, `monitor_tick`, `escalation_retry_tick`
- Lab L4: create monitor and inspect cron job

**Step 2: Write 15:00-17:00 section**

- State management and Memory
- Code mapping: `src/agents/meeting_coordinator_store.py` SQLite tables
- Code mapping: `src/agents/runtime_memory_boundary.py` `sanitize_user_memory_profile`
- Diagram: monitor state machine
- Lab L5: trigger retry tick

**Step 3: Commit**

```bash
git add docs/courseware/AI_Agents_Workshop_Courseware.md
git commit -m "docs(courseware): add day 2 afternoon content"
```

---

## Task 7: Write Day 3 morning (document processing + multi-agent)

**Files:**
- Modify: `docs/courseware/AI_Agents_Workshop_Courseware.md`

**Step 1: Write 09:00-10:30 section**

- Resume screening deep dive
- PDF/Docx processing, chunking, vectorization, context management
- Code mapping: `examples/` and document processing tools
- Lab: run `python -m semantier.cli examples/internal_transfer.phi.json examples/types/internal_transfer.yaml`

**Step 2: Write 10:30-12:00 section**

- Multi-agent orchestration
- Extractor Agent + Evaluator Agent Pipeline
- Rich text message output to Feishu
- Code mapping: `src/agents/webapi_gateway.py` plugin/skill install routes, `send_message_tool`
- Code mapping: `docs/derived/hermes-agent-self-improvement-design.md` background review and skill creation

**Step 3: Commit**

```bash
git add docs/courseware/AI_Agents_Workshop_Courseware.md
git commit -m "docs(courseware): add day 3 morning content"
```

---

## Task 8: Write Day 3 afternoon (security, debug, wrap-up)

**Files:**
- Modify: `docs/courseware/AI_Agents_Workshop_Courseware.md`

**Step 1: Write 13:00-14:30 section**

- Security and privacy
- PII protection, prompt injection defense, token monitoring
- Code mapping: `src/agents/webapi_gateway.py` `_enforce_rate_limit`, `_require_route_authorization`
- Code mapping: `src/agents/route_policy.py` route auth matrix

**Step 2: Write 14:30-16:00 section**

- Performance tuning and debug
- Code mapping: tests (`tests/test_meeting_coordinator_gateway.py`) for deterministic behavior
- Lab L6: run `pytest tests/test_agents_launcher.py tests/test_meeting_coordinator_gateway.py -v`

**Step 3: Write 16:00-17:00 section**

- Workshop summary and 30-day implementation plan
- Discussion questions
- Appendix references

**Step 4: Commit**

```bash
git add docs/courseware/AI_Agents_Workshop_Courseware.md
git commit -m "docs(courseware): add day 3 afternoon content"
```

---

## Task 9: Write appendices and finalize

**Files:**
- Modify: `docs/courseware/AI_Agents_Workshop_Courseware.md`

**Step 1: Write Appendix A**

Core file index with descriptions.

**Step 2: Write Appendix B**

Environment variables quick reference.

**Step 3: Write Appendix C**

References to design docs and tests.

**Step 4: Verify links and formatting**

Run: `python -m markdown --help` or just visually verify headers.

**Step 5: Final commit**

```bash
git add docs/courseware/AI_Agents_Workshop_Courseware.md
git commit -m "docs(courseware): add appendices and finalize"
```

---

## Testing / Validation

- Ensure every code snippet references an existing file in the repo.
- Run `git diff --stat` to confirm only `docs/courseware/` is touched.
- Open the file and verify all Mermaid blocks are valid syntax.
- Confirm total length > 300 lines.

---

## Execution Options

**Plan complete and saved to `docs/plans/2026-06-16-ai-agents-workshop-courseware-implementation-plan.md`.**

Two execution options:

1. **Subagent-Driven (this session)** - dispatch fresh subagent per task, review between tasks.
2. **Parallel Session (separate)** - open new session with `superpowers:executing-plans`.

**Recommended:** Implement directly in this session using the Write tool, since all tasks are sequential writes to one Markdown file.
