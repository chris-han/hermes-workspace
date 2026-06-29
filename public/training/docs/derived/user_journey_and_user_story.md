# User Journey & User Story (Financial Semantic Rewrite)

**Status:** Active product and workflow reference.
**Authority:** Derived product-spec and journey document. `architecture.md` remains the canonical runtime contract.
**Scope:** User-facing journeys, workflow scenarios, acceptance-oriented stories, and cross-channel product behavior.
**Upstream sources:**
- [Document Authority And Versioning](../canonical/document-authority-and-versioning.md)
- [architecture.md](../canonical/architecture.md)
- [prd_weixin_semantic_completion.md](prd_weixin_semantic_completion.md)

This document may use runtime concepts, but it should cite canonical definitions from `architecture.md` rather than redefine them.

---

## 1. Core Capability Definition

### 中文（财务语义）
核心能力：合同经济性分析与财务执行一体化系统。
系统基于多源非结构化输入（微信沟通记录、残缺发票影像、异构银行流水、模糊语音），通过语义提取与勾稽关系（Correlation Detection / 勾稽关系识别）构建完整交易语义闭环，实现盈利能力评估、会计确认、发票管理及税务处理。

### English (Financial Semantics)
Core capability: Integrated contract economic analysis and financial execution system.
The system ingests multi-source unstructured inputs (WeChat communications, incomplete invoice images, heterogeneous bank statements, noisy voice inputs), performs semantic extraction and correlation detection, and constructs a complete transactional semantic graph to enable profitability assessment, accounting recognition, invoicing, and tax handling.

---

## 2. Existing Journey Scope

This document covers the Semantier-EOS user-facing journey for:

```text
semantic extraction
correlation detection
adapter-mediated retrieval
projection context snapshotting
deterministic projection
replay
explainability
audit evidence
external verification
COA onboarding
projection exception governance
CQ analysis and reporting
B-end partner onboarding and incentive settlement
liability contract and responsibility allocation
risk pool and insurance claim trigger
CQ-driven commission settlement
reinsurance portfolio reporting
compliance drift detection
override escalation workflow
low-friction entry product (invoice tax risk check)
signup demo dataset onboarding
multi-organization context switching
actuarial calibration transition
```

The full architecture details are defined in:

```text
docs/canonical/architecture.md
```

---

## 3. Key Semantic Principle

### 中文
系统的核心不只是建立交易勾稽关系，而是在勾稽关系之上建立可治理的语义准入边界。检索可以帮助解释，Adapter 决定哪些上下文可以进入快照，`R_v` 决定语义优先级，`Π_v` 只在确定性规则包下进行投影，审计回放永远不依赖 live retrieval。

### English
The core of the system is not only the construction of transaction correlations, but the creation of a governed semantic admission boundary. Retrieval may assist interpretation, the Adapter decides which context may enter the snapshot, `R_v` determines semantic priority, `Π_v` projects only under deterministic bundles, and audit replay never depends on live retrieval.

---

## 4. Existing Core User Story

### 中文
作为企业经营者，我希望系统能够自动理解复杂业务沟通与财务资料，构建完整交易语义，并在考虑机会成本的情况下给出项目盈利能力判断，同时自动完成记账、开票与报税，从而降低人工成本并提高决策质量。

### English
As a business operator, I want the system to automatically understand complex business communications and financial documents, construct a complete transactional semantic model, evaluate profitability including opportunity costs, and execute accounting, invoicing, and tax processes, so that I can reduce manual workload and improve decision quality.

---

## 5. v7.4 Full Semantic Chain Summary

The full semantic chain is:

```text
Ontology primitives
  > KGL knowledge
  > deterministic projection
  > replay
  > explainability
  > audit evidence
  > external verification
```

This chain is exercised by the E2E test:

```text
test_full_semantic_chain_cloud_service_external_audit_verification()
```

---

## 6. COA Onboarding and Projection Exception Journey

This section covers the next product-critical scenario:

```text
COA onboarding
  > active COA projection bundle
  > valid new REA event
  > current COA cannot project it
  > projection exception
  > governance review
  > updated COA / projection rule
  > future projection succeeds
  > historical replay remains stable
```

The key doctrine is:

```text
REA admission failure ≠ projection failure
```

Meaning:

```text
A valid economic fact may be admitted even if the current COA projection bundle cannot classify it.
```

Therefore:

```text
REA event: COMMITTED
Projection: EXCEPTION
Ledger view: NOT MATERIALIZED
Governance task: REQUIRED
```

---

### Step 1 — COA Onboarding / 科目表导入

#### 中文
财务管理员首次配置组织账簿时，上传或选择中国 COA 基础模板，并补充企业自定义科目、成本中心、项目维度和管理口径。

系统不会把 COA 当成本体。COA 是 projection taxonomy，只能作为 `Π_v` 的目标分类空间。

系统生成候选：

```text
COATaxonomyCandidate_t
ProjectionBundleCandidate_t
ConstraintBundleCandidate_t
```

它们必须经过 schema 校验、KGL 来源绑定、人工审批和版本化后，才能成为：

```text
ACTIVE COA_v
ACTIVE Π_cn_coa,v
ACTIVE ConstraintBundle_v
```

#### English
When a finance admin first configures the organization ledger, they upload or select a Chinese COA base template and optionally add custom accounts, cost centers, project dimensions, and management reporting views.

The system does not treat COA as ontology. COA is a projection taxonomy; it is only the target classification space of `Π_v`.

The system creates candidates:

```text
COATaxonomyCandidate_t
ProjectionBundleCandidate_t
ConstraintBundleCandidate_t
```

They must pass schema validation, KGL source binding, human approval, and versioning before becoming:

```text
ACTIVE COA_v
ACTIVE Π_cn_coa,v
ACTIVE ConstraintBundle_v
```

---

### Step 2 — COA Activation / 科目表激活

#### 中文
财务负责人审批后，系统激活 COA 版本和投影规则：

```yaml
COA_v:
  version: cn_coa_org_2026_v1
  base_source: ministry_standard_coa
  custom_accounts:
    - account_code: "660299"
      account_name: "其他管理费用"
      parent: "6602"
      status: ACTIVE

Π_cn_coa,v:
  version: cn_coa_projection_2026_v1
  target_taxonomy: cn_coa_org_2026_v1
  status: ACTIVE
```

激活后，新投影只能使用当前 ACTIVE 版本。历史事件继续绑定自己的原始版本。

#### English
After finance lead approval, the system activates the COA version and projection rules:

```yaml
COA_v:
  version: cn_coa_org_2026_v1
  base_source: ministry_standard_coa
  custom_accounts:
    - account_code: "660299"
      account_name: "Other Management Expense"
      parent: "6602"
      status: ACTIVE

Π_cn_coa,v:
  version: cn_coa_projection_2026_v1
  target_taxonomy: cn_coa_org_2026_v1
  status: ACTIVE
```

After activation, new projections may use only the current ACTIVE version. Historical events remain bound to their original versions.

---

### Step 3 — New REA Event Cannot Be Projected / 新 REA 无法投影

#### 中文
系统接收到一笔新的有效经济事件，例如企业购买一类新的数字资产服务。

`O_v` 判断该事件是有效的：

```yaml
rea_event:
  event_id: evt_new_asset_service_0001
  event_type: purchase
  resource:
    primitive_type: service
    description: new digital asset custody service
    amount: 5000
    currency: CNY
  agents:
    provider: vendor/new_provider
    receiver: org/self
  evidence_refs:
    - invoice_ref
    - payment_ref
```

但是当前 `Π_cn_coa,v` 无法找到确定的 COA 分类。此时系统不能拒绝已经有效的经济事实，也不能随便让 LLM 编一个 account_code。

系统必须提交 REA fact，同时创建 projection exception。

#### English
The system receives a new valid economic event, such as the company purchasing a new type of digital asset custody service.

`O_v` determines that the event is valid:

```yaml
rea_event:
  event_id: evt_new_asset_service_0001
  event_type: purchase
  resource:
    primitive_type: service
    description: new digital asset custody service
    amount: 5000
    currency: CNY
  agents:
    provider: vendor/new_provider
    receiver: org/self
  evidence_refs:
    - invoice_ref
    - payment_ref
```

But the current `Π_cn_coa,v` cannot determine a valid COA classification. The system must not reject the valid economic fact, and it must not let an LLM invent an `account_code`.

The system must commit the REA fact and create a projection exception.

---

### Step 4 — Projection Exception Created / 创建投影异常

#### 中文
系统生成：

```yaml
ProjectionException_t:
  exception_id: pex_new_asset_service_0001
  event_id: evt_new_asset_service_0001
  projection_bundle: cn_coa_projection_2026_v1
  target_taxonomy: cn_coa_org_2026_v1
  projection_status: PROJECTION_EXCEPTION
  reason_code: NO_MATCHING_COA_RULE
  reason: current projection bundle cannot classify digital asset custody service
  candidate_claims:
    - claim_id: agent_suggested_intangible_asset
      semantic_tier: T6
      status: CANDIDATE_ONLY
    - claim_id: similar_service_management_expense
      semantic_tier: T5
      status: CANDIDATE_ONLY
  required_action: GOVERNANCE_REVIEW
```

关键约束：

```text
REA fact remains COMMITTED.
No account_code is written into REA fact.
No ledger projection is materialized.
No candidate rule becomes active automatically.
```

#### English
The system creates:

```yaml
ProjectionException_t:
  exception_id: pex_new_asset_service_0001
  event_id: evt_new_asset_service_0001
  projection_bundle: cn_coa_projection_2026_v1
  target_taxonomy: cn_coa_org_2026_v1
  projection_status: PROJECTION_EXCEPTION
  reason_code: NO_MATCHING_COA_RULE
  reason: current projection bundle cannot classify digital asset custody service
  candidate_claims:
    - claim_id: agent_suggested_intangible_asset
      semantic_tier: T6
      status: CANDIDATE_ONLY
    - claim_id: similar_service_management_expense
      semantic_tier: T5
      status: CANDIDATE_ONLY
  required_action: GOVERNANCE_REVIEW
```

Hard constraints:

```text
REA fact remains COMMITTED.
No account_code is written into REA fact.
No ledger projection is materialized.
No candidate rule becomes active automatically.
```

Automatic proposal start:

```text
If the exception classifier determines that resolution likely requires a new COA node
or posting mapping, Semantier may automatically open a governed proposal candidate.

This automatic start means:
- create a T4 COAChangeProposal_t and/or ProjectionRuleProposal_t in candidate state
- link it to ProjectionException_t and the active COA_v / Π_v
- attach any T6/T5 suggestions only as non-authoritative candidate evidence

This automatic start does NOT mean:
- no COA_v+1 is activated
- no projection rule becomes active
- no Hermes skill is created to bypass governance
```

---

### Step 5 — Governance Review / 治理审核

#### 中文
财务负责人打开异常队列，看到：

```text
This REA event is valid, but cannot be projected by current COA_v / Π_v.
```

系统提供候选处理方式，但全部都是候选：

```text
1. map to existing COA node
2. add custom account under existing parent
3. add new projection rule
4. split into multiple projections
5. reject projection because source evidence is insufficient
6. escalate to tax/accounting advisor
```

如果需要新增自定义科目，系统创建：

```text
COAChangeProposal_t
```

如果只需要新增规则，系统创建：

```text
ProjectionRuleProposal_t
```

两者都必须进入 Governance Loop。

#### English
The finance lead opens the exception queue and sees:

```text
This REA event is valid, but cannot be projected by current COA_v / Π_v.
```

The system offers candidate handling options, but all are candidates only:

```text
1. map to existing COA node
2. add custom account under existing parent
3. add new projection rule
4. split into multiple projections
5. reject projection because source evidence is insufficient
6. escalate to tax/accounting advisor
```

If a new custom account is needed, the system creates:

```text
COAChangeProposal_t
```

If only a new projection rule is needed, the system creates:

```text
ProjectionRuleProposal_t
```

Both must enter the Governance Loop.

In the preferred runtime path, this proposal is started by Semantier exception handling,
not by Hermes self-improvement. Hermes may surface the issue conversationally, but the
governed COA proposal begins from `ProjectionException_t` and remains inside Semantier's
T4 governance path.

---

### Step 6 — Approval and Version Activation / 审批与版本激活

#### 中文
审批通过后，系统创建新版本：

```yaml
COA_v+1:
  version: cn_coa_org_2026_v2
  changes:
    - add_account:
        account_code: "660298"
        account_name: "数字资产服务费"
        parent: "6602"
        reason: approved projection exception pex_new_asset_service_0001

Π_cn_coa,v+1:
  version: cn_coa_projection_2026_v2
  rules:
    - if resource.description matches digital_asset_custody_service
      then debit account_code "660298"
```

新版本激活后，只影响未来 projection，或对异常事件进行明确的 governed re-projection。

历史事实不被改写。

#### English
After approval, the system creates new versions:

```yaml
COA_v+1:
  version: cn_coa_org_2026_v2
  changes:
    - add_account:
        account_code: "660298"
        account_name: "Digital Asset Service Fee"
        parent: "6602"
        reason: approved projection exception pex_new_asset_service_0001

Π_cn_coa,v+1:
  version: cn_coa_projection_2026_v2
  rules:
    - if resource.description matches digital_asset_custody_service
      then debit account_code "660298"
```

After activation, the new version affects only future projections, or explicitly governed re-projection of exception events.

Historical facts are not rewritten.

---

### Step 7 — Reprojection of Exception / 异常重投影

#### 中文
财务负责人选择对该 exception 执行 governed re-projection。

系统用新的 `Π_cn_coa,v+1` 重新投影原始 REA fact：

```yaml
ledger_projection:
  projection_id: proj_new_asset_service_0001_v2
  source_event_id: evt_new_asset_service_0001
  projection_bundle: cn_coa_projection_2026_v2
  status: PROJECTED
  lines:
    - side: debit
      coa_code: "660298"
      coa_name: "数字资产服务费"
      amount: 5000
      currency: CNY
    - side: credit
      coa_code: "1002"
      coa_name: "银行存款"
      amount: 5000
      currency: CNY
```

原始 `ProjectionException_t` 保留，状态变为：

```text
RESOLVED_BY_GOVERNED_REPROJECTION
```

#### English
The finance lead chooses to perform governed re-projection for the exception.

The system uses the new `Π_cn_coa,v+1` to re-project the original REA fact:

```yaml
ledger_projection:
  projection_id: proj_new_asset_service_0001_v2
  source_event_id: evt_new_asset_service_0001
  projection_bundle: cn_coa_projection_2026_v2
  status: PROJECTED
  lines:
    - side: debit
      coa_code: "660298"
      coa_name: "Digital Asset Service Fee"
      amount: 5000
      currency: CNY
    - side: credit
      coa_code: "1002"
      coa_name: "Bank Deposit"
      amount: 5000
      currency: CNY
```

The original `ProjectionException_t` remains recorded, with status:

```text
RESOLVED_BY_GOVERNED_REPROJECTION
```

---

## 7. Projection Exception Governance DSL

The exception governance path should be structured enough to prevent ad-hoc resolution. A reviewer may decide, but the decision must be recorded through a governed object.

```yaml
ProjectionExceptionGovernance_t:
  schema_version: semantier.projection_exception_governance.v1
  governance_id: gov_pex_new_asset_service_0001
  exception_ref: pex_new_asset_service_0001
  source_event_id: evt_new_asset_service_0001
  current_versions:
    COA_v: cn_coa_org_2026_v1
    Pi_v: cn_coa_projection_2026_v1
    K_v: kgl_cn_accounting_tax_2026_05
  exception_type: NO_MATCHING_COA_RULE
  allowed_actions:
    - MAP_TO_EXISTING_COA_NODE
    - ADD_CUSTOM_ACCOUNT
    - ADD_PROJECTION_RULE
    - SPLIT_PROJECTION
    - REQUEST_MORE_EVIDENCE
    - ESCALATE_TO_ADVISOR
    - MARK_NOT_PROJECTABLE
  proposed_action:
    action_type: ADD_CUSTOM_ACCOUNT
    proposed_by: finance_reviewer
    justification:
      reason: Digital asset custody service needs explicit management expense treatment.
      evidence_refs:
        - invoice_ref
        - payment_ref
      candidate_claim_refs:
        - agent_suggested_intangible_asset
        - similar_service_management_expense
    proposed_changes:
      coa_change:
        parent: "6602"
        account_code: "660298"
        account_name: "数字资产服务费"
      projection_rule_change:
        match:
          resource.description: digital_asset_custody_service
        debit_account_code: "660298"
        credit_account_code: "1002"
  approval:
    status: APPROVED
    approved_by: finance_lead
    approved_at: 2026-05-04T10:00:00Z
  activation:
    COA_v_next: cn_coa_org_2026_v2
    Pi_v_next: cn_coa_projection_2026_v2
    activation_status: ACTIVE
  replay_policy:
    original_exception_replays_with: cn_coa_projection_2026_v1
    governed_reprojection_uses: cn_coa_projection_2026_v2
```

### Exception Types

```text
NO_MATCHING_COA_RULE
AMBIGUOUS_CLASSIFICATION
CONFLICTING_CLAIMS
INSUFFICIENT_EVIDENCE
POLICY_CONSTRAINT_BLOCK
TAX_TREATMENT_UNCLEAR
MANAGEMENT_VIEW_ONLY
NOT_PROJECTABLE_UNDER_CURRENT_SCOPE
```

### Action Semantics

```text
MAP_TO_EXISTING_COA_NODE
    Use an existing active COA node; requires reviewer justification.

ADD_CUSTOM_ACCOUNT
    Create COA_v+1 and usually Π_v+1; requires governance approval.

ADD_PROJECTION_RULE
    Keep COA unchanged but create Π_v+1; requires governance approval.

SPLIT_PROJECTION
    Split one REA event into multiple ledger projection lines; requires deterministic rule.

REQUEST_MORE_EVIDENCE
    Keep exception open until source evidence is sufficient.

ESCALATE_TO_ADVISOR
    Route to tax/accounting advisor; no automatic rule activation.

MARK_NOT_PROJECTABLE
    Preserve REA fact but mark the target ledger view unavailable under current scope.
```

### Governance Invariants

```text
ProjectionExceptionGovernance_t cannot mutate REA facts.
ProjectionExceptionGovernance_t cannot directly activate COA_v+1 or Π_v+1 without approval.
ProjectionExceptionGovernance_t cannot upgrade T6 agent suggestion into authority.
ProjectionExceptionGovernance_t must record selected action, rejected actions, justification, approver, and resulting version pins.
Every governed re-projection must produce a new projection result, not overwrite the original exception.
```

---

## 8. COA Onboarding and Projection Exception User Story

### 中文
作为财务管理员，我希望能够导入并激活企业 COA，同时当一个有效 REA 事件无法被当前 COA 投影时，系统能够保留经济事实、创建投影异常，并通过治理流程新增自定义科目或投影规则，从而避免把账簿分类失败误判为经济事实无效。

### English
As a finance admin, I want to onboard and activate the organization’s COA, and when a valid REA event cannot be projected by the current COA, I want the system to preserve the economic fact, create a projection exception, and route the issue through governance to add a custom account or projection rule, so that ledger classification failure is not confused with economic fact invalidity.

### Acceptance Criteria

```text
GIVEN an organization has onboarded COA_v and Π_cn_coa,v
AND a new REA event is valid under O_v
AND current Π_cn_coa,v cannot map it to an active COA node
WHEN projection runs
THEN the REA event remains COMMITTED
AND no account_code is written into the REA fact
AND no ledger projection is materialized
AND projection_status = PROJECTION_EXCEPTION
AND ProjectionException_t is created
AND ProjectionException_t records reason_code, active COA_v, active Π_v, candidate_claims, and required_action
AND candidate LLM / retrieval suggestions remain CANDIDATE_ONLY
AND a GovernanceStore review task is opened
AND if exception handling indicates that a new COA node is likely required, a governed T4 COA proposal candidate is auto-started in candidate state
AND the auto-started proposal records active COA_v, exception_ref, proposed parent node, and non-authoritative candidate evidence only
AND finance reviewer may choose existing COA mapping, new custom account, new projection rule, split projection, rejection, or escalation
AND ProjectionExceptionGovernance_t records the selected action, justification, approver, and resulting version pins
AND no COA_v+1 or Π_v+1 becomes ACTIVE without governance approval
AND once approved, COA_v+1 / Π_v+1 is versioned, hashed, and activated
AND historical REA fact remains unchanged
AND old exception remains replayable under original Π_v
AND governed re-projection uses the new Π_v+1 and records a new projection result
```

Negative criteria:

```text
IF O_v rejects the REA event
THEN no projection exception is created; the event is rejected before projection.

IF current Π_v has no matching rule
THEN the system must not invent an account_code.

IF an LLM suggests a new account
THEN the suggestion remains T6 candidate only.

IF Hermes self-improvement or curator suggests a reusable workflow
THEN that may become a procedural skill candidate only.
It must not directly create or activate COA_v+1.

IF a finance user manually chooses a COA node
THEN the selection must still be recorded as governed approval.

IF COA_v+1 changes a projection rule
THEN historical projections remain pinned to their original Π_v unless explicitly re-projected.
```

---

## 9. COA Onboarding and Projection Exception E2E Test Case

```text
test_coa_onboarding_and_projection_exception_governance()
    GIVEN finance_admin uploads Chinese COA base template
    AND finance_admin adds organization custom accounts
    WHEN COA onboarding runs
    THEN COATaxonomyCandidate_t is created
    AND ProjectionBundleCandidate_t is created
    AND ConstraintBundleCandidate_t is created
    AND none of them are ACTIVE before approval

    WHEN finance_lead approves the COA bundle
    THEN COA_v = cn_coa_org_2026_v1 becomes ACTIVE
    AND Π_cn_coa_v1 becomes ACTIVE
    AND content hashes and approval records are stored

    GIVEN a new valid REA event evt_new_asset_service_0001
    AND O_v validates service, purchase, agents, transfer, and evidence refs
    AND rea_event contains no coa_code
    WHEN Π_cn_coa_v1 attempts projection
    AND no deterministic rule matches the event
    THEN the REA event remains COMMITTED
    AND no ledger projection is materialized
    AND ProjectionException_t is created
    AND projection_status = PROJECTION_EXCEPTION
    AND reason_code = NO_MATCHING_COA_RULE
    AND candidate_claims are stored as CANDIDATE_ONLY
    AND GovernanceStore review task is opened

    WHEN finance_reviewer selects ADD_CUSTOM_ACCOUNT
    THEN ProjectionExceptionGovernance_t is created
    AND it records exception_ref, proposed_action, justification, evidence_refs, approver, and replay_policy
    AND candidate T6 suggestions remain non-authoritative

    WHEN finance_reviewer approves a new custom account and projection rule
    THEN COA_v+1 = cn_coa_org_2026_v2 is created
    AND Π_cn_coa_v+1 = cn_coa_projection_2026_v2 is created
    AND both are versioned, hashed, approved, and activated
    AND original REA fact remains unchanged

    WHEN governed re-projection runs on evt_new_asset_service_0001
    THEN projection uses Π_cn_coa_v2
    AND ledger projection contains the approved new account_code
    AND ProjectionException_t.status = RESOLVED_BY_GOVERNED_REPROJECTION
    AND replay of the original exception still uses Π_cn_coa_v1
    AND replay of the new projection uses Π_cn_coa_v2
```

---

## 10. CQ Analysis and Reporting User Story

### 中文
作为财务负责人，我希望在试算平衡校验完成后获得可解释的 CQ（Compliance Quality）分析与报告，看到分项质量得分、信任状态、保险准入结论和风险报价，并且能够追溯每个分数来自哪些已记录工件，从而在不依赖实时检索或 LLM 解释的前提下做出关账、导出、保险与治理决策。

### English
As a finance lead, I want CQ (Compliance Quality) analysis and reporting after trial-balance validation, including feature-level quality scores, trust-state outcome, insurance eligibility, and risk quote, with full traceability to recorded artifacts, so I can make close/export/insurance/governance decisions without relying on live retrieval or LLM narration.

### Acceptance Criteria

```text
GIVEN a projected result with pinned trial-balance validation artifacts
WHEN CQ analysis runs under an ACTIVE ComplianceQualityContract_v and calibration model
THEN ComplianceQualityFeatureVector_t is generated deterministically from recorded artifacts only
AND feature values are normalized and hash-bound
AND ComplianceQualityScore_t is generated deterministically from feature vector, contract weights, and calibration status
AND CQ gate outcomes are recorded for projection_trusted, period_close_ready, external_export_ready, and insurance_eligible_candidate
AND ProjectionTrustState_t transition is evaluated without mutating REA facts
AND InsuranceEligibilityResult_t is generated with explicit exclusions and liability basis
AND ComplianceQualityRiskQuote_t is generated with calibration_status preserved
AND governance_prior remains labeled governance_prior (not silently upgraded)
AND all CQ artifacts are append-only and replayable from pinned versions and hashes
```

Negative criteria:

```text
IF required validation artifacts are missing
THEN CQ analysis must fail closed and no trusted/export-ready claim is produced.

IF replay binding is invalid
THEN trust_state must not become PROJECTION_TRUSTED.

IF insurance exclusions are triggered (for example manual_override)
THEN eligibility must be REQUIRES_REVIEW, ELIGIBLE_WITH_EXCLUSIONS, or DECLINED per contract.

IF calibration model is governance_prior
THEN reports must not present the quote as empirically calibrated.

IF a newer contract or calibration model is activated
THEN historical CQ scores remain unchanged and recalculation creates new records only.
```

### CQ Reporting Output Surface

```text
CQ summary:
  score
  calibration_status
  gate outcomes
  projection trust state

CQ feature breakdown:
  validity
  direction_quality
  variance_quality
  reconciliation_quality
  evidence_completeness
  replayability
  governance_status
  override_penalty

Insurance output:
  eligibility_state
  exclusions
  liability_basis
  expected_loss
  pure_premium
  gross_premium
  deductible
  liability_cap
```

---

## 10.5. Internal Audit (内审) User Story

### 中文

作为内部审计员，我希望能够对已关账期间的特定交易进行取样审查，系统为我生成完整的审计证据包（包括 REA 事实、投影过程、试算平衡校验结果、CQ 得分和信任状态），并且我能够离线验证这些交易的完整语义链——从源经济事实到投影、试算、CQ 评分再到信任状态——而无需依赖任何实时检索、LLM 调用或当前运行时。我需要确保系统没有事后生成任何解释或证据。

### English

As an internal auditor, I want to sample specific transactions from a closed period and have the system generate a complete audit evidence package (including REA facts, projection processes, trial balance validation results, CQ scores, and trust states), and I want to independently verify the full semantic chain of sampled transactions—from source economic fact through projection, trial balance, CQ scoring, to trust state—without depending on any live retrieval, LLM calls, or current runtime state. I need to ensure no post-hoc explanation or evidence was fabricated.

### Audit Evidence Package Contents

The `AuditEvidencePackage_t` for internal audit includes:

```text
REA event record
  - event_id, occurred_at, resource, agent, claim
  - event_hash
  - justification_refs (evidence IDs that support admission)

ProjectionContextSnapshot_t
  - context_hash
  - pinned O_v, C_v, K_v, Π_v versions
  - memory_candidate_refs (what was retrieved, what was rejected)

ProjectionResult_t or ProjectionException_t
  - projection_id, status
  - account_code (if projected)
  - projection_context_hash
  - resolution_trace_hash (which semantic claim won, why)
  - projected_amount, valuation_method

TrialBalanceValidationResult_t
  - validation_checks (direction, variance, reconciliation, period-close)
  - check results and severity
  - failure explanation refs

ComplianceQualityFeatureVector_t + ComplianceQualityScore_t
  - validity_score, direction_quality_score, variance_quality_score
  - reconciliation_quality_score, evidence_completeness_score
  - replayability_score, governance_status_score, override_penalty
  - final_cq_score and gate outcomes

ProjectionTrustState_t
  - trust state at time of close (PROJECTION_TRUSTED, PROJECTION_WARNING, etc.)
  - governance decisions (if any)
  - user_feedback_signals (if any)

Replay Binding
  - all pinned artifact versions
  - all hashes (event_hash, context_hash, effect_hash)
  - no live dependencies
```

### Audit Workflow Steps

#### Step 1 — Period Close Validation and Reporting

Finance lead confirms period close, which transitions all PROJECTION_VALIDATED results to either PROJECTION_TRUSTED or PROJECTION_REQUIRES_GOVERNANCE. Only PROJECTION_TRUSTED results are included in closed financial reports.

#### Step 2 — Audit Sampling

Internal auditor opens the audit console and selects:
- Sampling methodology (risk-based, random, stratified)
- Sample size
- Period and date range
- Account or transaction type filters

Example:
```yaml
audit_sample:
  method: risk_based
  criteria:
    - high_cq_variability
    - large_transactions (> 50k)
    - override_events
    - variance_flags
  sample_size: 30
  period: "2026-05"
  expected_artifacts:
    - AuditEvidencePackage_t records
```

#### Step 3 — Evidence Package Generation

System generates `AuditEvidencePackage_t` for each sampled transaction, including:
- All semantic version pins (O_v, C_v, K_v, Π_v)
- Recorded artifacts (not recomputed)
- Evidence references (not generated by LLM)
- Hash bindings for replay verification
- Exception state (if any)

#### Step 4 — Independent Verification

Internal auditor performs offline verification without calling the live runtime:

```text
For each sampled transaction:
  1. Load AuditEvidencePackage_t
  2. Validate schema compliance
  3. Verify hashes:
     - Hash(REA event) matches event_hash
     - Hash(ProjectionContextSnapshot_t) matches context_hash
     - Hash(resolution trace) matches resolution_trace_hash
  4. Replay projection using pinned Π_v and ProjectionContextSnapshot_t
  5. Confirm replayed result matches stored ProjectionResult_t
  6. Verify CQ score deterministically from recorded feature vector
  7. Confirm trust state transition is correct given recorded governance decisions
  8. Check no live retrieval was invoked during original projection or CQ scoring
  9. Mark transaction as AUDIT_VERIFIED or flag AUDIT_EXCEPTION
```

#### Step 5 — Audit Summary

Internal auditor produces:

```yaml
internal_audit_summary:
  period: "2026-05"
  sample_size: 30
  verified_count: 29
  exception_count: 1
  exceptions:
    - transaction_ref: evt_xxx_0001
      reason: "ReplayBinding hash mismatch"
      severity: critical
  conclusion:
    - all_verified_projections_replay_correctly: true
    - all_verified_cq_scores_deterministic: true
    - no_live_runtime_dependencies_detected: true
    - governance_decisions_recorded_and_justified: true
    - audit_opinion: QUALIFIED (1 exception found and resolved)
```

### Acceptance Criteria

```text
GIVEN a period has been closed with PROJECTION_TRUSTED results
AND an internal auditor samples N transactions
WHEN AuditEvidencePackage_t is generated for each sample
THEN each package includes:
  - REA event with event_hash
  - ProjectionContextSnapshot_t with context_hash
  - ProjectionResult_t with projection_context_hash
  - TrialBalanceValidationResult_t
  - ComplianceQualityFeatureVector_t + ComplianceQualityScore_t
  - ProjectionTrustState_t
  - ReplayBinding_t with all pinned versions

WHEN auditor loads package and replays
THEN:
  - Hash(REA event) == stored event_hash → VERIFIED
  - Hash(ProjectionContextSnapshot_t) == stored context_hash → VERIFIED
  - Replay(Π_v, ProjectionContextSnapshot_t) == stored ProjectionResult_t → VERIFIED
  - Compute CQ features from stored artifacts == stored CQ feature vector → VERIFIED
  - TransitionTrustState(CQ score, governance decisions) == stored trust state → VERIFIED
  - No live LLM, OCR, memory retrieval, or runtime invocation is required → VERIFIED
```

Negative criteria:

```text
IF event_hash doesn't match
THEN mark AUDIT_EXCEPTION and flag for resolution.

IF replay produces different result
THEN mark AUDIT_EXCEPTION; possible Π_v mutation or context loss.

IF CQ score was computed with live dependencies
THEN mark AUDIT_EXCEPTION; violates determinism principle.

IF no replay binding exists
THEN mark AUDIT_EXCEPTION; cannot verify.

IF governance decision is missing justification
THEN mark AUDIT_EXCEPTION; audit trail incomplete.
```

### E2E Test Case

The internal audit flow is exercised by:

```text
test_internal_audit_sampling_and_offline_verification()
    GIVEN a closed period with 100 PROJECTION_TRUSTED transactions
    AND auditor samples 10 high-risk transactions
    WHEN AuditEvidencePackage_t is generated for each
    THEN all packages validate against schema
    AND all hashes match recorded values
    AND all projections replay correctly under pinned Π_v
    AND all CQ scores are deterministic from feature vector
    AND no transaction produces AUDIT_EXCEPTION
    AND audit_opinion transitions to UNQUALIFIED
```

This test uses bootstrap simulator events to ensure real-world transaction patterns (purchases, expenses, revenue, reconciliation) are handled correctly.

---

## 11. B-end Partner Onboarding and Incentive User Story

### 中文
作为代账公司合伙人，我希望将我的机构接入 Semantier，为每个客户配置独立的语义账本工作区，并在月度结算报告中看到由 automation_rate、compliance_score 和 override_rate 共同决定的佣金费率，从而以经济激励推动我的团队深度使用系统、避免人工干预。

### English
As an accounting firm partner (B-end), I want to onboard my firm to Semantier, configure per-client semantic ledger workspaces, and receive a monthly settlement report showing a commission rate driven by automation_rate, compliance_score, and override_rate, so that I have a structural financial incentive to maximize system depth and minimize overrides.

### Acceptance Criteria

```text
GIVEN an accounting firm has been approved as a Semantier B-end partner
WHEN firm onboarding runs
THEN a partner_id is assigned
AND each client receives an isolated tenant workspace with its own COA_v and Π_v
AND the partner_incentive contract version is pinned to the firm's onboarding record

WHEN the monthly settlement cycle runs
THEN ComplianceQualityScore_t records are aggregated per partner across all client workspaces
AND automation_rate = (system-executed projections) / (total projections) is computed
AND compliance_score = mean CQ score across all PROJECTION_TRUSTED results is computed
AND override_rate = (overridden projections) / (total projections) is computed
AND commission_rate = base_rate + α*automation_rate + β*compliance_score - γ*override_rate
AND commission_rate is rounded to contract precision and hash-bound to the settlement record
AND the settlement record references the pinned partner_incentive DSL contract version
AND the settlement record is append-only

WHEN override_rate > 0.15 in any settlement period
THEN a penalty cliff applies: commission_rate = base_rate * 0.50
AND the penalty is visible in the settlement report with reason = override_penalty_cliff
AND no retroactive correction is applied to the current period
```

Negative criteria:

```text
IF automation_rate is computed from projections where override == true
THEN those projections must be excluded from the automation_rate numerator.

IF a CQ score was produced under a different contract version than the active partner_incentive contract
THEN the settlement must flag the version mismatch and treat those scores as EXCLUDED.

IF compliance_score < 0.90 for the period
THEN insurance_coverage status transitions to SUSPENDED for that partner until the next period.

IF the partner disputes the settlement
THEN every input metric must be traceable to recorded ComplianceQualityFeatureVector_t artifacts.
```

### E2E Test Case

```text
test_b_end_partner_onboarding_and_incentive_settlement()
    GIVEN partner firm alpha_accounting_co is approved
    AND client workspaces are configured with cn_coa_org_2026_v1
    WHEN settlement cycle runs for 2026-05
    AND automation_rate = 0.82, compliance_score = 0.971, override_rate = 0.04
    THEN commission_rate = base_rate + α*0.82 + β*0.971 - γ*0.04
    AND settlement record is hash-bound and append-only
    AND insurance_coverage_status = ACTIVE

    WHEN override_rate = 0.17 in a subsequent period
    THEN commission_rate = base_rate * 0.50
    AND penalty_reason = override_penalty_cliff
    AND insurance_coverage_status = SUSPENDED
```

---

## 12. Liability Contract and Responsibility Allocation User Story

### 中文
作为财务负责人，我希望每一笔日记账分录都携带机器可读的责任归属标签——输入错误归 B 端、语义投影错误归平台、人工干预错误归操作者——从而在税务处罚或审计调整发生时，能够通过系统记录确定性地追溯责任方，而不产生争议。

### English
As a finance lead, I want each journal entry to carry a machine-readable liability allocation tag identifying whether any error is attributable to the partner (input error), the platform (projection error under a valid bundle), or the actor (manual override), so that in the event of a tax penalty or audit adjustment, responsibility is deterministically traceable to the recorded system artifacts without dispute.

### Acceptance Criteria

```text
GIVEN a projection is produced by Π_v under valid input with no override
WHEN the ledger contract is evaluated
THEN the resulting JE record includes:
    liability_model.input_error = "partner"
    liability_model.projection_error = "platform"
    liability_model.manual_override = "actor"
AND risk_profile.confidence is derived from cq_score
AND risk_profile.audit_exposure is derived from variance_quality feature
AND liability_trigger.requires = [valid_projection_execution, justification_present, no_override]
AND liability_trigger.excludes = [input_error, fraud, manual_override, missing_evidence]
AND the liability record is hash-bound and append-only

WHEN an override occurs
THEN UserFeedbackSignal_t.override = true is recorded
AND liability transitions to actor for that JE
AND cq_score receives override_penalty
AND insurance_eligibility is DECLINED for that JE
AND the override reason is mandatory before the override is accepted

WHEN an input error is later discovered (e.g., incorrect invoice amount)
THEN the original REA fact is NOT mutated
AND a correction REA event is submitted as a new economic fact
AND liability_model.input_error = "partner" is recorded on the correction event
AND no platform liability is triggered
```

Negative criteria:

```text
IF a projection runs correctly under Π_v but input data was fraudulent
THEN platform liability is not triggered; exclusion = fraud applies.

IF a human reviewer selects a COA node from a governance-approved list (no override)
THEN that selection does not trigger actor liability; it is governed approval.

IF a projection bundle error is discovered retroactively
THEN only the new correction projection creates a new liability record;
the original JE liability record is not mutated.
```

---

## 13. Risk Pool and Insurance Claim Trigger User Story

### 中文
作为平台运营主体，我希望每笔符合保险准入条件的投影事务按比例向风险池缴纳准备金，并当有效保险索赔触发时（投影执行正确、justification 完整、无人工干预、仍发生损失），系统能够通过记录的触发证据确定性地评估索赔资格，从而使平台的责任承担具备可核查的证明基础，而不依赖事后叙述。

### English
As a platform operator, I want each insurance-eligible projection to contribute a proportional amount to a risk pool, and when a valid claim trigger occurs (correct projection execution, complete justification, no override, loss still occurred), I want the system to deterministically evaluate claim eligibility from recorded trigger evidence, so that platform liability acceptance has a verifiable evidentiary basis rather than relying on post-hoc narrative.

### Acceptance Criteria

```text
GIVEN a projection result has InsuranceEligibilityResult_t.eligibility_state = ELIGIBLE
WHEN the transaction is committed
THEN a risk_pool_contribution_event is created:
    contribution_amount = exposure_amount * risk_pool_rate
    source_projection_id = proj_...
    cq_score = <pinned>
    eligibility_state = ELIGIBLE
    content_hash = sha256(...)
AND the contribution event is append-only

WHEN a loss event occurs (e.g., tax authority adjustment, audit finding)
AND the claimant submits a claim referencing the projection_id
THEN claim_trigger evaluation runs deterministically:
    requires_check: valid_projection_execution → verified from TrialBalanceReplayBinding_t
    requires_check: justification_present → verified from TrialBalanceJustification_t
    requires_check: no_override → verified from UserFeedbackSignal_t.override == false
    excludes_check: input_error, fraud, manual_override, missing_evidence
THEN if all requires pass and no exclusions triggered:
    InsuranceClaimResult_t.status = ELIGIBLE_FOR_PAYMENT
    liability_basis = platform
    evidence_hash_bundle = [replay_binding_hash, justification_hash, cq_score_hash]
THEN if any exclusion is triggered:
    InsuranceClaimResult_t.status = DECLINED
    decline_reason = <exclusion type>
AND the claim result is append-only and replayable

WHEN the risk pool balance is evaluated against the retention layer threshold
THEN excess exposure is surfaced to primary insurer or reinsurer according to ReinsurancePortfolioManifest_t
```

Negative criteria:

```text
IF the claimant cannot produce a valid projection_id with a pinned ReplayBinding_t
THEN the claim evaluation cannot proceed.

IF the loss occurred because the governing regulation changed after projection was trusted
THEN this is NOT a platform liability trigger; regulation_change is a separate exclusion.

IF input data was incorrect and caused the loss (even under a correct projection rule)
THEN claim is declined; exclusion = input_error.
```

---

## 14. CQ-Driven Commission Settlement User Story

### 中文
作为代账公司合伙人，我希望每月收到一份可审计的佣金结算报告，清楚展示我的 automation_rate、compliance_score、override_rate 分项指标，以及按 DSL 合同公式计算出的最终佣金费率，使我能够对照记录工件自行验证计算结果，并在有异议时提交可追溯的申诉。

### English
As an accounting firm partner, I want a monthly auditable commission settlement report showing my automation_rate, compliance_score, and override_rate component metrics and the final commission_rate computed by the pinned DSL contract formula, so that I can self-verify the calculation against recorded artifacts and submit a traceable dispute if I disagree.

### Acceptance Criteria

```text
GIVEN the settlement period 2026-05 has ended for partner alpha_accounting_co
WHEN settlement computation runs under partner_incentive.cn.v1
THEN the settlement record includes:
    period: 2026-05
    partner_id: alpha_accounting_co
    contract_version: partner_incentive.cn.v1
    total_projections: N
    system_executed_projections: N_auto (override == false)
    automation_rate: N_auto / N
    mean_cq_score: mean(ComplianceQualityScore_t.score) for PROJECTION_TRUSTED results
    compliance_score: mean_cq_score
    override_count: N_override (override == true)
    override_rate: N_override / N
    commission_rate: computed from pinned formula
    insurance_eligible_projection_rate: N_eligible / N
    penalty_applied: false | override_penalty_cliff | low_cq_penalty
    source_artifact_refs: [cq_score_ids ..., feature_vector_ids ...]
    content_hash: sha256(...)

WHEN the partner disputes a metric
THEN each component is traceable to individual ComplianceQualityFeatureVector_t records
AND each record's source_artifacts includes hashes of the underlying validation artifacts
AND no live runtime call is needed to verify the settlement
```

Negative criteria:

```text
IF a ComplianceQualityScore_t was produced under a different contract version
THEN it is excluded from the settlement computation and flagged as CONTRACT_VERSION_MISMATCH.

IF a projection was in PROJECTION_EXCEPTION status at period end
THEN it contributes to override_rate = 0 and automation_rate denominator but
does NOT contribute to compliance_score numerator.
```

---

## 15. Reinsurance Portfolio Reporting User Story

### 中文
作为平台风险官，我希望每季度生成一份 ReinsurancePortfolioManifest，汇总当期承保投影数量、总暴露金额、CQ 分布（P10/P50/P90）、预期损失和各层次再保险结构，并以可验证工件引用的方式提交给再保险方，使再保险方无需访问 Semantier 实时服务即可独立核验风险组合。

### English
As a platform risk officer, I want a quarterly ReinsurancePortfolioManifest generated from aggregated CQ distribution, exposure, expected loss, and reinsurance retention/cession layers, with artifact hashes the reinsurer can independently verify, so that the reinsurer never needs access to live runtime to audit the portfolio.

### Acceptance Criteria

```text
GIVEN the portfolio period 2026-Q2 ends
WHEN ReinsurancePortfolioManifest_t is generated for portfolio_cn_tax_2026_q2
THEN the manifest includes:
    period_start: 2026-04-01
    period_end: 2026-06-30
    cq_contract_version: cq.v2.0.0
    calibration_model_version: cq_calibration.cn.default.v1
    calibration_status: governance_prior (if still prior)
    insured_projection_count: N
    total_exposure_amount: sum(exposure_amounts)
    cq_distribution: { p10, p50, p90 }
    expected_loss_total: sum(expected_loss per InsuranceEligibilityResult_t)
    gross_premium_total: sum(gross_premium per ComplianceQualityRiskQuote_t)
    retention_layer: { from: 0, to: R }
    primary_insurer_layer: { from: R, to: L }
    reinsurer_layer: { from: L, to: unlimited }
    verification_artifact_refs: [ExternalVerificationManifest_t refs ...]
    content_hash: sha256(...)

WHEN the reinsurer requests independent verification
THEN they can replay CQ scores from exported artifact bundles
AND they do NOT call any Semantier runtime API
AND they do NOT access live KGL or LLM services
AND hash verification of all artifact refs must pass
```

Negative criteria:

```text
IF calibration_status is governance_prior
THEN the manifest must not claim actuarial validation of the expected loss estimates.

IF any insured projection has an invalid ReplayBinding_t
THEN it must be excluded from the manifest and listed in an exclusion_log.

IF the reinsurer layer boundary L has not been defined in the active InsuranceRiskContract_v
THEN the manifest generation must fail closed with error = REINSURANCE_LAYER_UNDEFINED.
```

---

## 16. Compliance Drift Detection User Story

### 中文
作为财务负责人，我希望在激活新版本 COA 或 Π_v+1 后，系统能自动对历史投影记录执行 drift 分析——对比当前 Π_v 和新 Π_v+1 在相同 REA 事实下会产生不同结果的案例——并在关账前通知我需要人工评审的异常事项，以防止语义漂移在下一个核算周期造成不一致。

### English
As a finance lead, I want the system to automatically run compliance drift analysis after a new COA or Π_v+1 is activated — comparing which historical REA events would produce different results under the new rules versus the old rules — and surface affected events for human review before period close, so that semantic drift does not silently propagate into the next accounting cycle.

### Acceptance Criteria

```text
GIVEN COA_v+1 = cn_coa_org_2026_v2 and Π_v+1 = cn_coa_projection_2026_v2 are activated
WHEN compliance drift analysis runs for the active ledger period
THEN for each historical REA event in the period:
    run Π_v+1 projection in dry-run mode (no commit)
    compare dry-run result to original committed projection under Π_v
    if different account_code or tax treatment:
        create ComplianceDriftSignal_t:
            event_id: ...
            original_projection_id: ...
            original_bundle: Π_v
            drift_projection_result: <dry-run output>
            drift_bundle: Π_v+1
            difference_summary: { changed_fields }
            review_required: true
THEN a DriftAnalysisReport_t is created:
    analysis_period: <period>
    events_analyzed: N
    events_with_drift: M
    drift_signal_ids: [...]
    content_hash: sha256(...)
AND the report is surfaced in the governance queue before period close is allowed

WHEN finance lead reviews each drift signal
THEN they may:
    accept_new_projection: triggers GovernedReprojection_t under Π_v+1
    retain_original: records explicit waiver with justification
AND period close gate checks that all ComplianceDriftSignal_t.review_required == true are resolved
```

Negative criteria:

```text
IF drift analysis is run after period close has been confirmed
THEN it runs in READ-ONLY mode and produces DriftAnalysisReport_t only;
it does NOT reopen the closed period.

IF a ComplianceDriftSignal_t is created but finance lead is unavailable
THEN period close is blocked until all drift signals are resolved or waived.

IF the dry-run projection under Π_v+1 produces a PROJECTION_EXCEPTION
THEN the drift signal must record the exception rather than silently suppress it.
```

---

## 17. Override Escalation Workflow User Story

### 中文
作为合规官，我希望任何人工干预（override）系统投影的行为都必须触发强制升级流程：操作者提供书面理由、CQ 得分因 override_penalty 降低、受影响的分录被标记为高审核等级、且在下一次关账前汇总为 OverrideEscalationSummary，从而防止人工干预静默积累成系统性合规风险。

### English
As a compliance officer, I want any human override of a system projection to trigger a mandatory escalation workflow — the actor must provide a written reason, the CQ score is immediately penalized, the affected entry is flagged to a higher review tier, and all overrides are surfaced in an OverrideEscalationSummary before the next period close — so that ad-hoc overrides cannot silently accumulate into systemic compliance risk.

### Acceptance Criteria

```text
GIVEN a finance reviewer submits an override to change a system-generated account_code
WHEN the override is submitted
THEN the system requires override_reason (minimum 20 characters) before accepting
AND UserFeedbackSignal_t is recorded with override = true, reason, actor_id, timestamp
AND ComplianceQualityScore_t is recalculated with override_penalty applied
AND the affected JE risk_profile.audit_exposure is elevated to HIGH
AND liability_model transitions from platform to actor for that JE
AND InsuranceEligibilityResult_t for that JE becomes DECLINED

WHEN the period close pre-check runs
THEN an OverrideEscalationSummary_t is generated:
    period: <period>
    total_overrides: N
    by_actor: { actor_id: count, ... }
    by_reason_category: { tax_dispute, classification_disagreement, ... }
    projected_cq_impact: delta CQ for affected projections
    high_risk_count: count where audit_exposure = HIGH
    content_hash: sha256(...)
AND the summary is presented to the compliance officer before close is approved
AND the compliance officer must sign off on the summary or escalate to tax advisor

WHEN the override_rate for any partner exceeds 0.15 in the period
THEN a PartnerOverrideAlert_t is generated and routed to B-end account management
AND commission_rate penalty_cliff is triggered for that settlement period
```

Negative criteria:

```text
IF a governance-approved action (e.g., ADD_CUSTOM_ACCOUNT via ProjectionExceptionGovernance_t)
THEN it is NOT counted as an override; it is a governed decision.

IF the override_reason field is empty or fewer than 20 characters
THEN the override submission is rejected with error = OVERRIDE_REASON_REQUIRED.

IF an override is discovered to be based on fraudulent input
THEN a FraudSignal_t is created and the override record is escalated to legal review;
the original JE is not mutated but is locked.
```

---

## 18. Low-Friction Entry Product User Story (Invoice Tax Risk Check)

### 中文
作为尚未订阅 Semantier 服务的小微企业主，我希望提交单张发票图片或一段微信沟通记录，立即获得关键语义提取结果（金额、税率、开票方、科目建议）和税务风险评估（是否存在虚开、进项抵扣风险、行业高频违规模式），而无需提前配置 COA 或建立账本，从而评估系统的实际能力后再决定是否与合作代账公司建立长期服务关系。

### English
As a small business owner not yet subscribed to Semantier, I want to submit a single invoice image or WeChat conversation and immediately receive key semantic extraction results (amount, tax rate, issuer, COA suggestion) and a tax risk assessment (potential false issuance, input VAT deduction risk, industry-frequent violation patterns) without configuring a COA or ledger, so that I can evaluate system accuracy before committing to a B-end partner relationship.

### Acceptance Criteria

```text
GIVEN an unauthenticated or trial-tier user submits a single invoice image
WHEN the entry product pipeline runs
THEN OCR and semantic extraction runs and produces:
    SemanticExtractionResult_t:
        extracted_amount
        extracted_tax_rate
        extracted_issuer
        extracted_category (T5 candidate only)
        confidence_score
AND tax risk signals are evaluated:
    TaxRiskSignal_t:
        false_issuance_risk: LOW | MEDIUM | HIGH
        input_vat_deduction_risk: LOW | MEDIUM | HIGH
        industry_violation_pattern_match: true | false | NOT_APPLICABLE
        regulatory_basis: <pinned K_v reference>
AND a COA classification suggestion is produced as T6 candidate (NOT authoritative):
    coa_suggestion: <account_code candidate>
    suggestion_tier: T6
    status: CANDIDATE_ONLY
AND the result is returned within the session without creating a REA fact
AND no COA_v or Π_v is required to be active for this flow
AND the result includes a clear notice: this is a non-binding preview; no audit trail is created

WHEN the user decides to proceed with a B-end partner
THEN the entry product result may be shared with the partner as a reference document
AND the partner onboards the user to a full tenant workspace
AND the original entry product result is NOT automatically promoted to a committed REA fact
```

Negative criteria:

```text
IF the invoice image is unreadable or confidence_score < threshold
THEN the extraction must return EXTRACTION_FAILED with reason, not a fabricated result.

IF the entry product result is mistakenly treated as a committed ledger entry
THEN the system must reject any attempt to reference it in a TrialBalanceView_t.

IF the user submits data that triggers a potential fraud pattern
THEN the system may decline the preview and record a FraudSignal_t internally.
```

---

## 19. Signup, Industry Demo Dataset, and Multi-Organization Context Journey

### 中文
作为刚注册 Semantier 的小微企业用户，我希望在注册时选择自己所属的行业，并被自动加入对应行业的 demo organization，这样我无需先配置 COA、规则或组织结构，就能立即体验系统基于该行业 demo dataset 提供的语义结果与经营分析，尽早获得 aha moment。

同时，作为逐步深入使用的用户，我希望自己可以同时属于多个 organization，并在这些 organization 之间切换当前上下文，这样我既可以体验行业 demo dataset，也可以进入自己的真实 organization 或其他授权 organization，而系统在切换后应同步切换语义上下文、默认数据来源和后续 agent reasoning 边界。

### English
As a newly registered Semantier user, I want to choose my industry at signup and be automatically attached to the corresponding demo organization, so that I can experience meaningful semantic and business outputs immediately without first configuring COA, rules, or organization structure, and reach the aha moment early.

At the same time, as a user who goes deeper into the product, I want to belong to multiple organizations and switch my active context between them, so that I can move between industry demo datasets, my real organization, and other authorized organizations, while the system switches semantic context, default data source, and agent reasoning boundaries accordingly.

### Acceptance Criteria

```text
GIVEN a new authenticated user completes signup
WHEN the user selects an industry during onboarding
THEN the system resolves that industry to a predefined demo organization profile:
    DemoOrganizationProfile_t:
        organization_id: <stable industry demo org id>
        organization_name: <industry-specific display name>
        industry_code: construction | apparel_customization_trade | retail | manufacturing | services | ...
        dataset_type: DEMO
        dataset_version: <pinned seed / manifest version>
        semantic_scope: <industry-specific governed bundle set>
AND that demo organization profile must correspond to a real bootstrap-seeded organization record, not only a frontend default label or runtime fallback constant
AND the system creates or activates a membership for that user in the selected demo organization
AND that demo organization becomes the user's active context for the initial session
AND the user may enter the product without manual COA onboarding
AND after signup the default landing page is `chat new`
AND the initial UX surfaces semantic outputs from the demo dataset fast enough to create the aha moment
AND the `chat new` page shows clickable demo prompts grounded in the selected demo dataset rather than generic placeholder prompts
AND the minimum prompt set must cover:
    营业分析
    日常入账报销
    报税报告生成
    合规报告生成
AND for the apparel customization / trade industry, the seeded demo organization must include:
    organization_id: org_demo_apparel_trade_cn
    organization_name: 北京宝库电子商务有限公司
    industry_code: apparel_customization_trade
AND its minimal dataset content must be comparable in breadth to the bootstrap content for 北京索阳科技有限公司
AND its trade-industry semantics must include at least one REA path for undocumented input purchase / no-invoice input VAT deduction risk
AND the apparel customization / trade demo dataset should be modeled from real business-event semantics first:
    procurement
    customization / production fulfillment
    inventory movement
    ecommerce / trade sales
    platform settlement
    returns / refunds
    reimbursement
    tax / compliance preparation inputs
AND Chinese industry statistics may inform scenario priority and demo prompt design
AND they must NOT be treated as the authority source for REA ontology, deductible conclusions, or governed tax interpretation

WHEN the user later joins or creates additional organizations
THEN the system preserves the user's existing memberships
AND the user may have more than one organization membership concurrently
AND each membership records:
    organization_id
    membership_status
    member_role
    dataset_type: DEMO | REAL
    joined_at

WHEN the user switches the active organization
THEN the authenticated request context changes to the selected organization_id
AND subsequent chat, analytics defaults, knowledge-access projections, and organization-scoped queries use the newly active organization context
AND the workspace session UI reflects the currently active organization clearly
AND the switch does NOT mutate historical records in the previously active organization
AND the switch does NOT merge facts, knowledge, approvals, or projections across organizations

WHEN the active organization is a demo organization
THEN demo facts and demo governed artifacts are readable within that org scope
AND the system may let the user explore projections, reports, and semantic explanations from the demo dataset
AND demo organization context remains isolated from any real organization the user later joins
AND the aha moment is accepted only if the user can click the seeded demo prompts and successfully see meaningful outputs for:
    营业分析
    日常入账报销
    报税报告生成
    合规报告生成

WHEN the active organization is the user's real organization
THEN the system must use the real organization's facts, governed bundles, and policy context
AND demo organization context must no longer be treated as the default reasoning source
AND any agent or analytics flow must bind to the real organization_id for subsequent requests
```

Negative criteria:

```text
IF a user belongs to multiple organizations
THEN the system MUST NOT silently blend data or governed artifacts across org boundaries.

IF the user switches organization context
THEN the switch MUST NOT retroactively alter past replay bindings, audit evidence, or approvals created under the previously active organization.

IF the selected industry has no mapped demo organization profile
THEN signup onboarding must fail closed with an explicit onboarding error or fallback path, not attach the user to an arbitrary org.

IF a demo organization is updated to a new dataset version
THEN historical replay for prior demo-bound actions must still use the original pinned versions and must not silently adopt the latest dataset.

IF the user lacks an active membership in the selected organization
THEN the context switch request must be rejected rather than partially switching UI state only.
```

Example onboarding / switching flow:

```text
User signs up
  -> selects industry = apparel_customization_trade
  -> system attaches user to demo org = org_demo_apparel_trade_cn
  -> active context = org_demo_apparel_trade_cn
  -> landing page = chat new
  -> user clicks demo prompts for:
       - 营业分析
       - 日常入账报销
       - 报税报告生成
       - 合规报告生成
  -> user sees seeded semantic outputs and reports from the trade-industry dataset

User later creates or joins real org = org_acme_real
  -> memberships now include:
       - org_demo_apparel_trade_cn (DEMO)
       - org_acme_real (REAL)
  -> user switches active context to org_acme_real
  -> subsequent analytics, chat defaults, and knowledge access bind to org_acme_real

User switches back to demo org for comparison
  -> active context = org_demo_apparel_trade_cn
  -> no facts or governed artifacts are copied between the two orgs
```

Implementation implications:

1. Industry onboarding needs a stable mapping from `industry_code` to `demo organization_id`.
2. Demo organizations must be present in the bootstrap dataset / seed manifest as first-class organization records, not only represented by a frontend default constant.
3. Membership storage must support one user belonging to multiple organizations concurrently.
4. Active organization switching must be reflected in authenticated request context and all downstream organization-scoped reads.
5. Demo org and real org must remain separate semantic partitions under the existing multi-tenant contract.
6. The initial seed cohort should include `北京宝库电子商务有限公司` for `apparel_customization_trade`, with a minimal trade-focused REA scenario covering undocumented input purchase / no-invoice input VAT deduction risk.
7. The post-signup default landing route should be `chat new`, not a neutral settings page.
8. The demo prompt set on `chat new` must be generated from features the selected demo dataset can actually demonstrate.
9. For `org_demo_apparel_trade_cn`, the seeded content should distinguish:
   - core REA business events
   - trade / ecommerce risk overlays
   - demo prompt coverage
10. Industry statistics may shape which scenarios are emphasized first, but must not replace governed semantic modeling of the underlying business events.
11. Research-backed scenario priority data for the apparel/trade industry is documented in [refactoring_plan_8.6.7_phase1_sprint3_industry_demo_onboarding.md](../refactoring_plan_8.6.7_phase1_sprint3_industry_demo_onboarding.md) appendix and includes real patterns for: no-invoice procurement risk, platform settlement netting, inventory-sales mismatch, return-rate impact, and mixed production-plus-trade operating models.

---

## 20. Actuarial Calibration Transition User Story

### 中文
作为平台精算顾问，我希望系统持续累积 ComplianceQualityOutcome_t 记录（真实损失、审计调整、税务处罚），并在累积足够历史数据时通过治理里程碑触发 calibration_status 从 governance_prior 升级为 empirically_calibrated，从而使保险定价从临时性治理估算过渡到精算支持的经验模型，使再保险方能够接受经过证明的风险定价。

### English
As a platform actuary, I want the system to accumulate ComplianceQualityOutcome_t records (actual losses, audit adjustments, tax penalties) over time and surface a governance milestone when sufficient outcome history supports transitioning calibration_status from governance_prior to empirically_calibrated, so that insurance pricing transitions from provisional governance estimates to actuarially supported models that reinsurers can accept as empirically proven.

### Acceptance Criteria

```text
GIVEN ComplianceQualityOutcome_t records have been accumulating for a minimum governance-defined period
WHEN the actuary initiates calibration review
THEN the system generates CalibrationReadinessReport_t:
    outcome_records_count: N
    training_window_start: <date>
    training_window_end: <date>
    feature_schema_hash: sha256(...)
    outcome_population_hash: sha256(...)
    excluded_records_hash: sha256(...)
    candidate_frequency_model: { model_type, parameters, performance_metrics }
    candidate_severity_model: { model_type, parameters, performance_metrics }
    governance_approval_required: true

WHEN governance approves the new calibration model
THEN a new ComplianceQualityCalibrationModel_v is created:
    calibration_status: empirically_calibrated
    model_type: logistic_frequency + lognormal_severity (or approved alternative)
    training_artifacts: all hashes above
    approved_by: actuary_lead + governance_board
    activation_date: <date>
AND historical CQ scores are NOT recalculated
AND new projections after activation use the empirically_calibrated model
AND the transition event is recorded in the governance audit trail

WHEN the ReinsurancePortfolioManifest_t is next generated
THEN calibration_status = empirically_calibrated
AND the manifest references the approved calibration model version and its training artifact hashes
AND the reinsurer may independently verify the training outcome population
```

Negative criteria:

```text
IF outcome records count is below the minimum governance-defined threshold
THEN CalibrationReadinessReport_t.governance_approval_required remains true
AND the calibration_status MUST NOT be upgraded.

IF the approved calibration model is later found to have systematic bias
THEN a model correction governance action is required
AND historical quotes generated under the biased model are NOT retroactively changed
AND new quotes after the correction use the corrected model.

IF a ReinsurancePortfolioManifest_t uses calibration_status = governance_prior
THEN it MUST NOT claim empirical validation in any presentation or report.
```

---

## 21. Updated Key Semantic Principle

### 中文
系统的核心不只是建立交易勾稽关系，而是在勾稽关系之上建立可治理的语义准入边界。有效经济事实可以先被承认和保存；账簿分类失败不等于事实失败。COA 是 projection taxonomy，不是 ontology。当前 COA 无法投影时，系统必须创建 projection exception，而不是拒绝 REA fact 或让 LLM 编造科目。COA 和 projection rule 的演进必须通过 Governance Loop，并通过版本化保证历史回放稳定。

### English
The core of the system is not only the construction of transaction correlations, but the creation of a governed semantic admission boundary. A valid economic fact may be admitted and preserved even when ledger classification fails. COA is a projection taxonomy, not ontology. When the current COA cannot project an event, the system must create a projection exception rather than reject the REA fact or let an LLM invent an account. COA and projection rule evolution must go through the Governance Loop, and versioning must preserve historical replay stability.

---

## 22. Test Instructions for All User Stories

Use the following automated tests to validate all user stories in this document and related product stories.

### Environment

```bash
cd /home/chris/repo/semantier-runtime
source .venv/bin/activate
```

### Core execution protocol user story

```bash
uv run pytest tests/test_workflows.py -v
```

### Weixin semantic completion user story

```bash
uv run pytest tests/test_semantic_completion.py tests/test_commit_projection_integration.py -v
```

### Invoice-to-journal E2E (gateway-agnostic)

This story exercises the semantic validation and journal-commit path. It is reachable via any supported gateway: Weixin, Feishu, Web UI, or Web API.

```bash
uv run pytest tests/test_hermes_user_story.py -v
```

### v7.5 governance and verification contract stories

```bash
uv run pytest \
  tests/test_projection_exception_store.py \
  tests/test_projection_exception_governance.py \
  tests/test_governed_reprojection.py \
  tests/test_verification_contract_v75.py \
  -v
```

### v7.6 trial balance and trust-state stories

```bash
uv run pytest tests/test_verification_contract_v76.py -v
```

### v7.7 COA onboarding and projection exception governance story (Section 9)

```bash
uv run pytest tests/test_verification_contract_v77.py -v
```

### v8 CQ analysis and reporting story (Section 10)

```bash
uv run pytest tests/test_verification_contract_v8.py -v
```

### All user story suites together

```bash
uv run pytest \
  tests/test_workflows.py \
  tests/test_semantic_completion.py \
  tests/test_commit_projection_integration.py \
  tests/test_hermes_user_story.py \
  tests/test_projection_exception_store.py \
  tests/test_projection_exception_governance.py \
  tests/test_governed_reprojection.py \
  tests/test_verification_contract_v75.py \
  tests/test_verification_contract_v76.py \
  tests/test_verification_contract_v77.py \
  tests/test_verification_contract_v8.py \
  tests/test_b_end_partner_incentive.py \
  tests/test_liability_contract.py \
  tests/test_risk_pool_claim_trigger.py \
  tests/test_cq_commission_settlement.py \
  tests/test_reinsurance_manifest.py \
  tests/test_compliance_drift.py \
  tests/test_override_escalation.py \
  tests/test_entry_product.py \
  tests/test_actuarial_calibration.py \
  -v
```

### v9 B-end partner and liability stories (Sections 11–12)

```bash
uv run pytest \
  tests/test_b_end_partner_incentive.py \
  tests/test_liability_contract.py \
  -v
```

### v9 risk pool, commission, and reinsurance stories (Sections 13–15)

```bash
uv run pytest \
  tests/test_risk_pool_claim_trigger.py \
  tests/test_cq_commission_settlement.py \
  tests/test_reinsurance_manifest.py \
  -v
```

### v9 compliance drift and override escalation stories (Sections 16–17)

```bash
uv run pytest \
  tests/test_compliance_drift.py \
  tests/test_override_escalation.py \
  -v
```

### v9 entry product and actuarial calibration stories (Sections 18–19)

```bash
uv run pytest \
  tests/test_entry_product.py \
  tests/test_actuarial_calibration.py \
  -v
```

### Note on named test in Section 5

The narrative function name `test_full_semantic_chain_cloud_service_external_audit_verification()` is represented in the current repository by the v7.5 governance and verification artifact suites listed above.

## 23. Full-Cycle Accounting Operations User Story

### 中文
作为财务负责人或代账会计，我希望 Semantier-EOS 能够把一个会计期间内从原始凭证、REA 事实、记账投影、账簿视图、对账结账、财务报表、纳税申报到会计档案归档的全过程组织成一个可治理、可解释、可回放的月度闭环，从而使“全盘账”不再依赖人工经验串联，而由语义层级、版本化规则、验证合同和治理记录共同保证。

### English
As a finance lead or accounting operator, I want Semantier-EOS to organize the full accounting-period cycle — from source evidence, REA facts, journal voucher projection, ledger views, reconciliation, period close, financial statements, tax filing, and accounting archive — into a governed, explainable, replayable monthly workflow, so that full-cycle accounting is not merely stitched together by manual experience but maintained by semantic tiers, versioned rules, validation contracts, and governance records.

### Journey Scope

```text
Source evidence collection and review
  > REA fact formation
  > JournalVoucherProjection_t
  > LedgerView materialization
  > TrialBalanceValidation_t
  > ReconciliationValidation_t
  > PeriodCloseValidation_t
  > FinancialStatementPackage_t
  > TaxFilingPackage_t
  > AccountingArchivePackage_t
```

### Step 1 — Source Evidence Collection and Review / 原始凭证收集与审核

#### 中文
用户通过微信、Web UI、API 或代账工作台提交发票、银行回单、合同、工资表、费用报销单、入库单、出库单等原始资料。系统不会把用户陈述直接当成会计事实，而是先创建 `SourceDocumentReview_t`，绑定文件哈希、来源、时间、提交人、提取结果和缺失字段。

系统对凭证执行四类审核：

```text
authenticity_check     业务是否真实发生或至少有足够证据支持
legality_check         是否触及税法、发票、合同或行业监管风险
completeness_check     日期、金额、税率、交易方、签章、附件是否完整
arithmetic_check       金额、税额、价税合计、大小写金额是否一致
```

审核通过不代表已经入账，只代表该凭证可以作为 REA fact formation 的证据输入。

#### English
The user submits invoices, bank receipts, contracts, payroll sheets, reimbursement forms, warehouse documents, and other source materials through Weixin, Web UI, API, or the accounting partner workspace. The system does not treat the user's statement as accounting truth. It first creates `SourceDocumentReview_t`, binding file hash, source, timestamp, submitter, extraction result, and missing fields.

The review checks authenticity, legality, completeness, and arithmetic correctness. Passing document review does not mean the item has been booked. It means the evidence may be used as input for REA fact formation.

### Step 2 — REA Fact Formation / REA 事实形成

#### 中文
审核后的凭证进入 REA 建模。系统把经济业务表达为资源、事件、代理方、权利义务、转移和结算，而不是直接写入会计科目。

```yaml
REAEvent_t:
  event_id: evt_2026_05_0001
  event_type: purchase | sale | payment | payroll | tax_payment | inventory_movement | asset_acquisition
  resources:
    - amount: 1000
      currency: CNY
      tax_amount: 60
  agents:
    provider: vendor/tencent_cloud
    receiver: org/self
  claims:
    - expense_claim
  evidence_refs:
    - source_document_review_id
    - invoice_ref
    - bank_payment_ref
  pins:
    ontology_version: O_v
    tag_ontology_version: O_tag_v
```

关键约束：

```text
REA fact contains no account_code.
REA fact contains no journal voucher number as primitive truth.
REA fact may be committed even if projection later fails.
```

#### English
Reviewed evidence is converted into REA semantics: resources, events, agents, obligations, transfers, and settlements. It is not directly converted into an account code. The REA fact contains no `account_code`; account classification is a later governed projection.

### Step 3 — Journal Voucher Projection / 记账凭证投影

#### 中文
当 REA fact 被提交后，系统使用当前 ACTIVE `COA_v`、`ProjectionBundle_v`、`ConstraintBundle_v` 和必要的 `ProjectionContextSnapshot_t` 生成 `JournalVoucherProjection_t`。

```yaml
JournalVoucherProjection_t:
  voucher_projection_id: jvp_2026_05_0001
  source_event_id: evt_2026_05_0001
  projection_bundle_version: Pi_cn_coa_2026_v1
  voucher_type: purchase | sale | payment | adjustment | closing
  lines:
    - side: debit
      account_code: "6602"
      account_name: "管理费用"
      amount: 1000
      currency: CNY
    - side: credit
      account_code: "1002"
      account_name: "银行存款"
      amount: 1000
      currency: CNY
  justification_ref: TrialBalanceJustification_t | ProjectionJustification_t
  projection_status: projection_candidate | projection_validated | projection_exception
```

如果当前规则无法生成确定分录，系统创建 `ProjectionException_t`，而不是拒绝 REA fact 或让 LLM 编造科目。

#### English
After the REA fact is committed, the system uses active `COA_v`, `ProjectionBundle_v`, `ConstraintBundle_v`, and necessary `ProjectionContextSnapshot_t` to generate `JournalVoucherProjection_t`. If the active projection rules cannot produce a deterministic voucher, the system creates `ProjectionException_t` rather than rejecting the REA fact or allowing an LLM to invent an account code.

### Step 3a — Bundle Linkage Index / 凭证捆绑索引

#### 中文

根据财政部《电子凭证会计数据标准》（财会〔2025〕9号）及配套技术规范，一张记账凭证可关联 N 张原始凭证（N ≥ 1）。每张原始凭证对应一份独立的 XBRL 入账信息结构化数据文件（入账信息文件）。所有入账信息文件通过共享同一 `NumberOfAccountingDocuments` 形成捆绑索引。

`REAEvent_t.evidence_refs` 保持为无序集合；具体的 N→1 捆绑结构是投影阶段由 `COA_v` 和 `ProjectionBundle_v` 根据业务规则（如“同一付款回单合并多笔费用”）决定的，因此捆绑索引属于 `JournalVoucherProjection_t` 的元数据，而非 REA 本体事实。

```yaml
BookkeepingInformationFile_t:
  file_id: bkif_einv_07654_a
  bookkeeping_info_type: einv | rai | bker | ntrev | atr | bkrs | efi | ctp
  xbrl_taxonomy_prefix: einv_ord_receiver
  number_of_accounting_documents: "07654"
  source_voucher_ref: sdr_einv_a
  stable_identifier:
    kind: InvoiceNumber | UniqueIdentifier | ReceiptNumber | ContractNumber
    value: "22442000000921300354"
  content_hash: sha256
  signature_verification_result_ref: svr_einv_a
  generated_at: 2022-07-16T09:30:00+08:00
  projection_line_refs:
    - jvp_07654_line_001
    - jvp_07654_line_002
```

每张入账信息文件必须自包含一对平衡的子分录（借 = 贷），并在 `InformationOfDebitAndCreditEntryTuple` 中完整描述。合并记账凭证主表允许将多张子分录的贷方合并为同一科目（如“银行存款”），只要子分录层面的平衡性不被破坏。

`JournalVoucherProjection_t` 扩展如下：

```yaml
JournalVoucherProjection_t:
  voucher_projection_id: jvp_2022_07_07654
  source_event_id: evt_2022_07_0003
  projection_bundle_version: Pi_cn_coa_2022_v1
  voucher_type: payment
  source_voucher_refs:
    - source_voucher_id: sdr_einv_a
      stable_identifier_kind: InvoiceNumber
      stable_identifier_value: "22442000000921300354"
      bookkeeping_information_file_ref: bkif_einv_07654_a
      sub_entry_balance: 500.00
      debit_line_refs: [jvp_07654_line_001]
      credit_line_refs: [jvp_07654_line_002]
    - source_voucher_id: sdr_rai_b
      stable_identifier_kind: UniqueIdentifier
      stable_identifier_value: "25E1234567"
      bookkeeping_information_file_ref: bkif_rai_07654_b
      sub_entry_balance: 800.00
      debit_line_refs: [jvp_07654_line_003]
      credit_line_refs: [jvp_07654_line_004]
    - source_voucher_id: sdr_bker_c
      stable_identifier_kind: ReceiptNumber
      stable_identifier_value: "6FE0-4D2C-66EA"
      bookkeeping_information_file_ref: bkif_bker_07654_c
      sub_entry_balance: 1300.00
      debit_line_refs: []
      credit_line_refs: [jvp_07654_line_005]
  lines:
    - side: debit
      account_code: "6602"
      account_name: "管理费用"
      sub_account_name: "办公费"
      amount: 500.00
      currency: CNY
      source_voucher_ref: sdr_einv_a
    - side: debit
      account_code: "6602"
      account_name: "管理费用"
      sub_account_name: "差旅费"
      amount: 800.00
      currency: CNY
      source_voucher_ref: sdr_rai_b
    - side: credit
      account_code: "1002"
      account_name: "银行存款"
      sub_account_name: "工行 6FE0"
      amount: 1300.00
      currency: CNY
      source_voucher_refs: [sdr_einv_a, sdr_rai_b, sdr_bker_c]
  justification_ref: TrialBalanceJustification_t
  projection_status: projection_validated
```

#### English

Per the MOF *Electronic Voucher Accounting Data Standard* (Cai Kuai [2025] No. 9) and its technical specifications, one journal voucher may be linked to N source vouchers (N ≥ 1). Each source voucher produces one independent XBRL bookkeeping information structured data file. All files share the same `NumberOfAccountingDocuments`, forming a bundle linkage index.

`REAEvent_t.evidence_refs` remains an unordered set. The concrete N→1 bundle structure is a projection-time decision made by `COA_v` and `ProjectionBundle_v` according to business rules (e.g., "merge multiple expense items under one bank payment receipt"). Therefore, the bundle linkage index is metadata of `JournalVoucherProjection_t`, not an REA ontological fact.

Each bookkeeping information file must contain a self-contained balanced sub-entry (debit = credit) described in full within `InformationOfDebitAndCreditEntryTuple`. The consolidated journal voucher main form may merge credits of multiple sub-entries into the same account (e.g., "Bank Deposit"), provided sub-entry-level balance is preserved.

#### Acceptance Criteria

```text
GIVEN N source vouchers belong to one economic event
WHEN JournalVoucherProjection_t is created
THEN source_voucher_refs contains exactly N entries
AND each entry binds source_voucher_id, stable_identifier_kind, stable_identifier_value, and bookkeeping_information_file_ref
AND each source voucher produces one BookkeepingInformationFile_t
AND all N files share the same number_of_accounting_documents
AND each sub-entry is independently balanced (sub_entry_debit = sub_entry_credit)
AND the sum of all sub_entry_balance values equals the consolidated voucher total
AND the consolidated credit amount matches the sum of individual sub-entry credits when merged
```

#### Negative Criteria

```text
IF a source voucher lacks a BookkeepingInformationFile_t
THEN JournalVoucherProjection_t.projection_status must not be PROJECTION_TRUSTED

IF N bookkeeping information files do not share the same number_of_accounting_documents
THEN the bundle is invalid and projection_status must be projection_exception

IF a sub-entry is not independently balanced (debit ≠ credit within the source)
THEN projection_status must be projection_exception

IF archive package omits bookkeeping_information_files or bundle_linkage_index_refs
THEN the archive must not be marked complete

IF ledger materialization ignores source_voucher_refs linkage
THEN the ledger view must not be marked PROJECTION_TRUSTED
```

### Step 4 — Ledger View Materialization / 会计账簿视图生成

#### 中文
记账凭证投影通过验证后，可以生成不同账簿视图。账簿视图不是事实源，而是从已批准投影结果派生的可回放表示。

```text
CashJournalView_t
BankJournalView_t
SubsidiaryLedgerView_t
GeneralLedgerView_t
TrialBalanceView_t
```

这些视图可支持现金日记账、银行日记账、明细账、总账和试算平衡表。任何视图都必须绑定来源投影、COA 版本、投影规则版本和内容哈希。

#### English
After voucher projections are validated, the system may materialize ledger views. Ledger views are not sources of truth; they are replayable representations derived from approved projection results. They include cash journal, bank journal, subsidiary ledger, general ledger, and trial balance views.

### Step 5 — Reconciliation and Period Close / 对账与结账

#### 中文
期末前，系统运行 `TrialBalanceValidationContract_v`，至少包括：

```text
DirectionValidation_t       检查余额方向
VarianceValidation_t        检查异常波动
ReconciliationValidation_t  检查账证、账账、账实和报表勾稽
PeriodCloseValidation_t     检查损益结转、余额结转、关账条件
```

如果存在未解决的 projection exception、重大对账差异、缺失凭证、人工 override 未审批、drift signal 未处理或损益未结转，系统不得把期间标记为 closed。

```yaml
MonthlyAccountingWorkflow_t:
  period_id: "2026-05"
  close_state: open | pre_close_validation | blocked | ready_to_close | closed
  blockers:
    - unresolved_projection_exception
    - reconciliation_mismatch
    - missing_evidence
    - unresolved_override
    - unresolved_compliance_drift
    - incomplete_profit_loss_close
```

#### English
Before closing the period, the system runs `TrialBalanceValidationContract_v`, including direction, variance, reconciliation, and period close validation. If unresolved projection exceptions, material reconciliation mismatches, missing evidence, unapproved overrides, unresolved drift signals, or incomplete profit/loss closing remain, the system must not mark the period as closed.

### Step 6 — Financial Statement Package / 财务报表包

#### 中文
期间关闭后，系统从已信任账簿视图生成 `FinancialStatementPackage_t`，包括资产负债表、利润表和现金流量表。

```yaml
FinancialStatementPackage_t:
  package_id: fsp_2026_05
  period_id: "2026-05"
  basis:
    trial_balance_view_id: tb_2026_05
    period_close_validation_id: pcv_2026_05
    reconciliation_validation_id: rv_2026_05
    reporting_contract_version: RPT_cn_2026_v1
  statements:
    balance_sheet_ref: bs_2026_05
    income_statement_ref: is_2026_05
    cash_flow_statement_ref: cf_2026_05
  validation:
    assets_equal_liabilities_plus_equity: passed
    retained_earnings_ties_to_net_income: passed
    cash_flow_ties_to_cash_delta: passed
  replay_binding_ref: ReplayBinding_t
  audit_evidence_package_ref: AuditEvidencePackage_t
```

报表不是 BI 截图，而是带有版本、验证、哈希和审计证据的治理工件。

#### English
After the period is closed, the system generates `FinancialStatementPackage_t` from trusted ledger views. It includes the balance sheet, income statement, and cash flow statement. The package is not a BI screenshot; it is a governed artifact with version pins, validation results, hashes, replay binding, and audit evidence.

### Step 7 — Tax Filing Package / 纳税申报包

#### 中文
系统基于税务投影和已关闭账簿生成 `TaxFilingPackage_t`。会计报表不能直接等同于税务申报，税务口径必须通过独立的 tax projection 和 tax rule bundle 生成。

```yaml
TaxFilingPackage_t:
  filing_id: tax_2026_05_vat
  period_id: "2026-05"
  tax_type: vat | corporate_income_tax | surtax | payroll_tax | stamp_duty
  source_refs:
    - financial_statement_package_id
    - trial_balance_view_id
    - projection_result_id
    - source_document_review_id
  tax_rule_bundle_version: TaxRuleBundle_cn_2026_v1
  filing_form_ref: tax_form_ref
  validation_result_ref: tax_validation_ref
  approval_state: draft | reviewed | approved | submitted | rejected
  submission_receipt_ref: receipt_ref | null
  replay_binding_ref: ReplayBinding_t
```

#### English
The system generates `TaxFilingPackage_t` from tax projections and closed ledger views. Accounting reports are not automatically tax filings. Tax treatment must be produced through a separate tax projection and tax rule bundle.

### Step 8 — Accounting Archive Package / 会计档案归档包

#### 中文
一个会计期间完成后，系统生成 `AccountingArchivePackage_t`，把凭证、REA facts、投影结果、账簿视图、校验结果、治理审批、财务报表、纳税申报和外部审计导出统一绑定。

```yaml
AccountingArchivePackage_t:
  archive_id: archive_2026_05
  period_id: "2026-05"
  includes:
    source_document_reviews: []
    rea_events: []
    journal_voucher_projections: []
    bookkeeping_information_files: []
    bundle_linkage_index_refs: []
    ledger_views: []
    validation_results: []
    governance_decisions: []
    financial_statement_packages: []
    tax_filing_packages: []
    external_audit_exports: []
  retention_policy_ref: retention_cn_accounting_2026_v1
  archive_hash: sha256
  manifest_ref: ExternalVerificationManifest_t
  immutable_after: timestamp
```

归档包必须支持离线验证，不得依赖 live LLM、live OCR、live KGL 或当前最新规则。

#### English
After the accounting period is completed, the system generates `AccountingArchivePackage_t`, binding source document reviews, REA facts, journal voucher projections, ledger views, validation results, governance decisions, financial statement packages, tax filing packages, and external audit exports. The archive package must support offline verification and must not depend on live LLMs, live OCR, live KGL, or latest mutable rules.

### Acceptance Criteria

```text
GIVEN a monthly accounting period is open
AND source documents are submitted through Weixin, Web UI, API, or partner workspace
WHEN document review completes
THEN SourceDocumentReview_t records authenticity, legality, completeness, arithmetic checks, evidence refs, and content hash
AND passing review only makes the document eligible for REA fact formation

WHEN REA fact formation runs
THEN REAEvent_t is created with resource, event, agent, claim, transfer/settlement, evidence refs, and ontology pins
AND REAEvent_t contains no account_code
AND REAEvent_t remains append-only

WHEN projection runs under active COA_v and ProjectionBundle_v
THEN JournalVoucherProjection_t is created if deterministic projection succeeds
AND ProjectionException_t is created if deterministic projection fails
AND no LLM or user suggestion becomes authoritative without governance

WHEN ledger materialization runs
THEN cash journal, bank journal, subsidiary ledger, general ledger, and trial balance views are derived from projection results
AND every view is bound to source projection IDs, semantic versions, and content hash

WHEN pre-close validation runs
THEN DirectionValidation_t, VarianceValidation_t, ReconciliationValidation_t, and PeriodCloseValidation_t execute
AND unresolved critical failures block close
AND waivers require TrialBalanceJustification_t and governance approval

WHEN the period is closed
THEN FinancialStatementPackage_t is generated from trusted closed-period ledger views
AND balance sheet, income statement, and cash flow statement validations are recorded

WHEN tax filing preparation runs
THEN TaxFilingPackage_t is generated from tax projection and pinned tax rules
AND tax filing approval and submission receipt are append-only artifacts

WHEN archive generation runs
THEN AccountingArchivePackage_t binds documents, facts, projections, ledgers, validations, governance decisions, statements, filings, and exports
AND offline verification can validate hashes, schemas, signatures, pins, and manifests without live runtime access

WHEN bundled source vouchers are projected into one journal voucher
THEN each source voucher produces one BookkeepingInformationFile_t
AND all files share the same number_of_accounting_documents
AND source_voucher_refs binds every source voucher to its bookkeeping information file and stable identifier
AND each sub-entry is independently balanced
```

### Negative Criteria

```text
IF source evidence is incomplete
THEN the system may request more evidence or keep the event in draft; it must not fabricate missing fields.

IF REA fact is valid but projection fails
THEN the REA fact remains committed and ProjectionException_t is created.

IF ledger projection is blocked or requires governance
THEN the affected ledger view must not become PROJECTION_TRUSTED.

IF reconciliation validation has unresolved critical failures
THEN period close must be blocked.

IF period is not closed
THEN FinancialStatementPackage_t may remain draft only and must not be marked final.

IF tax filing package uses unpinned or latest mutable tax rules
THEN filing validation must fail closed.

IF archive package omits source evidence, governance decisions, replay bindings, or verification manifest
THEN it must not be marked complete.

IF a source voucher lacks a BookkeepingInformationFile_t
THEN JournalVoucherProjection_t.projection_status must not be PROJECTION_TRUSTED

IF bundled bookkeeping information files do not share the same number_of_accounting_documents
THEN projection_status must be projection_exception

IF a sub-entry is not independently balanced (debit ≠ credit within the source)
THEN projection_status must be projection_exception

IF archive package omits bookkeeping_information_files or bundle_linkage_index_refs
THEN it must not be marked complete.
```

### E2E Test Case

```text
test_full_cycle_accounting_monthly_close_workflow()
    GIVEN period 2026-05 is open for org alpha_client
    AND source documents include invoices, bank receipts, payroll sheet, and tax payment evidence
    WHEN SourceDocumentReview_t runs
    THEN each document receives authenticity, legality, completeness, and arithmetic review results
    AND evidence refs and content hashes are stored

    WHEN REA fact formation runs
    THEN REAEvent_t records the economic facts without account_code
    AND ontology pins are stored

    WHEN projection runs under active COA_v and Π_v
    THEN JournalVoucherProjection_t records debit/credit lines
    OR ProjectionException_t is created and routed to governance

    WHEN ledger materialization runs
    THEN CashJournalView_t, BankJournalView_t, SubsidiaryLedgerView_t, GeneralLedgerView_t, and TrialBalanceView_t are derived
    AND none of these views rewrite REA facts

    WHEN pre-close validation runs
    THEN DirectionValidation_t, VarianceValidation_t, ReconciliationValidation_t, and PeriodCloseValidation_t execute
    AND unresolved critical failures block close

    WHEN all blockers are resolved or governed waivers are approved
    THEN MonthlyAccountingWorkflow_t.close_state = closed

    WHEN financial statement generation runs
    THEN FinancialStatementPackage_t includes balance sheet, income statement, and cash flow statement refs
    AND reporting validations pass or require governance

    WHEN tax filing generation runs
    THEN TaxFilingPackage_t is created under pinned TaxRuleBundle_v
    AND approval and submission receipt are recorded

    WHEN archive generation runs
    THEN AccountingArchivePackage_t binds all period artifacts
    AND ExternalVerificationManifest_t enables offline verification
```

---

## 24. Policy Denial User Story (Embedded Policy Runtime — Closed-World Default-Deny)

### Background — why no explicit deny rules

The embedded policy runtime uses the **closed-world default-deny** model from
OPA/Rego semantics.  `allow` is `false` unless explicitly proven true.  The
absence of `allow == true` **is** the denial.  No `deny { ... }` rules are ever
written because there is no default-allow baseline to override.

This means every gate check has exactly two observable outcomes:

```text
allow == true   →  claim is admitted / projection is trusted / export is permitted
allow == false  →  claim is denied and the reason is recorded in the policy result
```

The denial path is not an error state — it is a first-class governance outcome with
a hash-pinned, deterministic, replayable result that can be attached to a
`ProjectionException_t` or `TrialBalanceJustification_t`.

### User story

#### 中文
作为财务负责人，我希望当业务事件无法通过政策门控时，系统能够产生明确的、可追溯的拒绝记录——包括被违反的具体规则、拒绝时的输入值、政策文本哈希——而不是静默失败或等待人工发现，从而确保每一条被拒绝的凭证都有对应的治理任务，而不会积压成隐形风险。

#### English
As a finance lead, I want the system to produce explicit, traceable denial records
when a business event fails a policy gate check — including the exact rule violated,
the input values at time of denial, and the policy text hash — rather than silently
failing or waiting for manual discovery, so that every denied claim has a
corresponding governance task and does not accumulate as invisible risk.

### The five bootstrap denial scenarios

These are exercised by `SMBSimulator.policy_denial_stories()` and the companion
regression tests.  Each scenario is drawn from the 3-year Chinese renovation SMB
simulation data.

#### D1 — Gate 1: Unbalanced REA entry (恶意增项 scope_creep, E37)

```text
Business event:  E37 钓鱼式工程恶意增项
                 PM records ¥30,000 AR for disputed extra work.
                 Customer refuses to sign; no matching credit is raised.
Policy:          rea.rego — double-entry conservation check
Denial trigger:  resources[0].delta (30000) + resources[1].delta (0) ≠ 0
Result:          allow=false, lhs_value=30000.0, rhs_value=0.0
Governance:      ProjectionException created; event remains COMMITTED; no JE materialized
```

#### D2 — Gate 2: Four-flow mismatch (S7 四流不一致虚开发票)

```text
Business event:  S7 — contract party is A建材公司, invoice issuer is B贸易公司,
                       payment beneficiary is 法人配偶个人账户, goods received by 无关第三方
Policy:          gate2_four_flow_consistency.rego
Denial trigger:  projection_checks.four_flow_consistent == 0
                 (contract ≠ invoice ≠ payment ≠ goods receipt)
Result:          allow=false
Governance:      Projection blocked at Gate 2; VAT input deduction claim rejected;
                 FraudSignal_t created referencing S7 injected facts
```

#### D3 — Gate 2: Yin-yang contract (S8 阴阳合同隐匿收入)

```text
Business event:  S8 — official contract ¥100,000 registered with tax bureau;
                       supplemental hidden agreement ¥50,000 settled in 法人个人账户
Policy:          gate2_yinyang_contract.rego
Denial trigger:  projection_checks.registered_vs_bank_consistent == 0
                 (registered amount ≠ actual bank settlement amount)
Result:          allow=false
Governance:      Projection blocked; hidden revenue not admitted to JE;
                 POLICY_CONSTRAINT_BLOCK exception opened for compliance review
```

#### D4 — Gate 2: Payroll-social mismatch (S9 两套工资 dual payroll)

```text
Business event:  S9 — book payroll base ¥5,000/person/month;
                       social insurance contribution base ¥2,500/person (50% of payroll);
                       additional ¥3,000/person paid off-books in cash, no withholding tax
Policy:          gate2_payroll_social_consistency.rego
Denial trigger:  projection_checks.payroll_social_consistent == 0
                 (social_base ÷ book_payroll = 0.50 ≪ 1.0 compliance threshold)
Result:          allow=false
Governance:      Payroll projection blocked; 工资社保不符 exception;
                 IIT under-withholding risk flagged for tax advisor escalation
```

#### D5 — Gate 3: Export blocked by outstanding Gate-2 exception

```text
Business event:  Quarter-end: finance lead attempts to export financial statements
                 to tax-filing workflow while D2 (S7 四流) exception is unresolved
Policy:          gate3_export_guard.rego
Denial trigger:  cross_domain.export_allowed == 0
                 (upstream Gate-2 sets export_allowed=0 until exception is resolved)
Result:          allow=false
Governance:      Cross-domain export blocked; FinancialStatementPackage_t remains DRAFT;
                 TaxFilingPackage_t generation deferred until export_allowed transitions to 1
```

### Denial result shape

Every denial returns a deterministic, hash-pinned result dict:

```json
{
  "allow": false,
  "policy_ref": "/…/policies/gate2_four_flow_consistency.rego",
  "policy_sha256": "<64-hex-chars>",
  "allow_expression": "input.projection_checks.four_flow_consistent == 1",
  "lhs_value": 0.0,
  "rhs_value": 1.0,
  "deterministic": true
}
```

This result is safe to store as a `ProjectionException_t.policy_denial_evidence`
field and can be independently replayed without live OPA or runtime access.

### Acceptance criteria

```text
GIVEN a semantic claim or projection check with a non-compliant input
WHEN the embedded policy evaluator runs
THEN allow == false is returned
AND policy_sha256 is present (policy text hash for audit pinning)
AND lhs_value and rhs_value record the actual values that caused the denial
AND deterministic == true (result is reproducible from stored inputs + policy text)
AND the result contains no LLM-generated content or live data

GIVEN the same input is submitted from cli, weixin, or feishu gateway
THEN all three gateways return byte-identical denial results
(same allow, policy_sha256, allow_expression, lhs_value, rhs_value)

GIVEN a denial result is attached to a ProjectionException_t
WHEN the exception is replayed offline
THEN the replayed policy evaluation produces the same allow=false result
```

Negative criteria:

```text
IF the input key expected by the policy is missing
THEN allow == false is returned with an error message identifying the missing key;
it is NOT treated as allow == true.

IF the policy file cannot be parsed
THEN a ValueError is raised; the call site must not treat parse failure as allow == true.

IF the policy file does not exist
THEN a FileNotFoundError is raised; no default-allow fallback occurs.

IF a human reviewer manually overrides a policy denial
THEN the override must be recorded as UserFeedbackSignal_t with override=true, reason, and actor_id;
the original denial result is NOT mutated.
```

### E2E test reference

```bash
pytest tests/test_3year_smb_simulator.py::TestPolicyDenialStories -v
pytest tests/test_gateway_runtime_enablement.py -v
```

The `TestPolicyDenialStories` suite verifies:
- All five denial stories produce `allow == false`
- `policy_sha256` is present and consistent across repeated calls (cache hit)
- `lhs_value != rhs_value` for every story
- `deterministic == true` for every story
- Story IDs D1–D5 are all present in the output of `policy_denial_stories()`
- The fraud scenario references (S7, S8, S9) are correctly labelled

## 25. Working Capital and Cash Cycle Projection User Story

### Background — Π_wc and Π_cash in Semantier-EOS

The Semantier-EOS v2.1 white paper explicitly defines two projection domains beyond accounting and tax:

- **Π_wc** (working capital projection): governs AR/AP cycle, DSO (Days Sales Outstanding), DPO (Days Payable Outstanding), and operating liquidity constraints
- **Π_cash** (cash cycle projection): governs cash conversion cycle timing, payment term discipline, and cash-flow statement projection

These are **not** separate ontology tiers. They are governed projections of the same REA event under different domain knowledge contexts (`K_wc,v`, `K_cash,v`) and validation contracts (`WCVC_v`, `CCVC_v`). A locally trusted accounting projection does not automatically mean the working capital projection is also trusted.

For a renovation SMB (建筑装饰 SMB), the working capital dimension is especially critical: progress-payment contracts, retention clauses, and long construction cycles routinely push DSO well above 90 days, which can trigger a `PROJECTION_WARNING` or `PROJECTION_REQUIRES_GOVERNANCE` state even when all accounting entries are correct.

### User story

**中文：**
作为财务负责人，我希望系统在完成记账凭证投影后，自动评估当期应收账款周转周期（DSO）和资金占用健康度，
给出营运资金投影信任状态（PROJECTION_TRUSTED / PROJECTION_WARNING），
以便及时发现客户逾期付款积累对现金流的影响，并在关账前获得治理预警，而非在季报出具后才发现问题。

**English:**
As a finance lead, I want the system to evaluate the working capital projection after voucher projection completes — computing DSO from AR ageing and flagging a `PROJECTION_WARNING` when DSO exceeds the policy bound — so that cash-cycle risk is surfaced before period close, not discovered in the quarterly report.

### Positive case — DSO within policy bound (Year 1)

```
Context: Year 1 renovation SMB, revenue 400万, AR balance 120万
Computed DSO: (120 / 400) × 365 = 109.5 days
Policy (WCVC_v1): DSO_warn_threshold = 110 days, DSO_block_threshold = 135 days
Gate 2 (WC projection): DSO 109.5 < 110 → WCVC_v1 passes
Result: Π_wc projection trust state = PROJECTION_TRUSTED
Period close: allowed to proceed
```

Bootstrap reference: `working_capital_projection_stories()[0]` (year=1, story_id="WC1_PASS")

### Negative case — DSO exceeds warning threshold (Year 3)

```
Context: Year 3 renovation SMB, revenue 730万, AR balance 235万
         (客户付款延迟 + 质保金留存积累)
Computed DSO: (235 / 730) × 365 = 117.5 days
Policy (WCVC_v1): DSO_warn_threshold = 110 days, DSO_block_threshold = 135 days
Gate 2 (WC projection): DSO 117.5 ≥ 110 → WCVC_v1 warning triggered
Result: Π_wc projection trust state = PROJECTION_WARNING
Period close: advisory issued; finance reviewer must acknowledge before proceeding
Governance task created: WC_REVIEW_REQUIRED
```

Bootstrap reference: `working_capital_projection_stories()[1]` (year=3, story_id="WC3_WARN")

### Acceptance criteria

```
GIVEN an AR ageing snapshot for a closed period
WHEN the system computes DSO from (ar_balance / annual_revenue × 365)
AND evaluates it against the active WCVC_v
THEN the result must carry:
  - dso_days (float)
  - wcvc_version (string, e.g. "WCVC_v1")
  - trust_state ("PROJECTION_TRUSTED" | "PROJECTION_WARNING" | "PROJECTION_REQUIRES_GOVERNANCE")
  - deterministic = true

IF dso_days < DSO_warn_threshold
THEN trust_state = PROJECTION_TRUSTED

IF dso_days ≥ DSO_warn_threshold AND dso_days < DSO_block_threshold
THEN trust_state = PROJECTION_WARNING
AND a governance advisory is created

IF dso_days ≥ DSO_block_threshold
THEN trust_state = PROJECTION_REQUIRES_GOVERNANCE
AND period close is blocked until governance sign-off

In all cases, the WC projection result must be replayable under pinned WCVC_v without live runtime calls.
```

### Negative criteria

```
IF the WC projection result is PROJECTION_WARNING
BUT the period close record claims PROJECTION_TRUSTED
THEN the audit MUST flag this as a hash-mismatch or trust-state fraud.

IF the system silently downgrades DSO_warn_threshold to pass the check
THEN this constitutes a governance violation; WCVC_v version pin would mismatch.
```

### E2E test reference

```bash
pytest tests/test_3year_smb_simulator.py::TestWorkingCapitalProjectionStories -v
```

---

## 26. Cross-Domain Resolution — ALLOW_WITH_DISCLOSURE and ALLOW_WITH_LIMITS

### Background — Gate 3 non-blocking cross-domain outcomes

The Semantier-EOS v2.1 white paper and architecture define six possible Gate 3 (cross-domain resolution) outcomes:

```text
ALLOW                    — action fully admissible
ALLOW_WITH_DISCLOSURE    — action admissible, but a disclosure record must be attached
ALLOW_WITH_LIMITS        — action admissible under a constraint (e.g. pledge cap on AR)
ESCALATE                 — action requires human governance before proceeding
BLOCK_ACTION             — action blocked; no governance bypass available
BLOCK_EXPORT             — export blocked; data may not leave the trust boundary
```

The existing user stories and PRD reference Gate 3 extensively but only demonstrate `ALLOW` and `BLOCK_*` outcomes. `ALLOW_WITH_DISCLOSURE` and `ALLOW_WITH_LIMITS` are the most important non-blocking constrained outcomes because they allow economic activity to continue while maintaining an auditable record of the constraint.

For the renovation SMB bootstrap:
- **ALLOW_WITH_DISCLOSURE** — Tax filing package where an open internal audit finding exists for one transaction. The tax package may be submitted, but the disclosure record must reference the open audit item.
- **ALLOW_WITH_LIMITS** — Lender AR-pledge package where contested retention AR is excluded from the eligible pledge pool. The lender package is issued, but only for the non-contested portion.

### User story

**中文：**
作为财务总监，在向银行申请应收账款保理融资时，我希望系统能够区分：
哪些应收账款可以无限制入池（ALLOW），
哪些因争议留存款需要限额处理后方可入池（ALLOW_WITH_LIMITS），
哪些因涉及未决内审事项需附加披露记录后方可提交税务报表（ALLOW_WITH_DISCLOSURE），
哪些因跨域政策冲突必须完全封锁（BLOCK_EXPORT）——
确保每个跨域操作结果都有可审计的依据，不因"勉强通过"导致隐性合规风险。

**English:**
As a CFO, when submitting an AR-pledge package to a lender or a tax package to the authority, I want Gate 3 to distinguish between unrestricted approval (ALLOW), approval with an attached disclosure record (ALLOW_WITH_DISCLOSURE), approval with the contested portion capped (ALLOW_WITH_LIMITS), and full block (BLOCK_EXPORT) — so that every cross-domain action carries an auditable resolution record and constrained approvals do not silently bypass compliance requirements.

### Positive case 1 — Tax package with open audit finding → ALLOW_WITH_DISCLOSURE

```
Context: Tax filing package for Q3, one transaction has an open internal audit
         review item (AuditItem #AU-2026-037, status=IN_REVIEW).
Gate 3 evaluation:
  - Locally trusted projections: PROJECTION_TRUSTED (all Q3 entries)
  - Cross-domain policy (XPolicy_v1): open internal review items require disclosure
    when submitting tax package externally
  - Resolution: ALLOW_WITH_DISCLOSURE
Result:
  - Tax package export proceeds
  - disclosure_records = [{ audit_item_ref: "AU-2026-037", status: "IN_REVIEW" }]
  - cross_domain_order_result_hash recorded (auditable)
  - Counterparty (tax authority) receives the package with the disclosure note
```

Bootstrap reference: `cross_domain_resolution_stories()[0]` (story_id="CD1_DISCLOSURE")

### Positive case 2 — AR-pledge package with contested retention → ALLOW_WITH_LIMITS

```
Context: Lender package for AR pledge.
         Total AR: 235万 (Year 3).
         Contested retention AR (质保金争议): 41.6万 (17.7% of total).
Gate 3 evaluation:
  - Cross-domain policy (XPolicy_v1): contested AR must be excluded from eligible pledge pool
  - Resolution: ALLOW_WITH_LIMITS
    eligible_ar_pledge_万 = 235 - 41.6 = 193.4万
    excluded_reason = "quality_retention_disputed"
Result:
  - Lender package issued for 193.4万
  - limits = [{ excluded_ar_万: 41.6, reason: "quality_retention_disputed" }]
  - cross_domain_order_result_hash recorded
```

Bootstrap reference: `cross_domain_resolution_stories()[1]` (story_id="CD2_LIMITS")

### Negative case — AR-pledge blocked because contested portion exceeds policy threshold

```
Context: Hypothetical Year 3 scenario with severe disputes.
         Total AR: 235万.
         Contested AR: 142.4万 (60.6% of total).
Gate 3 evaluation:
  - Cross-domain policy (XPolicy_v1): if contested_ar_pct > 50%, BLOCK_EXPORT
  - Resolution: BLOCK_EXPORT
Result:
  - Lender package blocked entirely
  - No pledge data exported
  - Governance task created: CROSS_DOMAIN_BLOCK_REVIEW
  - Counterparty not contacted
```

Bootstrap reference: `cross_domain_resolution_stories()[2]` (story_id="CD3_BLOCK")

### Acceptance criteria

```
GIVEN a cross-domain action intent (tax_package | lender_package | insurance_package)
WHEN Gate 3 evaluates the projection set against XPolicy_v
THEN the result must carry:
  - xorder_result: one of ALLOW | ALLOW_WITH_DISCLOSURE | ALLOW_WITH_LIMITS | ESCALATE | BLOCK_ACTION | BLOCK_EXPORT
  - cross_domain_order_result_hash (SHA-256 of the resolution record)
  - XPolicy_v (version pin)
  - deterministic = true

IF xorder_result = ALLOW_WITH_DISCLOSURE
THEN disclosure_records must be non-empty
AND the action proceeds only after the disclosure record is attached to the outbound package

IF xorder_result = ALLOW_WITH_LIMITS
THEN limits must specify exactly which portion is excluded and why
AND the outbound package must reflect the constraint

IF xorder_result = BLOCK_EXPORT
THEN no data leaves the trust boundary
AND a governance task is created with the blocking reason
```

### Negative criteria

```
IF xorder_result = ALLOW_WITH_DISCLOSURE
BUT the export package omits the disclosure_records field
THEN the export is invalid and must be rejected by the receiving system.

IF xorder_result = ALLOW_WITH_LIMITS
BUT the package includes the excluded portion
THEN the export violates the cross-domain policy and must be flagged as AUDIT_EXCEPTION.

IF any cross-domain resolution result is produced without cross_domain_order_result_hash
THEN it is not replayable and must be rejected.
```

### E2E test reference

```bash
pytest tests/test_3year_smb_simulator.py::TestCrossDomainResolutionStories -v
```

---

## 27. T6 to T5 Routing User Stories

### 20.1 Hermes Procedural Skill Candidate Story

#### 中文
作为一线操作员，我希望系统把重复出现的提问顺序、表单补全顺序、报告格式化方式沉淀为可复用的 Hermes 技能候选，而不是直接变成受治理的语义规则，这样代理可以更高效地工作，但不会把流程便利误当成治理权威。

#### English
As an operator, I want repeated prompting order, completion flow, and formatting behavior to become a reusable Hermes skill candidate rather than an immediately governed semantic rule, so that the agent can work more efficiently without confusing workflow convenience with semantic authority.

### Acceptance Criteria

```text
GIVEN a repeated conversational pattern improves execution behavior only
AND the pattern affects prompting order, formatting, or workflow orchestration
WHEN the system detects the reusable pattern
THEN it may create or patch a Hermes skill candidate
AND the resulting artifact remains procedural by default
AND Hermes curator may pin, unpin, package, or surface the skill candidate
AND pinning alone does NOT activate T5 semantic authority
AND any optional Semantier record created for traceability must label the route as HERMES_PROCEDURAL_SKILL

IF the skill candidate later begins to encode scoped semantic defaults or rule meaning
THEN the system must open a separate Semantier governance path instead of silently reusing the Hermes route.
```

### 20.2 Semantier Governed T6 to T5 Story

#### 中文
作为管理者，我希望当代理或用户提出可复用的分类偏好、审批偏好或局部运营规则时，系统能够把它作为 Semantier 的 `T6 -> T5` 候选进入治理，而不是仅仅更新 Hermes 技能，这样后续执行、回放、冲突检测和审计都能追溯。

#### English
As a manager, I want reusable categorization preferences, approval preferences, or local operating rules proposed by a user or agent to enter the Semantier `T6 -> T5` governance path rather than merely updating a Hermes skill, so that later execution, replay, conflict checks, and audit remain traceable.

### Acceptance Criteria

```text
GIVEN a T6 suggestion changes scoped semantic defaults, approval behavior, categorization behavior, or reusable local meaning
WHEN semantic completion resolves the proposal as a T5 candidate
THEN GovernanceStore must record a governed T5 proposal
AND the proposal must carry scoped_owner and rollback metadata
AND fast-track activation is allowed only if the artifact stays within T5 jurisdiction
AND committed execution must persist replay bindings
AND the resulting audit record must label the route as SEMANTIER_GOVERNED_T5

IF the proposed T5 artifact weakens or bypasses T4, T3, or T2 obligations
THEN the system must reject or escalate it instead of activating it.
```

### 20.3 Mixed Artifact Handling Story

#### English
If one conversational proposal contains both a procedural automation change and a governed semantic change, the system must split the result into two linked artifacts rather than choose one route and overload it.

### Acceptance Criteria

```text
GIVEN a single proposal contains both:
    1. a procedural execution improvement
    2. a semantic preference or local rule
WHEN the proposal is materialized
THEN the system must create two linked artifacts
AND the procedural artifact follows the Hermes skill path
AND the semantic artifact follows the Semantier governed T5 path
AND both artifacts reference the same originating conversation or proposal ID.
```
