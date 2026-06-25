---
phase: 01-test-foundation-ci
plan: "01"
subsystem: testing
tags: [node:test, tsx, zod, sparkpost, mcp, typescript, nodenext]

requires: []
provides:
  - "src/sparkpost.ts: side-effect-free module exporting spRequest, asText, 8 handlers, 5 zod schema consts"
  - "index.ts: thin entry (key-guard + server registration + stdio connect)"
  - "test/spRequest.test.ts: 4 TEST-01 spRequest unit tests"
  - "npm test script: node --import tsx --test"
  - "tsconfig.json: widened include to src/ and test/"
affects:
  - 01-02-handler-tests
  - 01-03-github-actions-ci

tech-stack:
  added: []
  patterns:
    - "Module split: side-effect-free lib (src/sparkpost.ts) + thin entry (index.ts)"
    - "getHeaders() lazy env read pattern (avoids import-time side effects)"
    - "Duck-typed mockResponse to avoid Node 24 undici Response 204 bug"
    - "globalThis.fetch monkeypatching with beforeEach/afterEach save/restore"
    - "node:test + tsx: node --import tsx --test glob"

key-files:
  created:
    - src/sparkpost.ts
    - test/spRequest.test.ts
  modified:
    - index.ts
    - package.json
    - tsconfig.json

key-decisions:
  - "getHeaders() function (not const) defers env read to call time — importable without SPARKPOST_API_KEY set"
  - "Duck-typed mockResponse (not new Response()) avoids Node 24 undici 204 throw"
  - "nodenext .js extension on all cross-file imports (tsx resolves .js -> .ts at runtime)"

patterns-established:
  - "Pattern: all test files live in test/ as *.test.ts"
  - "Pattern: fetch stubs are duck-typed plain objects cast as unknown as Response"
  - "Pattern: globalThis.fetch saved in beforeEach, restored in afterEach"

requirements-completed:
  - TEST-01

coverage:
  - id: D1
    description: "src/sparkpost.ts exports spRequest, asText, 8 handlers, 5 zod schema consts with zero import-time side effects"
    requirement: TEST-01
    verification:
      - kind: unit
        ref: "test/spRequest.test.ts (4 passing tests against imported spRequest)"
        status: pass
      - kind: unit
        ref: "grep -c process.exit src/sparkpost.ts returns 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "index.ts thin entry: key-guard + server registration + stdio connect importing from ./src/sparkpost.js"
    requirement: TEST-01
    verification:
      - kind: unit
        ref: "npm run typecheck exits 0 with index.ts in scope"
        status: pass
    human_judgment: false
  - id: D3
    description: "4 TEST-01 spRequest cases pass: 2xx JSON, 403 throws, empty/204 body, AbortError propagates"
    requirement: TEST-01
    verification:
      - kind: unit
        ref: "test/spRequest.test.ts#2xx JSON: resolves parsed body"
        status: pass
      - kind: unit
        ref: "test/spRequest.test.ts#non-OK throws with status in message"
        status: pass
      - kind: unit
        ref: "test/spRequest.test.ts#empty/204 body resolves {}"
        status: pass
      - kind: unit
        ref: "test/spRequest.test.ts#fetch rejects (AbortError) propagates"
        status: pass
    human_judgment: false
  - id: D4
    description: "npm test script and widened tsconfig.json include (src/**/*.ts, test/**/*.ts) in place"
    requirement: TEST-01
    verification:
      - kind: unit
        ref: "npm test exits 0 (4 pass, 0 fail)"
        status: pass
      - kind: unit
        ref: "npm run typecheck exits 0 with src/ and test/ in scope"
        status: pass
    human_judgment: false

duration: 5min
completed: "2026-06-25"
status: complete
---

# Phase 01 Plan 01: Extract Module + spRequest Tests Summary

**node:test harness wired via tsx, src/sparkpost.ts extracted as side-effect-free module, 4 TEST-01 spRequest cases all passing**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-06-25T15:51:00Z
- **Completed:** 2026-06-25T15:54:22Z
- **Tasks:** 2
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments

- Extracted `src/sparkpost.ts`: importable with zero side effects — no key-guard, no process.exit, no McpServer, no server.connect. `getHeaders()` defers env read to call time.
- Rewrote `index.ts` as thin entry: key-guard + McpServer build + 8 tool registrations importing from `./src/sparkpost.js` + stdio connect.
- Wrote `test/spRequest.test.ts` with 4 TEST-01 cases, duck-typed mockResponse (avoids Node 24 undici 204 bug), and fetch save/restore.
- Added `npm test` script (`node --import tsx --test "test/**/*.test.ts"`) and widened `tsconfig.json` include to cover `src/` and `test/`.
- All 4 tests pass; `npm run typecheck` exits 0.

## Task Commits

1. **Task 1: Extract src/sparkpost.ts and rewrite index.ts** - `4a0ebda` (feat)
2. **Task 2: Wire node:test+tsx harness and write spRequest tests** - `e47bee7` (feat)

## Files Created/Modified

- `src/sparkpost.ts` — side-effect-free module: spRequest, asText, 8 handlers, 5 zod schema consts, getHeaders()
- `index.ts` — thin entry: key-guard + server + 8 tool registrations + stdio connect
- `test/spRequest.test.ts` — 4 TEST-01 spRequest unit tests
- `package.json` — added `test` script
- `tsconfig.json` — widened `include` to `["index.ts", "src/**/*.ts", "test/**/*.ts"]`

## Decisions Made

- `getHeaders()` as function (not const): defers `process.env.SPARKPOST_API_KEY` read to call time so importing the module never requires the key to be set (D-03).
- Duck-typed `mockResponse` (`{ ok, status, statusText, text: async () => body } as unknown as Response`): avoids Node 24 undici `Response` constructor throwing on status 204.
- `.js` extension on all imports from `src/sparkpost.ts`: required by `nodenext` moduleResolution; tsx resolves `.js` to `.ts` at runtime.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced. `src/sparkpost.ts` reads `SPARKPOST_API_KEY` only inside `getHeaders()` at call time; tests never set the key (T-01-IDISC mitigated).

## Known Stubs

None — no placeholder data, no wired-but-empty props.

## Next Phase Readiness

- `src/sparkpost.ts` is importable with the full handler + schema surface; `01-02` (handler tests) can now import and test all 8 handlers directly.
- The `node:test + tsx` harness is in place; `01-03` (CI) can wire `npm test` and `npm run typecheck` into GitHub Actions.
- No blockers.

---
*Phase: 01-test-foundation-ci*
*Completed: 2026-06-25*

## Self-Check: PASSED

- [x] `src/sparkpost.ts` exists
- [x] `test/spRequest.test.ts` exists
- [x] Commit `4a0ebda` exists (Task 1)
- [x] Commit `e47bee7` exists (Task 2)
- [x] 4 tests pass, 0 fail
- [x] typecheck exits 0
