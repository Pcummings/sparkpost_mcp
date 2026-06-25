---
phase: 01-test-foundation-ci
plan: "02"
subsystem: testing
tags: [node:test, tsx, zod, sparkpost, mcp, typescript, nodenext, handlers]

requires:
  - "src/sparkpost.ts (01-01): 8 handlers, 5 zod schema consts, asText"
provides:
  - "test/handlers.test.ts: 17 tests covering all 8 tool request contracts + 5 zod-rejection cases"
affects:
  - 01-03-github-actions-ci

tech-stack:
  added: []
  patterns:
    - "Capturing fetch stub: records { url, init } per test; restored in afterEach"
    - "Zod-rejection tests on exported schema consts directly (not through handler) per D-02"
    - "Zod v4 error message: 'expected string, received number' (not 'Expected string')"

key-files:
  created:
    - test/handlers.test.ts
  modified: []

decisions:
  - "Zod v4 changed error messages to lowercase — use /expected string/i flag to future-proof"
  - "Schema rejection tests target z.object(SchemaConst).parse() directly, not handler calls"
  - "Used case-insensitive regex for Zod type errors to survive minor message wording changes"

metrics:
  duration: 3min
  completed: "2026-06-25"
status: complete
---

# Phase 01 Plan 02: Handler Tests Summary

**17-test suite locking the URL/method/body contract for all 8 MCP tools and zod-rejection for all 5 parameterized schemas**

## Performance

- **Duration:** ~3 min
- **Completed:** 2026-06-25
- **Tasks:** 1
- **Files modified:** 1 (created)

## Accomplishments

- Created `test/handlers.test.ts` with 17 passing tests against a per-test capturing `globalThis.fetch` stub.
- All 8 handlers: asserts exact URL suffix, HTTP method, and (for POST/PUT) parsed body fields per PATTERNS.md.
- Branch tests: `getTemplate` with `draft:true`, `updateTemplate` with `update_published:true` and defined-keys-only body, `sendEmail` inline vs template branch.
- `asText` output asserted on every handler: `content[0].type === "text"` and `JSON.parse(content[0].text)` deepEquals the mocked response.
- 5 zod schemas: each has a rejection test using `z.object(SchemaConst).parse(badInput)` directly.
- Full suite: `npm test` 21/21 pass; `npm run typecheck` exits 0.
- No `SPARKPOST_API_KEY` anywhere in the file; no `new Response()` constructor used.

## Task Commits

1. **Task 1: Write handler payload + zod-validation tests for all 8 tools** - `e1749fe` (feat)

## Files Created/Modified

- `test/handlers.test.ts` — 17 tests: 8-handler request-contract assertions + 5 zod-rejection tests

## Decisions Made

- Zod v4 changed error messages to lowercase ("expected string, received number"). Used `/expected string/i` (case-insensitive) to avoid hardcoding capitalization.
- Schema rejection tests call `z.object(SchemaConst).parse()` directly rather than invoking handlers, because direct handler calls bypass the MCP SDK's validation layer (D-02).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Zod v4 error message regex mismatch**
- **Found during:** Task 1 first test run
- **Issue:** Plan examples used `/Expected string/` (capital E); Zod v4 emits "expected string, received number" (lowercase). 2 of 17 tests failed.
- **Fix:** Changed to `/expected string/i` (case-insensitive flag) for `GetTemplateSchema` and `UpdateTemplateSchema` rejection tests.
- **Files modified:** test/handlers.test.ts
- **Commit:** e1749fe

## Threat Flags

None — no new network endpoints, auth paths, or schema changes. Tests are fully isolated behind the capturing stub; no real fetch occurs.

## Known Stubs

None.

## Self-Check: PASSED

- [x] `test/handlers.test.ts` exists
- [x] Commit `e1749fe` exists (Task 1)
- [x] 17/17 handler tests pass
- [x] 21/21 full suite passes
- [x] typecheck exits 0
