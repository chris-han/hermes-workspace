# Hermes AI Agent Workshop: 3-Day Beginner-Oriented Agenda

## Audience and Design Intent

This workshop is redesigned for participants who are entry level to LLMs, AI agent architecture, and the Hermes agent harness.

Day 1 is for both IT professionals and business partners. It builds a shared language for LLMs, chatbots, agents, prompt engineering, context engineering, and harness engineering, then lets participants experience three enterprise use cases without requiring code.

Day 2 and Day 3 are for IT professionals only. Day 2 focuses on basic Hermes setup, operating model, core capabilities, and architecture. Day 3 focuses on customization and development through plugins, skills, tools, and hands-on coding labs.

## Workshop Outcomes

By the end of the workshop, business participants should be able to （day 1 morning）:

- Explain the difference between an LLM, chatbot, AI agent, and agent harness.
- Identify enterprise workflows that are good candidates for agent-assisted automation.
- Describe the human-in-the-loop controls required for enterprise adoption.
- Provide business requirements that IT can convert into agent skills, tools, and integrations.

By the end of the workshop, IT participants should additionally be able to:

- Install and configure Hermes for a working local or team-oriented setup.
- Use Hermes through CLI and, optionally, gateway channels.
- Explain the basic Hermes architecture: model provider, prompt/context assembly, tools, skills, memory, sessions, gateway, cron, delegation, and plugins.
- Build a simple Hermes skill and a simple plugin-backed tool.
- Decide whether a new capability should be implemented as a prompt pattern, skill, MCP integration, plugin, or core tool.
- Create a first backlog for enterprise pilot implementation.

## Reference Materials

- Existing workshop draft: `hermes-workspace/public/training/docs/AI_Agents_Workshop.docx`
- Beginner Hermes notes: `hermes-workspace/public/training/docs/hermes-for-beginner.md`
- Hermes official docs: https://hermes-agent.nousresearch.com/docs/
- Hermes learning path: https://hermes-agent.nousresearch.com/docs/getting-started/learning-path
- Hermes quickstart: https://hermes-agent.nousresearch.com/docs/getting-started/quickstart
- Hermes tools overview: https://hermes-agent.nousresearch.com/docs/user-guide/features/tools
- Hermes plugins overview: https://hermes-agent.nousresearch.com/docs/user-guide/features/plugins
- Build a Hermes plugin: https://hermes-agent.nousresearch.com/docs/guides/build-a-hermes-plugin
- Creating Hermes skills: https://hermes-agent.nousresearch.com/docs/developer-guide/creating-skills
- Hermes architecture: https://hermes-agent.nousresearch.com/docs/developer-guide/architecture

## Day 1: AI Agent Foundations for Enterprise

Audience: business partners, IT professionals, product owners, operations leads, process owners

Format: concept walkthrough, demos, guided exercises, group discussion

Primary goal: help beginners understand the AI application landscape through familiar consumer products first, then explain why enterprise use requires a harness, technical integration, local/private data options, and IT support.

中文目标：

- 先建立概念：LLM、多模态、Chatbot、Agent、Prompt Engineering、Context Engineering、Harness Engineering。
- 用豆包展示普通用户已经可以在家使用的 AI 能力，包括聊天、写作、图片理解、文件总结、语音/多模态交互等。
- 解释 AI 世界不止有豆包，还包括 DeepSeek、Gemini、ChatGPT、Codex 等不同模型和产品形态。
- 解释为什么国外模型或产品在某些能力上更强，但不是所有任务都更强：模型能力、工具生态、代码能力、多模态能力、上下文处理、企业集成、评测和产品成熟度不同，最终要按任务测试。
- 区分 consumer AI 和 enterprise AI：个人 App 内置功能很方便，但企业要连接内部数据、流程、权限、审计、安全和本地模型，需要技术人员建设 harness。
- 引入 Hermes：Hermes 是可建设、可定制的 agent harness，可以使用本地模型，让数据尽量留在本地，并通过 skills、AGENTS.md、MEMORY.md、工具和插件连接企业场景。

### Day 1 Anchor Examples: Doubao, DeepSeek, Gemini, ChatGPT, and Codex

Use Doubao, DeepSeek, Gemini, ChatGPT, and Codex as familiar examples for explaining the same three-layer AI application structure in beginner-friendly language.

AI world is not only Doubao. Use these examples to explain that "model", "harness", and "product" are different layers.

| Product Example | Model Layer | Harness Layer | Product Layer |
| --- | --- | --- | --- |
| Doubao / 豆包 | Seed model family | ByteDance's proprietary app/agent harness for prompt handling, context assembly, tool behavior, safety, routing, and product workflow | Doubao app experience: chat, file/image/voice interaction, feature buttons, mobile/desktop UI |
| DeepSeek | DeepSeek model family, such as DeepSeek-V3 or DeepSeek-R1 | DeepSeek's application and service harness for chat behavior, reasoning mode, context handling, API serving, safety, and product workflow | DeepSeek chat app, web UI, mobile app, and API-facing product experience |
| Gemini | Gemini model family | Google's Gemini application and platform harness, including prompt/context handling, tool and Workspace integration, safety, routing, and multimodal orchestration | Gemini app, Gemini web/mobile UI, Workspace side panels, Android integration, and API-facing product experience |
| ChatGPT | OpenAI GPT model family | OpenAI's ChatGPT harness for prompt/context handling, tools, memory, multimodal interaction, custom GPTs, connectors, and safety behavior | ChatGPT web/mobile/desktop app, voice, file analysis, image generation, browsing, data analysis, and connector experience |
| Codex | OpenAI coding agent model/runtime stack | Codex coding harness for repository context, terminal execution, patching files, running tests, code review, and task continuation | Developer-facing coding agent experience in CLI, IDE, cloud tasks, or integrated engineering workflows |

Simple formulas:

`豆包 App = Seed 模型 + 自研 Harness + 前端交互产品`

`DeepSeek App = DeepSeek 模型 + 自研 Harness + 前端/API 交互产品`

`Gemini App = Gemini 模型 + Google Harness + 前端/Workspace/Android 交互产品`

`ChatGPT App = GPT 模型 + OpenAI Harness + 前端/工具/连接器交互产品`

`Codex = 代码模型/Agent Runtime + 工程 Harness + 代码仓库/终端/测试交互产品`

This comparison helps participants separate three layers that are often confused:

- Model layer: the underlying LLM or multimodal model family that understands and generates language, code, images, or other media.
- Harness layer: the application/agent runtime around the model that manages prompts, context, tools, memory, safety checks, routing, session behavior, integrations, and product workflows.
- Product layer: the user-facing experience where people chat, upload files, use voice, trigger product features, connect enterprise apps, or call APIs.

Throughout Day 1, participants should compare each new concept against these examples:

- When we talk about LLMs, we are talking about model layers such as Seed, DeepSeek, Gemini, or GPT.
- When we talk about prompt engineering and context engineering, we are talking about how the harness shapes model behavior.
- When we talk about chatbot or agent experience, we are talking about the product plus harness working together.
- When we talk about Hermes, we are talking primarily about a buildable harness layer that lets IT teams create their own enterprise agent experience instead of only using a finished consumer app.

### Consumer AI vs Enterprise AI

Consumer AI apps already provide strong built-in features that anyone can use at home:

- Chat and writing assistance.
- Image understanding and multimodal Q&A.
- File summarization and document extraction.
- Voice interaction.
- Web search or browsing.
- Built-in tools such as image generation, data analysis, or coding help.

But stronger and broader enterprise use cases usually require technical help:

- Connect enterprise data sources: HR systems, finance systems, CRM, ERP, knowledge bases, document stores, calendars, and internal APIs.
- Write reusable instructions: `SKILL.md` for workflow skills, `AGENTS.md` for project rules, and memory files for durable preferences or environment facts.
- Build deterministic tools and plugins: API wrappers, validation logic, permission checks, audit logs, and integration handlers.
- Add security controls: local/private model routing, data minimization, approval gates, access control, and logging.
- Turn a prompt into a repeatable process: context assembly, tool calls, human approval, evidence capture, retries, and monitoring.

#### What Consumer AI Apps Usually Cannot Do by Default

| Need | Consumer AI App Limitation | Enterprise AI App with Harness |
| --- | --- | --- |
| Access internal systems | Cannot safely read private CRM, ERP, HR, finance, ticketing, or document systems unless manually pasted or connected through limited connectors | Uses approved APIs, service accounts, permissions, and audit logs to retrieve only authorized data |
| Respect company identity and permissions | Usually does not know the user's department, role, approval authority, tenant, or data access boundary | Resolves user identity, role, tenant, and permissions before retrieving data or taking action |
| Execute enterprise workflows | Can suggest steps, but usually cannot complete multi-system workflows such as creating tickets, updating CRM, sending approval requests, or booking internal resources | Calls tools/plugins to execute workflow steps with validation, approval gates, and rollback/error handling |
| Use governed enterprise knowledge | May rely on public knowledge, user-pasted content, or generic memory | Uses approved policies, templates, knowledge bases, versioned rubrics, and source-pinned context |
| Protect sensitive data | Data may leave the enterprise boundary depending on app/provider configuration | Can route to local/private models, minimize data exposure, redact sensitive fields, and keep data local where required |
| Produce auditable outputs | Often lacks enterprise-grade traceability for source data, tool calls, approvals, and final actions | Logs source systems, timestamps, model/tool versions, prompts, approvers, and execution evidence |
| Maintain repeatable behavior | A prompt may work once but drift across users, sessions, or model changes | Encodes repeatable behavior in skills, tools, tests, prompt assets, and workflow definitions |
| Handle exceptions safely | May give advice when data is missing or ambiguous | Escalates to humans, asks for missing inputs, blocks unsafe actions, and records why it stopped |
| Integrate local models or private deployment | Usually depends on the consumer app's hosted model and product choices | Can use local/private models and enterprise-controlled runtime infrastructure |
| Support IT-owned customization | Limited to product settings, custom instructions, connectors, or custom GPT-style configuration | Allows IT to build `SKILL.md`, `AGENTS.md`, memory, tools, plugins, webhooks, cron jobs, and gateway integrations |

Day 1 should make this transition clear:

`Consumer AI = powerful built-in app features`

`Enterprise AI = model + harness + enterprise data + security + workflow integration + human governance`

`Hermes = a buildable harness for enterprise AI, with skills, tools, plugins, memory, gateway, local execution, and optional local models`

### Morning Session: Concepts and Shared Vocabulary

| Time | Topic | Learning Scope | Activity |
| --- | --- | --- | --- |
| 09:00-09:20 | Welcome and participant alignment | Workshop goals, audience split, why day 1 is business plus IT and days 2-3 are IT-only | Participants list current pain points where knowledge work is slow, repetitive, or hard to scale |
| 09:20-10:00 | What is an LLM and multimodal model? | Token prediction, language generation, image/file/audio understanding, limitations, hallucination, context window, model providers; use Doubao to demonstrate everyday multimodal ability | Mini-lab: ask an LLM to explain a simple enterprise policy from insufficient information, observe uncertainty/hallucination risk, then retry with better source text |
| 10:00-10:30 | AI world beyond Doubao | Compare Doubao, DeepSeek, Gemini, ChatGPT, and Codex; why some foreign models/products may be stronger for coding, tool use, multimodal work, long-context tasks, ecosystem integrations, and agent workflows | Demo/discussion: compare the same task across a consumer chat app, ChatGPT-style assistant, and Codex-style coding agent |
| 10:30-10:45 | Break |  |  |
| 10:45-11:20 | Chatbot, agent, and prompt engineering | Chatbots respond; agents plan and use tools; prompt engineering controls role, task, constraints, examples, output format, and evaluation criteria | Mini-lab: write a simple prompt, test it with an LLM, score the answer, improve the prompt, and test again |
| 11:20-12:00 | Context engineering | Why agents need the right data, files, policies, system instructions, memory, retrieval, and tool results; difference between "more context" and "better context" | Mini-lab: run the same prompt with no context, excessive context, and curated context; compare answer quality |

### Afternoon Session: From Concepts to Enterprise Experience

| Time | Topic | Learning Scope | Activity |
| --- | --- | --- | --- |
| 13:00-13:35 | Consumer AI vs enterprise AI | Built-in consumer app features are useful, but consumer apps usually cannot safely access internal systems, enforce company permissions, execute governed workflows, keep sensitive data local, or produce audit evidence by default | Exercise: compare what Doubao/ChatGPT can do out of the box with what an enterprise AI app can do when backed by harness, tools, permissions, local/private model routing, and audit |
| 13:35-14:20 | Harness engineering and Hermes | Why an agent harness is needed: model routing, tools, approvals, memory, sessions, gateways, cron, logs, governance, retry and fallback behavior; Hermes as a buildable enterprise harness where data can stay local and models can be local/private | Mini-lab: convert a one-shot LLM prompt into a Hermes-style workflow with context, `SKILL.md`, `AGENTS.md`, memory, tool/plugin, logging, and approval checkpoints |
| 14:20-15:05 | Enterprise use case 1: meeting coordinator | Natural language request intake, calendar context, participant constraints, room/resource booking, confirmation loop; what consumer AI can draft vs what enterprise harness must integrate | Live demo or scripted walkthrough: "Find a 45-minute slot next week for project review and draft the invite" |
| 15:05-15:20 | Break |  |  |
| 15:20-16:05 | Enterprise use case 2: document / resume / policy reviewer | Document upload, extraction, scoring rubric, human review, privacy and PII controls; where multimodal/file ability helps and where enterprise governance is required | Activity: define a scoring rubric and identify what must remain human-approved |
| 16:05-16:40 | Enterprise readiness discussion | ROI, risk, governance, data access, auditability, human-in-the-loop checkpoints, change management | Group creates a first candidate use-case list with value, risk, data dependency, and owner |
| 16:40-17:00 | Day 1 wrap-up and IT handoff | What business participants should provide to IT: workflow description, source systems, sample data, acceptance criteria, escalation rules | Produce a one-page pilot candidate canvas for each team |

### Day 1 Key Concepts

- LLM: a general-purpose language model that predicts and generates text or multimodal outputs from context.
- Chatbot: a conversational interface that answers or guides, usually without independent tool execution.
- Agent: an LLM-driven system that can plan steps, call tools, inspect results, update state, and continue toward a goal.
- Prompt engineering: designing the instruction given to the model for a task.
- Context engineering: designing the information environment the model receives.
- Harness engineering: designing the runtime system around the model so it can use tools, route models, persist state, observe behavior, and operate safely.
- Consumer AI: finished AI products such as Doubao, DeepSeek, Gemini, or ChatGPT, with strong built-in features for individual use.
- Enterprise AI: AI systems connected to company data, company workflows, company identity, company security, and company governance.
- Codex-style coding agent: a specialized agent experience for software engineering that can inspect code, edit files, run commands, execute tests, and continue multi-step coding tasks with repository context.

### Day 1 Concept Exercises

These exercises use the same learning rhythm for each concept:

1. Write a simple first version.
2. Test it with an LLM such as Doubao, ChatGPT, Claude, Gemini, or an approved enterprise model.
3. Observe what is wrong, vague, risky, or missing.
4. Improve the prompt, context, or workflow.
5. Test again and compare the result.

#### Exercise 1: LLM Basics

Goal: experience that an LLM can generate fluent answers even when it lacks the right source information.

First prompt:

```text
Explain our company's travel reimbursement policy.
```

Expected observation:

- The answer may sound confident but will be generic.
- The model does not know the company's actual policy unless the policy is provided.
- This demonstrates why enterprise AI needs context and governance, not just a powerful model.

Improved prompt with context:

```text
Use only the policy excerpt below to explain the travel reimbursement policy in 5 bullet points.
If the excerpt does not answer something, say "not specified in the provided policy."

Policy excerpt:
[paste a short sample policy here]
```

Debrief:

- Model capability is not the same as enterprise knowledge.
- In the Doubao, DeepSeek, and Gemini framing, the model can produce language, but the app/harness must provide the right context and constraints.

#### Exercise 2: Chatbot vs Agent

Goal: see the difference between answering a question and executing a task.

Chatbot-style prompt:

```text
What should I consider when scheduling a project review meeting?
```

Agent-style prompt:

```text
Help schedule a 45-minute project review meeting next week.
First ask for any missing constraints.
Then propose 3 candidate time slots.
Do not send the invite until I approve one option.
```

Expected observation:

- The chatbot prompt produces advice.
- The agent prompt creates a workflow with missing-information handling and an approval checkpoint.

Debrief:

- A chatbot conversation can be useful, but an agent needs task state, tools, and control boundaries.
- Hermes is relevant when IT wants to build the harness that manages these steps.

#### Exercise 3: Consumer AI vs Enterprise AI

Goal: understand what built-in AI apps can do directly, and what requires technical integration.

Consumer prompt:

```text
Help me draft a monthly sales review summary for our leadership team.
```

Improved consumer prompt:

```text
Help me draft a monthly sales review summary for our leadership team.
Use this structure:
1. Executive summary
2. Revenue highlights
3. Pipeline risks
4. Customer issues
5. Decisions needed

Use clear business language and avoid inventing numbers.
```

Enterprise workflow version:

```text
Enterprise workflow:
1. Pull sales numbers from CRM.
2. Pull pipeline status from the forecast system.
3. Pull customer escalations from the support system.
4. Apply the approved finance reporting template.
5. Draft the leadership summary.
6. Ask the sales owner and finance owner to approve before sending.
7. Log source systems, data timestamp, approvers, and final version.
```

Expected observation:

- Consumer AI can help with writing, structure, and reasoning.
- It cannot safely access internal CRM, finance, support, approval, and audit systems by default.
- Enterprise AI needs a harness plus technical integration.
- The main difference is not only "smarter model"; it is controlled access, governed context, deterministic tools, workflow execution, and auditability.

Debrief:

- Built-in app features are useful for personal productivity.
- Enterprise deployment requires IT support for data access, permission, security, workflow, and audit.
- Hermes provides the buildable harness layer where this enterprise logic can live.

#### Exercise 4: ChatGPT vs Codex-Style Coding Agent

Goal: understand why a coding agent can be stronger than a general chat assistant for software work, but also why it has boundaries.

ChatGPT-style prompt:

```text
How should I add a calendar integration to our meeting assistant?
```

Codex-style task:

```text
Inspect this repository.
Find where integrations are registered.
Add a mock calendar availability tool.
Create or update a SKILL.md that explains how the meeting assistant should use the tool.
Run the relevant tests and summarize the patch.
```

Expected observation:

- ChatGPT-style assistants can explain architecture and suggest code.
- Codex-style agents can inspect files, edit code, run commands, patch tests, and work with repository context.
- Codex is more powerful for engineering tasks, but it still needs clear requirements, review, permissions, tests, and access to the right repo/data.

Debrief:

- For enterprise AI, business users may define the workflow, but technical users often need to create integrations, tools, `SKILL.md`, `AGENTS.md`, and memory/context files.
- A coding agent helps IT build the harness, but human review and enterprise controls remain necessary.

#### Exercise 5: Prompt Engineering

Goal: learn how task framing changes output quality.

First prompt:

```text
Summarize this meeting note.
```

Test input:

```text
Customer asked whether implementation can finish before September. Sales promised a timeline, but engineering has not reviewed API dependencies. Finance asked whether extra integration cost should be quoted separately. Next meeting is Friday.
```

Improved prompt:

```text
You are preparing a business follow-up note.
Summarize the meeting note using this structure:
1. Decision made
2. Open risks
3. Owner for each follow-up
4. Questions that must be clarified before committing to a timeline

If no decision or owner is stated, write "not stated."

Meeting note:
[paste note]
```

Expected observation:

- The improved prompt reduces vague summary and produces a more usable business artifact.
- Explicit output format and "not stated" rules reduce overconfident guessing.

#### Exercise 6: Context Engineering

Goal: learn that context selection is part of system design.

Base prompt:

```text
Should we approve this vendor invoice?
```

Round 1: test with no context.

Round 2: test with too much context:

```text
[Paste a long mixed document containing invoice text, unrelated emails, vendor marketing copy, old contract clauses, and partial policy notes.]
Should we approve this vendor invoice?
```

Round 3: test with curated context:

```text
Answer whether this invoice is ready for human approval.
Use only these inputs:
- Invoice amount: RMB 82,000
- PO approved amount: RMB 80,000
- Policy: invoices over PO amount require finance manager approval
- Delivery status: service accepted by project owner

Return:
1. Approval status
2. Reason
3. Required next human action
```

Expected observation:

- No context produces generic advice.
- Too much context can distract or confuse the model.
- Curated context produces a more reliable decision-support answer.

Debrief:

- Context engineering is not "paste everything."
- It is the design of what the model sees, in what order, with what source authority.

#### Exercise 7: Harness Engineering

Goal: understand why enterprise agent systems need runtime controls around the LLM.

Start with a one-shot prompt:

```text
Review this resume and decide whether to interview the candidate.
```

Convert it into a harnessed workflow:

```text
Workflow:
1. Extract candidate facts from the resume.
2. Compare facts against the approved role requirements.
3. Score each requirement from 1 to 5 with evidence.
4. Flag missing or uncertain information.
5. Produce a recommendation.
6. Require HR approval before any candidate status is changed.
7. Log the source document name, rubric version, timestamp, and reviewer.
```

Expected observation:

- The one-shot prompt mixes extraction, evaluation, decision, and action.
- The harnessed workflow separates steps, inputs, evidence, approval, and audit.

Debrief:

- Harness engineering turns model output into a controlled enterprise process.
- In the Doubao, DeepSeek, and Gemini examples, this kind of logic lives outside the base model in the app/harness layer.
- In Hermes, IT can build this layer through context files, skills, tools, plugins, memory, gateway, cron, and approval patterns.

### Day 1 Deliverables

- Shared glossary for AI agent terms.
- Completed concept exercise worksheet showing first prompt, first LLM output, observed issue, improved prompt/context/workflow, and second LLM output.
- Three reviewed enterprise use-case patterns.
- Candidate pilot backlog with value/risk ranking.
- Business-to-IT handoff template for day 2 and day 3 labs.

## Day 2: Hermes Basics and Architecture for IT Professionals

Audience: IT professionals only

Format: setup, instructor walkthrough, guided labs, architecture discussion

Primary goal: help IT participants form a practical mental model of how to use Hermes as an agent harness before extending it.

### Morning Session: Install, Configure, and Operate Hermes

| Time | Topic | Learning Scope | Activity |
| --- | --- | --- | --- |
| 09:00-09:20 | Day 2 orientation | What Hermes is, where it fits in the enterprise agent stack, expected lab outcomes | Check lab prerequisites and local environment |
| 09:20-10:10 | Installation and first run | Desktop installer vs CLI install, `hermes setup`, model provider setup, model verification | Lab: install Hermes or verify prepared environment; run first successful chat |
| 10:10-10:45 | Model provider and routing basics | Primary model, auxiliary task models, fallback, cost/performance routing, local/self-hosted endpoint considerations | Lab: inspect or configure model settings; discuss routing choices for enterprise workloads |
| 10:45-11:00 | Break |  |  |
| 11:00-11:35 | CLI usage and basic commands | Starting sessions, resuming sessions, slash commands, verbose tool output, context files, attaching files | Lab: run a structured task with files and observe tool calls |
| 11:35-12:00 | Toolsets and permissions | Built-in tool categories: web, terminal, file, browser, vision, memory, messaging, cron, delegation; safe usage and approvals | Lab: enable/inspect tools and run a simple file or web-assisted task |

### Afternoon Session: Hermes Architecture and Core Capabilities

| Time | Topic | Learning Scope | Activity |
| --- | --- | --- | --- |
| 13:00-13:45 | Hermes architecture map | Entry points, agent loop, model provider, prompt assembly, context files, tool execution, session persistence | Draw the request lifecycle for a user asking Hermes to inspect a project and produce an answer |
| 13:45-14:25 | Context, memory, and skills | AGENTS.md, SOUL.md, MEMORY.md, USER.md, context files, skill loading, what belongs in memory vs skill | Lab: create a small project context file and compare agent behavior before/after |
| 14:25-15:00 | Automation primitives | Cron jobs, script-only cron, webhooks, batch processing, delegation, background work | Lab: design a daily report automation without coding it yet |
| 15:00-15:15 | Break |  |  |
| 15:15-16:00 | Gateway and enterprise channels | Messaging gateway concept, Telegram/Discord/Slack/Teams-style channels, session identity, delivery, pairing, security considerations | Architecture exercise: map a business chat request from channel to Hermes session to tool execution |
| 16:00-16:40 | Observability, safety, and operations | Logs, session storage, approvals, prompt injection risk, data privacy, tool boundaries, cost monitoring | Group reviews risks for the three day 1 enterprise use cases |
| 16:40-17:00 | Day 2 checkpoint | What participants can now operate, what remains extension work, day 3 coding prep | Confirm plugin/skill lab environment and assign optional pre-reading |

### Day 2 Hands-On Labs

1. Install or verify Hermes.
2. Complete model setup and run a successful chat.
3. Use a context file to guide a project-specific task.
4. Enable and test basic toolsets.
5. Inspect session behavior and tool outputs.
6. Design one enterprise automation flow using Hermes primitives.

### Day 2 Learning Scope

Participants should understand:

- How Hermes differs from a standalone chatbot.
- How a user request becomes an agent loop with context, model calls, tools, and persisted session state.
- How built-in tools extend agent capability.
- How memory, context files, and skills play different roles.
- How cron, gateway, and delegation support always-on or asynchronous workflows.
- Why enterprise operation requires identity, permission, audit, and human approval boundaries.

## Day 3: Hermes Customization and Development

Audience: IT professionals only

Format: developer walkthrough, pair programming, coding labs, demo review

Primary goal: teach participants how to customize Hermes through skills, plugins, and tools, using enterprise use cases as lab scenarios.

### Morning Session: Skills and Customization Without Core Code Changes

| Time | Topic | Learning Scope | Activity |
| --- | --- | --- | --- |
| 09:00-09:20 | Day 3 orientation | Skill vs tool vs plugin vs MCP integration; when to choose each | Review decision tree for extension mechanisms |
| 09:20-10:05 | Creating a Hermes skill | Skill directory structure, `SKILL.md`, progressive disclosure, scripts, references, eval examples | Lab: create a simple "meeting-summary-review" or "policy-checklist" skill |
| 10:05-10:45 | Skill quality and evaluation | Good skill instructions, deterministic steps, examples, failure handling, test cases, versioning | Lab: add examples and acceptance checks to the skill |
| 10:45-11:00 | Break |  |  |
| 11:00-11:40 | Context and prompt assets for repeatable workflows | Reusable task framing, context file boundaries, avoiding giant prompts, separating business policy from execution | Lab: convert a day 1 business workflow into reusable instructions |
| 11:40-12:00 | Demo and review | Participants run skills against sample inputs | Peer review: clarity, missing context, expected outputs, escalation rules |

### Afternoon Session: Plugin and Tool Development Lab

| Time | Topic | Learning Scope | Activity |
| --- | --- | --- | --- |
| 13:00-13:35 | Hermes plugin structure | `plugin.yaml`, registration, schemas, handlers, lifecycle hooks, bundled skill files | Instructor walkthrough of a minimal plugin |
| 13:35-14:35 | Build a simple custom tool | Tool schema design, input validation, deterministic handler behavior, error messages, safe outputs | Lab: implement a simple enterprise helper tool, such as policy lookup, meeting-room mock lookup, or resume scoring rubric lookup |
| 14:35-15:00 | Tool testing and debugging | Local invocation, logs, invalid input handling, traceability, regression test approach | Lab: test happy path and failure path |
| 15:00-15:15 | Break |  |  |
| 15:15-15:55 | Integrations and MCP orientation | When to use existing CLI/API, MCP server, webhook, plugin, or built-in core tool; API credentials and enterprise secrets | Exercise: choose integration approach for calendar, document store, HR system, and finance reporting |
| 15:55-16:35 | Capstone lab | Combine a skill plus one custom tool into a small working agent-assisted workflow | Teams demo a working prototype or technical design if external systems are unavailable |
| 16:35-17:00 | Closeout and implementation backlog | Production readiness checklist, ownership, pilot scope, next 30 days | Create post-workshop backlog: environment, integration, security review, data samples, acceptance tests |

### Day 3 Hands-On Lab Options

Choose one primary lab path depending on available enterprise systems and participant skill level.

| Lab Path | Description | Expected Output |
| --- | --- | --- |
| Meeting coordinator assistant | Skill captures meeting request rules; tool mocks room/calendar availability | Agent drafts meeting options and asks for human confirmation |
| Resume/document reviewer | Skill defines review rubric; tool returns structured scoring criteria or mock candidate metadata | Agent produces scored summary with evidence and escalation notes |
| Finance/operations BP assistant | Skill defines analysis pattern; tool mocks policy or report lookup | Agent answers with cited inputs, assumptions, and approval boundary |
| Generic internal helper | Skill defines repeated IT support or knowledge-base workflow; tool wraps a local JSON/CSV lookup | Agent performs repeatable lookup plus structured response |

### Day 3 Learning Scope

Participants should understand:

- Use a skill when the capability is mostly procedural instructions, examples, shell/API usage, or repeatable workflow guidance.
- Use a tool when precise execution, validation, auth handling, binary data, streaming, or real-time behavior is needed.
- Use a plugin when adding custom tools, hooks, slash commands, bundled skills, or integration logic without modifying Hermes core.
- Use MCP when a suitable external tool server already exists or when enterprise systems should expose standardized tool endpoints.
- Avoid core Hermes changes unless building reusable platform functionality that belongs in the agent runtime itself.

## Extension Decision Tree

| Need | Recommended Approach |
| --- | --- |
| Improve how the agent performs a repeated workflow | Create or update a skill |
| Add project-specific instructions or coding conventions | Add an `AGENTS.md` context file |
| Store durable user or environment facts | Use memory |
| Call a deterministic business function or API | Build a tool, usually through a plugin |
| Add several tools plus hooks and bundled skills | Build a Hermes plugin |
| Connect to an existing external tool ecosystem | Use or build an MCP server |
| Schedule repeated work | Use cron or script-only cron |
| React to external events | Use webhook/gateway/event-driven integration |
| Support a new model/backend/channel at platform level | Evaluate provider, gateway, or core extension path |

## Prerequisites

### All Day 1 Participants

- Laptop for exercises.
- Access to workshop collaboration board or shared document.
- One candidate workflow or pain point from their team.

### IT Participants for Day 2 and Day 3

- Laptop with local admin rights where possible.
- Terminal access: PowerShell, macOS Terminal, Linux shell, or WSL.
- VS Code or equivalent editor.
- Python development environment.
- Git installed.
- Hermes install path available through desktop installer or CLI installer.
- LLM provider access through Nous Portal, OpenAI, Azure OpenAI, Anthropic, Gemini, DashScope/Qwen, or approved enterprise provider.
- Optional: test credentials or mock data for calendar, document, HR, or finance systems.

## Instructor Preparation Checklist

- Prepare a no-code day 1 demo path with screenshots or live environment fallback.
- Prepare sanitized sample documents for resume/document review.
- Prepare a mock calendar or room availability dataset.
- Prepare a mock policy/report lookup dataset.
- Verify Hermes installation path for Windows, macOS, Linux, and WSL participants.
- Prepare fallback model/provider configuration for participants without production credentials.
- Prepare a minimal skill template.
- Prepare a minimal plugin template.
- Prepare troubleshooting notes for install, provider auth, tool enablement, and network restrictions.
- Prepare enterprise safety talking points: PII, audit, approval, prompt injection, data retention, and model routing.

## Suggested Post-Workshop 30-Day Plan

| Week | Focus | Output |
| --- | --- | --- |
| Week 1 | Select pilot use case and define success criteria | Pilot charter, owners, sample data, acceptance tests |
| Week 2 | Build first skill/tool prototype | Working local prototype with mock or sandbox data |
| Week 3 | Integrate enterprise system safely | Auth pattern, logging, human approval flow, security review |
| Week 4 | Run controlled pilot | Measured results, issue list, go/no-go recommendation |

## Review Questions

Use these questions to validate whether the agenda fits the confirmed audience profile:

- Does day 1 avoid assuming prior LLM or agent architecture knowledge?
- Are business participants given enough concrete examples without being pulled into coding details?
- Does day 2 give IT participants a usable Hermes mental model before asking them to build?
- Does day 3 teach extension decisions before implementation details?
- Are labs achievable with mock data if enterprise credentials are unavailable?
- Is each enterprise use case tied to human approval and governance boundaries?
