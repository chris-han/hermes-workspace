# Accounting Workflow Artifacts

**Status:** Operational reference  
**Authority:** Operational/design note  
**Scope:** Illustrative sample artifacts for the seven-step accounting flow used in this repository. This document is explanatory only and is not the source of truth for runtime behavior or MOF schema requirements.  
**Upstream sources:** [accounting_workflow.md](accounting_workflow.md), [../derived/electronic_voucher_projection_design.md](../derived/electronic_voucher_projection_design.md), [../canonical/architecture.md](../canonical/architecture.md)

Sample artifacts for each step in [accounting_workflow.md](accounting_workflow.md), with the implementation surface of the MOF electronic voucher/accounting-data standard called out at a high level.

Use this document as a reader aid:

- workflow semantics come from [accounting_workflow.md](accounting_workflow.md),
- runtime and replay boundaries come from [../canonical/architecture.md](../canonical/architecture.md),
- projection/export design details come from [../derived/electronic_voucher_projection_design.md](../derived/electronic_voucher_projection_design.md).

## Legend

- `STANDARD REQUIRED`: schema, signature, or `入账信息结构化数据文件` is governed by the external MOF standard at this step.
- `DERIVED`: produced from already-governed projections; no direct standard surface.

## 1. 经济业务发生 · 原始凭证

English: `Source Voucher`  
Standard surface: `STANDARD REQUIRED`

Example artifact: inbound electronic invoice in `XML`, delivered with embedded digital signature.

Sample fields:

- 发票号码: `22442000000921300354`
- 开票日期: `2022-07-15`
- 购买方: `广州市万福布艺有限公司`
- 销售方: `广州市兆丰商贸有限公司`
- 项目名称: `办公用品 · A4 复印纸`
- 数量: `10`
- 金额: `500.00`
- 税额: `0.00`
- 价税合计: `500.00`
- 合同号: `202207159977`
- 银行电子回单号: `6FE0-4D2C-66EA`

Implementation note: the receiver verifies the signature, authenticates the artifact, and parses it according to the applicable standard/tooling.

## 2. 会计确认与编制 · 会计分录

English: `Journal Entry`  
Standard surface: `DERIVED`

Example semantic interpretation:

| Debit | Credit |
| --- | --- |
| 管理费用 — 办公费 `¥500.00` | 银行存款 — 工行 6FE0 `¥500.00` |

Implementation note: this is a semantic projection step. Account codes and classifications are Semantier/accounting-system outputs, not part of the inbound source artifact.

## 3. 凭证生成 · 记账凭证

English: `Journal Voucher`  
Standard surface: `STANDARD REQUIRED`

### A. Human-readable form

- 凭证号: `付款凭证 07654`
- 记账日期: `2022-07-16`
- 期间: `2022-07`
- 摘要: `购买办公用品`
- 借方: `管理费用 / 办公费 / 500.00`
- 贷方: `银行存款 / 工行 6FE0 / 500.00`
- 制单人: `李`
- 审核人: `王`
- 记账人: `张`
- 附原始凭证: `1 张`

### B. 入账信息结构化数据文件

Format: `XBRL`

```xml
<!-- illustrative receiver-view example -->
<xbrl xmlns:einv="…/einv">
  <einv:InvoiceNumber>22442000000921300354</einv:InvoiceNumber>
  <einv:NameOfAccountingEntity>广州市万福布艺有限公司</einv:NameOfAccountingEntity>
  <einv:InformationOfAccountingDocumentsTuple>
    <einv:NumberOfAccountingDocuments>07654</einv:NumberOfAccountingDocuments>
    <einv:PostingDate>2022-07-16</einv:PostingDate>
    <einv:AccountingPeriod>2022-07</einv:AccountingPeriod>
    <einv:InformationOfDebitAndCreditEntryTuple>
      <einv:DebitOrCredit>借方</einv:DebitOrCredit>
      <einv:NameOfGeneralLedgerSubject>管理费用</einv:NameOfGeneralLedgerSubject>
      <einv:RecordedAmount unitRef="CNY">500.00</einv:RecordedAmount>
    </einv:InformationOfDebitAndCreditEntryTuple>
    <einv:InformationOfDebitAndCreditEntryTuple>
      <einv:DebitOrCredit>贷方</einv:DebitOrCredit>
      <einv:NameOfGeneralLedgerSubject>银行存款</einv:NameOfGeneralLedgerSubject>
      <einv:RecordedAmount unitRef="CNY">500.00</einv:RecordedAmount>
    </einv:InformationOfDebitAndCreditEntryTuple>
  </einv:InformationOfAccountingDocumentsTuple>
</xbrl>
```

Implementation note: this XBRL `入账信息结构化数据文件` is the core export artifact at this step. In practice, linkage back to source evidence uses the stable identifier required by the voucher type, not only `InvoiceNumber`.

## 4. 凭证体系归类 · 会计凭证

English: `Accounting Voucher (Bundle)`  
Standard surface: `STANDARD REQUIRED`

Example bundle structure:

```text
记账凭证 #07654 (2022-07, ¥500.00)
└── 报销单 RB-2022-0716-001
    ├── A · 原始凭证 — 数电发票 #22442000000921300354 [XML]
    │   └── 入账信息结构化数据文件 (XBRL) [linked by InvoiceNumber]
    ├── B · 原始凭证 — 铁路电子客票 #25E1234567 [OFD+XBRL]
    │   └── 入账信息结构化数据文件 (XBRL) [linked by 唯一标识]
    └── C · 原始凭证 — 银行电子回单 #6FE0-4D2C-66EA [OFD+XBRL]
        └── 入账信息结构化数据文件 (XBRL) [linked by 回单号]
```

Implementation note: the bundle is the unit of `归档`. Each source voucher keeps its own structured accounting file keyed by the stable identifier defined for that source type.

## 5. 登账处理 · 凭证过账

English: `Posting`  
Standard surface: `DERIVED`

Example:

- Source voucher projection:
  - 管理费用 `+500.00` `D`
  - 银行存款 `+500.00` `C`
- Target ledger mutation:
  - 期初: `10,000.00`
  - `07-16 #07654`: `500.00` `C`
  - 期末: `9,500.00`

Implementation note: this is an internal posting mutation. In Semantier-EOS terms, this is replay of `JournalVoucherProjection_t -> LedgerView_t`.

## 6. 时序账簿记录 · 日记账

English: `Journal`  
Standard surface: `DERIVED`

Example rows produced by voucher `#07654`:

| 日期 | 凭证号 | 摘要 | 总账科目 | 明细科目 | 借方 | 贷方 |
| --- | --- | --- | --- | --- | ---: | ---: |
| 2022-07-16 | 付 07654 | 购买办公用品 | 管理费用 | 办公费 | 500.00 | — |
| 2022-07-16 | 付 07654 | 购买办公用品 | 银行存款 | 工行 6FE0 | — | 500.00 |

Implementation note: chronological tape view across accounts, derived from posted vouchers.

## 7. 分类汇总账簿 · 总账

English: `General Ledger`  
Standard surface: `DERIVED`

Example monthly summarized view:

| 科目编码 | 科目名称 | 期初余额 | 本期借方 | 本期贷方 | 期末余额 |
| --- | --- | ---: | ---: | ---: | ---: |
| 1002 | 银行存款 | 25,000.00 | 12,000.00 | 8,500.00 | 28,500.00 |
| 1122 | 应收账款 | 42,000.00 | — | 12,000.00 | 30,000.00 |
| 6602 | 管理费用 | 0.00 | 8,500.00 | — | 8,500.00 |
| 合计 |  | 67,000.00 | 20,500.00 | 20,500.00 | 67,000.00 |

Implementation note: category-summarized derived view. Trial balance check remains `借方合计 = 贷方合计`.

## Implementation Surface By Step

At a high level, the external standard governs these operations:

`接收 · 验签(验真) · 解析 · 报销 · 入账 · 归档`

These map onto the seven workflow steps as follows:

| Workflow Step | Standard Surface | What Must Conform | Implementation |
| --- | --- | --- | --- |
| 1. 原始凭证 | 接收 · 验签(验真) · 解析 | Accept supported inbound formats for the voucher family, verify embedded digital signatures where applicable, and parse with the applicable toolkit/schema. | `REQUIRED` |
| 2. 会计分录 | — | Pure semantic projection. The standard does not constrain this step directly. | `No` |
| 3. 记账凭证 | 入账 (核心) | After 入账 completes, emit the `入账信息结构化数据文件` in the required structured format for the source voucher type, including accounting-document and debit/credit entry structures. | `REQUIRED · CORE` |
| 4. 会计凭证 (bundle) | 报销 · 归档 | Preserve the linkage relationships between one journal voucher, its source vouchers, and their structured accounting files using stable source identifiers. | `REQUIRED` |
| 5. 凭证过账 | — | Internal posting operation. Not in scope of the external data standard. | `No` |
| 6. 日记账 | — | Derived view over the posted ledger. Not in scope. | `No` |
| 7. 总账 | — | Derived view over the posted ledger. Not in scope. | `No` |

## Bottom Line

As an operational summary, the main implementation pressure remains at **Steps 1, 3, and 4**:

- accept conforming inbound formats,
- emit the structured accounting file on `入账`,
- persist the cross-link index for `归档`.

The remaining workflow, `会计分录 → 过账 → 日记账 → 总账`, remains internal and is not directly constrained by the external voucher-format standard.
