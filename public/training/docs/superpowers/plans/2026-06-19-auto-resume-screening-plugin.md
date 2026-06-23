# Auto Resume Screening Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the resume-document workflow from `chris-han/Vibe-Trading.git` and implement a Semantier-owned Hermes plugin for 自动简历筛选 with deterministic parsing, scoring, artifact output, and workspace-scoped execution.

**Architecture:** The plugin source of truth lives in `src/plugins/auto_resume_screening/` and is installed into `.semantier-home/plugins/auto_resume_screening/` only through `src/agents/launcher.py`. The plugin exposes ASCII-stable tool names and JSON schema fields while using Chinese display labels only in output metadata. Resume screening results are deterministic artifacts under the active workspace runs directory; LLM-assisted interpretation may be a future candidate input, but the first implementation must not depend on live LLM, live retrieval, or unmanaged prompt memory for scoring.

**Tech Stack:** Python 3.12, Hermes plugin `ctx.register_tool`, stdlib `zipfile`/`xml.etree.ElementTree` for `.docx`, existing Semantier workspace/auth helpers, pytest.

---

## Source Context

The source repository was inspected at:

- Repository: `https://github.com/chris-han/Vibe-Trading.git`
- Commit: `69f1d48e301d1cc858b513dba62f43c935ab81a5`
- Relevant source files:
  - `agent/src/tools/doc_reader_tool.py`: PDF document extraction, OCR fallback, upload-path resolution, structured JSON return shape.
  - `agent/src/upload_capabilities.py`: upload extension policy, including `.docx`.
  - `agent/src/plugins/vibe_trading/__init__.py`: Hermes plugin registration pattern.
  - `agent/src/plugins/vibe_trading/schemas.py` and `agent/src/plugins/vibe_trading/tools.py`: schema/handler separation pattern.
  - `agent/tests/regression/test_hermes_sse_regression.py`: resume-wiki workflow regression using uploaded resume documents.
  - `prompt.txt`: example uploaded resumes and the instruction to create a resume KB.

There is no single `自动简历筛选` function to copy. The extraction should convert Vibe-Trading's document-reading plus resume-wiki workflow into an explicit Semantier plugin API:

- `screen_resumes`: batch parse and score uploaded resumes against a job profile.
- `extract_resume_text`: deterministic text extraction from `.docx`, `.txt`, `.md`, and optionally `.pdf`.
- `rank_resume_candidates`: pure scoring over already-extracted text and structured criteria.

## File Structure

- Create `src/plugins/auto_resume_screening/plugin.yaml`
  - Plugin metadata only.
- Create `src/plugins/auto_resume_screening/__init__.py`
  - Hermes `register(ctx)` entry point.
- Create `src/plugins/auto_resume_screening/schemas.py`
  - ASCII JSON schemas for tool calls.
- Create `src/plugins/auto_resume_screening/tools.py`
  - Tool handlers that validate auth/workspace context and return JSON strings.
- Create `src/plugins/auto_resume_screening/extraction.py`
  - Deterministic resume text extraction helpers.
- Create `src/plugins/auto_resume_screening/scoring.py`
  - Deterministic keyword/evidence scoring.
- Create `src/plugins/auto_resume_screening/artifacts.py`
  - Workspace-scoped artifact writing with UTC timestamps and content hashes.
- Create `src/plugins/auto_resume_screening/SKILL.md`
  - User-facing procedural instructions for 自动简历筛选; no authority claims.
- Modify `src/agents/launcher.py`
  - Add `auto_resume_screening` as an optional runtime plugin and include its plugin skill directory when installed.
- Create `tests/test_auto_resume_screening_plugin.py`
  - Unit tests for registration, extraction, scoring, artifact output, and auth/workspace guards.
- Modify `tests/test_agents_launcher.py`
  - Bootstrap/config tests for optional plugin installation and `skills.external_dirs`.
- Modify `tests/test_plugin_import_resolution.py`
  - Import-resolution regression for the new plugin package.
- Optional documentation update: add a short note to `README.md` only if product documentation needs to mention the plugin; do not duplicate architecture content.

## Architecture Constraints To Preserve

- Use ASCII tool names and schema keys: `screen_resumes`, `job_profile`, `resume_paths`, `candidate_id`, `score`, `evidence`, `display_name_zh`.
- Do not create machine identifiers such as `简历路径`, `候选人`, or `评分` in schemas, files, tables, or JSON keys.
- Do not resolve user identity or organization from user text. Use governed workspace/auth context when a workspace is active.
- Do not write artifacts into `.semantier-home` directly. Use `$SEMANTIER_WORKSPACE_RUNS_DIR` or fail clearly when it is required and missing.
- Use timezone-aware UTC ISO-8601 timestamps ending in `Z`.
- Do not introduce live retrieval/LLM/OCR into replay or audit paths. PDF OCR can be a best-effort extraction input for the online tool, but persisted screening artifacts must contain extracted text hashes and scoring inputs so results can be replayed without OCR.

### Task 1: Plugin Skeleton And Registration

**Files:**
- Create: `src/plugins/auto_resume_screening/plugin.yaml`
- Create: `src/plugins/auto_resume_screening/__init__.py`
- Create: `src/plugins/auto_resume_screening/schemas.py`
- Create: `src/plugins/auto_resume_screening/tools.py`
- Test: `tests/test_auto_resume_screening_plugin.py`

- [ ] **Step 1: Write failing registration tests**

```python
# tests/test_auto_resume_screening_plugin.py
from __future__ import annotations

import json

from plugins.auto_resume_screening import register


class DummyContext:
    def __init__(self) -> None:
        self.calls: list[dict] = []

    def register_tool(self, **kwargs):
        self.calls.append(kwargs)


def test_auto_resume_screening_registers_tools():
    ctx = DummyContext()

    register(ctx)

    names = {call["name"] for call in ctx.calls}
    assert names == {"extract_resume_text", "rank_resume_candidates", "screen_resumes"}
    for call in ctx.calls:
        assert call["toolset"] == "auto_resume_screening"
        assert call["schema"]["parameters"]["type"] == "object"
        assert callable(call["handler"])


def test_screen_resumes_schema_uses_ascii_machine_keys():
    ctx = DummyContext()
    register(ctx)

    call = next(item for item in ctx.calls if item["name"] == "screen_resumes")
    props = call["schema"]["parameters"]["properties"]

    assert set(call["schema"]["parameters"]["required"]) == {"job_profile", "resume_paths"}
    assert "job_profile" in props
    assert "resume_paths" in props
    assert "简历" not in json.dumps(call["schema"], ensure_ascii=False)
```

- [ ] **Step 2: Run the failing test**

Run: `pytest tests/test_auto_resume_screening_plugin.py::test_auto_resume_screening_registers_tools -v`

Expected: FAIL with `ModuleNotFoundError: No module named 'plugins.auto_resume_screening'`.

- [ ] **Step 3: Add plugin metadata**

```yaml
# src/plugins/auto_resume_screening/plugin.yaml
name: auto_resume_screening
version: "0.1.0"
description: Deterministic resume screening tools for Semantier workspaces.
```

- [ ] **Step 4: Add schemas**

```python
# src/plugins/auto_resume_screening/schemas.py
from __future__ import annotations

TOOLSET_NAME = "auto_resume_screening"

EXTRACT_RESUME_TEXT_SCHEMA = {
    "description": "Extract normalized text from one uploaded resume file.",
    "parameters": {
        "type": "object",
        "properties": {
            "resume_path": {"type": "string", "description": "Path or uploaded filename for a resume document."},
        },
        "required": ["resume_path"],
    },
}

RANK_RESUME_CANDIDATES_SCHEMA = {
    "description": "Rank extracted resume texts against a deterministic job profile.",
    "parameters": {
        "type": "object",
        "properties": {
            "job_profile": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "required_keywords": {"type": "array", "items": {"type": "string"}, "default": []},
                    "preferred_keywords": {"type": "array", "items": {"type": "string"}, "default": []},
                    "negative_keywords": {"type": "array", "items": {"type": "string"}, "default": []},
                    "min_years_experience": {"type": "number", "default": 0},
                },
                "required": ["title"],
            },
            "resumes": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "candidate_id": {"type": "string"},
                        "source_path": {"type": "string"},
                        "text": {"type": "string"},
                    },
                    "required": ["candidate_id", "source_path", "text"],
                },
            },
        },
        "required": ["job_profile", "resumes"],
    },
}

SCREEN_RESUMES_SCHEMA = {
    "description": "Extract and rank uploaded resumes, then persist a workspace-scoped screening artifact.",
    "parameters": {
        "type": "object",
        "properties": {
            "job_profile": RANK_RESUME_CANDIDATES_SCHEMA["parameters"]["properties"]["job_profile"],
            "resume_paths": {"type": "array", "items": {"type": "string"}, "minItems": 1},
            "run_label": {"type": "string", "default": "resume-screening"},
        },
        "required": ["job_profile", "resume_paths"],
    },
}
```

- [ ] **Step 5: Add temporary handlers and registration**

```python
# src/plugins/auto_resume_screening/tools.py
from __future__ import annotations

import json
from typing import Any


def extract_resume_text(args: dict[str, Any], **_kw: Any) -> str:
    return json.dumps({"status": "error", "error_code": "NOT_IMPLEMENTED"}, ensure_ascii=False)


def rank_resume_candidates(args: dict[str, Any], **_kw: Any) -> str:
    return json.dumps({"status": "error", "error_code": "NOT_IMPLEMENTED"}, ensure_ascii=False)


def screen_resumes(args: dict[str, Any], **_kw: Any) -> str:
    return json.dumps({"status": "error", "error_code": "NOT_IMPLEMENTED"}, ensure_ascii=False)
```

```python
# src/plugins/auto_resume_screening/__init__.py
from __future__ import annotations

from typing import Any

from . import schemas, tools


def register(ctx: Any) -> None:
    ctx.register_tool(
        name="extract_resume_text",
        toolset=schemas.TOOLSET_NAME,
        schema=schemas.EXTRACT_RESUME_TEXT_SCHEMA,
        handler=tools.extract_resume_text,
        emoji="📄",
    )
    ctx.register_tool(
        name="rank_resume_candidates",
        toolset=schemas.TOOLSET_NAME,
        schema=schemas.RANK_RESUME_CANDIDATES_SCHEMA,
        handler=tools.rank_resume_candidates,
        emoji="📊",
    )
    ctx.register_tool(
        name="screen_resumes",
        toolset=schemas.TOOLSET_NAME,
        schema=schemas.SCREEN_RESUMES_SCHEMA,
        handler=tools.screen_resumes,
        emoji="✅",
    )
```

- [ ] **Step 6: Run registration tests**

Run: `pytest tests/test_auto_resume_screening_plugin.py::test_auto_resume_screening_registers_tools tests/test_auto_resume_screening_plugin.py::test_screen_resumes_schema_uses_ascii_machine_keys -v`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/plugins/auto_resume_screening tests/test_auto_resume_screening_plugin.py
git commit -m "feat: add auto resume screening plugin skeleton"
```

### Task 2: Deterministic Resume Extraction

**Files:**
- Create: `src/plugins/auto_resume_screening/extraction.py`
- Modify: `src/plugins/auto_resume_screening/tools.py`
- Test: `tests/test_auto_resume_screening_plugin.py`

- [ ] **Step 1: Add extraction tests**

```python
# append to tests/test_auto_resume_screening_plugin.py
import zipfile
from pathlib import Path

from plugins.auto_resume_screening.extraction import extract_text_from_resume


def _write_docx(path: Path, paragraphs: list[str]) -> None:
    body = "".join(f"<w:p><w:r><w:t>{text}</w:t></w:r></w:p>" for text in paragraphs)
    document_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        f"<w:body>{body}</w:body></w:document>"
    )
    with zipfile.ZipFile(path, "w") as archive:
        archive.writestr("word/document.xml", document_xml)


def test_extract_text_from_docx(tmp_path):
    resume = tmp_path / "resume.docx"
    _write_docx(resume, ["张三", "Java backend engineer", "5 years Spring Boot"])

    result = extract_text_from_resume(resume)

    assert result["status"] == "ok"
    assert result["source_path"] == str(resume)
    assert result["extension"] == ".docx"
    assert "Java backend engineer" in result["text"]
    assert result["text_sha256"].startswith("sha256:")


def test_extract_text_rejects_unsupported_extension(tmp_path):
    resume = tmp_path / "resume.exe"
    resume.write_text("bad", encoding="utf-8")

    result = extract_text_from_resume(resume)

    assert result["status"] == "error"
    assert result["error_code"] == "UNSUPPORTED_RESUME_FORMAT"
```

- [ ] **Step 2: Run the failing tests**

Run: `pytest tests/test_auto_resume_screening_plugin.py::test_extract_text_from_docx tests/test_auto_resume_screening_plugin.py::test_extract_text_rejects_unsupported_extension -v`

Expected: FAIL because `plugins.auto_resume_screening.extraction` does not exist.

- [ ] **Step 3: Implement extraction**

```python
# src/plugins/auto_resume_screening/extraction.py
from __future__ import annotations

import hashlib
import json
import re
import zipfile
from pathlib import Path
from typing import Any
from xml.etree import ElementTree

SUPPORTED_EXTENSIONS = (".docx", ".md", ".txt")
_WORD_NS = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


def _sha256_text(text: str) -> str:
    return "sha256:" + hashlib.sha256(text.encode("utf-8")).hexdigest()


def _normalize_text(text: str) -> str:
    lines = [re.sub(r"\s+", " ", line).strip() for line in text.splitlines()]
    return "\n".join(line for line in lines if line)


def _read_docx(path: Path) -> str:
    with zipfile.ZipFile(path) as archive:
        raw = archive.read("word/document.xml")
    root = ElementTree.fromstring(raw)
    paragraphs: list[str] = []
    for paragraph in root.iter(f"{_WORD_NS}p"):
        chunks = [node.text or "" for node in paragraph.iter(f"{_WORD_NS}t")]
        text = "".join(chunks).strip()
        if text:
            paragraphs.append(text)
    return "\n".join(paragraphs)


def extract_text_from_resume(path: Path) -> dict[str, Any]:
    resolved = path.expanduser()
    if not resolved.exists():
        return {
            "status": "error",
            "error_code": "RESUME_FILE_MISSING",
            "message": f"Resume file not found: {path}",
        }
    extension = resolved.suffix.lower()
    if extension not in SUPPORTED_EXTENSIONS:
        return {
            "status": "error",
            "error_code": "UNSUPPORTED_RESUME_FORMAT",
            "message": f"Supported resume formats: {', '.join(SUPPORTED_EXTENSIONS)}",
            "extension": extension,
        }
    if extension == ".docx":
        raw_text = _read_docx(resolved)
    else:
        raw_text = resolved.read_text(encoding="utf-8")
    text = _normalize_text(raw_text)
    return {
        "status": "ok",
        "source_path": str(resolved),
        "filename": resolved.name,
        "extension": extension,
        "char_count": len(text),
        "text_sha256": _sha256_text(text),
        "text": text,
    }


def extract_text_json(path: str) -> str:
    return json.dumps(extract_text_from_resume(Path(path)), ensure_ascii=False)
```

- [ ] **Step 4: Wire extraction handler**

```python
# replace extract_resume_text in src/plugins/auto_resume_screening/tools.py
def extract_resume_text(args: dict[str, Any], **_kw: Any) -> str:
    from .extraction import extract_text_json

    resume_path = str(args.get("resume_path") or "").strip()
    if not resume_path:
        return json.dumps(
            {"status": "error", "error_code": "RESUME_PATH_REQUIRED", "message": "resume_path is required"},
            ensure_ascii=False,
        )
    return extract_text_json(resume_path)
```

- [ ] **Step 5: Run extraction tests**

Run: `pytest tests/test_auto_resume_screening_plugin.py::test_extract_text_from_docx tests/test_auto_resume_screening_plugin.py::test_extract_text_rejects_unsupported_extension -v`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/plugins/auto_resume_screening/extraction.py src/plugins/auto_resume_screening/tools.py tests/test_auto_resume_screening_plugin.py
git commit -m "feat: extract resume text deterministically"
```

### Task 3: Deterministic Resume Scoring

**Files:**
- Create: `src/plugins/auto_resume_screening/scoring.py`
- Modify: `src/plugins/auto_resume_screening/tools.py`
- Test: `tests/test_auto_resume_screening_plugin.py`

- [ ] **Step 1: Add scoring tests**

```python
# append to tests/test_auto_resume_screening_plugin.py
from plugins.auto_resume_screening.scoring import rank_resumes


def test_rank_resumes_scores_required_and_preferred_keywords():
    job_profile = {
        "title": "Java Backend Engineer",
        "required_keywords": ["Java", "Spring Boot"],
        "preferred_keywords": ["Kafka", "Kubernetes"],
        "negative_keywords": ["frontend only"],
        "min_years_experience": 3,
    }
    resumes = [
        {"candidate_id": "alice", "source_path": "alice.docx", "text": "Alice Java Spring Boot Kafka 5 years"},
        {"candidate_id": "bob", "source_path": "bob.docx", "text": "Bob frontend only React 2 years"},
    ]

    result = rank_resumes(job_profile, resumes)

    assert result["status"] == "ok"
    assert [item["candidate_id"] for item in result["rankings"]] == ["alice", "bob"]
    assert result["rankings"][0]["score"] > result["rankings"][1]["score"]
    assert result["rankings"][0]["recommendation"] == "shortlist"
    assert result["rankings"][1]["recommendation"] == "reject"
    assert "display_name_zh" in result["rankings"][0]
```

- [ ] **Step 2: Run the failing scoring test**

Run: `pytest tests/test_auto_resume_screening_plugin.py::test_rank_resumes_scores_required_and_preferred_keywords -v`

Expected: FAIL because `plugins.auto_resume_screening.scoring` does not exist.

- [ ] **Step 3: Implement scoring**

```python
# src/plugins/auto_resume_screening/scoring.py
from __future__ import annotations

import hashlib
import re
from typing import Any


def _as_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()]


def _contains(text: str, keyword: str) -> bool:
    return keyword.lower() in text.lower()


def _experience_years(text: str) -> float:
    matches = re.findall(r"(\d+(?:\.\d+)?)\s*(?:years?|年)", text, flags=re.IGNORECASE)
    values = [float(item) for item in matches]
    return max(values) if values else 0.0


def _text_hash(text: str) -> str:
    return "sha256:" + hashlib.sha256(text.encode("utf-8")).hexdigest()


def rank_resumes(job_profile: dict[str, Any], resumes: list[dict[str, Any]]) -> dict[str, Any]:
    required = _as_list(job_profile.get("required_keywords"))
    preferred = _as_list(job_profile.get("preferred_keywords"))
    negative = _as_list(job_profile.get("negative_keywords"))
    min_years = float(job_profile.get("min_years_experience") or 0)

    rankings: list[dict[str, Any]] = []
    for index, resume in enumerate(resumes):
        text = str(resume.get("text") or "")
        required_hits = [keyword for keyword in required if _contains(text, keyword)]
        preferred_hits = [keyword for keyword in preferred if _contains(text, keyword)]
        negative_hits = [keyword for keyword in negative if _contains(text, keyword)]
        years = _experience_years(text)

        score = 0
        score += 50 if required and len(required_hits) == len(required) else len(required_hits) * 20
        score += len(preferred_hits) * 10
        score += 15 if min_years and years >= min_years else 0
        score -= len(negative_hits) * 30
        score = max(0, min(100, score))

        if score >= 70:
            recommendation = "shortlist"
        elif score >= 40:
            recommendation = "review"
        else:
            recommendation = "reject"

        rankings.append(
            {
                "candidate_id": str(resume.get("candidate_id") or f"candidate_{index + 1}"),
                "display_name_zh": str(resume.get("display_name_zh") or resume.get("candidate_id") or f"候选人{index + 1}"),
                "source_path": str(resume.get("source_path") or ""),
                "score": score,
                "recommendation": recommendation,
                "evidence": {
                    "required_hits": required_hits,
                    "preferred_hits": preferred_hits,
                    "negative_hits": negative_hits,
                    "experience_years": years,
                    "text_sha256": _text_hash(text),
                },
            }
        )

    rankings.sort(key=lambda item: (-int(item["score"]), item["candidate_id"]))
    return {
        "status": "ok",
        "job_title": str(job_profile.get("title") or ""),
        "ranking_count": len(rankings),
        "rankings": rankings,
    }
```

- [ ] **Step 4: Wire scoring handler**

```python
# replace rank_resume_candidates in src/plugins/auto_resume_screening/tools.py
def rank_resume_candidates(args: dict[str, Any], **_kw: Any) -> str:
    from .scoring import rank_resumes

    job_profile = args.get("job_profile")
    resumes = args.get("resumes")
    if not isinstance(job_profile, dict):
        return json.dumps({"status": "error", "error_code": "JOB_PROFILE_REQUIRED"}, ensure_ascii=False)
    if not isinstance(resumes, list):
        return json.dumps({"status": "error", "error_code": "RESUMES_REQUIRED"}, ensure_ascii=False)
    return json.dumps(rank_resumes(job_profile, resumes), ensure_ascii=False)
```

- [ ] **Step 5: Run scoring tests**

Run: `pytest tests/test_auto_resume_screening_plugin.py::test_rank_resumes_scores_required_and_preferred_keywords -v`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/plugins/auto_resume_screening/scoring.py src/plugins/auto_resume_screening/tools.py tests/test_auto_resume_screening_plugin.py
git commit -m "feat: rank resumes deterministically"
```

### Task 4: Workspace-Scoped Screening Artifacts

**Files:**
- Create: `src/plugins/auto_resume_screening/artifacts.py`
- Modify: `src/plugins/auto_resume_screening/tools.py`
- Test: `tests/test_auto_resume_screening_plugin.py`

- [ ] **Step 1: Add artifact tests**

```python
# append to tests/test_auto_resume_screening_plugin.py
import os


def test_screen_resumes_writes_workspace_artifact(tmp_path, monkeypatch):
    resume = tmp_path / "alice.docx"
    _write_docx(resume, ["Alice", "Java Spring Boot Kafka", "5 years"])
    runs_dir = tmp_path / "workspaces" / "ws-1" / "runs"
    monkeypatch.setenv("SEMANTIER_WORKSPACE_RUNS_DIR", str(runs_dir))

    from plugins.auto_resume_screening.tools import screen_resumes

    payload = {
        "job_profile": {
            "title": "Java Backend Engineer",
            "required_keywords": ["Java", "Spring Boot"],
            "preferred_keywords": ["Kafka"],
            "min_years_experience": 3,
        },
        "resume_paths": [str(resume)],
        "run_label": "backend-hiring",
    }

    result = json.loads(screen_resumes(payload))

    assert result["status"] == "ok"
    assert result["artifact_path"].endswith("screening_result.json")
    artifact = Path(result["artifact_path"])
    assert artifact.exists()
    saved = json.loads(artifact.read_text(encoding="utf-8"))
    assert saved["created_at"].endswith("Z")
    assert saved["content_hash"].startswith("sha256:")
    assert saved["rankings"][0]["candidate_id"] == "alice"


def test_screen_resumes_requires_workspace_runs_dir(tmp_path, monkeypatch):
    resume = tmp_path / "alice.docx"
    _write_docx(resume, ["Alice Java"])
    monkeypatch.delenv("SEMANTIER_WORKSPACE_RUNS_DIR", raising=False)

    from plugins.auto_resume_screening.tools import screen_resumes

    result = json.loads(screen_resumes({"job_profile": {"title": "Java"}, "resume_paths": [str(resume)]}))

    assert result["status"] == "error"
    assert result["error_code"] == "WORKSPACE_RUNS_DIR_REQUIRED"
```

- [ ] **Step 2: Run the failing artifact tests**

Run: `pytest tests/test_auto_resume_screening_plugin.py::test_screen_resumes_writes_workspace_artifact tests/test_auto_resume_screening_plugin.py::test_screen_resumes_requires_workspace_runs_dir -v`

Expected: FAIL because `screen_resumes` still returns `NOT_IMPLEMENTED`.

- [ ] **Step 3: Implement artifact writer**

```python
# src/plugins/auto_resume_screening/artifacts.py
from __future__ import annotations

import hashlib
import json
import os
import re
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


def utc_now_iso() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def _slug(value: str) -> str:
    text = re.sub(r"[^A-Za-z0-9_.-]+", "-", value.strip()).strip("-")
    return text or "resume-screening"


def _canonical_json(payload: dict[str, Any]) -> str:
    return json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _hash_payload(payload: dict[str, Any]) -> str:
    return "sha256:" + hashlib.sha256(_canonical_json(payload).encode("utf-8")).hexdigest()


def workspace_runs_dir() -> Path:
    raw = os.environ.get("SEMANTIER_WORKSPACE_RUNS_DIR")
    if not raw:
        raise RuntimeError("WORKSPACE_RUNS_DIR_REQUIRED: SEMANTIER_WORKSPACE_RUNS_DIR is required")
    return Path(raw).expanduser()


def write_screening_artifact(run_label: str, payload: dict[str, Any]) -> Path:
    run_root = workspace_runs_dir() / "auto_resume_screening" / _slug(run_label)
    run_root.mkdir(parents=True, exist_ok=True)
    artifact = dict(payload)
    artifact["created_at"] = utc_now_iso()
    artifact["content_hash"] = _hash_payload(artifact)
    path = run_root / "screening_result.json"
    path.write_text(json.dumps(artifact, ensure_ascii=False, indent=2, sort_keys=True), encoding="utf-8")
    return path
```

- [ ] **Step 4: Implement `screen_resumes`**

```python
# replace screen_resumes in src/plugins/auto_resume_screening/tools.py
def screen_resumes(args: dict[str, Any], **_kw: Any) -> str:
    from pathlib import Path

    from .artifacts import write_screening_artifact
    from .extraction import extract_text_from_resume
    from .scoring import rank_resumes

    job_profile = args.get("job_profile")
    resume_paths = args.get("resume_paths")
    run_label = str(args.get("run_label") or "resume-screening")
    if not isinstance(job_profile, dict):
        return json.dumps({"status": "error", "error_code": "JOB_PROFILE_REQUIRED"}, ensure_ascii=False)
    if not isinstance(resume_paths, list) or not resume_paths:
        return json.dumps({"status": "error", "error_code": "RESUME_PATHS_REQUIRED"}, ensure_ascii=False)

    extracted: list[dict[str, Any]] = []
    errors: list[dict[str, Any]] = []
    for index, raw_path in enumerate(resume_paths, start=1):
        result = extract_text_from_resume(Path(str(raw_path)))
        if result.get("status") != "ok":
            errors.append(result)
            continue
        source_path = str(result["source_path"])
        candidate_id = Path(source_path).stem or f"candidate_{index}"
        extracted.append(
            {
                "candidate_id": candidate_id,
                "display_name_zh": candidate_id,
                "source_path": source_path,
                "text": str(result["text"]),
                "text_sha256": str(result["text_sha256"]),
            }
        )
    if not extracted:
        return json.dumps({"status": "error", "error_code": "NO_RESUMES_EXTRACTED", "errors": errors}, ensure_ascii=False)

    ranking = rank_resumes(job_profile, extracted)
    payload = {
        "status": "ok",
        "job_profile": job_profile,
        "extracted": [
            {key: value for key, value in item.items() if key != "text"}
            for item in extracted
        ],
        "errors": errors,
        "rankings": ranking["rankings"],
    }
    try:
        artifact_path = write_screening_artifact(run_label, payload)
    except RuntimeError as exc:
        code = str(exc).split(":", 1)[0]
        return json.dumps({"status": "error", "error_code": code, "message": str(exc)}, ensure_ascii=False)

    response = dict(payload)
    response["artifact_path"] = str(artifact_path)
    return json.dumps(response, ensure_ascii=False)
```

- [ ] **Step 5: Run artifact tests**

Run: `pytest tests/test_auto_resume_screening_plugin.py::test_screen_resumes_writes_workspace_artifact tests/test_auto_resume_screening_plugin.py::test_screen_resumes_requires_workspace_runs_dir -v`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/plugins/auto_resume_screening/artifacts.py src/plugins/auto_resume_screening/tools.py tests/test_auto_resume_screening_plugin.py
git commit -m "feat: persist resume screening artifacts"
```

### Task 5: Launcher Bootstrap Wiring

**Files:**
- Modify: `src/agents/launcher.py`
- Modify: `tests/test_agents_launcher.py`

- [ ] **Step 1: Add launcher tests for optional plugin bootstrap**

```python
# append to tests/test_agents_launcher.py
def test_run_hermes_cli_installs_optional_auto_resume_screening_plugin(monkeypatch, tmp_path):
    hermes_cli_pkg = types.ModuleType("hermes_cli")
    hermes_main_mod = types.ModuleType("hermes_cli.main")
    hermes_main_mod.main = lambda: 0
    hermes_cli_pkg.main = hermes_main_mod
    monkeypatch.setitem(sys.modules, "hermes_cli", hermes_cli_pkg)
    monkeypatch.setitem(sys.modules, "hermes_cli.main", hermes_main_mod)
    monkeypatch.setattr(launcher, "_repo_runtime_root", lambda: tmp_path / ".semantier-home")
    monkeypatch.delenv("HERMES_HOME", raising=False)
    monkeypatch.delenv("SEMANTIER_LOCAL_STATE_DIR", raising=False)

    plugin_root = tmp_path / "src" / "plugins"
    for name in ("business_analytics", "semantier_routing_guard", "auto_resume_screening"):
        plugin_source = plugin_root / name
        plugin_source.mkdir(parents=True)
        (plugin_source / "__init__.py").write_text("# plugin\n", encoding="utf-8")
        (plugin_source / "plugin.yaml").write_text(f"name: {name}\n", encoding="utf-8")
    (plugin_root / "auto_resume_screening" / "SKILL.md").write_text(
        "---\nname: auto-resume-screening\ndescription: demo\n---\n",
        encoding="utf-8",
    )
    monkeypatch.setattr(launcher, "_repo_plugin_source_root", lambda: plugin_root)
    skill_root = tmp_path / "src" / "skills"
    monkeypatch.setattr(launcher, "_repo_skill_source_root", lambda: skill_root)

    rc = launcher.run_hermes_cli(["status"])

    assert rc == 0
    target = tmp_path / ".semantier-home" / "plugins" / "auto_resume_screening"
    assert (target / "plugin.yaml").exists()
    config = yaml.safe_load((tmp_path / ".semantier-home" / "config.yaml").read_text(encoding="utf-8"))
    assert "auto_resume_screening" in config["plugins"]["enabled"]
    assert str(target.resolve()) in config["skills"]["external_dirs"]
```

- [ ] **Step 2: Run the failing launcher test**

Run: `pytest tests/test_agents_launcher.py::test_run_hermes_cli_installs_optional_auto_resume_screening_plugin -v`

Expected: FAIL because `auto_resume_screening` is not in `_OPTIONAL_RUNTIME_PLUGIN_NAMES`.

- [ ] **Step 3: Modify launcher constants**

```python
# src/agents/launcher.py, near plugin constants
_AUTO_RESUME_SCREENING_PLUGIN_NAME = "auto_resume_screening"
_OPTIONAL_RUNTIME_PLUGIN_NAMES: tuple[str, ...] = (
    _FEISHU_MEETING_COORDINATOR_PLUGIN_NAME,
    _AUTO_RESUME_SCREENING_PLUGIN_NAME,
)
```

No special platform toolset is required unless a channel-specific route is added later. The existing optional-plugin loop will install, enable, and add plugin `SKILL.md` directories to `skills.external_dirs`.

- [ ] **Step 4: Run launcher tests**

Run: `pytest tests/test_agents_launcher.py::test_run_hermes_cli_installs_optional_auto_resume_screening_plugin tests/test_agents_launcher.py::test_run_hermes_cli_normalizes_repo_local_runtime_config -v`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/agents/launcher.py tests/test_agents_launcher.py
git commit -m "feat: bootstrap auto resume screening plugin"
```

### Task 6: Skill Asset For Chinese Workflow

**Files:**
- Create: `src/plugins/auto_resume_screening/SKILL.md`
- Test: `tests/test_auto_resume_screening_plugin.py`

- [ ] **Step 1: Add skill asset test**

```python
# append to tests/test_auto_resume_screening_plugin.py
def test_auto_resume_screening_skill_asset_is_procedural():
    skill = Path(__file__).resolve().parents[1] / "src" / "plugins" / "auto_resume_screening" / "SKILL.md"
    text = skill.read_text(encoding="utf-8")

    assert "name: auto-resume-screening" in text
    assert "自动简历筛选" in text
    assert "screen_resumes" in text
    assert "metadata:" in text
    assert "route: procedural_only" in text
```

- [ ] **Step 2: Run the failing skill test**

Run: `pytest tests/test_auto_resume_screening_plugin.py::test_auto_resume_screening_skill_asset_is_procedural -v`

Expected: FAIL because `SKILL.md` does not exist.

- [ ] **Step 3: Add `SKILL.md`**

```markdown
---
name: auto-resume-screening
description: 自动简历筛选：extract uploaded resume text, rank candidates against a job profile, and write a workspace artifact.
metadata:
  semantier:
    route: procedural_only
---
# 自动简历筛选

Use this skill when the user asks to screen uploaded resumes, compare candidates for a role, or build a short list from resume files.

Call `screen_resumes` with:

- `job_profile.title`
- `job_profile.required_keywords`
- `job_profile.preferred_keywords`
- `job_profile.negative_keywords`
- `job_profile.min_years_experience`
- `resume_paths`

Output the top candidates with scores, recommendations, and evidence from the returned artifact. Treat the score as a decision-support signal, not an employment decision by itself. If the user asks for a final hiring decision, explain that the plugin provides screening evidence and that a human reviewer should make the final decision.

Do not infer protected attributes. Do not rank by age, gender, ethnicity, marital status, health status, household registration, or other protected or irrelevant personal attributes.
```

- [ ] **Step 4: Run the skill test**

Run: `pytest tests/test_auto_resume_screening_plugin.py::test_auto_resume_screening_skill_asset_is_procedural -v`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/plugins/auto_resume_screening/SKILL.md tests/test_auto_resume_screening_plugin.py
git commit -m "feat: add auto resume screening skill asset"
```

### Task 7: Import Resolution And Full Regression

**Files:**
- Modify: `tests/test_plugin_import_resolution.py`
- Test: `tests/test_auto_resume_screening_plugin.py`

- [ ] **Step 1: Add import-resolution test**

```python
# append to tests/test_plugin_import_resolution.py
def test_auto_resume_screening_import_resolves_from_repo_source_tree():
    module = importlib.import_module("plugins.auto_resume_screening")

    expected = (
        Path(__file__).resolve().parents[1]
        / "src"
        / "plugins"
        / "auto_resume_screening"
        / "__init__.py"
    ).resolve()

    assert Path(module.__file__).resolve() == expected
```

- [ ] **Step 2: Run focused plugin tests**

Run: `pytest tests/test_auto_resume_screening_plugin.py tests/test_plugin_import_resolution.py::test_auto_resume_screening_import_resolves_from_repo_source_tree -v`

Expected: PASS.

- [ ] **Step 3: Run bootstrap and schema guard tests**

Run: `pytest tests/test_agents_launcher.py::test_run_hermes_cli_installs_optional_auto_resume_screening_plugin tests/test_schema_identifier_law.py tests/test_skill_artifact_paths_lint.py -v`

Expected: PASS. If `tests/test_schema_identifier_law.py` catches a non-ASCII machine identifier, replace the identifier with ASCII and move Chinese text into `display_name_zh` or Markdown prose.

- [ ] **Step 4: Run broader regression slice**

Run: `pytest tests/test_auto_resume_screening_plugin.py tests/test_agents_launcher.py tests/test_plugin_import_resolution.py tests/test_runtime_inventory_skill_hashes.py -v`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/test_plugin_import_resolution.py
git commit -m "test: cover auto resume screening plugin imports"
```

## Manual Verification

- [ ] Run `semantier bootstrap --replace` if local runtime state should be refreshed.
- [ ] Run `semantier status` or another Hermes CLI command that triggers launcher bootstrap.
- [ ] Confirm `.semantier-home/plugins/auto_resume_screening/plugin.yaml` exists.
- [ ] Confirm `.semantier-home/config.yaml` includes `auto_resume_screening` in `plugins.enabled`.
- [ ] In an authenticated workspace with `SEMANTIER_WORKSPACE_RUNS_DIR` bound, call `screen_resumes` with two sample `.docx` files and confirm `workspaces/<workspace_id>/runs/auto_resume_screening/<run_label>/screening_result.json` is created.

## Risk Notes

- The Vibe-Trading source accepted `.docx` uploads but its reusable document reader primarily targeted PDF. This plan implements `.docx` extraction directly instead of depending on Vibe-Trading's PDF-only `read_document` path.
- Automated resume screening can create employment-compliance risk. The first plugin version must rank only against explicit job-related criteria supplied in `job_profile` and must not infer protected attributes.
- The plugin writes deterministic artifacts, but the online extraction step reads live uploaded files. Replay of a screening result must use the persisted `text_sha256`, `job_profile`, `rankings`, and artifact hash rather than re-reading mutable uploads.

## Self-Review

- Spec coverage: The plan extracts Vibe-Trading's resume document workflow into a Semantier plugin, registers Hermes tools, adds a Chinese procedural skill asset, and wires launcher bootstrap.
- Architecture coverage: Plugin source lives under `src/plugins`; `.semantier-home` is only a bootstrap target; machine schemas are ASCII; Chinese appears only in prose or `display_name_zh`; artifact timestamps are UTC ISO-8601; workspace artifact writes fail clearly if the governed runs directory is absent.
- Test coverage: Registration, schema identifiers, extraction, ranking, artifact writing, launcher bootstrap, import resolution, and relevant existing guard tests are included.
