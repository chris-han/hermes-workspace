#!/usr/bin/env python3
"""Thin JSON wrapper around hermes skills search for the workspace API."""
import json
import sys
import os
from pathlib import PurePosixPath
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

from tools.skills_hub import GitHubAuth, GitHubSource, create_source_router, unified_search


def _is_http_url(value: str) -> bool:
    parsed = urlparse(value)
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def _github_repo_slug_from_url(value: str) -> str:
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or parsed.netloc.lower() != "github.com":
        return ""

    parts = [part for part in parsed.path.strip("/").split("/") if part]
    if len(parts) < 2:
        return ""

    owner, repo = parts[0], parts[1]
    if repo.endswith('.git'):
        repo = repo[:-4]
    if not owner or not repo:
        return ""
    return f"{owner}/{repo}"


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
        "type": str(entry.get("type") or "skill").strip() or "skill",
        "path": str(entry.get("path") or "").strip() or None,
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


def _search_github_marketplace_repo(query: str, limit: int, repo_slug: str):
    auth = GitHubAuth()
    source = GitHubSource(auth=auth)
    cached = source._get_repo_tree(repo_slug)
    if cached is None:
        return {
            "results": [],
            "source": f"github-repo:{repo_slug}",
            "total": 0,
        }

    _default_branch, tree_entries = cached
    query_lower = query.strip().lower()
    normalized = []
    seen_identifiers = set()

    for entry in tree_entries:
        path = str(entry.get("path") or "")
        if entry.get("type") != "blob":
            continue
        package_type = None
        package_dir = ""
        if path.startswith("skills/") and path.endswith("/SKILL.md"):
            package_type = "skill"
            package_dir = path[: -len("/SKILL.md")]
        elif path.startswith("plugins/") and path.endswith("/plugin.yaml"):
            package_type = "plugin"
            package_dir = path[: -len("/plugin.yaml")]
        else:
            continue

        identifier = f"{repo_slug}/{package_dir}"
        if identifier in seen_identifiers:
            continue

        meta = source.inspect(identifier)
        if meta is None:
            continue

        searchable = f"{meta.name} {meta.description} {' '.join(meta.tags)}".lower()
        if query_lower and query_lower not in searchable:
            continue

        seen_identifiers.add(identifier)
        path_parts = PurePosixPath(package_dir).parts
        category = path_parts[1] if package_type == "skill" and len(path_parts) >= 3 else "Productivity"
        normalized.append(
            {
                "id": identifier,
                "name": meta.name,
                "type": package_type,
                "path": package_dir,
                "description": meta.description,
                "author": repo_slug.split("/", 1)[0],
                "category": category.capitalize(),
                "tags": meta.tags or [],
                "source": "github-repo",
                "identifier": identifier,
                "trust_level": getattr(meta, "trust_level", "community"),
                "repo": f"https://github.com/{repo_slug}",
                "homepage": f"https://github.com/{repo_slug}/tree/main/{package_dir}",
                "installed": False,
            }
        )
        if len(normalized) >= limit:
            break

    return {
        "results": normalized,
        "source": f"github-repo:{repo_slug}",
        "total": len(normalized),
    }


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
    github_repo_slug = _github_repo_slug_from_url(normalized_marketplace_url)
    if github_repo_slug:
        custom_result = _search_github_marketplace_repo(
            query,
            limit,
            github_repo_slug,
        )
        print(json.dumps(custom_result))
        return

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
