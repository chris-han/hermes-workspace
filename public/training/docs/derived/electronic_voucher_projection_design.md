# Electronic Voucher (电子凭证) Projection Output Design

**Status:** Design draft — maps Semantier-EOS projected ledger to the Chinese Ministry of Finance electronic accounting data standard (电子凭证会计数据标准推广应用工具包 V1.0).

**Canonical runtime contract:** [architecture.md](../canonical/architecture.md)  
**Knowledge-tier governance:** [knowledge_tier_implementation_spec.md](knowledge_tier_implementation_spec.md)

---

## 1. Scope and Intent

This document defines how Semantier-EOS produces **electronic accounting vouchers (电子凭证)** as governed, deterministic outputs from the projected ledger, in compliance with the MOF electronic accounting data standard.

The standard toolkit (V1.0) publishes 17 config IDs. Semantier focuses on receiver-view export and also supports voucher families that are receiver-only in the toolkit.

| Source Document Type | configId | JSON Sample | XBRL Taxonomy Prefix | Standard Name |
|---|---|---|---|---|
| VAT E-Ordinary Invoice (issuer) | `inv_ord_issuer` | `inv_ord_issuer.json` | `inv` | 增值税电子普通发票 |
| VAT E-Ordinary Invoice (receiver) | `inv_ord_receiver` | `inv_ord_receiver.json` | `inv` | 增值税电子普通发票 |
| VAT E-Special Invoice (issuer) | `inv_spcl_issuer` | `inv_spcl_issuer.json` | `inv` | 增值税电子专用发票 |
| VAT E-Special Invoice (receiver) | `inv_spcl_receiver` | `inv_spcl_receiver.json` | `inv` | 增值税电子专用发票 |
| Non-Tax Revenue General Payment (issuer) | `ntrev_gpm_issuer` | `ntrev_gpm_issuer.json` | `ntrev` | 电子非税收入一般缴款书 |
| Non-Tax Revenue General Payment (receiver) | `ntrev_gpm_receiver` | `ntrev_gpm_receiver.json` | `ntrev` | 电子非税收入一般缴款书 |
| Railway E-Ticket (issuer) | `rai_issuer` | `rai_issuer.json` | `rai` | 电子发票（铁路电子客票） |
| Railway E-Ticket (receiver) | `rai_receiver` | `rai_receiver.json` | `rai` | 电子发票（铁路电子客票） |
| Air Transport E-Receipt (issuer) | `atr_issuer` | `atr_issuer.json` | `atr` | 电子发票（航空运输电子客票行程单） |
| Air Transport E-Receipt (receiver) | `atr_receiver` | `atr_receiver.json` | `atr` | 电子发票（航空运输电子客票行程单） |
| Bank Electronic Receipt (issuer) | `bker_issuer` | `bker_issuer.json` | `bker` | 银行电子回单 |
| Bank Electronic Receipt (receiver) | `bker_receiver` | `bker_receiver.json` | `bker` | 银行电子回单 |
| Bank Reconciliation Statement | `bkrs` | `bkrs.json` | `bkrs` | 银行电子对账单 |
| Fully Digital E-Invoice Ordinary (receiver) | `einv_ord_receiver` | `einv_ord_receiver.json` | `einv` | 全面数字化的电子发票-普通发票 |
| Fully Digital E-Invoice Special (receiver) | `einv_spcl_receiver` | `einv_spcl_receiver.json` | `einv` | 全面数字化的电子发票-增值税专用发票 |
| Fiscal E-Bill | `efi` | `efi.json` | `efi` | 财政电子票据 |
| Treasury Centralized Payment E-Voucher | `ctp` | `ctp.json` | `ctp` | 国库集中支付电子凭证 |

For each type, the standard defines:
1. **Issuer view** — the source document as originally issued.
2. **Receiver view** — the source document plus accounting treatment (记账凭证信息) bound to the receiving entity.

Semantier-EOS must generate the **receiver view** from projected ledger data, because the receiver view is where accounting meaning (debit/credit subjects, amounts, periods) is attached to the source evidence.

Scope boundary for this design:
1. Primary generated targets: all receiver config IDs + `efi` + `ctp`.
2. Issuer config IDs are treated as inbound evidence/parsing types, not Semantier-authored accounting outputs.

---

## 2. Architecture Alignment

### 2.1 Core Doctrine

```text
REA facts define reality.
Books are derived projections.
Account codes are projection outputs, never stored in REA facts.
Electronic vouchers are governed export artifacts, not sources of truth.
```

### 2.2 Position in the v8.1 Full-Cycle Chain

```text
SourceDocumentReview_t
  → REAEvent_t
  → JournalVoucherProjection_t
  → LedgerView_t (Cash / Bank / Subsidiary / General)
  → TrialBalanceValidation_t
  → PeriodCloseValidation_t
  → FinancialStatementPackage_t
  → TaxFilingPackage_t
  → AccountingArchivePackage_t
      → ElectronicVoucherExport_t   ← THIS DOCUMENT
```

`ElectronicVoucherExport_t` is a **deterministic serialization** of selected projected fields into the MOF standard JSON/XBRL schema. It is not a new projection; it is an **export view** over already-governed, already-replayable projections.

### 2.3 Boundary Conditions

```text
Electronic voucher output MUST NOT introduce live LLM, OCR, parser, or holographic retrieval dependencies.
Electronic voucher output MUST be reconstructible from pinned eos.db artifacts + replay bindings.
Electronic voucher output MUST validate against the MOF standard JSON schema (or XBRL taxonomy).
Electronic voucher output MUST NOT mutate REA facts or JournalVoucherProjection_t.
```

---

## 3. Data Flow: REA Claim → Projected Views → Electronic Voucher

### 3.1 Step 1 — REA Fact Formation

When a source document (e.g., a VAT special invoice) passes `SourceDocumentReview_t`, it is admitted as an `REAEvent_t`:

```yaml
rea_event:
  event_id: evt_inv_2026_0001
  event_type: purchase
  resource:
    primitive_type: goods_or_service
    amount: 97029.70
    tax_amount: 970.30
    currency: CNY
  agents:
    provider: vendor/甘肃****有限公司
    receiver: org/self
  transfer:
    from: org/self
    to: vendor/甘肃****有限公司
  evidence_refs:
    - doc_inv_spcl_2026_0001
```

No account code, no XBRL tag, no MOF schema field is written into the REA fact.

### 3.2 Step 2 — Journal Voucher Projection

Under `Π_cn_coa,v`, the event projects to `JournalVoucherProjection_t`:

```yaml
journal_voucher_projection:
  jvp_id: jvp_inv_2026_0001
  rea_event_id: evt_inv_2026_0001
  projection_bundle: Π_cn_coa_v1
  replay_binding_ref: rb_inv_2026_0001
  trust_state: PROJECTION_TRUSTED
  voucher_lines:
    - seq: 1
      side: debit
      coa_code: "5401"
      coa_name: 合同履约成本
      subsidiary_name: 分包成本
      amount: 97029.70
      currency: CNY
    - seq: 2
      side: debit
      coa_code: "2221"
      coa_name: 应交税费
      subsidiary_name: 进项税额
      amount: 970.30
      currency: CNY
    - seq: 3
      side: credit
      coa_code: "2202"
      coa_name: 应付账款
      subsidiary_name: 工程款
      amount: 98000.00
      currency: CNY
```

### 3.3 Step 3 — Tax Projection (Independent)

`TaxFilingPackage_t` runs under a pinned `TaxRuleBundle_v` and produces independent tax treatment:

```yaml
tax_projection:
  tax_rule_bundle: tax_cn_vat_v1
  input_vat_deductible: true
  tax_period_of_deduction: "2026-01"
  pre_tax_deduction_completed: true
  deduction_year_begin: "2026"
  deduction_year_end: "2026"
  expenditure_period_begin: "2026-01"
  expenditure_period_end: "2026-01"
```

Tax projection is **not** derived from the accounting JE; it is a parallel projection over the same REA fact. The electronic voucher receiver view consumes both.

### 3.4 Step 4 — Electronic Voucher Export

The export assembler pulls:
- **Issuer-side fields** from `SourceDocumentReview_t` / `REAEvent_t` evidence metadata (invoice code, number, seller name, tax ID, line items, amounts, issue date).
- **Receiver-side accounting fields** from `JournalVoucherProjection_t`.
- **Receiver-side tax status fields** from `TaxFilingPackage_t`.
- **Entity identity** from org-scoped KGL config (unified social credit code, accounting entity name).

Output: `ElectronicVoucherExport_t` serialized as JSON (interchange mode) and JSON+XBRL (archive mode).

`Whether...HasBeenChecked` fields are sourced from `SourceDocumentReview_t` verification outcomes (authenticity/legality/completeness/arithmetic + platform verification receipt), not from tax projection artifacts.

---

## 4. Canonical Mapping: Projected Ledger → MOF Receiver View

### 4.1 VAT E-Special Invoice Receiver (`inv_spcl_receiver`)

| MOF Receiver Field | Semantier Source | Table / Object |
|---|---|---|
| `UniqueCodeOfInvoice` | `REAEvent_t.evidence_refs[].unique_code` | `rea_events` |
| `NameOfSeller` | `REAEvent_t.agents.provider_name` | `rea_events` |
| `TaxpayerIdentificationNumberUnifiedSocialCreditCodeOfSeller` | `REAEvent_t.agents.provider_tax_id` | `rea_events` |
| `TotalAmountExcludingTax` | `REAEvent_t.resource.amount` | `rea_events` |
| `TotalTaxAmount` | `REAEvent_t.resource.tax_amount` | `rea_events` |
| `TaxIncludedAmountInFigures` | Computed (`amount + tax_amount`) | `rea_events` |
| `DateOfIssue` | `REAEvent_t.occurred_at` | `rea_events` |
| `WhetherInvoiceIsRedInvoice` | `REAEvent_t.tags.is_red_invoice` | `rea_events` |
| `WhetherInvoiceHasBeenChecked` | `SourceDocumentReview_t.evidence_status + verification_receipt` | `source_document_reviews` |
| `WhetherInvoiceHasBeenBooked` | `JournalVoucherProjection_t.trust_state == PROJECTION_TRUSTED` | `journal_voucher_projections` |
| `UnifiedSocialCreditCodeOfAccountingEntity` | `org_config.unified_social_credit_code` | `kgl_versions` (T4 org policy) |
| `NameOfAccountingEntity` | `org_config.entity_name` | `kgl_versions` (T4 org policy) |
| `InformationOfAccountingDocumentsTuple` | `JournalVoucherProjection_t.voucher_lines` | `journal_voucher_projections` |
| `ContractNumber` | `REAEvent_t.tags.contract_number` | `rea_events` |
| `MatchingStateBetweenBusinessDocumentsAndVatEInvoice` | `Workflow reconciliation/matching evidence derived under period workflow` | `monthly_accounting_workflows` + reconciliation artifacts |
| `WhetherInvoiceHasBeenPaid` | `REAEvent_t.settlement.settled_at IS NOT NULL` | `rea_events` / `rea_claims` |
| `NumberOfBankElectronicReceipt` | `REAEvent_t.settlement.payment_ref` | `rea_events` |
| `WhetherPreTaxDeductionOfIncomeTaxHasBeenCompleted` | `TaxFilingPackage_t.pre_tax_deduction_completed` | `tax_filing_packages` |
| `BeginningOfPreTaxDeductionYearOfIncomeTax` | `TaxFilingPackage_t.deduction_year_begin` | `tax_filing_packages` |
| `EndOfPreTaxDeductionYearOfIncomeTax` | `TaxFilingPackage_t.deduction_year_end` | `tax_filing_packages` |
| `BeginningOfExpenditurePeriodUnderAccrualBasis` | `TaxFilingPackage_t.expenditure_period_begin` | `tax_filing_packages` |
| `EndOfExpenditurePeriodUnderAccrualBasis` | `TaxFilingPackage_t.expenditure_period_end` | `tax_filing_packages` |

#### Mapping: `InformationOfAccountingDocumentsTuple`

```yaml
# Source: JournalVoucherProjection_t
InformationOfAccountingDocumentsTuple:
  NumberOfAccountingDocuments: journal_voucher_projection.voucher_number
  PostingDate: journal_voucher_projection.posting_date
  AccountingPeriod: journal_voucher_projection.accounting_period
  SummaryOfAccountingDocuments: journal_voucher_projection.summary
  InformationOfDebitAndCreditEntryTuple:
    - DebitOrCredit: >-
        map("debit" → "借方" / "借",
            "credit" → "贷方" / "贷")
      NameOfGeneralLedgerSubject: line.coa_name
      NameOfSubsidiaryLedgerSubject: line.subsidiary_name
      RecordedAmount: line.amount
```

> **Note:** The standard uses both `借方/贷方` and `借/贷`. The export assembler normalizes to the form required by the specific voucher-type JSON schema. Because this is a presentation-layer normalization, it does not affect replay.

### 4.2 VAT E-Ordinary Invoice Receiver (`inv_ord_receiver`)

Same mapping as `inv_spcl_receiver` with the following differences:
- No `WhetherInputVatHasBeenTransferredOut` (specific to special invoices).
- `SpecialInvoiceType` may be present in issuer view but is omitted in receiver view.

### 4.3 Railway E-Ticket Receiver (`rai_receiver`)

| MOF Receiver Field | Semantier Source |
|---|---|
| `ElectronicInvoiceRailwayETicketNumber` | `REAEvent_t.evidence_refs[].ticket_number` |
| `Fare` | `REAEvent_t.resource.amount` (excl. tax basis) |
| `TotalAmountExcludingTax` | `REAEvent_t.resource.amount` |
| `TaxAmount` | `REAEvent_t.resource.tax_amount` |
| `TaxRate` | `REAEvent_t.tags.tax_rate` |
| `IssueDate` | `REAEvent_t.occurred_at` |
| `IssueParty` | `REAEvent_t.agents.provider_name` |
| `WhetherInvoiceHasBeenDeducted` | `TaxFilingPackage_t.input_vat_deductible` |
| `TaxPeriodOfInvoiceDeduction` | `TaxFilingPackage_t.tax_period_of_deduction` |

The JE projection for railway tickets typically hits:
- `管理费用—差旅费` (debit)
- `应交税费—进项税额` (debit)
- `应付账款—其他` (credit)

### 4.4 Air Transport E-Receipt Receiver (`atr_receiver`)

Same pattern as railway ticket, with additional issuer fields (`Carrier`, `Flight`, `DepartureStation`, `DestinationStation`, etc.) sourced from `REAEvent_t.tags` or evidence metadata.

JE projection may hit `在建工程—差旅费` or `管理费用—差旅费` depending on `business_purpose` tag.

### 4.5 Bank Electronic Receipt Receiver (`bker_receiver`)

Bank electronic receipts represent **settlement events** (payment / receipt), not purchase events.

| MOF Receiver Field | Semantier Source |
|---|---|
| `IdentifyingCode` | `REAEvent_t.evidence_refs[].bank_receipt_id` |
| `DateOfIssue` | `REAEvent_t.occurred_at` |
| `TransactionAmountInFigures` | `REAEvent_t.resource.amount` |
| `WhetherReceiptHasBeenBooked` | `JournalVoucherProjection_t.trust_state` |
| `WhetherReceiptHasBeenReconciled` | `ReconciliationValidation_t.status` |
| `WhetherReceiptHasBeenTransferredToBank` | `REAEvent_t.tags.transferred_to_bank` |

JE projection lines depend on the matching invoice / contract:
- `应付账款—工程款` (debit)
- `银行存款` (credit)

### 4.6 Non-Tax Revenue General Payment Receiver (`ntrev_gpm_receiver`)

`ntrev_gpm_receiver` covers non-tax government payment documents. The exact JE subjects remain projection-bundle-dependent by scenario.

Toolkit sample illustrates one possible JE:
- `管理费用—差旅费` (debit)
- `应付账款—差旅报销费` (credit)

Fiscal penalty-style JE examples (`营业外支出—罚没款` / `其他应付款—赔偿罚款`) are represented by `efi` samples and should not be hard-coded as the only `ntrev_gpm_receiver` mapping.

Tax projection is typically nil (non-VAT).

### 4.7 Treasury Centralized Payment E-Voucher (`ctp`)

`ctp` is a treasury centralized payment voucher type (not a charity-donation schema). It may produce dual-booking JEs (财务会计 + 预算会计) for government / public-sector entities:
- `业务活动费用—商品和服务费用` (debit) / `财政拨款收入—一般公共预算财政拨款` (credit)
- `行政支出—日常公用经费` (debit) / `财政预算拨款收入—日常公用经费` (credit)

The MOF schema supports this via multiple `InformationOfDebitAndCreditEntryTuple` lines within a single `InformationOfAccountingDocumentsTuple`.

### 4.8 Fiscal E-Bill (`efi`)

`efi` represents fiscal electronic bills and follows the same receiver-side accounting tuple contract.

| MOF Receiver Field | Semantier Source |
|---|---|
| `EInvoiceID` | `REAEvent_t.evidence_refs[].invoice_id` |
| `InvoicingPartyName` | `REAEvent_t.agents.provider_name` |
| `InvoicingPartyCode` | `REAEvent_t.agents.provider_tax_id` |
| `IssueDate` | `REAEvent_t.occurred_at` |
| `TotalAmount` | `REAEvent_t.resource.amount` |
| `WhetherInvoiceHasBeenChecked` | `SourceDocumentReview_t.evidence_status + verification_receipt` |
| `WhetherInvoiceHasBeenBooked` | `JournalVoucherProjection_t.trust_state == PROJECTION_TRUSTED` |
| `InformationOfAccountingDocumentsTuple` | `JournalVoucherProjection_t.voucher_lines` |

In toolkit samples, `efi` includes fiscal penalty JE examples. Runtime mapping remains projection-bundle-dependent and must be replayable from pinned artifacts.

---

## 5. XBRL vs JSON Serialization

### 5.1 Primary Format: JSON

The MOF tool包 provides JSON sample files as the **canonical interchange format** for system-to-system transmission. Semantier-EOS uses JSON as the primary export format.

```json
{
  "UniqueCodeOfInvoice": "06200210011300341001",
  "NameOfSeller": "甘肃****有限公司",
  ...,
  "InformationOfAccountingDocumentsTuple": [
    {
      "NumberOfAccountingDocuments": "12345678",
      "PostingDate": "2026-01-31",
      "AccountingPeriod": "2026-01",
      "SummaryOfAccountingDocuments": "和分包商结算工程款",
      "InformationOfDebitAndCreditEntryTuple": [
        {
          "DebitOrCredit": "借方",
          "NameOfGeneralLedgerSubject": "合同履约成本",
          "NameOfSubsidiaryLedgerSubject": "分包成本",
          "RecordedAmount": "97029.70"
        },
        ...
      ]
    }
  ]
}
```

### 5.2 Archive/Compliance Format: XBRL

XBRL is required for **archive compliance** and long-term readability. The export assembler MUST produce XBRL using the MOF taxonomy for archival-grade exports:

```xml
<inv:InformationOfAccountingDocumentsTuple>
  <inv:NumberOfAccountingDocuments contextRef="c1">12345678</inv:NumberOfAccountingDocuments>
  <inv:PostingDate contextRef="c1">2026-01-31</inv:PostingDate>
  ...
</inv:InformationOfAccountingDocumentsTuple>
```

XBRL generation is a deterministic transform of the JSON export. It does not re-query projections.

Runtime modes:
1. Interchange mode: JSON only (system integration hop).
2. Archive mode: JSON + XBRL (period-close archive binding).

---

## 6. Governance and Replay Contracts

### 6.1 Export Artifact: `ElectronicVoucherExport_t`

```yaml
ElectronicVoucherExport_t:
  export_id: ev_export_2026_01_0001
  export_format: json | xbrl | both
  voucher_type: inv_spcl_receiver | inv_ord_receiver | rai_receiver | atr_receiver | bker_receiver | ntrev_gpm_receiver | einv_ord_receiver | einv_spcl_receiver | efi | ctp | bkrs
  mof_standard_version: "V1.0"
  
  # Source pointers (all pinned)
  rea_event_id: evt_inv_2026_0001
  journal_voucher_projection_id: jvp_inv_2026_0001
  tax_filing_package_id: filing_vat_2026_01_0001
  monthly_workflow_id: maw_2026_01
  
  # Replay binding
  replay_binding_ref: rb_inv_2026_0001
  
  # Validation
  schema_validation_result: PASS | FAIL
  schema_validation_errors: []
  
  # Determinism proof
  export_hash: sha256:...
  generated_at: "2026-01-31T23:59:59Z"
  generated_by: semantier_eos_v8.1
```

### 6.2 Replay Requirements

An external verifier must be able to reconstruct the exact electronic voucher without live runtime:

```text
Given:
  - replay_binding_ref (pins O_v, K_v, Π_v, ConstraintBundle_v, etc.)
  - REAEvent_t (immutable)
  - JournalVoucherProjection_t (immutable)
  - TaxFilingPackage_t (immutable)
  - org_config (version-pinned)
Then:
  - ElectronicVoucherExport_t must be bit-for-bit reproducible.
```

### 6.3 Trust-State Gating

Electronic vouchers are exported only when:

```text
JournalVoucherProjection_t.trust_state == PROJECTION_TRUSTED
AND TrialBalanceValidationResult_t.status == VALIDATED | GOVERNED_WAIVED
AND MonthlyAccountingWorkflow_t.close_state IN (closed, reported, filed, archived)
```

If `trust_state == PROJECTION_EXCEPTION`, the voucher is **not exported**; instead, a `ProjectionException_t` record is included in the `AccountingArchivePackage_t` for audit.

---

## 7. Integration with Accounting Archive Package

`AccountingArchivePackage_t` (v8.1) binds all period artifacts. The electronic voucher export is one bound artifact:

```yaml
AccountingArchivePackage_t:
  archive_id: archive_2026_01
  period: "2026-01"
  artifacts:
    - type: rea_events
      ref: evt_inv_2026_0001
    - type: journal_voucher_projection
      ref: jvp_inv_2026_0001
    - type: tax_filing_package
      ref: filing_vat_2026_01_0001
    - type: electronic_voucher_export
      ref: ev_export_2026_01_0001
      format: json
      hash: sha256:...
    - type: electronic_voucher_export
      ref: ev_export_2026_01_0001_xbrl
      format: xbrl
      hash: sha256:...
    - type: replay_binding
      ref: rb_inv_2026_0001
    - type: trial_balance_validation
      ref: tbv_2026_01
```

Archive packages must support **offline verification** without live LLM, OCR, KGL, or mutable rules.

---

## 8. SQLite Schema Additions (Proposed)

Two new tables in `eos.db`:

```sql
-- Electronic voucher exports (append-only)
CREATE TABLE electronic_voucher_exports (
    export_id TEXT PRIMARY KEY,
    export_format TEXT NOT NULL CHECK (export_format IN ('json','xbrl','both')),
    voucher_type TEXT NOT NULL,
    mof_standard_version TEXT NOT NULL DEFAULT 'V1.0',
  rea_event_id TEXT NOT NULL REFERENCES rea_claims(rea_id),
  journal_voucher_projection_id TEXT NOT NULL REFERENCES journal_voucher_projections(jvp_id),
  tax_filing_package_id TEXT REFERENCES tax_filing_packages(filing_id),
    monthly_workflow_id TEXT REFERENCES monthly_accounting_workflows(workflow_id),
  replay_binding_ref TEXT NOT NULL REFERENCES replay_bindings(event_id),
    schema_validation_result TEXT NOT NULL CHECK (schema_validation_result IN ('PASS','FAIL')),
    schema_validation_errors TEXT, -- JSON array
    export_hash TEXT NOT NULL,
    export_payload_json TEXT,      -- inline JSON for small exports
    export_payload_xbrl TEXT,      -- inline XBRL for small exports
    generated_at TEXT NOT NULL,
    generated_by TEXT NOT NULL
);

-- Index for archive package assembly
CREATE INDEX idx_eve_workflow ON electronic_voucher_exports(monthly_workflow_id);
CREATE INDEX idx_eve_rea ON electronic_voucher_exports(rea_event_id);
CREATE UNIQUE INDEX idx_eve_dedupe ON electronic_voucher_exports(
  voucher_type,
  rea_event_id,
  monthly_workflow_id,
  export_format
);
```

---

## 9. Deterministic Export Assembler (Pseudo-Algorithm)

```python
def assemble_electronic_voucher(
    rea_event: REAEvent_t,
    jvp: JournalVoucherProjection_t,
    tax_fp: TaxFilingPackage_t | None,
    org_config: OrgConfig,
    voucher_type: str,  # e.g., "inv_spcl_receiver"
) -> ElectronicVoucherExport_t:
    # 1. Validate lineage
    assert jvp.rea_event_id == rea_event.event_id
    assert jvp.trust_state == ProjectionTrustState.PROJECTION_TRUSTED

    # 2. Build issuer-side fields from REA event evidence metadata
    issuer_fields = map_issuer_fields(rea_event, voucher_type)

    # 3. Build receiver-side accounting fields from JVP
    accounting_docs = map_accounting_documents(jvp)

    # 4. Build receiver-side tax fields from tax filing package
    tax_fields = map_tax_fields(tax_fp, voucher_type)

    # 5. Build entity identity from org config
    entity_fields = {
        "UnifiedSocialCreditCodeOfAccountingEntity": org_config.uscc,
        "NameOfAccountingEntity": org_config.entity_name,
    }

    # 6. Merge
    payload = {**issuer_fields, **entity_fields, **tax_fields, **accounting_docs}

    # 7. Schema validate
    schema = load_mof_schema(voucher_type)
    validation = schema.validate(payload)

    # 8. Hash and persist
    export_hash = sha256(json.dumps(payload, sort_keys=True, ensure_ascii=False))
    export = ElectronicVoucherExport_t(
        ...,
        export_hash=export_hash,
        schema_validation_result="PASS" if validation.ok else "FAIL",
    )
    store.append(export)
    return export
```

---

## 10. Open Questions and Decisions

| # | Question | Proposed Decision | Governance Tier |
|---|---|---|---|
| 1 | Should red-invoice (红字发票) export reuse the same assembler or a separate one? | Same assembler with `is_red_invoice` flag; negates amounts. | T4 (org policy) |
| 2 | How to handle `InformationOfAccountingDocumentsTuple` when one REA event splits across multiple vouchers? | Emit one `ElectronicVoucherExport_t` per JVP; split events create multiple JVPs. | T3 (accounting standard) |
| 3 | Should XBRL generation be inline or delegated to the MOF Java tool包? | Inline deterministic transform for replay; optional post-export validation via MOF tool. | T4 |
| 4 | How to version the MOF standard schema binding? | Pin `mof_standard_version` in export; schema files stored under `policies/mof_schemas/`. | T4 |
| 5 | Do bank reconciliation statements (`bkrs`) produce JVP? | Default no. `bkrs` is primarily reconciliation evidence; if an org policy defines booking entries, those are explicit projection rules, not implicit defaults. | T3 |

---

## 11. Acceptance Criteria

```text
GIVEN a VAT special invoice REA event with trusted JVP and validated tax projection
WHEN the period closes
THEN an ElectronicVoucherExport_t is generated in JSON + XBRL for archive mode
AND JSON validates against the MOF V1.0 schema for inv_spcl_receiver
AND XBRL validates against the matching MOF taxonomy/configId binding
AND it contains the correct debit/credit lines from JVP
AND `WhetherInvoiceHasBeenChecked` is derived from SourceDocumentReview verification outcomes
AND it contains the correct tax status from TaxFilingPackage_t
AND its export_hash is reproducible from pinned artifacts
AND repeated export requests with identical tuple `(voucher_type, rea_event_id, monthly_workflow_id, export_format)` are idempotent (no duplicate booking artifact)
AND it is bound into the AccountingArchivePackage_t for the period
AND no live LLM, OCR, parser, or holographic retrieval is used during export.
```

---

## Appendix A: MOF Standard JSON Schema Surface (Summary)

The following field groups appear across receiver views:

- **Invoice / Document Identity**: `UniqueCodeOfInvoice`, `InvoiceNumber`, `EINVOICE_ID`, etc.
- **Seller / Issuer**: `NameOfSeller`, `TaxpayerIdentificationNumber...OfSeller`, `IssueParty`
- **Amounts**: `TotalAmountExcludingTax`, `TotalTaxAmount`, `TaxIncludedAmountInFigures`, `PaidAmt`
- **Dates**: `DateOfIssue`, `BillDate`, `PostingDate`, `AccountingPeriod`
- **Flags**: `WhetherInvoiceIsRedInvoice`, `WhetherInvoiceHasBeenChecked`, `WhetherInvoiceHasBeenBooked`, `WhetherInvoiceHasBeenPaid`, `WhetherPreTaxDeduction...`
- **Accounting Documents Tuple**: nested structure with `NumberOfAccountingDocuments`, `PostingDate`, `AccountingPeriod`, `SummaryOfAccountingDocuments`, and `InformationOfDebitAndCreditEntryTuple` (repeating: `DebitOrCredit`, `NameOfGeneralLedgerSubject`, `NameOfSubsidiaryLedgerSubject`, `RecordedAmount`).

All fields map to either:
- `REAEvent_t` (issuer/source evidence)
- `JournalVoucherProjection_t` (accounting treatment)
- `TaxFilingPackage_t` (tax status)
- `org_config` / `MonthlyAccountingWorkflow_t` (entity and workflow state)

---

*End of design document.*
