# Bootstrap Guide (Unified Dataset)

This directory contains deterministic bootstrap tooling for local/dev/demo environments.

## Unified dataset scope

The unified bootstrap seeds one combined dataset that includes:

- `v8` base accounting/contracts artifacts
- `v8.1` full-cycle accounting artifacts and reports
- `v8.5` SMB simulation and analytics artifacts
- `KM lifecycle` tiered knowledge management demo artifacts (T1–T6)

This removes profile-level branching for normal bootstrap and cleanup operations.

## Unified entrypoints

Use a single command path.

### Seed

```bash
semantier bootstrap --replace
semantier bootstrap --dry-run
```

### Cleanup

```bash
semantier bootstrap cleanup --dry-run
semantier bootstrap cleanup
```

## Internal scripts (invoked by unified entrypoints)

- `bootstrap_seed_v8.py`
- `bootstrap_seed_v81.py`
- `bootstrap_seed_v85.py`
- `bootstrap_seed_km.py` — seeds KM lifecycle demo artifacts (T1–T6)
- `bootstrap_cleanup_v8.py`
- `bootstrap_cleanup_v81.py`
- `bootstrap_cleanup_v85.py`
- `bootstrap_cleanup_km.py` — removes KM lifecycle demo artifacts

## Output manifests

- v8 + v8.1: `bootstrap/output/seeded_ids.json`
- v8.5: `bootstrap/output/seeded_ids_v85.json`
- KM lifecycle: `bootstrap/output/seeded_ids_km.json`

Cleanup scripts are manifest-driven and only delete rows explicitly listed in the corresponding manifest.

## Safety notes

- Always run cleanup with `--dry-run` first in shared environments.
- Prefer wrapper scripts over manual SQL deletes.
- Use profile-specific manifests to avoid cross-profile accidental deletion.
