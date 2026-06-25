# Phase 1: Test Foundation & CI - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-25
**Phase:** 01-test-foundation-ci
**Areas discussed:** Testability architecture, Test runner, HTTP mocking, CI scope

---

## Testability architecture

| Option | Description | Selected |
|--------|-------------|----------|
| Extract & export fns | Move spRequest + handlers into a module, export, unit-test directly with mocked fetch | ✓ |
| InMemoryTransport e2e | Connect MCP client over in-memory transport, call tools end-to-end | |
| client.ts core split | Extract typed SparkPost client; handlers stay thin wrappers | |

**User's choice:** Extract & export fns
**Notes:** All options require splitting `index.ts` so the key-guard/connect don't run at import; chosen option minimizes test code.

---

## Test runner

| Option | Description | Selected |
|--------|-------------|----------|
| node:test | Node stdlib runner via tsx, zero new deps | ✓ |
| vitest | Richer DX, adds dev dependency + config | |

**User's choice:** node:test
**Notes:** Ponytail — stdlib over a new dependency.

---

## HTTP mocking

| Option | Description | Selected |
|--------|-------------|----------|
| Monkeypatch global fetch | Swap globalThis.fetch per test | ✓ |
| undici MockAgent | Intercept at HTTP layer via undici | |
| Inject fetch | Pass fetch as a dependency | |

**User's choice:** Monkeypatch global fetch
**Notes:** Simplest, no deps; restore after each test.

---

## CI scope

| Option | Description | Selected |
|--------|-------------|----------|
| typecheck+test, 1 Node | npm ci → typecheck → test on push+PR, single Node LTS, no real API | ✓ |
| + Node matrix | Same across multiple Node versions | |
| typecheck only | CI runs typecheck only | |

**User's choice:** typecheck+test, 1 Node
**Notes:** Tests fully mocked → no SparkPost secret needed in CI.

## Claude's Discretion

- Test file layout/naming, exact node:test+tsx invocation, npm `test` script, assertion style, per-tool coverage depth.

## Deferred Ideas

- InMemoryTransport e2e smoke tests; Node version matrix; vitest + coverage UI; retry/backoff tests.
