# File Ingestion Toolsets Design

Related docs:

- [Runtime Architecture](../canonical/architecture.md)
- [Data Processing Pipeline Reflection](../operational/design-reflection-for-data-processing-pipeline.md)
- [Auto Resume Screening Plan](../superpowers/plans/2026-06-19-auto-resume-screening-plugin.md)

## Status

Draft for review.

This document proposes a built-in file ingestion boundary for Semantier runtime
plugins. It treats upload as a platform primitive and separates regular document
ingestion from structured data ingestion so downstream tools can consume stable
canonical artifacts without reimplementing file parsers in each workflow plugin.

## Problem

The current `auto_resume_screening` plugin contains its own resume text
extraction for `.docx`, `.pdf`, `.md`, and `.txt`. Platform upload code accepts
some document extensions, but it does not provide a generic parsing contract.

This creates three design issues:

1. Future plugins may duplicate document parsing code.
2. Resume-specific plugins must manage generic parser dependencies.
3. Data files such as `.csv` and `.xlsx` are easy to confuse with documents,
   even though their canonical processing format should be table-oriented, not
   markdown.

## Goals

- Introduce a generic built-in document ingestion toolset for text-bearing
  documents.
- Introduce a separate built-in data ingestion toolset for structured tables.
- Keep upload/storage as an internal platform service rather than a separate
  user-facing plugin.
- Keep downstream plugin contracts stable across DuckDB now and ClickHouse later.
- Preserve deterministic parsing, artifact pinning, content hashes, parser
  versions, and replay/audit compatibility.
- Keep domain interpretation in domain plugins. For example, resume candidate
  extraction and ranking remain in the resume screening plugin.

## Non-Goals

- Do not make document ingestion understand resume, accounting, legal, or HR
  semantics.
- Do not convert `.csv` or `.xlsx` into canonical markdown.
- Do not make DuckDB or ClickHouse storage the canonical ingestion artifact.
- Do not create a standalone upload plugin unless upload becomes independently
  extensible beyond the platform storage/auth boundary.
- Do not introduce live retrieval, LLM, OCR, or parser services into replay or
  audit paths.
- Do not replace governed EOS authority with uploaded files or lakehouse
  artifacts.

## Separation of Concerns

The recommended split is:

```text
Platform core service:
  workspace upload/storage

Built-in ingestion toolsets:
  document_ingestion
  data_ingestion

Domain plugins:
  auto_resume_screening
  accounting_import_review
  contract_review
  analytics_import
```

Upload should not be a separate user-facing plugin in the initial design. It is
transport and storage plumbing used by many workflows. Making it a plugin would
force downstream capabilities to reason about whether the upload plugin is
installed or enabled, even though upload is part of the base authenticated
workspace experience.

The boundary should still be explicit in code:

```text
upload service
  -> receives bytes
  -> resolves authenticated workspace/session
  -> sanitizes filename
  -> stores immutable source bytes
  -> returns file_ref

ingestion toolset
  -> receives file_ref
  -> validates supported source type
  -> parses source bytes
  -> writes canonical artifact
  -> returns artifact_ref
```

This keeps separation of concern without fragmenting the runtime/plugin surface
too finely.

## Proposed Built-In Toolsets

### 1. `document_ingestion`

Purpose: parse text-bearing documents into deterministic canonical markdown.

Supported source types:

- `.md`
- `.txt`
- `.docx`
- `.pdf`

Canonical output:

```text
document_artifact/
  manifest.json
  content.md
```

The markdown artifact is the canonical downstream document payload. It is not a
presentation document. It is a normalized, deterministic text artifact for tools
that need document content.

Expected consumers:

- Resume screening
- Contract review
- Policy/document comparison
- Meeting notes or report summarization workflows

### 2. `data_ingestion`

Purpose: parse structured data files into deterministic table artifacts.

Supported source types:

- `.csv`
- `.xlsx`

Canonical output:

```text
table_artifact/
  manifest.json
  data.parquet
  preview.csv
```

`preview.csv` is optional and exists only for UI, debugging, and export. The
canonical runtime artifact is `data.parquet` plus `manifest.json`.

For `.xlsx`, each sheet or named table should become a separate table artifact:

```text
workbook_artifact/
  workbook_manifest.json
  sheets/
    sheet_001/
      manifest.json
      data.parquet
      preview.csv
    sheet_002/
      manifest.json
      data.parquet
      preview.csv
```

Expected consumers:

- Analytics and reporting tools
- Data import validation
- Accounting source table review
- Future ClickHouse materialization jobs

## Why Two Toolsets

Documents and data files have different semantics:

| Concern | Document ingestion | Data ingestion |
|---|---|---|
| Canonical artifact | Markdown text | Parquet table |
| Primary structure | Headings, paragraphs, lists, pages | Columns, rows, sheets, typed values |
| Loss risk | Text order, page breaks, table text | Types, nulls, timestamps, formulas, encodings |
| Current engine fit | Plugin text processing | DuckDB `read_parquet` |
| Future engine fit | Text-oriented tools | ClickHouse Parquet ingest/materialization |

Keeping these separate prevents markdown from becoming a lossy table transport
format and prevents table ingestion rules from leaking into document workflows.

## Artifact Contracts

### Document Manifest

Required fields:

```json
{
  "artifact_type": "canonical_document",
  "schema_version": "1.0",
  "source_filename": "resume.docx",
  "source_extension": ".docx",
  "source_content_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "source_hash": "sha256:...",
  "canonical_format": "markdown",
  "content_path": "content.md",
  "content_hash": "sha256:...",
  "parser_name": "document_ingestion",
  "parser_version": "0.1.0",
  "created_at": "2026-06-20T00:00:00Z"
}
```

Rules:

- `created_at` must be timezone-aware UTC ISO-8601.
- Machine identifiers must be ASCII-stable.
- Parser errors must be deterministic and structured.
- The markdown payload must not depend on live LLM, OCR, retrieval, or network
  services.

### Table Manifest

Required fields:

```json
{
  "artifact_type": "canonical_table",
  "schema_version": "1.0",
  "source_filename": "candidates.xlsx",
  "source_extension": ".xlsx",
  "source_content_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "source_hash": "sha256:...",
  "canonical_format": "parquet",
  "data_path": "data.parquet",
  "data_hash": "sha256:...",
  "preview_path": "preview.csv",
  "parser_name": "data_ingestion",
  "parser_version": "0.1.0",
  "row_count": 1234,
  "columns": [
    {
      "name": "candidate_id",
      "type": "string",
      "nullable": false,
      "display_name": "Candidate ID"
    },
    {
      "name": "score",
      "type": "decimal",
      "nullable": true,
      "display_name": "Score"
    }
  ],
  "created_at": "2026-06-20T00:00:00Z"
}
```

Rules:

- Column names in canonical parquet and API contracts must be ASCII-stable.
- Localized labels belong in metadata such as `display_name` or
  `display_name_zh`, not in machine column identifiers.
- Null handling, timestamp normalization, decimal precision, and type inference
  policy must be explicit and versioned.
- `.xlsx` formulas must have a documented policy: preserve cached values only,
  reject formulas, or carry formulas as metadata. The initial implementation
  should choose one deterministic policy and expose it in the manifest.

## Engine Strategy

The canonical data artifact should remain independent from query engines:

```text
canonical table artifact
  -> DuckDB now: read_parquet(...)
  -> ClickHouse later: ingest/query Parquet, then materialize MergeTree tables
```

This avoids coupling plugin contracts to DuckDB internal storage or ClickHouse
table layouts. DuckDB and ClickHouse are serving/query engines. Parquet plus a
manifest is the portable artifact contract between ingestion and runtime
consumers.

CSV should remain an upload/source, preview, and export format. It should not be
the canonical runtime table format because it weakens type fidelity, null
semantics, timestamp handling, and large-table performance.

## Plugin Boundary

The built-in ingestion toolsets should live as platform-owned capabilities,
exposed through runtime inventory like other toolsets. Upload remains a platform
service that can be called by API routes and internal runtime code, but it does
not need to appear as an installable or domain-facing plugin.

Recommended split:

```text
Platform core:
  workspace upload service

Platform built-in toolsets:
  document_ingestion
  data_ingestion

Domain plugins:
  auto_resume_screening
  accounting_import_review
  contract_review
  analytics_import
```

Domain plugins should consume artifact references and canonical payloads rather
than directly parsing files.

For `auto_resume_screening`, the future flow should be:

```text
uploaded resume.docx
  -> workspace_upload.save(...)
  -> file_ref
  -> document_ingestion.extract_document(file_ref)
  -> document_artifact/content.md
  -> auto_resume_screening.screen_resumes(document_refs=[...])
```

Resume-specific logic stays in the plugin:

- candidate name extraction
- job profile matching
- role-term heuristics
- deterministic ranking
- screening artifact generation

Generic logic moves to document ingestion:

- extension validation for document parsing
- `.docx` text extraction
- `.pdf` text extraction
- `.md` and `.txt` normalization
- markdown canonicalization
- document artifact manifest and hashes

## Upload Boundary

Upload storage and parsing should remain separate operations.

Upload accepts bytes and stores them in workspace-scoped storage with sanitized
filenames. Ingestion then turns a stored upload into a canonical artifact.

Upload responsibilities:

- Authenticate and authorize the workspace/session.
- Enforce upload size limits, filename sanitization, path isolation, and quota
  policy.
- Store original source bytes immutably for the lifetime of the workspace
  artifact reference.
- Return a stable `file_ref`, source metadata, and source hash.
- Avoid parsing, semantic interpretation, or canonical format conversion.

Ingestion responsibilities:

- Resolve `file_ref` through the platform upload service.
- Validate the source type against the specific ingestion toolset.
- Parse bytes into canonical document or table artifacts.
- Persist artifact manifests with hashes, parser versions, and parse options.
- Return stable `artifact_ref` values to downstream plugins.

This preserves clear error surfaces:

- upload errors: invalid filename, empty file, unsupported upload extension
- ingestion errors: unsupported parser format, parser dependency missing,
  malformed source file, empty parsed content

The upload allow-list may be broader than an individual ingestion toolset, but
toolsets must reject unsupported source types deterministically.

## Determinism and Replay

Ingestion artifacts must be deterministic for the same source bytes, parser
version, and options.

Requirements:

- Hash original source bytes.
- Hash canonical output bytes.
- Record parser name and version.
- Record explicit parse options.
- Use UTC-aware timestamps for persisted manifests.
- Avoid live network calls and LLM calls in ingestion paths.
- Treat OCR as a separate optional pipeline, not part of the base deterministic
  document parser.

Replay and audit paths should consume pinned artifacts, not reparse mutable
workspace files.

## Open Decisions

1. Whether built-in ingestion toolsets are packaged under
   `semantier-skills/plugins/` or under `src/plugins/` as first-class platform
   capabilities.
2. Whether upload source records need a durable metadata table in addition to
   workspace-scoped file storage.
3. Whether parsed artifacts should be stored under workspace runs, a shared
   artifact store, or a future governed artifact table.
4. Which Parquet writer dependency to standardize on for `data_ingestion`.
5. The initial `.xlsx` formula policy.
6. Whether `document_ingestion` should preserve simple tables in markdown or
   emit a sidecar table artifact for embedded document tables.
7. Whether upload allow-lists should be unified or remain route/toolset-specific.

## Suggested Initial Milestones

1. Add `document_ingestion` with `.md`, `.txt`, `.docx`, and `.pdf` support.
2. Refactor `auto_resume_screening` to consume document artifacts instead of
   parsing files directly.
3. Add `data_ingestion` with `.csv` to Parquet plus manifest.
4. Add `.xlsx` sheet extraction to table artifacts with explicit formula policy.
5. Add DuckDB smoke tests that read generated Parquet through `read_parquet`.
6. Add migration-oriented tests proving the table artifact contract is
   independent from DuckDB-specific storage.
