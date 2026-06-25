---
phase: 01
slug: test-foundation-ci
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-25
---

# Phase 01 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `01-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (Node stdlib, run via `tsx`) — no new dependency |
| **Config file** | none — `node:test` needs no config |
| **Quick run command** | `node --import tsx --test "test/spRequest.test.ts"` |
| **Full suite command** | `node --import tsx --test "test/**/*.test.ts"` (npm: `npm test`) |
| **Estimated runtime** | ~2–4 seconds (fully mocked, no network) |

---

## Sampling Rate

- **After every task commit:** Run `node --import tsx --test "test/spRequest.test.ts"` (fast, covers TEST-01)
- **After every plan wave:** Run `npm test` (full suite)
- **Before `/gsd-verify-work`:** `npm run typecheck && npm test` must be green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

> Plans not yet written — mapped at plan granularity from RESEARCH § Phase Requirements → Test Map. Executor refines to per-task IDs.

| Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01 | 1 | TEST-01 | T-01-01 | No real API key in test env; `globalThis.fetch` monkeypatched, never reaches SparkPost | unit | `node --import tsx --test "test/spRequest.test.ts"` | ❌ W0 | ⬜ pending |
| 01-02 | 2 | TEST-02 | T-01-01 | Same — handlers tested against stubbed `fetch`; zod rejects invalid input | unit | `node --import tsx --test "test/handlers.test.ts"` | ❌ W0 | ⬜ pending |
| 01-03 | 2 | TEST-03 | T-01-02 | No `SPARKPOST_API_KEY` secret in CI; tests fully mocked | smoke | `npm run typecheck && npm test` (in CI) | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Behaviors to sample (Nyquist):**
- TEST-01: `spRequest` — 2xx JSON success, non-OK throws `SparkPost <status>: <body>`, empty/204 → `{}`, fetch-reject/timeout propagates. (Direct unit, not inferable — must be held by explicit cases per edge.)
- TEST-02: each of 8 handlers builds correct URL/method/body; `asText` wraps to `{ content: [{ type: "text", text }] }`; zod schemas reject bad input (e.g. invalid email). (Direct unit; representative depth where handlers are near-identical.)
- TEST-03: CI runs typecheck + tests on push/PR, green on `main`. (Smoke — observable via Actions run status.)

---

## Wave 0 Requirements

- [ ] `src/sparkpost.ts` — extracted module (`spRequest` + `asText` + 8 handlers + `getHeaders()`); enables all tests, no side effects at import
- [ ] `test/spRequest.test.ts` — stubs + 4 cases for TEST-01
- [ ] `test/handlers.test.ts` — 8-tool payload/zod cases for TEST-02
- [ ] `.github/workflows/ci.yml` — TEST-03
- [ ] `tsconfig.json` — widen `include` to `["index.ts", "src/**/*.ts", "test/**/*.ts"]`
- [ ] `package.json` — add `"test": "node --import tsx --test \"test/**/*.test.ts\""` script

*No framework install needed — `node:test` + `tsx` already present.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CI is green on `main` in GitHub | TEST-03 | Requires a push to GitHub + Actions run; not locally assertable | Push branch, open PR, confirm the CI check passes in the Actions tab |

*All request-layer and handler behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
