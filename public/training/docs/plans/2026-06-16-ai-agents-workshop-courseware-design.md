# AI Agents 工作坊课件设计文档

**Date:** 2026-06-16  
**Status:** Approved for implementation  
**Audience:** 企业业务人员 + IT 工程师（三天混合工作坊）  
**Format:** 单份中文 Markdown 手册  
**Depth:** 架构图 + 关键代码片段 + 可运行实验命令  
**Source index:** `docs/AI_Agents_Workshop_CN.docx`

---

## 1. 目标

以 `docs/AI_Agents_Workshop_CN.docx` 为索引，结合 `semantier-runtime` 代码库，生成一份可直接用于三天工作坊的中文课件手册。每节课都映射到真实代码、设计文档、测试用例和可动手实验。

## 2. 成功标准

- 覆盖 docx 中全部 14 个时间块（3 天）。
- 每个时间块包含：学习目标、核心概念、代码映射、实验、讨论题。
- 所有代码引用必须附带文件路径和行号或函数名。
- 包含至少 5 个可直接运行的 CLI/API 实验。
- 包含 3 个以上的 Mermaid/文本架构图。
- 统一放在 `docs/courseware/AI_Agents_Workshop_Courseware.md`。

## 3. 总体结构

```text
# 企业级 AI Agent 三天工作坊课件

## 前置说明
- 实验环境要求
- 项目结构速览
- 如何启动运行时

## Day 1：AI 能力边界与企业架构基础
### 上午：企业 AI 愿景与应用场景
- 09:00-09:30 企业工作范式转变
- 09:30-10:30 案例演示：业务伙伴自动化智能体
- 10:30-11:30 扩展应用场景
- 11:30-12:00 Q&A 与业务对齐

### 下午：技术架构与环境准备
- 13:00-14:30 企业 AI 技术栈解析
- 14:30-16:00 基础设施与部署
- 16:00-17:00 飞书开发者平台配置

## Day 2：Hands-on 智能体构建
### 上午：构建第一个通信闭环
- 09:00-10:30 Workspace 初始化与 Persona 配置
- 10:30-12:00 连接 GPT-4 与通义千问 API

### 下午：飞书集成
- 13:00-15:00 会议协调助手 Demo 重建
- 15:00-17:00 状态管理与 Memory

## Day 3：高级工作流与企业运营
### 上午：复杂文档处理与多步骤逻辑
- 09:00-10:30 自动简历筛选深入实践
- 10:30-12:00 多智能体编排

### 下午：生产环境、安全与治理
- 13:00-14:30 安全与隐私
- 14:30-16:00 性能调优与 Debug
- 16:00-17:00 Workshop 总结与 30 天实施计划

## 附录
- A. 核心文件索引
- B. 环境变量速查
- C. 参考资料
```

## 4. 每节课内容模板

每个时间块统一使用以下模板：

```markdown
### HH:MM-HH:MM｜标题

**学习目标**
- ...

**核心概念**
- ...

**代码映射**
- 文件：`src/.../xxx.py`
- 关键函数/类：...
- 代码片段：...

**架构图/流程图**
```mermaid
...
```

**动手实验**
1. ...
2. ...

**讨论题**
- ...
```

## 5. 关键代码映射表

| 工作坊主题 | 代码文件 | 说明 |
|---|---|---|
| 运行时启动与 Profile 编排 | `src/agents/launcher.py` | `_bootstrap_runtime_root`, `_ensure_repo_local_runtime_config`, `_ensure_meeting_coordinator_profiles` |
| Gateway 统一入口 | `src/agents/gateway.py` | FastAPI app 组装 |
| Web API / 会话适配 | `src/agents/webapi_gateway.py` | `/system/*`, `/sessions`, 嵌入 Hermes API |
| 飞书会议协调 | `src/agents/meeting_coordinator_gateway.py` | `start_monitor`, `escalation_retry_tick`, `monitor_tick` |
| 会议协调状态 | `src/agents/meeting_coordinator_store.py` | SQLite store |
| 运行时清单 | `src/agents/runtime_inventory.py` | `list_skills_inventory`, `list_plugins_inventory`, `list_toolsets_inventory` |
| 多租户与路由策略 | `src/agents/route_policy.py` | `ROUTE_POLICY_MAP`, `ROUTE_AUTHZ_CLASS_MAP` |
| 插件包 | `semantier-skills/plugins/feishu_meeting_coordinator/` | plugin.yaml, tools.py, SKILL.md |
| 多租户设计 | `docs/derived/gateway-unified-multitenant-design.md` | workspace 隔离、gateway 架构 |
| 会议插件设计 | `docs/derived/feishu-meeting-coordinator-plugin-design.md` | RSVP monitor、cron、escalation |
| 自改进设计 | `docs/derived/hermes-agent-self-improvement-design.md` | skill 创建路径、workspace 隔离 |
| 测试 | `tests/test_agents_launcher.py` | launcher bootstrap、plugin 安装 |
| 测试 | `tests/test_meeting_coordinator_gateway.py` | monitor、escalation retry |
| 测试 | `tests/test_meeting_coordinator_webapi.py` | Web API 路由、cron client |

## 6. 实验设计

| 编号 | 实验名称 | 对应课程 | 命令/步骤 |
|---|---|---|---|
| L1 | 启动 Semantier 运行时 | Day1 下午 | `semantier run --replace` |
| L2 | 查看系统 skills/plugins/tools | Day1 下午 | `curl http://localhost:8899/system/skills` 等 |
| L3 | 安装飞书会议协调插件 | Day2 下午 | `POST /system/skills/install` |
| L4 | 创建会议 RSVP 监控 | Day2 下午 | 调用 `feishu_meeting_monitor_start` 并观察 cron job |
| L5 | 触发 escalation retry tick | Day2 下午 | `POST /system/meeting-coordinator/delivery-tasks/retry` |
| L6 | 运行 launcher 测试 | Day3 上午 | `pytest tests/test_agents_launcher.py -v` |
| L7 | 配置路由策略与限流 | Day3 下午 | 查看 `src/agents/route_policy.py` 与 webapi_gateway 限流 |

## 7. 架构图设计

1. **Semantier Runtime 整体架构图**：展示 launcher → gateway → webapi_gateway → embedded Hermes → workspace/eos.db 的数据流。
2. **飞书会议协调时序图**：展示 meeting create → monitor start → cron tick → follow-up → escalation 的完整流程。
3. **多租户 Workspace 隔离图**：展示 workspaces/<id>/.hermes、auth.db、eos.db 的边界。
4. **Self-improvement Skill 创建路径图**：展示 review agent → skill_manager_tool → workspace-scoped skills dir。

## 8. 实现步骤

1. 创建目录 `docs/courseware/`。
2. 编写主文件 `docs/courseware/AI_Agents_Workshop_Courseware.md`。
3. 按上述结构填充每一天、每一节课。
4. 确保所有代码引用准确（文件路径、函数名、行号范围）。
5. 验证 Mermaid 图语法正确。
6. 添加附录索引。

## 9. 交付物

- `docs/courseware/AI_Agents_Workshop_Courseware.md`
- 可选：`docs/courseware/assets/`（若需要本地图片，本版以 Mermaid 为主，暂不创建）
