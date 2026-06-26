Installation and Initial Setup
Getting Hermes running takes a single command. 
On Windows, you run this in PowerShell:
iex (irm 
https://hermes-agent.nousresearch.com/install.ps1
)
On Linux, macOS, or WSL, the equivalent is:
curl -fsSL 
https://hermes-agent.nousresearch.com/install.sh
 | bash
Once installed, restarting the terminal and running hermes setup launches a guided configuration flow that walks through model selection, terminal backend, messaging gateway, and tool setup in sequence.
Choosing and Routing Models
The first real decision in setup is which LLM provider powers the agent's "brain." Authentication happens via OAuth rather than raw API keys, which extends to being able to log in through an existing Claude Code or Codex CLI session rather than generating a separate API key.
What's genuinely well-designed here is how Hermes separates the model used for your main conversation from the models used for background and auxiliary tasks. By default, the same model handles both, but each auxiliary task can be pointed at a different provider independently. 
The tasks that support this kind of override are:
	• vision – image analysis and description
	• web_extract – summarizing long web pages
	• compression – compressing an overflowing conversation context
	• title_generation – generating session titles
	• curator – the background agent responsible for the self-improving loop
	• kanban_decomposer – breaking large tasks into subtasks in Kanban mode
	• goal_judge – the agent that checks whether a /goal has actually been achieved
This is configured directly in config.yaml, for example:
yaml
# Primary model for chat and complex reasoning
model:
  provider: "anthropic"
  default: "claude-4-8-sonnet"
  auxiliary:
    vision:
      provider: "gemini"
      model: "gemini-2.5-flash"
    compression:
      provider: "custom"
      base_url: "http://localhost:11434/v1"
      api_key: "none"
      model: "qwen2.5:32b"
This kind of explicit routing solves a real problem with OpenRouter as a default choice: the same nominal model is often deployed by many different providers, frequently in different quantizations, and OpenRouter will silently shuffle each new request between roughly twenty of them. 
The practical effect is that within a single session, you're not talking to one consistent model – you're talking to a rotating cast of differently-configured instances of it, some of which handle tool calls and prompt templates more reliably than others. Routing manually inside Hermes avoids this entirely.
It's also worth noting that if you want to save money on the conversational model without sacrificing coding quality, Hermes supports /claude_code and /codex commands that delegate coding tasks directly to those CLI tools rather than handling them with the configured chat model.
Terminal Backends
A core piece of the architecture is the Terminal Backend Environment, which determines where and how shell commands and Python scripts actually execute, and how the agent touches your filesystem. Hermes supports five.
Local is the default. Commands run directly on your machine with the same permissions as your user account – no isolation. It's the right choice for local development and trusted personal use where you want the agent editing your actual project files. 
Safety here relies entirely on a built-in approvals system that intercepts destructive commands (an rm -rf /, a DROP TABLE) and asks for explicit permission before running them.
Docker runs the agent inside an isolated sandbox so it can't touch your host system. SSH has the agent execute commands and work with files on a remote server over a remote connection. Modal runs everything in serverless cloud sandboxes – you're essentially renting compute by the second, paying only for the actual seconds your code runs.
Daytona is a container-management layer purpose-built for AI coding agents; it's faster than running Docker directly and handles environment setup and dependency installation automatically.
For most personal use cases, Local is genuinely sufficient – the other options matter mainly if you're running untrusted code or operating at team scale.
Messaging Gateway and Tool Configuration
After the terminal backend, setup moves to choosing where you'll actually talk to the agent – Telegram being the most polished option. Selecting it gives you a direct link that spins up a pre-configured bot; there's no manual bot-token setup involved.
The remainder of setup walks through enabling individual tools and their respective providers – browser automation, image generation, text-to-speech, and web search. For web search specifically, self-hosted Firecrawl or Exa stand out as strong choices for agent-oriented scraping and retrieval. 
X search requires a Grok subscription to enable, which is worth knowing before you go looking for it in the menu.
Slash commands worth knowing
Hermes ships with a long list of slash commands, most self-explanatory by name, but a handful are worth calling out specifically.
	1. /background <prompt> runs a task in the background without interrupting your main session. 
	2. /goal sets a long-term objective the agent works toward persistently, with subcommands for pausing, resuming, clearing, or checking status; 
	3. /subgoalmanages smaller objectives nested under an active goal. 
	4. /kanban orchestrates asynchronous, long-running work across multiple independent agents – functioning like an actual Kanban board where a pool of tasks gets distributed among worker agents and moves through to-do, in-progress, and done as it gets handed off between them.
On the development side /github_pr_workflow handles the full branch-to-merge cycle including CI, /github_code_reviewreviews pull requests, and /codebase_inspection analyzes a repository's language breakdown and line counts. /dogfood is a dedicated QA mode that hunts for bugs in a web app and produces an evidence-backed report. /spike runs a quick, throwaway experiment to validate an idea before committing to full development, and /systematic_debugging works through bugs in four phases, understanding root cause before attempting a fix.
There's also a cluster of integration-specific commands – /notion, /obsidian, /airtable, /google_workspace, /arxiv, /blogwatcher, /polymarket, /ocr_and_documents, /youtube_content – each wrapping a specific external service or workflow, plus /bundles, which groups several existing skills under one slash command via small YAML configuration files.
Cron jobs and Webhooks
Two automation primitives deserve particular attention. 
	• Cron jobs let you schedule a script to run on a timer; if you pass -no-agent when creating one, Hermes will execute a plain Python or bash script and just forward its output to your messenger, without spending any LLM tokens at all.
	• Webhooks are the more powerful piece: they let the agent react to external events rather than a timer. You can configure a webhook so that, for instance, a new GitHub pull request automatically triggers an agent with a specific prompt and skill set – effectively standing up an on-call reviewer agent with zero manual intervention per PR.
Context Engines
The context engine governs how Hermes compresses and manages conversation history once it approaches the model's token limit, and there are two options. 
	• The default, called Compressor, applies lossy summarization to the middle portion of a long conversation. 
	• The alternative, LCM (Lossless Context Management), takes a structurally different approach: instead of producing a text summary, it builds a directed acyclic graph of the conversation's key points, letting the agent navigate from a high-level, heavily compressed view down to the specific original messages that support it.
Memory Engines
External memory providers run alongside Hermes's built-in local memory files, MEMORY.md and USER.md, adding capabilities like semantic search and knowledge graphs. 
Several can be configured directly through the setup TUI.
	1. Honcho is built around modeling a detailed user profile, using background LLM calls to synthesize observations across two layers: a base layer of session summaries and profiles, and a dialectical layer that analyzes the user's current needs. 
	2. OpenViking is a context database that builds a filesystem-style knowledge hierarchy, supporting tiered context retrieval and automatically sorting extracted facts into six categories – events, patterns, preferences, and so on – at the end of each session. 
	3. Mem0 is a fully managed cloud memory service; fact extraction happens server-side via LLM, and it includes semantic search, result reranking, and automatic deduplication, though being cloud-hosted it's also the one option here with a recurring cost.
	4. Hindsight is a more advanced long-term memory system built on a knowledge graph, in the GraphRAG style. It extracts entities from sessions, builds relationships between them, and preserves full conversational turns including tool calls, with memory split into four categories: facts about the world, the agent's own experience, opinions, and observations. 
	5. Holographic is a local, SQLite-based fact store with no external dependencies, including a trust-scoring system for stored facts and the use of Holographic Reduced Representations to support algebraic, compositional queries, with the ability to automatically detect contradictions within its knowledge base.
	6. RetainDB is a cloud API for team memory, offering hybrid search across vector, BM25, and reranking methods, with memory split into seven distinct types and delta compression to keep storage efficient. 
	7. ByteRover is a portable, local memory system accessed through a CLI, building a hierarchical knowledge tree and extracting important facts before lossy compression has a chance to drop them from context. 
	8. Supermemory offers semantic long-term memory with a graph API: it ingests full session logs after a conversation ends to build its knowledge graph, periodically cleans recalled facts to avoid pollution from current turns, and can isolate memory into separate containers per agent profile.
For day-to-day use, the default local memory is genuinely adequate for most people – the heavier systems trade real resource cost, especially RAM for locally hosted options, for capability that most workflows don't yet need.
The Self-Improving Loop
This is the feature that most distinguishes Hermes from a conventional agent: a set of asynchronous background processes that continuously analyze your conversations, extract useful patterns from them, and write those patterns into long-term memory and procedural memory (skills) – then maintain that accumulated knowledge so it doesn't decay over time. The whole system runs in parallel with your main chat and is built from three components: a trigger system, a background review agent, and a curator.
	• The Trigger System
Hermes doesn't analyze every message in real time, since that would burn tokens for no benefit. Instead, it relies on two counters that trigger a reflection pass once they cross a threshold. 
A memory trigger fires every ten user prompts, checking whether new facts worth saving have appeared in the conversation. 
A skill trigger fires every ten tool-call iterations within a single turn, on the theory that if the agent just spent that many steps fighting through a problem by trial and error, that experience is worth analyzing and possibly turning into a reusable skill. 
Once either counter hits its limit, an internal function fires, handing off a snapshot of the current conversation to a background review process.
	• The Background Review Agent
This snapshot goes to a fully separate, isolated agent process that runs in parallel without interrupting your main session. It works in two directions. 
	1. On the declarative side, if it notices new user preferences or environment details – a preference for Supabase, a project pinned to Python 3.12 – it updates MEMORY.md or USER.md, depending on which file the fact belongs in. 
	2. On the procedural side, if it detects that the agent just solved a non-trivial problem or worked out a complex process, it can create a new skill, edit an existing one, apply a targeted patch, or delete one outright. Any skill it creates gets explicitly tagged as agent-generated, so its origin is always traceable.
For the curator to eventually judge which of these self-generated skills are actually worth keeping, Hermes maintains a hidden usage log tracking, for every skill: how many times it's been loaded into a prompt, how many times the agent has opened it to read it, how many times it's been edited, and timestamps for creation, last use, and last edit.
	• The Curator
Left unchecked, this process can eventually produce hundreds of skills, some redundant, some outdated. 
The curator exists to keep that knowledge base from degrading. It only starts when two conditions hold simultaneously: enough time has passed since its last run (seven days, by default), and the main agent has been idle long enough (two hours, by default) that a heavy maintenance pass won't interfere with active work. 
Before making any changes, it automatically backs up the entire skills directory, so any unsatisfactory result can be rolled back through a single terminal command.
The curator's work happens in two phases:
	• The first is purely mechanical and doesn't involve an LLM call at all: it checks the usage metrics, marks any agent-generated skill unused for more than 30 days as deprecated, and moves anything unused for more than 90 days into an archive folder. Important skills can be explicitly pinned to protect them from this process.
	• The second phase is a genuine LLM review, run through a separate isolated agent instance using whichever model is configured for the curator's auxiliary task – by default the same model as the main conversation, though it can be pointed at something cheaper. It's worth being cautious about going too cheap here, since the quality of these decisions has a real downstream effect on the skill library. 
For each skill, the curator decides to keep it as-is if it's still accurate and useful, fix it if it contains errors or outdated methods, merge it with another skill covering substantially the same ground (correctly relocating any associated scripts, evals, or reference files and rewriting relative paths in the process), or archive it outright. 
At the end of the cycle, it produces a detailed report including a rename map showing exactly how old skill names mapped to new ones after any merges, so the reasoning behind every decision is fully auditable.
Using Hermes well
Cloud agents like this are genuinely valuable for any process you can run 24/7 – coding work being the notable exception – provided you've actually digitized that process carefully and built a solid skill around it, including evaluations.
The workflow that tends to produce good results looks something like this: 
	1. Start by recording yourself, in detail, walking through the process from absolute start to finish, ideally using a dictation tool so you capture it accurately – and this step only works if you genuinely understand the process or have researched it properly. 
	2. Take that recording or those notes and feed them into a coding agent using a skill-creation tool to produce a first draft; it won't be good enough yet to hand off, especially for anything complex. 
	3. Build in evals – reference solutions that represent a correct outcome – since they're what let you actually measure whether the skill is performing well rather than guessing. 
	4. Run the skill in a test setting and refine both the evals and the skill content based on what you observe, doing most of that editing by hand rather than delegating it. 
	5. Only once the skill behaves consistently and deterministically should it be handed off to the always-on agent. If the process depends on some external service, it's worth checking whether an existing MCP server or CLI already covers it before building one from scratch.
The broader point is that the range of things you can hand to an agent like this is limited mainly by how well you can specify the work, not by the agent's raw capability. 
Three principles seem to hold up across use cases: don't outsource coding work to an unsupervised 24/7 cloud agent, keep a human in the loop reviewing what the agent actually produces, and treat skill refinement as ongoing work rather than something you finish once and walk away from.

From <https://x.com/ScottyBeamIO/status/2066885278451519590> 
