# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.1 — Expand & Publish

**Shipped:** 2026-06-26
**Phases:** 3 | **Plans:** 8 | **Sessions:** ~2 (2026-06-25 → 2026-06-26)

### What Was Built
- Test + CI foundation: `node:test`/tsx harness, `src/sparkpost.ts` extracted as a side-effect-free request module, 44 tests, GitHub Actions gating push/PR (TEST-01..03)
- 12 new tools (8 → 20): webhooks, subaccounts, message-events search, deliverability metrics, recipient lists, suppression add/remove — all typed, zod-validated, tested (COV-01..05)
- npm publish readiness + docs: MIT LICENSE, `files` allowlist, `prepublishOnly` typecheck, clean dry-run tarball, README 20-tool table + MCP client config (PKG-01..02)

### What Worked
- **Tests-first phase ordering** — Phase 1 (tests+CI) landed before the Phase 2 coverage expansion, so 12 new tools were added onto a verified request layer instead of guesswork.
- **Extracting a side-effect-free `src/sparkpost.ts` up front** made every handler trivially unit-testable with mocked `fetch`.
- **TDD red-green** in Phase 2 caught schema/payload mistakes at write time.
- **Zero new dependencies** — `node:test` (stdlib) covered all testing needs; no framework added.

### What Was Inefficient
- **SUMMARY.md `one_liner` field drifted** across plans — milestone extraction returned `MESSAGE_EVENT_TYPES` for one plan and empty for three, forcing a manual accomplishments rewrite at close. Keep the field present and prose-shaped.
- **STATE.md velocity/metrics tables accumulated inconsistent rows** (mixed phase-key formats, a stale 0% progress bar at 100% complete) — cosmetic but noisy.

### Patterns Established
- `URLSearchParams` query builder for list/search endpoints; path-suffix `group_by` for metrics.
- `encodeURIComponent` on every path-interpolated ID (webhook/list/suppression) — path-traversal safety as a default.
- `zod` enum arrays to constrain SparkPost-specific sets (event types, key grants).
- Reshape flat tool input → nested SparkPost payload inside the handler, keeping tool schemas flat.

### Key Lessons
1. Lock the testable seam (a pure request module) before widening the API surface — it pays back on every subsequent tool.
2. Milestone tooling only works if upstream artifacts stay well-formed: enforce a non-empty, prose `one_liner` in every SUMMARY.md.

### Cost Observations
- Model mix: not tracked this milestone.
- Sessions: ~2.
- Notable: zero new runtime deps beyond promoting `tsx` to a dependency (needed by `bin` at install time).

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.1 | ~2 | 3 | Brownfield hardening → tests-first, then coverage expansion, then publish |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v1.1 | 44 | not measured | Yes (`node:test` stdlib) |

### Top Lessons (Verified Across Milestones)

1. Establish a testable seam before expanding surface area. *(v1.1 — needs a second milestone to confirm)*
2. Keep planning artifacts well-formed; milestone tooling depends on them. *(v1.1)*
