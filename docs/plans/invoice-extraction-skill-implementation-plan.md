# Document Extraction and Financial Documents Implementation Plan

## 1. Architecture Decision

The final architecture is locked to **two built-in, shareable Semantier plugins** plus an existing orchestration skill:

1. `document_extraction` converts heterogeneous source files into a neutral `canonical_document.v1` artifact.
2. `financial_documents` converts `canonical_document.v1` into `invoice_contract.v1` and deterministic validation findings.
3. `expense-reimbursement` remains a skill that orchestrates the two plugin tools and the governed reimbursement workflow.

This is not a temporary one-plugin implementation. Coding must not collapse these responsibilities into an `invoice_extraction` plugin.

```text
source document
    ↓
document_extraction.extract_document_content
    ↓
canonical_document.v1
    ↓
financial_documents.extract_financial_document
    ↓
invoice_contract.v1 + validation findings
    ↓
expense-reimbursement skill / other governed workflows
```

## 2. Design Principles

Document parsing answers: **what content and structure are present in this file?**

Financial extraction answers: **which document elements represent invoice semantics?**

The document plugin must remain financially neutral. It may identify text, tables, cells, key-value candidates, QR codes, and evidence locations, but it must not decide that a value is an invoice total, taxpayer identifier, or admissible accounting fact.

The financial plugin may propose invoice fields and deterministic validation findings, but Semantier core remains authoritative for identity, governed persistence, replay, audit, admissibility state transitions, approval, and accounting execution.

## 3. Required Input Modalities

The first production release must support:

- digital PDF with embedded text;
- scanned or image-only PDF;
- standalone image, including Chinese-language invoices requiring OCR;
- DOCX;
- XLSX;
- HTML.

Structured XML and JSON invoice inputs are included through a structured-parser path. They may be delivered in the same release if existing runtime support is available; otherwise they are a named Phase 4 gate and must not be represented as completed before their contract tests pass.

Initial financial document families:

- Google Workspace subscription invoice;
- Microsoft Azure hierarchical usage invoice;
- generic subscription invoice;
- generic cloud-usage invoice;
- Chinese VAT ordinary invoice;
- Chinese VAT special invoice;
- Chinese electronic or fully digital invoice;
- generic Chinese commercial invoice.

## 4. Plugin Responsibilities

### 4.1 `document_extraction`

Owns:

- governed source artifact resolution;
- media-type detection;
- native PDF extraction with PyMuPDF;
- PDF page rendering when OCR is required;
- image preprocessing;
- Chinese-capable OCR provider integration;
- DOCX OOXML extraction;
- XLSX workbook, sheet, cell, and table extraction;
- HTML parsing;
- structured XML/JSON parsing;
- neutral layout and table reconstruction;
- evidence coordinates and source references;
- persisted `canonical_document.v1` artifacts.

Must not own:

- invoice field interpretation;
- reimbursement policy;
- tax-policy decisions;
- accounting classification;
- authoritative admissibility.

### 4.2 `financial_documents`

Owns:

- financial document classification;
- invoice field extraction;
- vendor, jurisdiction, and document-family adapters;
- line-item and section hierarchy;
- Chinese tax-field interpretation;
- arithmetic and tax reconciliation findings;
- duplicate fingerprints;
- evidence mapping from invoice fields back to canonical-document evidence;
- persisted `invoice_contract.v1` proposals.

Must not own:

- raw file parsing implementations;
- unrestricted host file access;
- reimbursement approval workflow;
- accounting posting authority;
- live dependency calls during replay.

### 4.3 `expense-reimbursement` skill

The existing `src/skills/productivity/expense-reimbursement/SKILL.md` remains an orchestration skill. It must:

- call `extract_document_content` for uploaded source documents;
- call `extract_financial_document` using the resulting canonical artifact;
- avoid asking users to re-enter fields extracted with sufficient confidence;
- ask only for unresolved, conflicting, or policy-required fields;
- generate and update reimbursement artifacts;
- route governed approval and submission actions;
- consume a versioned reimbursement policy result rather than hard-code policy authority in prompt prose.

The current contradiction between “no invoice = rejected” and “待补发票” must be removed. The policy contract must return one of:

```text
allowed
exception_review_required
rejected
```

## 5. Existing Word and Excel Refactor Boundary

Existing Office capabilities must not be merged wholesale into `document_extraction`.

### Keep in existing format-oriented plugins

- Word creation, editing, formatting, conversion, and export.
- `automate_excel` merge, filter, deduplicate, aggregate, transpose, formatting, template fill, conversion, validation, and other spreadsheet transformations.

### Refactor or delegate to `document_extraction`

- generic DOCX reading;
- generic XLSX reading;
- duplicated OOXML parsing in domain plugins;
- runtime helpers that return only flat DOCX/XLSX text when a canonical structured representation is required.

Existing public Word and Excel tool behavior must remain backward compatible during migration. Internal readers may delegate to `document_extraction`, but mutation and authoring tools remain in their current plugins.

## 6. Machine Contract: `extract_document_content`

Plugin: `document_extraction`

Toolset: `document_extraction`

Tool: `extract_document_content`

### 6.1 Authority and binding

`workspace_id` and `session_id` are untrusted request claims. The tool must not use them directly to construct paths, select storage, or authorize access. Before any artifact read or write, Semantier core identity and session services must:

- resolve the authenticated principal;
- resolve the active governed workspace and session binding;
- verify that the requested workspace and session match the authenticated binding;
- verify that every supplied artifact reference belongs to that same governed scope; and
- reject cross-workspace, cross-session, stale-session, or unbound access attempts before parser execution.

Where the runtime already injects authoritative workspace/session context, implementation should prefer that bound context and treat request identifiers only as consistency assertions. Plugins must never override authoritative context with caller-supplied identifiers.

### 6.2 Live request

```json
{
  "workspace_id": "...",
  "session_id": "...",
  "document_ref": "...",
  "media_type_hint": null,
  "language_hints": ["zh-CN", "en"],
  "features": ["text", "layout", "tables", "key_values", "qr_codes"],
  "allow_ocr": true,
  "mode": "live"
}
```

### 6.3 Replay request

```json
{
  "workspace_id": "...",
  "session_id": "...",
  "mode": "replay",
  "source_artifact_ref": "...",
  "normalized_document_artifact_ref": "...",
  "provider_artifact_refs": ["..."],
  "pins": {
    "document_schema_version": "canonical_document.v1",
    "parser_version": "...",
    "ocr_provider": "...",
    "ocr_model_version": "...",
    "prompt_version": "..."
  }
}
```

### 6.4 Response

```json
{
  "status": "completed",
  "document": {
    "schema_version": "canonical_document.v1",
    "source_media_type": "application/pdf",
    "languages": ["zh-CN", "en"],
    "pages": [],
    "blocks": [],
    "tables": [],
    "key_value_candidates": [],
    "barcodes": [],
    "qr_codes": [],
    "evidence": []
  },
  "artifacts": {
    "source_artifact_ref": "...",
    "normalized_document_artifact_ref": "...",
    "provider_artifact_refs": []
  },
  "parser": {
    "method": "native_pdf",
    "version": "..."
  },
  "completed_at": "2026-07-17T23:15:42.123Z"
}
```

## 7. `canonical_document.v1`

The canonical document representation must preserve modality-specific evidence without introducing financial semantics.

Minimum concepts:

```python
class CanonicalDocument(BaseModel):
    schema_version: Literal["canonical_document.v1"]
    source_media_type: str
    languages: list[str]
    pages: list[DocumentPage]
    blocks: list[DocumentBlock]
    tables: list[DocumentTable]
    key_value_candidates: list[KeyValueCandidate]
    barcodes: list[BarcodeEvidence]
    qr_codes: list[QrCodeEvidence]
    evidence: list[DocumentEvidence]
    parser: ParserMetadata
```

Evidence addressing must support:

- PDF or image: page and bounding box;
- DOCX: section, paragraph, table, row, and cell;
- XLSX: workbook, sheet, cell, and range;
- HTML: DOM path;
- XML/JSON: node or JSON pointer.

## 8. Machine Contract: `extract_financial_document`

Plugin: `financial_documents`

Toolset: `financial_documents`

Tool: `extract_financial_document`

### 8.1 Authority and binding

The same non-trust rule applies at the financial boundary. `workspace_id`, `session_id`, `canonical_document_artifact_ref`, `financial_extraction_artifact_ref`, and model artifact references are caller-supplied claims until Semantier core resolves them against the authenticated principal and active governed session. The plugin must reject any artifact outside the bound workspace/session before loading canonical content or financial evidence.

### 8.2 Live request

```json
{
  "workspace_id": "...",
  "session_id": "...",
  "canonical_document_artifact_ref": "...",
  "document_type_hint": "invoice",
  "jurisdiction_hint": null,
  "preferred_currency": null,
  "allow_model_fallback": true,
  "require_evidence": true,
  "mode": "live"
}
```

### 8.3 Replay request

```json
{
  "workspace_id": "...",
  "session_id": "...",
  "mode": "replay",
  "canonical_document_artifact_ref": "...",
  "financial_extraction_artifact_ref": "...",
  "model_artifact_refs": ["..."],
  "pins": {
    "invoice_schema_version": "invoice_contract.v1",
    "adapter_name": "...",
    "adapter_version": "...",
    "validation_ruleset_version": "...",
    "prompt_version": "...",
    "model_provider": "...",
    "model_version": "..."
  }
}
```

### 8.4 Response

```json
{
  "status": "admissible",
  "document": {},
  "findings": [],
  "unresolved_fields": [],
  "review_tasks": [],
  "artifacts": {
    "canonical_document_artifact_ref": "...",
    "financial_extraction_artifact_ref": "...",
    "model_artifact_refs": []
  },
  "completed_at": "2026-07-17T23:15:42.123Z"
}
```

The plugin may return a proposed status of `admissible`, `review_required`, or `rejected`, but Semantier core owns the authoritative governed transition.

## 9. `invoice_contract.v1`

Minimum fields:

```python
class InvoiceDocument(BaseModel):
    schema_version: Literal["invoice_contract.v1"]
    document_type: Literal["vendor_invoice"]
    supplier: Party
    customer: Party | None
    invoice_number: str
    invoice_date: date
    due_date: date | None
    billing_period: DateRange | None
    currency: str
    subtotal: Decimal | None
    tax: Decimal | None
    total: Decimal
    amount_due: Decimal | None
    sections: list[InvoiceSection]
    line_items: list[InvoiceLineItem]
    evidence: list[FieldEvidence]
    parser: ParserMetadata
    validation: InvoiceValidationResult
```

Line-item variants must include:

- subscription item;
- usage-category item;
- product item;
- credit item;
- tax item;
- adjustment item.

Chinese invoice adapters must support fields such as invoice code, invoice number, issue date, buyer and seller taxpayer identifiers, amount excluding tax, tax rate, tax amount, and total including tax.

## 10. OCR Requirements

Chinese OCR support is mandatory for standalone images and scanned PDFs.

The OCR provider abstraction must support:

- simplified and traditional Chinese;
- mixed Chinese, English, and numeric text;
- orientation detection;
- table and key-value reconstruction;
- token or field bounding boxes;
- confidence values;
- QR and barcode detection;
- provider and model version metadata.

Native extraction remains preferred when a reliable text layer exists. OCR is used only when required or when deterministic quality checks show native extraction is insufficient.

## 11. Replay and Audit Contract

Live mode may call OCR, document-intelligence, or model providers only when policy allows.

Replay and audit modes must never call live providers. They consume only stored, content-addressed artifacts and pinned versions.

Persist for every provider-assisted extraction:

- source artifact hash;
- preprocessing configuration;
- provider request artifact;
- provider response artifact;
- provider and model version;
- prompt version;
- parser and adapter version;
- schema version;
- validation ruleset version;
- timezone-aware UTC ISO-8601 timestamps.

Missing or hash-invalid replay artifacts cause fail-closed replay failure. Running a newer OCR or model version is a new extraction, not replay.

## 12. Governed I/O

Both plugins accept governed artifact references, not unrestricted host paths or arbitrary URLs. Request identifiers and artifact references must first pass the authority-and-binding checks defined in Sections 6.1 and 8.1.

All reads and writes resolve under the authoritative authenticated workspace/session scope:

```text
workspaces/<bound_workspace_id>/sessions/<bound_session_id>/
├── uploads/      # immutable or versioned user-provided source documents
├── runs/         # workflow-visible generated outputs and reimbursement documents
├── artifacts/    # canonical documents, OCR/provider results, financial extraction proposals, replay pins
├── logs/         # governed operational and audit logs with sensitive-value redaction
└── tmp/          # governed ephemeral files with session lifecycle cleanup
```

Required placement rules:

- source documents enter through `uploads/` or an equivalent core-managed upload artifact service;
- `canonical_document.v1`, OCR requests/responses, preprocessing manifests, and provider outputs are persisted under `artifacts/document_extraction/`;
- `invoice_contract.v1`, model-fallback artifacts, validation findings, and duplicate fingerprints are persisted under `artifacts/financial_documents/`;
- reimbursement forms and other workflow-facing generated documents are persisted under `runs/reimbursement/`;
- structured operational and audit events are written through the governed logging service corresponding to `logs/`, never arbitrary text files created by plugins;
- temporary renderings or library scratch files use only `tmp/` through the governed session temp facility and are removed according to session lifecycle policy.

Plugins must not concatenate caller-provided workspace or session identifiers into paths. Semantier core must provide resolved roots or storage handles after authorization. No plugin may use unmanaged global temporary directories, guessed home directories, or fallback storage.

## 13. Prompt Boundary

All OCR-assistance, model-fallback, and semantic-extraction prompts must live in versioned prompt assets. Material prompt prose must not be embedded inline in runtime code.

## 14. Plugin Packaging

Create two built-in plugin packages:

```text
semantier-skills/plugins/document_extraction/
├── plugin.yaml
├── __init__.py
├── tools.py
├── schemas.py
├── service.py
├── parsers/
│   ├── pdf.py
│   ├── image.py
│   ├── docx.py
│   ├── xlsx.py
│   ├── html.py
│   └── structured.py
├── providers/
│   └── ocr.py
├── prompts/
└── tests/

semantier-skills/plugins/financial_documents/
├── plugin.yaml
├── __init__.py
├── tools.py
├── schemas.py
├── service.py
├── adapters/
│   ├── base.py
│   ├── google_workspace_v1.py
│   ├── microsoft_azure_v1.py
│   ├── generic_subscription_v1.py
│   ├── generic_cloud_usage_v1.py
│   ├── china_vat_ordinary_v1.py
│   ├── china_vat_special_v1.py
│   └── china_digital_invoice_v1.py
├── validation/
├── prompts/
└── tests/
```

Both plugins must be present in `semantier-skills/marketplace/index.json` unless a newer formally superseding specification deprecates that requirement. Do not invent built-in catalog fields. Built-in startup behavior must use the repository’s actual bundling mechanism.

## 15. Registration Contract

`document_extraction.__init__.py` must register `extract_document_content`.

`financial_documents.__init__.py` must register `extract_financial_document`.

Immediately before implementation, copy the exact `register(ctx)` behavior, `ctx.register_tool(...)` argument names, schema keyword shape, handler binding, and return behavior from the current runtime guideline and a known-good built-in plugin using the same runtime version.

Conceptual snippets in this plan are not executable API definitions. Registration contract tests must fail CI when runtime API drift occurs.

## 16. Core and Plugin Boundaries

| Concern | Plugin responsibility | Semantier core responsibility |
|---|---|---|
| Registration | Manifest, `register(ctx)`, tool schemas | Discovery, enablement, runtime inventory |
| Parsing | Format adapters and neutral canonical representation | Governed file authorization |
| Financial interpretation | Invoice adapters and findings | Authoritative admissibility transition |
| Provider calls | Bounded request construction | Provider policy, credentials, telemetry, artifact persistence |
| Storage | Request governed reads/writes | Workspace/session roots, encryption, retention, tenancy |
| Replay | Pure recomputation from pinned artifacts | Artifact pinning, no-live-dependency enforcement, audit export |
| Reimbursement | Skill orchestration | Policy authority, approval, governed workflow state |
| Accounting execution | Proposal only | Approval, posting, fact persistence |

## 17. Implementation Phases

### Phase 0: Contract and packaging skeleton

Deliverables:

- both plugin directories;
- canonical `plugin.yaml` files;
- canonical `__init__.py` registration modules;
- `tools.py` and schema stubs;
- marketplace index entries;
- built-in startup discovery configuration;
- manifest, registration, inventory, and dispatch tests.

Acceptance criteria:

- both plugins load independently;
- both tools appear under their intended toolsets;
- no parser or provider side effects occur during registration.

### Phase 1: Canonical document foundation and required modalities

Deliverables:

- `canonical_document.v1`;
- governed artifact I/O;
- digital PDF parser;
- image and scanned-PDF preprocessing;
- Chinese-capable OCR provider integration;
- DOCX parser;
- XLSX parser;
- HTML parser;
- evidence model.

Acceptance criteria:

- one golden fixture for each required modality produces a valid canonical artifact;
- Chinese image invoice OCR preserves text, bounding boxes, and confidence;
- DOCX tables retain row/cell evidence;
- XLSX content retains sheet/cell/range evidence;
- authenticated context binding rejects mismatched workspace/session claims and cross-scope artifact references;
- uploads, canonical artifacts, provider artifacts, logs, and temporary files are written only to their required governed subroots;
- replay succeeds without network access from stored OCR artifacts.

### Phase 2: Financial schema and generic extraction

Deliverables:

- `invoice_contract.v1`;
- generic invoice interpreter;
- generic subscription and cloud-usage adapters;
- arithmetic reconciliation;
- duplicate fingerprinting;
- evidence mapping.

Acceptance criteria:

- financial extraction consumes only canonical-document artifacts;
- no financial adapter opens source files directly;
- unresolved fields are represented explicitly rather than guessed.

### Phase 3: Initial vendor and Chinese invoice adapters

Deliverables:

- Google Workspace adapter;
- Microsoft Azure adapter;
- Chinese VAT ordinary adapter;
- Chinese VAT special adapter;
- Chinese digital invoice adapter;
- jurisdiction-specific validation findings.

Acceptance criteria:

- Google and Microsoft sample invoices reconcile exactly;
- at least one Chinese image invoice completes OCR-to-invoice extraction;
- buyer/seller IDs, amount excluding tax, tax, and total retain evidence;
- tax arithmetic conflicts route to review or rejection.

### Phase 4: Structured inputs and Office-reader migration

Deliverables:

- XML and JSON parser path;
- compatibility adapters for existing generic DOCX/XLSX readers;
- migration of duplicated readers where safe;
- `automate_excel` delegation for read-only canonical extraction where beneficial.

Acceptance criteria:

- existing Excel mutation and transformation tools remain backward compatible;
- existing Word authoring/editing behavior remains unchanged;
- domain plugins can consume canonical documents without independent OOXML parsing.

### Phase 5: Expense reimbursement integration

Deliverables:

- refactored `expense-reimbursement` skill;
- tool-call instructions for both plugins;
- reimbursement policy contract;
- resolution of the no-invoice versus 待补发票 contradiction;
- extracted-field confirmation workflow;
- governed reimbursement artifact generation and update flow;
- integration tests for upload-to-reimbursement submission.

Acceptance criteria:

- an uploaded invoice or receipt populates reimbursement fields automatically;
- only unresolved or policy-required fields are requested from the user;
- no-invoice cases produce `allowed`, `exception_review_required`, or `rejected` from policy evaluation;
- the skill does not contain authoritative reimbursement rules that bypass the policy contract;
- reimbursement submission remains governed and auditable.

### Phase 6: Hardening and rollout

Deliverables:

- layout-drift tests;
- malformed and encrypted-document tests;
- provider outage tests;
- replay and audit-export tests;
- performance and cost telemetry;
- migration documentation.

Acceptance criteria:

- false-admissible rate is tracked as the primary safety metric;
- missing replay artifacts fail closed;
- provider outages do not silently degrade to invented values;
- all required plugin, modality, financial, and reimbursement tests pass.

## 18. Testing Matrix

Required golden fixtures:

| Modality | Minimum fixture |
|---|---|
| Digital PDF | Google Workspace invoice |
| Multi-page digital PDF | Microsoft Azure invoice |
| Standalone image | Chinese invoice image |
| Scanned PDF | Chinese or bilingual scanned invoice |
| DOCX | Invoice represented in paragraphs and a table |
| XLSX | Invoice represented in cells and line-item rows |
| HTML | Invoice page fixture |
| XML/JSON | Structured invoice fixture when Phase 4 is implemented |

Required contract tests:

- both plugin manifests;
- exact runtime registration shape;
- runtime inventory and dispatch;
- authoritative workspace/session binding and cross-scope rejection;
- governed-path enforcement for `uploads/`, `runs/`, `artifacts/`, `logs/`, and `tmp/`;
- canonical schema validation;
- artifact-only replay;
- no direct source-file access by financial adapters;
- marketplace index consistency;
- built-in startup discovery;
- backward compatibility for existing Word and Excel tools;
- expense-reimbursement orchestration and policy outcomes.

## 19. Definition of Done

The first production-ready release is complete only when:

- `document_extraction` and `financial_documents` exist as separate built-in plugins;
- `extract_document_content` and `extract_financial_document` are independently registered and dispatchable;
- digital PDF, scanned PDF, image with Chinese OCR, DOCX, XLSX, and HTML golden tests pass;
- `canonical_document.v1` preserves modality-specific evidence;
- `invoice_contract.v1` preserves financial semantics and evidence provenance;
- Google Workspace, Microsoft Azure, and Chinese invoice-family tests pass;
- replay and audit use only pinned artifacts and perform no live provider calls;
- caller-supplied workspace/session identifiers are never trusted before authoritative binding, and cross-scope artifact access is rejected;
- generated outputs are stored only under the required governed session subroots;
- existing Word and Excel mutation/authoring tools remain backward compatible;
- generic DOCX/XLSX reading is available through the canonical document layer;
- the expense-reimbursement skill calls both plugin tools;
- the reimbursement policy contradiction is resolved through a versioned policy contract;
- ambiguous or conflicting financial documents fail closed into review or rejection;
- downstream workflows receive proposals, never unreviewed accounting posting instructions.

## 20. Immediate Next Actions

1. Read the current plugin guideline and known-good built-in plugin registration examples.
2. Create both plugin skeletons and contract tests before parser implementation.
3. Define `canonical_document.v1` and both tool schemas.
4. Implement governed PDF, image/OCR, DOCX, XLSX, and HTML parsing.
5. Define `invoice_contract.v1` and financial validation findings.
6. Implement Google, Microsoft, and Chinese invoice adapters.
7. Add artifact-only replay for both plugin boundaries.
8. Refactor reusable Word/Excel read paths without changing existing mutation APIs.
9. Refactor `expense-reimbursement` to orchestrate the tools and consume a versioned policy contract.
10. Run the full modality, plugin-contract, replay, and reimbursement integration test matrix.
