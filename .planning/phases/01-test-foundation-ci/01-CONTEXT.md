# Phase 1: Test Foundation & CI - Context

**Gathered:** 2026-06-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish a test harness and CI for the **existing** 8-tool SparkPost server. Cover the HTTP request layer and every tool handler, and run typecheck + tests in CI. No new SparkPost tools or behavior change — this phase makes the current surface verifiable so Phase 2 (API expansion) lands safely.

Maps to: TEST-01 (spRequest unit tests), TEST-02 (tool-handler tests), TEST-03 (GitHub Actions).

</domain>

<decisions>
## Implementation Decisions

### Testability architecture
- **D-01:** Split `index.ts`. Extract `spRequest` + the 8 tool handlers (and the `asText` helper) into an importable module that does **not** run the key-guard or `server.connect()` at import time. `index.ts` becomes a thin entry: env key-guard → build server → connect stdio.
- **D-02:** Export the handler functions and `spRequest` so tests call them directly (chosen over MCP InMemoryTransport e2e and a separate client.ts split — smallest test code).
- **D-03:** Importing the module for tests must have no side effects (no process.exit, no stdio connect). The guard lives only in the entry path.

### Test runner
- **D-04:** Use Node's stdlib `node:test` run via `tsx`. No new test-framework dependency (rejected vitest for v1).

### HTTP mocking
- **D-05:** Mock by monkeypatching `globalThis.fetch` with a per-test stub; restore after each test. No undici MockAgent, no fetch injection.

### CI
- **D-06:** GitHub Actions at `.github/workflows/ci.yml`: `npm ci` → `npm run typecheck` → test, on push and PR.
- **D-07:** Single Node LTS (no version matrix for v1). Tests are fully mocked — CI never calls the real SparkPost API, needs no `SPARKPOST_API_KEY` secret.

### Claude's Discretion
- Test file layout (`test/` dir vs colocated `*.test.ts`) and naming.
- Exact `node:test` + `tsx` invocation and the npm `test` script (a known sharp edge — see research targets).
- Coverage breadth within TEST-02: request layer covered fully (success, non-OK with status, empty/204 body, timeout); per-tool tests assert payload shaping + zod validation for each of the 8 tools, representative depth where tools are near-identical.
- Assertion style (`node:assert/strict`).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external ADRs/specs in-repo. Requirements captured in `.planning/REQUIREMENTS.md` (TEST-01..03) and decisions above.

Research targets (not repo docs — for the researcher to investigate):
- `@modelcontextprotocol/sdk` testing surface (handler invocation; InMemoryTransport as a later option)
- `node:test` + `tsx` integration: test discovery, `--import tsx`, glob handling across Node LTS
- GitHub Actions Node setup/caching for a `tsx`-run TS project (no build step)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `spRequest(path, method, body)` — single choke point for all HTTP; ideal unit-test target (already throws `SparkPost <status>: <body>` on !ok, returns `{}` on empty).
- `asText(data)` — response wrapper; trivially assertable.
- 8 handlers + zod schemas (`z.email()`, `z.record(z.string(), z.unknown())`, etc.) — payload shaping + validation are the TEST-02 surface.

### Established Patterns
- Errors: `spRequest` throws with HTTP status embedded — tests assert on thrown message.
- Key guard currently at module top via `process.exit(1)` — the reason D-01/D-03 require the entry split.
- 30s `AbortSignal.timeout` in fetch — timeout path is a TEST-01 case (stub fetch to reject with a timeout-style error).

### Integration Points
- New: `index.ts` (entry) imports the extracted module. Tests import the module directly and monkeypatch `globalThis.fetch`.

</code_context>

<specifics>
## Specific Ideas

- Likely run shape: `node --import tsx --test` over `test/*.test.ts` (exact form deferred to research — D-04 discretion).
- spRequest test cases (TEST-01): 2xx JSON success, non-OK carries status in error, empty/204 → `{}`, fetch rejects (timeout) → propagates.
- Handler tests (TEST-02): for each tool, stub `globalThis.fetch`, call handler, assert the request path/method/body it builds and that `asText` output matches; assert zod rejects bad input (e.g. invalid email).
- CI keeps `node_modules` cached via `actions/setup-node` cache.

</specifics>

<deferred>
## Deferred Ideas

- MCP `InMemoryTransport` end-to-end smoke tests (client → server → mocked fetch) — higher fidelity, add later if regressions slip past unit tests.
- Node version matrix in CI (20/22/24).
- vitest + coverage reporting UI.
- Retry/backoff + rate-limit handling and its tests (also out of scope per REQUIREMENTS Out of Scope).

None of these block Phase 1.

</deferred>

---

*Phase: 01-test-foundation-ci*
*Context gathered: 2026-06-25*
