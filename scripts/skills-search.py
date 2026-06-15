#!/usr/bin/env python3
"""Thin JSON wrapper around hermes skills search for the workspace API."""
import json
import sys
import os
from urllib.parse import urlparse

import httpx

script_dir = os.path.dirname(os.path.abspath(__file__))
workspace_dir = os.path.dirname(script_dir)
repo_root = os.path.dirname(workspace_dir)
monorepo_agent = os.path.join(repo_root, 'hermes-agent')
home_agent = os.path.expanduser("~/hermes-agent")

for path in [monorepo_agent, home_agent]:
    if os.path.isdir(path):
        sys.path.insert(0, path)
        break

from tools.skills_hub import GitHubAuth, create_source_router, unified_search


def _is_http_url(value: str) -> bool:
    parsed = urlparse(value)
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def _normalize_custom_entry(entry):
    if not isinstance(entry, dict):
        return None

    identifier = str(
        entry.get("id")
        or entry.get("identifier")
        or entry.get("slug")
        or entry.get("name")
        or ""
    ).strip()
    name = str(entry.get("name") or identifier).strip()
    if not identifier or not name:
        return None

    tags = entry.get("tags")
    if isinstance(tags, list):
        normalized_tags = [str(tag).strip() for tag in tags if str(tag).strip()]
    else:
        normalized_tags = []

    return {
        "id": identifier,
        "name": name,
        "description": str(entry.get("description") or "").strip(),
        "author": str(entry.get("author") or entry.get("publisher") or "Community").strip(),
        "category": str(entry.get("category") or "Productivity").strip(),
        "tags": normalized_tags,
        "source": str(entry.get("source") or "custom-marketplace").strip(),
        "identifier": identifier,
        "trust_level": str(entry.get("trust_level") or entry.get("trust") or "community").strip(),
        "repo": entry.get("repo"),
        "homepage": entry.get("homepage"),
        "installed": bool(entry.get("installed", False)),
    }


def _matches_custom_query(entry, query: str) -> bool:
    normalized_query = query.strip().lower()
    if not normalized_query:
        return True

    tags = entry.get("tags")
    haystack = "\n".join(
        [
            str(entry.get("id") or ""),
            str(entry.get("name") or ""),
            str(entry.get("description") or ""),
            str(entry.get("author") or ""),
            str(entry.get("category") or ""),
            " ".join(str(tag) for tag in tags) if isinstance(tags, list) else "",
        ]
    ).lower()
    return normalized_query in haystack


def _search_custom_marketplace(query: str, limit: int, marketplace_url: str):
    response = httpx.get(
        marketplace_url,
        params={"q": query, "limit": limit},
        timeout=20,
        follow_redirects=True,
    )
    response.raise_for_status()
    payload = response.json()

    if isinstance(payload, dict):
        source = str(payload.get("source") or "custom-marketplace")
        total = payload.get("total")
        items = payload.get("results")
        if not isinstance(items, list):
            items = payload.get("skills")
        if not isinstance(items, list):
            items = payload.get("data")
        if not isinstance(items, list):
            items = []
    elif isinstance(payload, list):
        source = "custom-marketplace"
        total = None
        items = payload
    else:
        source = "custom-marketplace"
        total = None
        items = []

    normalized = []
    for item in items:
        mapped = _normalize_custom_entry(item)
        if mapped is not None:
            normalized.append(mapped)

    normalized = [
        item for item in normalized if _matches_custom_query(item, query)
    ]

    if isinstance(total, int):
        total_count = min(total, len(normalized)) if normalized else 0
    else:
        total_count = len(normalized)

    return {
        "results": normalized[:limit],
        "source": source,
        "total": total_count,
    }


def main():
    query = sys.argv[1] if len(sys.argv) > 1 else ""
    limit = int(sys.argv[2]) if len(sys.argv) > 2 else 20
    source_filter = sys.argv[3] if len(sys.argv) > 3 else "all"
    marketplace_url = sys.argv[4] if len(sys.argv) > 4 else ""

    if not query:
        print(json.dumps({"results": [], "source": "idle"}))
        return

    normalized_marketplace_url = marketplace_url.strip()
    if normalized_marketplace_url and _is_http_url(normalized_marketplace_url):
        custom_result = _search_custom_marketplace(
            query,
            limit,
            normalized_marketplace_url,
        )
        print(json.dumps(custom_result))
        return

    auth = GitHubAuth()
    sources = create_source_router(auth)
    results = unified_search(query, sources, source_filter=source_filter, limit=limit)

    out = []
    for r in results:
        out.append({
            "id": getattr(r, "identifier", r.name),
            "name": r.name,
            "description": getattr(r, "description", ""),
            "author": getattr(r, "author", getattr(r, "source_label", "")),
            "category": getattr(r, "category", ""),
            "tags": getattr(r, "tags", []),
            "source": getattr(r, "source_label", ""),
            "trust": getattr(r, "trust_level", "community"),
            "installCommand": f"hermes skills install {getattr(r, 'identifier', r.name)}",
            "installed": False,
        })

    print(json.dumps({"results": out, "source": "skills-hub", "total": len(out)}))


if __name__ == "__main__":
    main()
