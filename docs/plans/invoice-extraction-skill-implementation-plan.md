# Invoice Extraction Skill Implementation Plan

## 1. Objective

Build a production-grade AI agent skill that extracts invoice data from heterogeneous PDF invoices into a canonical, auditable financial-document contract.

The implementation must correctly handle both:

- recurring subscription invoices, such as Google Workspace invoices with one or more conventional subscription line items; and
- hierarchical cloud-usage invoices, such as Microsoft Azure invoices containing billing sections and aggregated service categories such as Networking and Storage.

The design must avoid creating a completely separate extraction tool for every vendor. Instead, it will use one shared extraction pipeline, one canonical invoice schema, and small vendor or document-family adapters only where semantic interpretation differs.

## 2. Core Design Principle

The system will separate four concerns:

1. **Document access**: recover text, coordinates, pages, blocks, and tables from the PDF.
2. **Semantic interpretation**: map labels, sections, and values into invoice concepts.
3. **Validation**: determine whether the proposed extraction is internally consistent and admissible.
4. **Accounting handoff**: expose a governed result to downstream classification, approval, and posting workflows.

The PDF parser proposes evidence and field values. It must not independently authorize accounting execution.

This capability will be delivered as a **built-in Semantier plugin with a thin registration and adapter layer**, backed by Semantier core services for governed storage, replay, persistence, identity, and admissibility enforcement. It ships with the Semantier distribution and is shareable through the same plugin package format, but it is not an after-market dependency that users must install before use. It is also not a standalone authority runtime embedded inside a plugin.

## 3. Scope

### 3.1 In scope

- Digitally generated PDFs with embedded text.
- Scanned or image-only PDFs through a fallback path.
- Invoice-header extraction.
- Supplier and customer extraction.
- Billing-period extraction.
- Totals, tax, currency, and amount-due extraction.
- Conventional line items.
- Hierarchical usage sections and category-level charges.
- Confidence and evidence provenance.
- Arithmetic, cross-page, and semantic validation.
- Vendor and document-family detection.
- Human-review routing.
- Initial adapters for Google Workspace and Microsoft Azure invoices.

### 3.2 Out of scope for the first version

- Automatic posting to the general ledger.
- Tax determination beyond extracting the tax stated on the invoice.
- Resource-level cloud cost allocation where the invoice does not provide that detail.
- Handwriting recognition beyond forwarding unresolved documents to a managed document-intelligence fallback.
- Training a custom OCR or document-understanding model.

## 4. Target Architecture

```text
Invoice PDF
    |
    v
Document Classifier
    |-- embedded text available --> PyMuPDF native extraction
    |-- image-only or degraded ----> OCR/document-intelligence fallback
    |
    v
Normalized Document Representation
    - pages
    - text blocks
    - words and bounding boxes
    - tables
    - repeated headers and footers
    |
    v
Generic Invoice Interpreter
    - common labels
    - dates
    - money values
    - parties
    - totals
    - candidate line items
    |
    v
Vendor / Document-Family Router
    |-- google_workspace_invoice_v1
    |-- microsoft_azure_invoice_v1
    |-- generic_subscription_invoice_v1
    |-- generic_cloud_usage_invoice_v1
    `-- generic_invoice_v1
    |
    v
Canonical Invoice Contract
    |
    v
Deterministic Validation
    |
    |-- admissible --> downstream accounting review
    `-- unresolved --> human review / fallback parser
```

## 5. Technology Selection

### 5.1 Primary PDF engine

Use **PyMuPDF** as the primary PDF-access layer because it can extract:

- embedded text;
- words with bounding boxes;
- text blocks and reading order;
- page dimensions and page count;
- tables where layout permits; and
- document metadata.

PyMuPDF is responsible only for recovering document evidence. It is not the invoice-semantic parser.

### 5.2 Schema and validation

Use **Pydantic** models for:

- canonical field types;
- monetary precision with `Decimal`;
- date normalization;
- required-field policies;
- discriminated line-item types;
- validation results; and
- versioned parser metadata.

### 5.3 OCR and unknown-layout fallback

Introduce a provider abstraction rather than hard-coding a managed service:

```python
class DocumentIntelligenceProvider(Protocol):
    def analyze_invoice(self, document: bytes) -> ProviderInvoiceResult: ...
```

The first implementation may use Azure AI Document Intelligence, Google Document AI, or AWS Textract depending on deployment requirements. The canonical contract must not depend on any provider-specific response schema.

### 5.4 LLM usage

An LLM or vision-language model may be used only for unresolved semantic interpretation after deterministic extraction. It must:

- receive bounded document evidence;
- emit data conforming to the canonical schema;
- identify the evidence supporting every material field;
- avoid inventing missing fields; and
- never override failed arithmetic or policy validation.

All model-facing prompt prose, extraction instructions, examples, and fallback rules must live in versioned prompt assets under the repository-approved prompt location. Runtime code may load and parameterize prompt assets, but must not embed material prompt prose inline. A plugin-local prompt directory may be used only where permitted by the marketplace plugin guideline.

### 5.5 Replay mode for managed OCR and LLM fallback

OCR and LLM providers are permitted only during a live production extraction run when explicitly allowed by policy. Every provider request and response used to derive a material field must be persisted as an immutable, content-addressed artifact with provider name, provider model or processor version, request configuration, response hash, and UTC timestamp.

Replay and audit-export modes must never call a live OCR, document-intelligence, or LLM provider. They must consume only:

- the stored source-file artifact;
- the stored normalized-document artifact;
- stored OCR or document-intelligence provider outputs;
- stored LLM fallback outputs;
- pinned parser, adapter, prompt, schema, and validation-ruleset versions; and
- the original execution configuration.

If any required replay artifact is unavailable or fails its hash check, replay must fail closed rather than silently invoke a live dependency.

## 6. Canonical Invoice Contract

Create a versioned schema, initially `invoice_contract.v1`.

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

    billing_account_id: str | None
    billing_profile: str | None
    payment_status: str | None

    sections: list[InvoiceSection]
    line_items: list[InvoiceLineItem]

    evidence: list[FieldEvidence]
    parser: ParserMetadata
    validation: InvoiceValidationResult
```

### 6.1 Line-item variants

Do not force all vendors into a traditional quantity-times-unit-price model.

Support at least:

- `subscription_item`;
- `usage_category_item`;
- `product_item`;
- `credit_item`;
- `tax_item`; and
- `adjustment_item`.

Example subscription item:

```json
{
  "type": "subscription_item",
  "description": "Google Workspace Business Starter",
  "commitment": "Commitment",
  "service_period": {
    "start": "2026-06-01",
    "end": "2026-06-30"
  },
  "quantity": "1",
  "amount": "5.60"
}
```

Example cloud-usage category item:

```json
{
  "type": "usage_category_item",
  "section": "Microsoft Azure Standard",
  "category": "Networking",
  "service_period": {
    "start": "2026-06-01",
    "end": "2026-06-30"
  },
  "amount": "3.59"
}
```

## 7. Normalized Document Representation

Define an intermediate representation independent of invoice semantics:

```python
class DocumentWord(BaseModel):
    text: str
    page: int
    bbox: BoundingBox

class DocumentBlock(BaseModel):
    text: str
    page: int
    bbox: BoundingBox
    block_type: Literal["text", "table", "header", "footer"]

class NormalizedDocument(BaseModel):
    source_hash: str
    page_count: int
    embedded_text_available: bool
    words: list[DocumentWord]
    blocks: list[DocumentBlock]
    raw_text_by_page: list[str]
```

This layer allows parsers and tests to operate without reopening the original PDF.

## 8. Generic Invoice Interpreter

Implement a generic interpreter before vendor-specific adapters.

### 8.1 Common label dictionary

Support normalized aliases including:

```text
invoice_number:
- Invoice Number
- Invoice number
- Invoice No.
- Invoice ID

invoice_date:
- Invoice Date
- Invoice Date In UTC
- Issue Date

total:
- Total
- Total Amount
- Total in USD
- Invoice Total

subtotal:
- Subtotal
- Subtotal in USD

tax:
- Tax
- Sales Tax
- VAT
- GST

billing_period:
- Billing Period
- This invoice is for the billing period
- Summary for
- Charge Start Date - Charge End Date
```

### 8.2 Anchor-based extraction

Prefer label anchors and relative geometry over absolute coordinates.

Each candidate field should record:

- normalized field name;
- extracted value;
- source label;
- page;
- bounding box;
- parser method;
- confidence; and
- competing candidates.

### 8.3 Money and date normalization

- Parse money using `Decimal`, never binary floating point.
- Preserve the original string representation in evidence.
- Normalize currencies to ISO 4217 codes.
- Support date ranges with multiple delimiters.
- Treat ambiguous dates as unresolved unless the document or locale resolves them.

## 9. Vendor and Document-Family Detection

Vendor adapters must be selected using multiple signals rather than a single vendor-name check.

Detection features should include:

- supplier legal name;
- tax identifier;
- product-family names;
- distinctive headings;
- billing-portal URLs;
- page structure;
- table headers; and
- known recurring phrases.

Return a scored decision:

```json
{
  "vendor": "microsoft",
  "document_family": "azure_invoice",
  "layout_version": "inferred_2026_v1",
  "confidence": 0.99,
  "signals": [
    "Microsoft Corporation",
    "Usage Charges - Microsoft Azure Standard",
    "aka.ms/invoice-billing"
  ]
}
```

If no adapter exceeds the routing threshold, use a generic document-family adapter rather than guessing a vendor.

## 10. Initial Adapters

### 10.1 Google Workspace adapter

Responsibilities:

- recognize Google LLC and Google Workspace billing structure;
- extract invoice number, invoice date, billing ID, domain, billing period, currency, subtotal, tax, and total;
- parse the subscription table;
- distinguish product description from commitment type;
- confirm the invoice number is consistent across pages; and
- validate line-item sum against subtotal.

Expected document family:

```text
google_workspace_invoice_v1
```

### 10.2 Microsoft Azure adapter

Responsibilities:

- recognize Microsoft Corporation and Azure invoice structure;
- extract billing profile, invoice number, invoice date, due date, billing period, currency, subtotal, tax, and total;
- parse section summaries;
- retain the hierarchy between billing section, usage-charge family, and service categories;
- convert Networking and Storage charges into `usage_category_item` records;
- avoid inventing quantity or unit-price fields where the invoice does not provide them; and
- validate section totals and category totals against the invoice total.

Expected document family:

```text
microsoft_azure_invoice_v1
```

### 10.3 Generic adapters

Implement two reusable generic families before adding more vendor-specific adapters:

1. `generic_subscription_invoice_v1`
2. `generic_cloud_usage_invoice_v1`

A new vendor-specific adapter should be added only when the generic family cannot preserve material business semantics or extraction accuracy.

## 11. Adapter Interface

```python
class InvoiceAdapter(Protocol):
    name: str
    version: str

    def detect(self, document: NormalizedDocument) -> DetectionResult: ...

    def extract(
        self,
        document: NormalizedDocument,
        generic_result: GenericInvoiceResult,
    ) -> InvoiceExtractionProposal: ...

    def validate(
        self,
        proposal: InvoiceExtractionProposal,
    ) -> list[ValidationFinding]: ...
```

Adapters should define configuration and interpretation rules, not duplicate the entire extraction pipeline.

## 12. Validation and Admissibility

The validation layer must be deterministic and independent of the LLM.

### 12.1 Required validations

- `subtotal == sum(line_items)` where document semantics support that equation.
- `total == subtotal + tax + adjustments - credits`.
- Section totals reconcile with child items.
- Currency is consistent across material monetary fields.
- Invoice number is consistent across pages.
- Billing-period dates are ordered correctly.
- Invoice date and due date are plausible.
- Supplier identity is supported by document evidence.
- Every material field has evidence provenance.
- Duplicate detection key can be constructed.

### 12.2 Duplicate-detection key

Construct a canonical fingerprint from:

```text
supplier identity
+ invoice number
+ invoice date
+ currency
+ total
```

Also store the source-file SHA-256 hash. A hash match is conclusive for an identical file, while the canonical fingerprint detects reformatted duplicates.

### 12.3 Validation outcome

```python
class InvoiceValidationResult(BaseModel):
    status: Literal["admissible", "review_required", "rejected"]
    checks: list[ValidationCheck]
    unresolved_fields: list[str]
    material_conflicts: list[str]
```

Suggested policy:

- `admissible`: all required material fields are present and all mandatory checks pass;
- `review_required`: extraction is usable but one or more material ambiguities remain;
- `rejected`: arithmetic conflict, unsupported supplier identity, corrupted document, or irreconcilable values.

## 13. Evidence and Auditability

Each material value must point back to document evidence.

```python
class FieldEvidence(BaseModel):
    field_path: str
    page: int
    bbox: BoundingBox | None
    source_text: str
    extraction_method: Literal[
        "native_text",
        "table",
        "ocr",
        "vendor_adapter",
        "llm_fallback"
    ]
    confidence: float
```

Persist:

- parser version;
- adapter version;
- canonical schema version;
- original file hash;
- normalized-document hash;
- validation ruleset version; and
- extraction timestamp in timezone-aware UTC ISO-8601 format, for example `2026-07-17T23:15:42.123Z`.

This enables deterministic replay when layouts, parsers, prompts, providers, or validation rules change. Reprocessing with newer components is a distinct, versioned re-extraction operation and must not be represented as replay of the original decision.

## 14. Semantier Tool and Skill Interface

Expose one registered plugin tool as the stable machine contract. The primary artifact is therefore a **plugin that provides tools**, not a skill. A bundled skill may optionally orchestrate user-facing behavior around that tool, but it must not duplicate extraction or governance logic.

Registered tool name:

```text
extract_financial_document
```

The plugin `register(ctx)` function must register this tool through the Semantier plugin context and include the required `toolset` argument. The exact call signature must follow the current marketplace guideline, but the registration contract is conceptually:

```python
def register(ctx):
    ctx.register_tool(
        toolset="financial_documents",
        name="extract_financial_document",
        description="Extract and validate a financial document into a governed canonical contract.",
        input_schema=EXTRACT_FINANCIAL_DOCUMENT_INPUT_SCHEMA,
        output_schema=EXTRACT_FINANCIAL_DOCUMENT_OUTPUT_SCHEMA,
        handler=extract_financial_document,
    )
```

The implementation must use the repository's actual `register_tool` keyword names and schema conventions rather than treating this illustrative snippet as an independent API definition.

**Hard implementation constraint:** immediately before coding the entry module, inspect the current `semantier-marketplace-plugin-creation-guideline.md` and at least one known-good plugin registered against the same runtime version. Copy the exact `register(ctx)` signature, `ctx.register_tool(...)` argument names, schema keyword shape, handler binding pattern, and return behavior from those current sources. Do not infer, normalize, or preserve the conceptual signature above when it differs from the runtime API. Registration tests must assert the exact current contract so any runtime API drift fails during CI rather than plugin installation.

Optional bundled skill name:

```text
invoice_extraction
```

The bundled skill may guide the agent to select a workspace/session file, call `extract_financial_document`, interpret `admissible`, `review_required`, and `rejected`, and present review findings. It must call the registered tool rather than invoking parser modules directly.

Suggested request:

```json
{
  "workspace_id": "...",
  "session_id": "...",
  "document_ref": "...",
  "document_type_hint": "invoice",
  "preferred_currency": null,
  "allow_managed_fallback": true,
  "require_evidence": true,
  "mode": "live"
}
```

Suggested response:

```json
{
  "status": "admissible",
  "document": {},
  "findings": [],
  "review_tasks": [],
  "artifacts": {
    "source_hash": "...",
    "normalized_document_ref": "..."
  }
}
```

The agent should invoke the bundled skill once or call the registered tool directly. Internal routing selects the appropriate adapter.

### 14.1 Governed file and artifact I/O

The public contract must accept a Semantier-governed `document_ref`, not an arbitrary host path or unrestricted URI. All authenticated reads and writes must resolve under:

```text
workspaces/<workspace_id>/sessions/<session_id>/
```

Source documents, normalized representations, provider outputs, parser results, and review artifacts must be created through Semantier workspace/session storage services. The plugin must not use unmanaged host-global temporary directories, direct absolute paths, or fallback storage outside the governed workspace/session root. Ephemeral files, when unavoidable for a library call, must be allocated through the governed session temp facility and removed according to its lifecycle policy.

### 14.2 Tool response semantics

The tool returns an extraction proposal plus evidence and validation findings. The plugin may report a proposed validation status, but Semantier core owns the authoritative admissibility transition and persistence of the governed decision. The tool must not post an invoice, mutate accounting facts, or bypass review policy.

## 15. Semantier Plugin Packaging and Registration

### 15.1 Plugin identity and location

Package the capability as:

```text
semantier-skills/plugins/invoice_extraction/
```

The plugin name is `invoice_extraction`. It must be included in the Semantier built-in plugin set, automatically discoverable at runtime, and shareable through the standard plugin package format. Normal product use must not depend on a separate marketplace installation step.

### 15.2 Required plugin files

```text
semantier-skills/plugins/invoice_extraction/
├── plugin.yaml
├── __init__.py
├── tools.py
├── schemas.py
├── adapters/
│   ├── base.py
│   ├── registry.py
│   ├── google_workspace_v1.py
│   ├── microsoft_azure_v1.py
│   ├── generic_subscription_v1.py
│   └── generic_cloud_usage_v1.py
├── prompts/
│   └── unresolved_invoice_fields_v1.md
├── README.md
└── tests/
    ├── fixtures/
    ├── test_manifest.py
    ├── test_registration.py
    ├── test_inventory.py
    ├── test_google_workspace.py
    ├── test_microsoft_azure.py
    └── test_replay_contract.py
```

`__init__.py` is mandatory for a loadable plugin and must expose the canonical `register(ctx)` entrypoint required by the current plugin guideline. The handler module must use the repository-standard `tools.py` filename unless a newer superseding specification explicitly changes that convention.

### 15.3 `plugin.yaml` contract

The manifest must include all fields required by the marketplace guideline, including at minimum:

- stable plugin identifier and display name;
- semantic version;
- description and category;
- entrypoint identifying the module that exposes `register(ctx)`;
- runtime and dependency declarations;
- toolset and exposed tool metadata where required;
- permissions or capabilities for governed file access and optional provider egress;
- prompt assets and bundled skill declarations where supported; and
- publisher, license, and compatibility metadata.

Do not invent manifest keys during implementation. Copy the exact field names and validation constraints from the current `semantier-marketplace-plugin-creation-guideline.md` and a known-good marketplace plugin.

### 15.4 Registration behavior

The entry module must expose `register(ctx)`. Registration must:

1. register `extract_financial_document` under the `financial_documents` toolset;
2. provide explicit input and output JSON schemas;
3. bind the handler through the plugin context rather than a global registry;
4. declare only the permissions needed for governed workspace/session file access and optional external provider calls;
5. expose the optional bundled skill only when skill registration is supported by the current plugin contract; and
6. remain side-effect free apart from registration.

### 15.5 Built-in and marketplace index registration

Add the plugin to `semantier-skills/marketplace/index.json` using the exact canonical index schema required by `semantier-marketplace-plugin-creation-guideline.md`, unless a newer formally superseding specification explicitly deprecates that contract. Before adding any built-in or bundled flag, inspect the live catalog schema and known-good entries. Use such a marker only when it is explicitly defined by the current schema; do not invent or extend catalog fields. If no built-in marker exists, preserve built-in behavior through the repository's existing bundling and startup-discovery mechanism while keeping the `index.json` entry fully canonical. The `index.json` entry, `plugin.yaml`, plugin identifier, version, entrypoint, toolset, and registered tool names must remain consistent. Runtime discovery must work from the standard Semantier distribution without a separate user installation or manual local path configuration, while the same package remains shareable through the standard plugin distribution mechanism.

## 16. Core and Plugin Package Boundaries

The following split is normative:

| Concern | Plugin responsibility | Semantier core responsibility |
|---|---|---|
| Registration | Manifest, `register(ctx)`, toolset, tool schemas | Plugin discovery, install policy, runtime inventory |
| Document interpretation | PyMuPDF invocation, generic field candidates, vendor/document-family adapters | Governed file resolution and access authorization |
| Prompt fallback | Load versioned prompt assets and construct bounded requests | Provider authorization, policy, secrets, telemetry, and replay artifact persistence |
| Storage | Request artifact writes through core APIs | Workspace/session roots, encryption, retention, tenant isolation, content addressing |
| Validation | Produce deterministic arithmetic and semantic findings | Own and enforce authoritative admissibility policy and state transition |
| Identity and authority | Pass authenticated execution context | Resolve principal, workspace, session, permissions, and authority |
| Replay and audit | Purely recompute from supplied pinned artifacts | Pin artifacts/versions, prohibit live dependencies, produce audit export |
| Accounting execution | Return extraction proposal only | Approval, posting authority, fact persistence, and downstream governed execution |

The plugin must not create a parallel persistence layer, identity model, authority engine, replay store, or accounting execution path.

## 17. Internal Plugin Module Structure

```text
semantier-skills/plugins/invoice_extraction/
├── plugin.yaml
├── __init__.py
├── tools.py
├── schemas.py
├── service.py
├── models/
│   ├── canonical.py
│   ├── document.py
│   ├── evidence.py
│   └── validation.py
├── extraction/
│   ├── pymupdf_extractor.py
│   ├── table_extractor.py
│   └── ocr_provider.py
├── interpretation/
│   ├── generic_invoice.py
│   ├── labels.py
│   ├── dates.py
│   └── money.py
├── adapters/
│   ├── base.py
│   ├── registry.py
│   ├── google_workspace_v1.py
│   ├── microsoft_azure_v1.py
│   ├── generic_subscription_v1.py
│   └── generic_cloud_usage_v1.py
├── validation/
│   ├── arithmetic.py
│   ├── identity.py
│   ├── duplicate.py
│   └── policy.py
├── providers/
│   ├── base.py
│   └── document_intelligence.py
├── prompts/
│   └── unresolved_invoice_fields_v1.md
└── tests/
    ├── fixtures/
    ├── test_google_workspace.py
    ├── test_microsoft_azure.py
    ├── test_generic_invoice.py
    ├── test_validation.py
    ├── test_duplicate_detection.py
    ├── test_manifest.py
    ├── test_registration.py
    ├── test_inventory.py
    └── test_replay_contract.py
```

Shared authority, persistence, replay, and workspace/session storage contracts belong in Semantier core and must be consumed through existing core interfaces. Only extraction-specific models that are not already canonical core contracts should remain plugin-local.

## 18. Testing Strategy

### 18.1 Golden-file tests

Use the Google Workspace and Microsoft Azure invoices as initial golden fixtures.

For each fixture, assert:

- exact supplier identity;
- exact invoice number;
- normalized invoice date;
- billing period;
- currency;
- subtotal, tax, and total;
- expected line-item types;
- expected hierarchy;
- successful arithmetic reconciliation; and
- evidence availability for all material fields.

### 18.2 Layout-resilience tests

Generate modified fixtures or normalized-document snapshots covering:

- extra whitespace;
- changed page breaks;
- repeated headers;
- reordered text blocks;
- missing optional fields;
- tax added or removed;
- credits and negative values;
- multiple subscription items;
- multiple billing sections; and
- a layout-version change with the same vendor.

### 18.3 Failure tests

Test fail-closed behavior for:

- conflicting totals;
- duplicated invoice numbers with different totals;
- missing currency;
- unreadable scanned pages;
- ambiguous date formats;
- multiple competing total candidates;
- unsupported encrypted PDFs; and
- hallucinated LLM fallback fields without evidence.

### 18.4 Accuracy metrics

Track:

- field-level exact match;
- normalized-value match;
- line-item precision and recall;
- arithmetic-validation pass rate;
- false-admissible rate;
- human-review rate;
- fallback invocation rate; and
- extraction latency and cost.

The primary safety metric should be the false-admissible rate, not only field accuracy.

### 18.5 Plugin contract and discovery tests

Add automated tests that verify:

- `plugin.yaml` passes the repository's manifest validator;
- the declared entrypoint imports successfully;
- `register(ctx)` registers exactly the intended toolset and tool without side effects;
- the registered input/output schemas are valid and match documented examples;
- plugin runtime inventory exposes `extract_financial_document` after installation;
- the marketplace index entry matches the manifest identifier and version;
- installation and uninstall behavior follow marketplace conventions;
- missing permissions fail closed;
- governed workspace/session paths are enforced; and
- replay mode rejects attempts to invoke live OCR or LLM providers.

## 19. Implementation Phases

### Phase 0: Plugin contract and boundary skeleton

Deliverables:

- plugin directory under `semantier-skills/plugins/invoice_extraction/`;
- valid `plugin.yaml`;
- entry module with `register(ctx)`;
- `financial_documents` toolset registration;
- placeholder input/output schemas with governed workspace/session references;
- marketplace index entry; and
- plugin discovery and registration tests.

Acceptance criteria:

- the plugin installs and appears in runtime inventory;
- `extract_financial_document` is discoverable under the intended toolset;
- no parser, provider, or authority side effects occur during registration.

### Phase 1: Foundation

Deliverables:

- canonical Pydantic schema;
- normalized-document representation;
- PyMuPDF extraction layer;
- money and date utilities;
- evidence model; and
- base validation framework.

Acceptance criteria:

- both sample PDFs can be converted into stable normalized-document snapshots;
- all monetary values use `Decimal`;
- every extracted candidate can retain page-level evidence.

### Phase 2: Generic Invoice Interpreter

Deliverables:

- common-label dictionary;
- anchor-based field extraction;
- party, totals, currency, and billing-period extraction;
- generic line-item candidates; and
- generic subscription and cloud-usage document families.

Acceptance criteria:

- common header fields from both sample invoices are extracted without vendor-specific code;
- unresolved or conflicting fields are explicitly represented rather than guessed.

### Phase 3: Initial Vendor Adapters

Deliverables:

- Google Workspace adapter;
- Microsoft Azure adapter;
- adapter registry and routing scores; and
- layout-version metadata.

Acceptance criteria:

- Google subscription semantics are preserved;
- Microsoft section and usage-category hierarchy is preserved;
- both invoices reconcile exactly to their stated totals.

### Phase 4: Validation and Review Routing

Deliverables:

- arithmetic validation;
- cross-page consistency checks;
- supplier-identity checks;
- duplicate fingerprinting;
- admissibility policy; and
- review-task generation.

Acceptance criteria:

- altered totals fail validation;
- materially ambiguous fields result in `review_required`;
- irreconcilable documents are never marked `admissible`.

### Phase 5: OCR and Managed Fallback

Deliverables:

- document-intelligence provider abstraction;
- first provider integration;
- bounded LLM fallback for unresolved fields; and
- provider-result mapping into the canonical schema.

Acceptance criteria:

- image-only invoices can enter the same canonical pipeline;
- fallback results remain subject to identical deterministic validation;
- provider-specific fields do not leak into the canonical contract;
- every provider request and response used by extraction is persisted as a hashed governed artifact; and
- replay and audit modes complete without network access and fail closed when pinned artifacts are missing.

### Phase 6: Tool, Skill, and Accounting Integration

Deliverables:

- registered `extract_financial_document` plugin tool;
- optional `invoice_extraction` bundled skill wrapper;
- attachment/file-reference handling;
- structured agent response;
- review workflow handoff; and
- accounting-classification integration boundary.

Acceptance criteria:

- an agent can invoke one tool or bundled skill for both sample invoices;
- the bundled skill calls the registered tool rather than parser internals;
- the tool returns evidence, parser metadata, and validation status;
- no invoice is posted automatically by the extraction capability.

## 20. Adapter Creation Policy

Do not create an adapter merely because a new vendor appears.

Create a new vendor or document-family adapter only when at least one condition is true:

1. The generic parser cannot extract material fields reliably.
2. The invoice uses a materially different hierarchy or line-item semantics.
3. Vendor-specific validation is needed.
4. The layout recurs frequently enough to justify deterministic support.
5. The managed fallback cost or review rate is materially higher than an adapter's maintenance cost.

Prefer configuration-based label and section rules before adding procedural code.

## 21. Operational Controls

- Version every adapter and validation ruleset.
- Record extraction telemetry without storing unnecessary sensitive document text.
- Encrypt original documents and extracted financial data at rest.
- Redact addresses and identifiers from application logs.
- Apply tenant isolation to source files, normalized documents, and results.
- Set retention policies independently for original files and derived extraction artifacts.
- Support replay against a newer parser without overwriting the original extraction result.
- Distinguish deterministic replay from versioned re-extraction; replay never calls live providers.
- Resolve all file and artifact access through authenticated workspace/session roots.
- Persist every cross-boundary timestamp as timezone-aware UTC ISO-8601.
- Load model instructions only from versioned prompt assets.

## 22. Risks and Mitigations

### Layout drift

**Risk:** Vendors change headings, page order, or tables.

**Mitigation:** use anchor and document-family detection, retain normalized snapshots, version adapters, and monitor review-rate changes by layout version.

### Overfitting to known samples

**Risk:** Initial adapters work only for the two supplied invoices.

**Mitigation:** keep shared extraction generic, add layout-resilience tests, and collect multiple historical invoices per family before declaring production support.

### LLM hallucination

**Risk:** A model fills in plausible but absent financial fields.

**Mitigation:** require evidence for every material field, prohibit silent inference, and apply deterministic validation after model output.

### Semantic flattening

**Risk:** Cloud usage categories are forced into traditional invoice-line fields and lose hierarchy.

**Mitigation:** use discriminated line-item types and explicit section relationships.

### False acceptance

**Risk:** A structurally valid extraction contains incorrect financial values.

**Mitigation:** optimize for low false-admissible rate, require reconciliation, and route conflicts to review.

## 23. Definition of Done

The first production-ready release is complete when:

- one registered tool or bundled skill accepts both Google Workspace and Microsoft Azure invoice PDFs;
- the marketplace plugin manifest, index entry, and `register(ctx)` contract pass automated validation;
- the registered tool is exposed through the `financial_documents` toolset and runtime inventory;
- native-text PDFs use PyMuPDF without unnecessary OCR;
- scanned PDFs use the configured fallback provider;
- both known invoice families map into `invoice_contract.v1`;
- subscription and usage-category semantics remain distinct;
- all material fields contain evidence provenance;
- totals and section amounts reconcile deterministically;
- duplicate fingerprints are produced;
- ambiguous or conflicting documents fail closed into review;
- replay and audit use only pinned stored artifacts and perform no live provider calls;
- all I/O remains inside authenticated workspace/session storage roots;
- golden, resilience, failure, plugin-contract, discovery, and replay tests pass; and
- downstream accounting workflows receive a proposal, never an unreviewed posting instruction.

## 24. Immediate Next Actions

1. Read the current marketplace plugin guideline and one known-good plugin, then create `semantier-skills/plugins/invoice_extraction/` with the exact canonical filenames.
2. Add `plugin.yaml`, `register(ctx)`, the `financial_documents` toolset declaration, explicit schemas, and the marketplace index entry.
3. Add plugin manifest, registration, inventory, install, governed-path, and replay-contract tests before parser implementation.
4. Add sanitized copies or normalized snapshots of the two invoices as test fixtures.
5. Implement `invoice_contract.v1` and the normalized-document representation against existing Semantier core contracts.
6. Implement the PyMuPDF extractor and snapshot tests.
7. Build the generic invoice interpreter and versioned prompt assets.
8. Add the Google Workspace and Microsoft Azure adapters.
9. Add deterministic validation findings while delegating authoritative admissibility enforcement to Semantier core.
10. Add managed fallback artifact persistence and artifact-only replay.
11. Expose the registered `extract_financial_document` tool and optional bundled `invoice_extraction` skill.
