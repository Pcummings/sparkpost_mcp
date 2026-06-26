---
phase: 03-publish-docs
plan: "01"
subsystem: packaging
tags: [npm, license, packaging, publish]
dependency_graph:
  requires: []
  provides: [PKG-02]
  affects: [package.json, LICENSE]
tech_stack:
  added: []
  patterns: [npm-files-allowlist, prepublishOnly-typecheck-gate]
key_files:
  created:
    - LICENSE
  modified:
    - package.json
  deleted:
    - tsconfig.json.bak
decisions:
  - "MIT license, copyright 2026 Peter Cummings"
  - "tsx moved devDependencies -> dependencies (bin needs tsx resolvable post-install)"
  - "files allowlist: index.ts, src/, README.md, LICENSE, tsconfig.json"
  - "prepublishOnly: tsc --noEmit (typecheck gate on publish, not pack)"
  - "engines.node: >=18 (fetch/AbortSignal.timeout require Node 18+)"
metrics:
  duration: "5 minutes"
  completed: "2026-06-26"
  tasks_completed: 3
  files_changed: 3
status: complete
requirements: [PKG-02]
---

# Phase 03 Plan 01: npm Publish Readiness Summary

MIT LICENSE added, package.json updated with files allowlist + prepublishOnly typecheck + tsx moved to runtime deps, stray tsconfig.json.bak deleted; `npm publish --dry-run` exits 0 with a clean 6-file tarball.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add MIT LICENSE file | d3df242 | LICENSE (created) |
| 2 | Update package.json packaging metadata | be8e723 | package.json |
| 3 | Remove tsconfig.json.bak and prove clean minimal tarball | 6882189 | tsconfig.json.bak (deleted) |

## Verification Evidence

- `npm publish --dry-run` exits 0; `prepublishOnly: tsc --noEmit` typecheck gate ran and passed
- Tarball contains exactly 6 files: `LICENSE`, `README.md`, `index.ts`, `package.json`, `src/sparkpost.ts`, `tsconfig.json`
- Tarball excludes: `test/`, `.planning/`, `.github/`, `tsconfig.json.bak`, `.env`
- `node -p "require('./package.json').license"` → `MIT`
- `tsx` is under `dependencies`; `devDependencies` retains only `@types/node` and `typescript`

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None. This plan edits packaging metadata only; no new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries.

## Self-Check

- LICENSE exists at repo root: FOUND
- package.json fields verified via node assertion: PASS
- tsconfig.json.bak deleted: CONFIRMED (git rm)
- Commits exist: d3df242 be8e723 6882189 — FOUND
