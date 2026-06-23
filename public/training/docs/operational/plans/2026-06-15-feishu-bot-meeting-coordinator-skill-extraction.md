# Feishu Bot Meeting Coordinator Skill Extraction Plan

## Summary

Session `20260615_031731_0b3edf9f` shows a Feishu-origin meeting scheduling request loading `productivity/google-workspace` and attempting Google Calendar auth because no Feishu calendar scheduling skill was available in the shared Semantier runtime skills set.

Extract the `feishu-bot-meeting-coordinator` skill from `chris-han/Vibe-Trading` into this repository as a Semantier-managed shared Hermes skill. The goal is to make Feishu calendar/contact scheduling available through the Semantier runtime without editing `.semantier-home` directly.

Also maintain a standalone publishable repository layout so the same skill can be installed from the Hermes Workspace Skills screen without requiring Semantier launcher vendoring.

## Source And Target

Source:

- Repository: `https://github.com/chris-han/Vibe-Trading.git`
- Selected skill: `agent/src/skills/app-infra/productivity/feishu-bot-meeting-coordinator/`
- Selected helper: `scripts/feishu_bot_api.py`

Target:

- Source of truth: `src/skills/productivity/feishu-bot-meeting-coordinator/`
- Runtime install output: `.semantier-home/skills/productivity/feishu-bot-meeting-coordinator/`
- Installer: `src/agents/launcher.py` shared runtime bootstrap

Standalone publishable repo target:

- Workspace scaffold: `semantier-skills/`
- Installable skill path inside repo: `semantier-skills/skills/productivity/feishu-bot-meeting-coordinator/`
- Static marketplace index: `semantier-skills/marketplace/index.json`
- Skills screen install modes:
  - direct identifier: `chris-han/semantier-skills/skills/productivity/feishu-bot-meeting-coordinator`
  - raw SKILL URL: `https://raw.githubusercontent.com/chris-han/semantier-skills/main/skills/productivity/feishu-bot-meeting-coordinator/SKILL.md`
  - marketplace URL: `https://github.com/chris-han/semantier-skills`

This is not a Git submodule. It is a self-contained shared Hermes skill directory managed by Semantier bootstrap.

## Key Changes

- Add `src/skills/productivity/feishu-bot-meeting-coordinator/SKILL.md`.
- Add `src/skills/productivity/feishu-bot-meeting-coordinator/scripts/feishu_bot_api.py`.
- Update `src/agents/launcher.py` `_RUNTIME_SKILL_PATHS` to include `("productivity", "feishu-bot-meeting-coordinator")`.
- Keep `.semantier-home/skills` as generated runtime state; do not edit it directly.
- Add a standalone repo copy under `semantier-skills/skills/productivity/feishu-bot-meeting-coordinator/` for GitHub-based installation and marketplace discovery.
- Keep the Skills screen marketplace URL configurable so a GitHub repository URL or hosted JSON index can be used without code changes.

The extracted skill should keep these behavioral rules:

- Use `feishu-bot-meeting-coordinator` for Feishu/Lark meeting scheduling and contact/group lookup.
- Do not use Google Calendar unless the user explicitly asks for Google Calendar.
- Resolve attendees through Feishu contact/chat APIs, not guessed identifiers.
- Treat the Feishu message sender as the default requester/meeting owner when governed Feishu session context provides that identity.
- Fail clearly if requester identity is unavailable; do not infer authority from prompt text.
- Create on the requester primary calendar when Feishu permits it.
- Fall back to the bot calendar on Feishu `191002` calendar access errors.
- Always add attendees through Feishu's separate attendee API after event creation, because attendees in the create-event body are ignored by Feishu.
- Never ask users to paste Feishu app secrets, tokens, or webhook secrets into chat.

## Implementation Notes

- Adapt the helper script to this repo instead of copying Vibe-Trading paths verbatim.
- Prefer existing Semantier/Hermes Feishu configuration and environment surfaces.
- Keep all machine-facing identifiers ASCII-stable.
- Use timezone-aware behavior for event inputs and outputs; default user-facing Feishu meeting timezone to `Asia/Shanghai` when not specified.
- Keep the helper output structured JSON with explicit `ok`, `result`, and `error` fields so agent turns can recover from partial failures.
- Avoid broad `feishu-cli-gateway` extraction in this change. That is a separate, larger Feishu API surface and not needed to fix the observed calendar fallback.
- The standalone repo helper must not assume an `agent/` checkout ancestor when loading credentials; it should respect active runtime env vars and runtime `.env` files.
- A static marketplace index is acceptable if the Skills screen search wrapper performs local query filtering on returned entries.

## Test Plan

- Add launcher/bootstrap regression coverage proving the new managed skill is copied into the shared runtime skills directory.
- Add standalone repo coverage or smoke validation proving the publishable scaffold contains the installable skill path and marketplace index.
- Add skill-content tests verifying:
  - the skill points to `scripts/feishu_bot_api.py`
  - the skill prohibits Google Calendar fallback for Feishu meeting tasks
  - the skill documents requester ownership, `191002` fallback, and separate attendee creation
- Add marketplace wrapper tests proving a hosted static JSON index can be searched through the configurable marketplace URL.
- Add helper unit tests adapted from Vibe-Trading for:
  - contact ranking
  - group phrase expansion
  - requester required when not provided by argument or environment
  - requester implicitly added as an attendee
  - requester primary-calendar lookup
  - bot-calendar fallback on `191002`
  - separate attendee API invocation after event creation
- Run focused verification:
  - `pytest -q tests/test_agents_launcher.py`
  - new Feishu coordinator tests
  - relevant existing Feishu gateway/auth tests if helper configuration touches shared Feishu setup

## Assumptions

- The requested artifact is a reviewable implementation plan only; no skill extraction or runtime wiring is implemented yet.
- A standalone publishable scaffold now exists under `semantier-skills/`, published at `https://github.com/chris-han/semantier-skills`.
- The selected extraction target is `feishu-bot-meeting-coordinator`, not Vibe-Trading's broader `feishu-cli-gateway` proposal.
- Shared Semantier skills remain git-backed under `src/skills/` and are promoted into `.semantier-home/skills/` only through launcher bootstrap.
