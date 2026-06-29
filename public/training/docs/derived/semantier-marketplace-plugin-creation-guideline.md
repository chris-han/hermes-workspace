# Semantier Marketplace Plugin Creation Guideline

## Scope

This guide defines the packaging contract for plugins published through the
repo-local Semantier marketplace under `semantier-skills/`.

This marketplace is not the same format as the Codex personal marketplace used
by the `plugin-creator` skill. In this repository, the install surface is:

- a repo-local plugin package under `semantier-skills/plugins/<plugin_name>/`
- a Hermes/Semantier manifest at `plugin.yaml`
- a repo-local static marketplace index at `semantier-skills/marketplace/index.json`

Do not add `.codex-plugin/plugin.json` or `marketplace.json` unless the repo is
explicitly introducing a second, separate Codex distribution path.

This guide is intentionally scoped to the current Semantier marketplace shape:

- general Hermes plugins distributed from `semantier-skills/plugins/`
- marketplace discovery through `semantier-skills/marketplace/index.json`
- installation through the Semantier runtime marketplace/install path

It is not a general guide for every Hermes plugin subtype. Platform plugins,
provider plugins, and other specialized Hermes plugin categories need their own
category-specific rules.

## Design Review: `feishu_meeting_coordinator`

The existing `feishu_meeting_coordinator` package is the reference baseline for
the current Semantier marketplace shape:

- good: single installable package with `plugin.yaml`, `__init__.py`, bundled
  `SKILL.md`, and helper scripts
- good: indexed in `semantier-skills/marketplace/index.json` as a
  `type: "plugin"` entry with a repo-relative `path` under the top-level
  `"skills"` array
- good: companion skill instructions are bundled with the runtime package
- good: `register(ctx)` wires tools (with explicit `toolset=`), skill path, and
  CLI surfaces; schemas are defined inline in `__init__.py` as `TOOL_SCHEMAS`
  with a private `_function_schema` helper
- good: `messages.py` provides localized runtime message rendering backed by
  `src/prompts/meeting_coordinator/` templates, not inline prose (**legacy
  exception**: this directory uses the semantic alias `meeting_coordinator`
  instead of the plugin folder name `feishu_meeting_coordinator`; new plugins
  must not copy this path — see Prompt Asset Boundary; a migration to
  `src/prompts/feishu_meeting_coordinator/` with a regression test is tracked
  separately)
- good: `dashboard/plugin_api.py` is an executable Python adapter, not static
  assets
- good: four reference test files covering package inventory, plugin
  registration, tool behavior, and message rendering

Gaps addressed by this guideline:

- the authoring contract for keeping `plugin.yaml`, `SKILL.md`, and
  `marketplace/index.json` synchronized is now explicit
- the marketplace contract is now distinguished from Codex plugin packaging
- plugin and bundled skill naming convention is now documented; future plugins
  must not infer words like `bot` unless supplied by the author
- `schemas.py` is the recommended home for new tool schemas; the reference
  keeping `TOOL_SCHEMAS` in `__init__.py` is an existing implementation detail,
  not a pattern for new scaffolds
- `toolset=` is documented as required in `ctx.register_tool`
- generator output must pass `schema=` as the `{"parameters": ...}` sub-object
  shape only; `name` and `description` are separate named arguments (the Hermes
  registry stores the dict and wraps it internally, but Semantier marketplace
  plugins standardize on this sub-object shape for consistency)

The rest of this guide makes the authoring contract explicit enough to support
deterministic scaffolding.

## Plugin Types In Scope

This marketplace guideline currently supports one package class:

- standalone Semantier/Hermes plugins that register tools, hooks, CLI commands,
  bundled skills, or a combination of those surfaces

Out of scope for generator scaffolding unless a follow-up guideline is added:

- `plugins/platforms/<name>/`
- `plugins/model-providers/<name>/`
- `plugins/memory/<name>/`
- `plugins/context_engine/<name>/`
- `plugins/image_gen/<name>/`
- pip entry-point plugin packages

If a plugin request actually targets one of those categories, do not force it
into the standalone marketplace template in this document.

## Required Package Layout

Every Semantier marketplace plugin must live under:

```text
semantier-skills/
  plugins/
    <plugin_name>/
      plugin.yaml
      __init__.py
      SKILL.md                # required when the plugin exposes user-facing agent behavior
      tools.py                # recommended for tool handlers
      schemas.py              # recommended for tool parameter schemas
      <domain_adapter>.py      # optional, for platform/API/domain adapters
      scripts/                # optional
      dashboard/              # optional Python modules or UI/API adapters
      assets/                 # optional
```

Rules:

- `<plugin_name>` must be ASCII-stable and machine-safe. Prefer lower-case
  snake_case to match current repo convention.
- The directory name and `plugin.yaml` `name` must match exactly.
- Keep plugin-owned machine identifiers ASCII-only.
- Bundle the companion `SKILL.md` inside the plugin package when the plugin
  depends on agent-facing instructions.
- `__init__.py` is required for loadable Hermes plugins.
- Prefer explicit modules such as `tools.py`, `schemas.py`, `cli.py`, and
  `messages.py` when the plugin grows beyond a trivial surface.
- Keep plugin-local assets and helper scripts inside the plugin directory; do
  not scatter plugin runtime files elsewhere in the repo.
- Domain-specific adapter modules such as `feishu_calendar.py` are valid and
  should live beside `tools.py` when they support only this plugin.
- `dashboard/` may contain executable Python adapter modules, not only static
  assets. Do not create it unless the plugin has a dashboard/API surface.

## Recommended Layout By Capability

### Tool-only plugin

```text
semantier-skills/plugins/<plugin_name>/
  plugin.yaml
  __init__.py
  schemas.py
  tools.py
```

### Tool plugin with bundled skill

```text
semantier-skills/plugins/<plugin_name>/
  plugin.yaml
  __init__.py
  schemas.py
  tools.py
  SKILL.md
```

### Operational plugin with helper modules

```text
semantier-skills/plugins/<plugin_name>/
  plugin.yaml
  __init__.py
  schemas.py
  tools.py
  cli.py
  messages.py
  scripts/
  dashboard/
  SKILL.md
```

Use the smallest layout that fits the plugin. Do not create empty directories
just because another plugin uses them.

## Required Files

### `plugin.yaml`

Minimum required fields for a standalone plugin:

```yaml
name: my_plugin
version: 0.1.0
description: Short runtime-oriented summary.
author: Semantier
kind: standalone
platforms:
  - linux
  - macos
  - windows
```

Guidance:

- `name` must match the plugin folder name.
- `description` should describe runtime capability, not prompt policy prose.
- Use semver-like versioning and update it intentionally.
- Keep prompt policy text out of `plugin.yaml`; put that in prompt assets or
  `SKILL.md`, consistent with repo architecture rules.
- `kind` should stay `standalone` for plugins covered by this guideline.
- Add `provides_tools` and `provides_hooks` when they are stable and known; they
  are useful metadata even though runtime registration remains the source of truth.

Recommended richer manifest for tool plugins:

```yaml
name: my_plugin
version: 0.1.0
description: Short runtime-oriented summary.
author: Semantier
kind: standalone
provides_tools:
  - my_tool
provides_hooks: []
platforms:
  - linux
  - macos
  - windows
```

### `__init__.py`

`__init__.py` must expose the plugin registration surface expected by Hermes.
For tool plugins, it should register the tool handlers and any CLI bindings.

Minimum contract:

- expose `register(ctx)`
- register every tool with `ctx.register_tool(...)`
- register bundled skills with `ctx.register_skill(...)` when `SKILL.md` exists
- register CLI commands with `ctx.register_cli_command(...)` when applicable

Recommended registration pattern:

```python
from pathlib import Path

from . import schemas, tools


def register(ctx):
    ctx.register_tool(
        name="my_tool",
        toolset="my_plugin",
        schema=schemas.function_schema("my_tool"),
        handler=tools.my_tool,
        description="Short action-oriented description.",
    )
    ctx.register_skill(
        name="my-plugin-skill",
        path=Path(__file__).with_name("SKILL.md"),
        description="User-facing workflow guidance for the plugin.",
    )
```

The exact helper module split can vary, but `register(ctx)` is not optional.
`toolset` is required by the Hermes `PluginContext.register_tool(...)` contract;
use a stable toolset name, normally the plugin name or a documented capability
group such as `meeting-coordinator`.

Bundled skills should be registered with a concrete `Path`, preferably
`Path(__file__).with_name("SKILL.md")`, so discovery does not depend on the
current working directory.

### `schemas.py`

Recommended for any plugin that exposes tools. New generator output should
extract schemas to `schemas.py` instead of placing large schema dictionaries in
`__init__.py`. The existing `feishu_meeting_coordinator` plugin keeps
`TOOL_SCHEMAS` in `__init__.py` as an implementation detail, not a rule for new
scaffolds.

Rules:

- each exported schema must be a Python `dict`
- schemas passed to `ctx.register_tool(schema=...)` should be function-body
  dictionaries containing at least `parameters`
- pass the human-readable tool description through `ctx.register_tool(description=...)`
- keep parameters explicit and machine-safe
- prefer aliases only when they reduce user friction materially
- do not encode prompt policy essays into schema descriptions

Minimal example:

```python
TOOL_SCHEMAS = {
    "my_tool": {
        "type": "object",
        "properties": {
            "input": {"type": "string", "description": "Required input."}
        },
        "required": ["input"],
    },
}


def function_schema(name: str) -> dict:
    return {"parameters": TOOL_SCHEMAS[name]}
```

### `tools.py`

Recommended for any plugin that exposes tools.

Rules:

- handlers should accept `args: dict` plus `**kwargs`
- handlers should return serialized JSON strings or the repo's established tool
  return shape for the plugin surface
- prefer deterministic behavior and clear error payloads
- do not rely on generated shell scripts or ad hoc temporary Python files for
  tool execution paths
- keep Semantier authority logic out of plugin-local tool glue

### `SKILL.md`

Include `SKILL.md` when the plugin has an agent-facing workflow. The skill file
should:

- instruct the agent to use registered tools directly
- forbid runtime code-generation workarounds when the plugin surface is missing
- keep user-facing workflow rules in the skill, not inline in runtime code

Required frontmatter:

```yaml
---
name: my-plugin-skill
description: One-paragraph description of when to use the bundled skill.
---
```

Optional frontmatter fields currently used by repo plugins include:

- `version`
- `author`
- `license`
- `tags`

When a plugin bundles a skill, document the mapping clearly:

- plugin package name: machine/runtime identity
- bundled skill name: agent-facing invocation identity

The bundled skill name is free-form within the Hermes skill-name constraints
(`a-z`, `A-Z`, digits, `_`, `-`; no `:`). A generator must ask for it or derive
an explicit default such as `<plugin-name-kebab>-skill`; it must not infer
special words like `bot` unless the user supplies them.

For plugin workflows similar to `feishu_meeting_coordinator`, the skill should
also explicitly say what the agent must not do when the plugin is unavailable.

## Marketplace Index Contract

Every published plugin must have an entry in the `skills` array inside
`semantier-skills/marketplace/index.json`. The top-level object uses
`"source": "static-index"` even when individual entries have `"type": "plugin"`.

Current index shape:

```json
{
  "source": "static-index",
  "skills": [
    {
      "id": "owner/repo/plugins/my_plugin",
      "name": "my_plugin",
      "type": "plugin",
      "path": "plugins/my_plugin",
      "description": "Short summary",
      "author": "Semantier",
      "category": "Productivity",
      "tags": ["tag-one", "tag-two"],
      "source": "custom-marketplace",
      "trust_level": "community",
      "homepage": "https://github.com/owner/repo/tree/main/plugins/my_plugin",
      "repo": "https://github.com/owner/repo"
    }
  ]
}
```

Rules:

- `type` must be `"plugin"` for plugin packages.
- entries live under the top-level `skills` array; do not create a `plugins`
  array for this marketplace format.
- `path` must be the repo-relative package root, not `plugin.yaml`.
- `id` should be stable and match the install identifier form
  `owner/repo/plugins/<plugin_name>`.
- Keep `name` aligned with `plugin.yaml` `name`.
- Use flat tags with concise ASCII values.
- `homepage` should point to the plugin directory in the default branch.
- append new entries; do not reorder existing entries without an explicit reason
- keep `source` as `"custom-marketplace"` for repo-local static entries
- keep `trust_level` intentional and stable

Recommended entry authoring procedure:

1. copy an existing plugin entry shape
2. change `id`, `name`, `path`, `description`, `tags`, and URLs
3. verify the `path` matches the actual package root
4. verify the install identifier and homepage resolve to the same package

When `marketplace/index.json` already exists, append only the inner entry object
to the existing `skills` array. Preserve the existing top-level object and
`source` value.

## Naming And Metadata Rules

- Plugin package name: lower-case ASCII snake_case.
- Bundled skill name: may differ from plugin name, but document the mapping in
  `SKILL.md` and plugin design docs.
- Category should be user-facing and stable, for example `Productivity`.
- Descriptions should stay short and operational.
- Do not encode localization into machine identifiers. Localized labels belong
  in documentation or presentation metadata.

## Runtime Boundary Rules

The plugin package is not allowed to become a shadow runtime layer.

Keep these concerns in Semantier runtime code under `src/`:

- governed identity and authority resolution
- authoritative persistence needed for runtime continuity
- authenticated web/gateway behavior
- deterministic replay and audit logic

Keep these concerns inside the plugin package:

- tool registration
- tool-facing schemas
- helper functions and adapters local to the plugin surface
- bundled agent instructions
- plugin-owned CLI wiring

If a feature needs a new authoritative store, replay contract, or tenant-facing
runtime route, the plugin package alone is not the whole implementation.

## Prompt Asset Boundary

Use bundled `SKILL.md` for agent-facing procedural instructions. Use prompt
assets under `src/prompts/` for runtime message templates, localized operator
messages, cron prompts, and user-facing text assembled by Semantier runtime
code.

A plugin-local renderer such as `messages.py` may load repo-owned prompt assets
when the plugin needs deterministic runtime message rendering, as
`feishu_meeting_coordinator` does. That pattern is valid only when:

- the templates remain in `src/prompts/<plugin_name>/` inside the repo
- the plugin passes explicit structured values into the renderer
- the renderer does deterministic template substitution
- tests cover localized and default rendering

**Deployment precondition:** the `_prompt_root()` directory walk in `messages.py`
finds templates only when the plugin file sits under a tree that also contains
`src/prompts/<plugin_name>/` as a descendant. This is satisfied in the repo
development environment but is **not** automatically satisfied when a
marketplace install copies the plugin into a workspace path such as
`.hermes/plugins/<plugin_name>/`. Before generating `messages.py` for a
marketplace-distributed plugin, confirm one of the following:

1. The runtime install step copies `src/prompts/<plugin_name>/` to a
   known location that the walk will reach from the installed plugin path.
2. The plugin uses a runtime prompt resolver injected through the plugin
   context rather than the self-contained directory walk.
3. The plugin does not require localized runtime messages and `messages.py`
   should be omitted.

**Default recommendation for marketplace-distributed plugins:** use option 3
(omit `messages.py`) until a runtime prompt resolver is injected through the
plugin context. Option 1 (install-time copy) adds complexity to the marketplace
installer and is not yet standardized. Option 2 (injected resolver) is
architecturally clean but requires the Hermes plugin context to expose a resolver
interface, which does not yet exist. The repo development environment supports
the directory-walk pattern because `src/prompts/` is always reachable; that
should not be assumed for installed plugins.

Do not generate a `messages.py` that silently fails to locate templates at
install time. If the prompt location is not guaranteed by a supported mechanism
above, omit `messages.py` until the install-time copy or resolver is in place.

Prompt directory naming: use `src/prompts/<plugin_name>/` where `<plugin_name>`
matches the plugin folder name exactly (e.g., `feishu_meeting_coordinator`). Do
not use semantic aliases or rename the directory; the walk pattern in
`_prompt_root()` depends on the name matching.

Do not put long runtime prompt prose or localized message templates directly in
Python plugin code.

## Generator Skill Requirements

This section defines what a future `semantier-plugin-generator` skill must be
able to do from this guideline alone.

### Required Inputs

The generator skill should require or infer:

- plugin package name
- short runtime description
- plugin capability class:
  `tool-only`, `tool-plus-skill`, or `operational-plugin`
- whether the plugin bundles a user-facing skill
- bundled skill name when a skill is generated, or permission to derive the
  default `<plugin-name-kebab>-skill`
- tool list, including:
  - tool name
  - toolset name, defaulting to the plugin name unless the user supplies a
    capability group
  - purpose
  - required parameters
  - optional parameters
- whether the plugin exposes CLI commands
- whether the plugin needs localized or template-driven runtime messages; if yes,
  also ask:
  - deployment scope: `repo-dev-only` (directory-walk pattern supported) or
    `marketplace-distributed` (default; `messages.py` deferred until resolver lands)
  - when scope is `repo-dev-only`: per-message template file name
    (e.g. `FOLLOWUP_MESSAGE.md`), placeholder field names, and whether a
    localized variant (e.g. `.zh.md`) is needed — the generator creates minimal
    templates automatically; do not create prompt stubs when `messages.py` is
    deferred, to avoid dead assets
- whether the plugin needs a dashboard/API adapter surface (triggers `dashboard/`)
- marketplace metadata:
  - category
  - tags
  - author override if not `Semantier`
  - repo slug or homepage base if not derived from current repo

### Required Outputs

For an in-scope standalone marketplace plugin, the generator skill should be
able to create:

- `semantier-skills/plugins/<plugin_name>/plugin.yaml`
- `semantier-skills/plugins/<plugin_name>/__init__.py`
- `semantier-skills/plugins/<plugin_name>/schemas.py` when the plugin exposes tools
- `semantier-skills/plugins/<plugin_name>/tools.py` when the plugin exposes tools
- `semantier-skills/plugins/<plugin_name>/SKILL.md` when the plugin bundles a skill
- conditional `cli.py`, `messages.py`, `scripts/`, `dashboard/`
- `src/prompts/<plugin_name>/<TEMPLATE_NAME>.md` (one per message, plus
  localized variants) when `messages.py` is generated
- a new entry in `semantier-skills/marketplace/index.json`
- matching tests or test stubs for discovery/registration/install behavior

### Generator Decision Rules

The generator skill should:

- reject Codex `.codex-plugin` scaffolding for this marketplace unless the user
  explicitly asks for a parallel Codex package
- default to `kind: standalone`
- default to `author: Semantier`
- default to cross-platform `linux`, `macos`, `windows`
- create `SKILL.md` only when the plugin actually needs agent-facing workflow
  instructions
- create `schemas.py` and `tools.py` for new tool plugins
- only generate `messages.py` and `src/prompts/<plugin_name>/` template files
  when the user explicitly selects `repo-dev-only` scope or confirms that
  install-time prompt copy or resolver support is in place; default to omitting
  both when the deployment scope is unspecified or `marketplace-distributed`
- do not create `src/prompts/<plugin_name>/` stub files when `messages.py` is
  deferred; empty prompt directories are dead assets and must not be scaffolded
- pass `schema=schemas.function_schema("<tool_name>")` or the equivalent
  `{"parameters": ...}` shape into `ctx.register_tool(...)`
- pass `description=...` and `toolset=...` explicitly into every
  `ctx.register_tool(...)` call
- register bundled skills with `Path(__file__).with_name("SKILL.md")`
- avoid creating empty optional directories
- preserve existing marketplace entry order
- append entries to the top-level `skills` array in `marketplace/index.json`
- add tests whenever a new install/discovery contract is introduced

### Generator Non-Goals

The generator skill should not:

- invent new marketplace schemas
- write `.codex-plugin/plugin.json` as a substitute for `plugin.yaml`
- move Semantier runtime state into unmanaged plugin-local files
- generate prompt-policy prose inline in Python runtime code
- scaffold out-of-scope Hermes plugin categories using this template

## Deterministic Scaffolding Template

For a new tool plugin with a bundled skill, the generator may use this file set
as the default scaffold.

### `plugin.yaml`

```yaml
name: my_plugin
version: 0.1.0
description: Short runtime-oriented summary.
author: Semantier
kind: standalone
provides_tools:
  - my_tool
provides_hooks: []
platforms:
  - linux
  - macos
  - windows
```

### `__init__.py`

```python
from pathlib import Path

from . import schemas, tools


def register(ctx):
    ctx.register_tool(
        name="my_tool",
        toolset="my_plugin",
        schema=schemas.function_schema("my_tool"),
        handler=tools.my_tool,
        description="Do one specific task.",
    )
    ctx.register_skill(
        name="my-plugin-skill",
        path=Path(__file__).with_name("SKILL.md"),
        description="User-facing workflow guidance for the plugin.",
    )
```

### `schemas.py`

```python
TOOL_SCHEMAS = {
    "my_tool": {
        "type": "object",
        "properties": {
            "input": {
                "type": "string",
                "description": "Required input.",
            }
        },
        "required": ["input"],
    },
}


def function_schema(name: str) -> dict:
    return {"parameters": TOOL_SCHEMAS[name]}
```

### `tools.py`

```python
from __future__ import annotations

import json


def my_tool(args: dict, **kwargs) -> str:
    del kwargs
    value = str(args.get("input") or "").strip()
    if not value:
        return json.dumps({"ok": False, "error": "input is required"})
    return json.dumps({"ok": True, "input": value})
```

### `messages.py` (operational plugins only)

Generate this file only when the plugin needs localized or template-driven
runtime messages and the deployment precondition in the Prompt Asset Boundary
section is satisfied. Templates must remain in `src/prompts/<plugin_name>/`
(name must match the plugin folder exactly), not inline in this module.

```python
from __future__ import annotations

from pathlib import Path


def _prompt_root() -> Path:
    for parent in Path(__file__).resolve().parents:
        candidate = parent / "src" / "prompts" / "my_plugin"
        if candidate.exists():
            return candidate
    raise RuntimeError("my_plugin prompt assets not found")


def _render(template_name: str, values: dict[str, str], *, language: str = "en") -> str:
    prompt_root = _prompt_root()
    prompt_name = template_name
    if language and language != "en":
        localized = template_name.removesuffix(".md") + f".{language}.md"
        if (prompt_root / localized).exists():
            prompt_name = localized
    text = (prompt_root / prompt_name).read_text(encoding="utf-8")
    for key, value in values.items():
        text = text.replace("{{" + key + "}}", str(value))
    return text


def render_my_message(
    *,
    field_one: str,
    field_two: str,
    language: str = "en",
) -> str:
    return _render(
        "MY_MESSAGE.md",
        {"field_one": field_one, "field_two": field_two},
        language=language,
    )
```

Add the corresponding template file at
`src/prompts/my_plugin/MY_MESSAGE.md` (and a localized variant such as
`MY_MESSAGE.zh.md` when needed). Tests must cover both default and localized
rendering.

### `SKILL.md`

```markdown
---
name: my-plugin-skill
description: Use this skill when the user needs the plugin workflow.
---

# My Plugin Skill

Use the registered plugin tools directly.

If the required plugin tools are unavailable, stop and report that the plugin
tool surface is not loaded. Do not work around the missing tool by generating
runtime code or shell commands.
```

### Marketplace index shape

```json
{
  "source": "static-index",
  "skills": [
    {
      "id": "owner/repo/plugins/my_plugin",
      "name": "my_plugin",
      "type": "plugin",
      "path": "plugins/my_plugin",
      "description": "Short runtime-oriented summary",
      "author": "Semantier",
      "category": "Productivity",
      "tags": ["plugin"],
      "source": "custom-marketplace",
      "trust_level": "community",
      "homepage": "https://github.com/owner/repo/tree/main/plugins/my_plugin",
      "repo": "https://github.com/owner/repo"
    }
  ]
}
```

For an existing index, generate and append only the inner plugin object under
`skills[]`.

## Authoring Workflow

1. Create `semantier-skills/plugins/<plugin_name>/`.
2. Add `plugin.yaml` with a stable ASCII `name`.
3. Add `__init__.py` and register tools/CLI surfaces.
4. Add `schemas.py` and `tools.py` for tool surfaces.
5. Add bundled `SKILL.md` if agent-facing instructions are required.
6. Add any helper modules, scripts, or dashboard files.
7. Add or update the plugin entry in `semantier-skills/marketplace/index.json`.
8. Add or update tests covering install/discovery behavior, including
   platform toolset exposure for any plugin that registers tools.
9. Add or update design docs when the plugin introduces runtime contracts.

## Review Checklist

Before publishing a plugin entry, verify:

- folder name matches `plugin.yaml` `name`
- package contains `plugin.yaml` and `__init__.py`
- tool plugins include `schemas.py` and `tools.py`, or an intentional equivalent
- bundled `SKILL.md` exists when the plugin depends on agent instructions
- marketplace `id`, `name`, and `path` match the package
- install identifier resolves to the intended repo path
- `register(ctx)` wires every declared tool/skill/CLI surface
- every `ctx.register_tool(...)` call includes an explicit `toolset=` argument
- every `ctx.register_tool(...)` passes `schema=` as the `{"parameters": ...}` sub-object shape (not a full OpenAI function schema with top-level `name`/`description`)
- tool plugins installed into a workspace are not only listed in
  `plugins.enabled`; their toolset is also present in the intended
  `platform_toolsets` entries, especially `api_server` for web/API sessions
- no prompt-policy prose is hidden in runtime code
- no non-ASCII machine identifiers were introduced
- any Semantier-owned durable state remains in governed runtime code, not
  unmanaged plugin-local files
- tests cover install, discovery, and any package-specific invariants
- message-rendering plugins have prompt-rendering tests
- operational plugins have focused tool/gateway-binding tests

## Validation And Tests

At minimum, run the relevant repo tests for plugin packaging and marketplace
search/install behavior:

```bash
pytest -v \
  tests/test_marketplace_plugin_install.py \
  tests/test_skills_search_marketplace.py
```

For plugins that bundle tools and skills, also add plugin-specific tests covering:

- package inventory
- `register(ctx)` tool and skill registration
- key schema invariants
- launcher/install behavior proving the installed plugin's toolset is exposed
  through the intended `platform_toolsets`; bundled `SKILL.md` visibility alone
  is not sufficient because the agent can see the skill while the tool remains
  unavailable
- any plugin-specific "must not generate code at runtime" guardrails encoded in
  `SKILL.md`
- tool handler behavior and gateway/runtime binding behavior for operational plugins
- runtime message rendering when the plugin uses `src/prompts/` assets

The `feishu_meeting_coordinator` tests are the reference model:

- `tests/test_feishu_meeting_coordinator_package_inventory.py`
- `tests/test_feishu_meeting_coordinator_plugin.py`
- `tests/test_feishu_meeting_coordinator_tools.py`
- `tests/test_feishu_meeting_coordinator_messages.py`

A lightweight guideline contract test may assert that the canonical contracts
are present in generated or hand-authored plugins. Key invariants worth
asserting:

- `marketplace/index.json` top-level contains `"skills"` (not `"plugins"`)
- every `register_tool` call in `__init__.py` includes `toolset=`
- every `register_tool` call does not pass a schema dict containing a top-level
  `"name"` key (i.e., `schema=` carries only the sub-object)
- install/runtime tests assert that tool plugins are present in both
  `plugins.enabled` and the intended `platform_toolsets`
- `register_skill` path argument uses `Path(__file__).with_name("SKILL.md")` or
  an equivalent absolute path expression
- if `messages.py` exists, it does not contain inline template strings longer
  than a single-sentence fallback

## Completeness Criteria

This guideline is complete enough for a generator skill only if the generator
can answer all of these without improvising new repo conventions:

- where the plugin folder lives
- which files are mandatory
- what `plugin.yaml` must contain
- how `register(ctx)` should look
- what `schema=` argument shape `ctx.register_tool` accepts (answer: `{"parameters": ...}` only; `name` and `description` are separate args)
- what `toolset=` value to use and that it is required (answer: plugin name or an explicit capability group supplied by the author)
- how installation exposes that toolset to the intended runtime platforms
  through `platform_toolsets`
- when to generate `SKILL.md`
- when to generate `messages.py` and how it must reference `src/prompts/` assets
- how to update marketplace metadata
- which behaviors belong in plugin code versus Semantier runtime code
- which tests must be created or updated

If any of those answers would require guesswork, extend this guideline before
building the generator skill.

## Future Compatibility Note

If this repo later needs a Codex-native plugin marketplace, treat that as a
parallel packaging target with its own manifest files and validation flow. Do
not silently repurpose the current `plugin.yaml` plus `marketplace/index.json`
contract as if it were a Codex `.codex-plugin` package.
