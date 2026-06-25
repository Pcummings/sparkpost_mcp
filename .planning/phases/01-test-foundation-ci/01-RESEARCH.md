# Phase 01: Test Foundation & CI - Research

**Researched:** 2026-06-25
**Domain:** Node.js stdlib test runner, TypeScript module splitting, GitHub Actions
**Confidence:** HIGH — all critical commands verified by execution on this machine (Node 24.18.0, tsx 4.22.4)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Split `index.ts`. Extract `spRequest` + the 8 tool handlers (and the `asText` helper) into an importable module that does **not** run the key-guard or `server.connect()` at import time. `index.ts` becomes a thin entry: env key-guard → build server → connect stdio.
- **D-02:** Export the handler functions and `spRequest` so tests call them directly (chosen over MCP InMemoryTransport e2e and a separate client.ts split — smallest test code).
- **D-03:** Importing the module for tests must have no side effects (no process.exit, no stdio connect). The guard lives only in the entry path.
- **D-04:** Use Node's stdlib `node:test` run via `tsx`. No new test-framework dependency (rejected vitest for v1).
- **D-05:** Mock by monkeypatching `globalThis.fetch` with a per-test stub; restore after each test. No undici MockAgent, no fetch injection.
- **D-06:** GitHub Actions at `.github/workflows/ci.yml`: `npm ci` → `npm run typecheck` → test, on push and PR.
- **D-07:** Single Node LTS (no version matrix for v1). Tests are fully mocked — CI never calls the real SparkPost API, needs no `SPARKPOST_API_KEY` secret.

### Claude's Discretion
- Test file layout (`test/` dir vs colocated `*.test.ts`) and naming.
- Exact `node:test` + `tsx` invocation and the npm `test` script.
- Coverage breadth within TEST-02: request layer covered fully (success, non-OK with status, empty/204 body, timeout); per-tool tests assert payload shaping + zod validation for each of the 8 tools, representative depth where tools are near-identical.
- Assertion style (`node:assert/strict`).

### Deferred Ideas (OUT OF SCOPE)
- MCP `InMemoryTransport` end-to-end smoke tests — add later if regressions slip past unit tests.
- Node version matrix in CI (20/22/24).
- vitest + coverage reporting UI.
- Retry/backoff + rate-limit handling and its tests.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TEST-01 | `spRequest` unit tests (success, non-OK with status, empty body, timeout) with mocked `fetch` | All 4 cases verified working; exact patterns in Code Examples |
| TEST-02 | Tool handler tests asserting payload shaping + zod validation against mocked SparkPost | Handler export pattern verified; zod v4 parse/error shape documented |
| TEST-03 | GitHub Actions runs install → typecheck → test on push and PR | Exact workflow YAML documented; no secrets needed confirmed |
</phase_requirements>

---

## Summary

This phase requires three concrete deliverables: (1) splitting `index.ts` into a side-effect-free importable module, (2) writing tests using `node:test` + `tsx` with `globalThis.fetch` monkeypatching, and (3) a GitHub Actions workflow. All critical commands have been verified by execution on this machine.

The sharpest edge — exact `node:test` + `tsx` invocation — is fully resolved. The working command is `node --import tsx --test "test/**/*.test.ts"`. With tsx loaded as an `--import` hook, Node's test runner discovers `.ts` files automatically (not just `.js`), and each test file runs in its own child process (process isolation), so fetch mocks do not leak across files. Within a file, `beforeEach`/`afterEach` restore is still required.

The `Response` constructor in Node 24's built-in undici rejects status 204 in test mocks. Use a plain duck-typed object (`{ ok, status, statusText, text: async () => body }`) cast to `Response` for all mock responses. This pattern passes tsc strict checking and all tests.

**Primary recommendation:** Use `node --import tsx --test "test/**/*.test.ts"` as the npm `test` script. Extract handlers + `spRequest` + `asText` into `src/sparkpost.ts` (no side effects at import). Test files in `test/`. Update `tsconfig.json` include to `["index.ts", "src/**/*.ts", "test/**/*.ts"]`.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| HTTP request layer (`spRequest`) | API/Backend module | — | Single choke point for all outbound calls; isolated in `src/sparkpost.ts` |
| Tool handlers (payload shaping) | API/Backend module | — | Business logic; exported as plain async functions |
| MCP server wiring | Entry point (`index.ts`) | — | Side effects (stdio, key-guard) live here only |
| Zod validation | API/Backend module | — | Schemas colocated with handlers in extracted module |
| GitHub Actions CI | CI/CD | — | Typecheck + test gate on every push/PR |

---

## Standard Stack

### Core (no new dependencies needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:test` | Built into Node 22+ | Test runner | Zero install; D-04 locked |
| `node:assert/strict` | Built into Node | Assertions | Stdlib; no config needed |
| `tsx` | 4.22.4 (already installed) | TypeScript loader for node:test | D-04 locked |

### No new packages required

The entire test harness uses `node:test` (stdlib) + `tsx` (already a devDependency). The package legitimacy audit is not needed — no new packages are installed.

**Installation:** None. `tsx` is already in `devDependencies`.

**npm `test` script to add to `package.json`:**
```json
"test": "node --import tsx --test \"test/**/*.test.ts\""
```

---

## Architecture Patterns

### System Architecture Diagram

```
index.ts (entry — side effects here)
  ├─ reads SPARKPOST_API_KEY → process.exit(1) if missing
  ├─ imports src/sparkpost.ts
  ├─ builds McpServer, registers tools via server.tool()
  └─ server.connect(StdioServerTransport)

src/sparkpost.ts (imported by index.ts AND by tests — NO side effects)
  ├─ export async function spRequest(path, method, body)
  ├─ export const asText = (data) => {...}
  └─ export handler functions: getAccount, listTemplates, getTemplate,
       createTemplate, updateTemplate, sendEmail, checkSuppression, listSendingDomains

test/
  ├─ spRequest.test.ts   (TEST-01: 4 cases)
  └─ handlers.test.ts    (TEST-02: 8 tools × payload shaping + zod)

.github/workflows/ci.yml  (TEST-03)
```

### Recommended Project Structure
```
src/
└── sparkpost.ts         # extracted module: spRequest + asText + handlers
test/
├── spRequest.test.ts    # TEST-01: HTTP layer
└── handlers.test.ts     # TEST-02: tool handlers
index.ts                 # thin entry: guard → register tools → connect
.github/
└── workflows/
    └── ci.yml           # TEST-03
```

### Pattern 1: Extracted Module Shape (D-01/D-03)

The key constraint: `API_KEY` must NOT be read at module top with a `process.exit` guard. Move the guard to `index.ts`. In `src/sparkpost.ts`, read `process.env.SPARKPOST_API_KEY` inside `spRequest` (lazy) or accept it as a closure at registration time. Laziest: read env inside the function — it's only called at runtime anyway.

```typescript
// src/sparkpost.ts — NO side effects at import time
import { z } from "zod";

const API_BASE = process.env.SPARKPOST_API_BASE ?? "https://api.eu.sparkpost.com/api/v1";

function getHeaders() {
  return {
    "Authorization": process.env.SPARKPOST_API_KEY ?? "",
    "Content-Type": "application/json",
  };
}

export async function spRequest(path: string, method = "GET", body?: unknown) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: getHeaders(),
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`SparkPost ${res.status} ${res.statusText}: ${raw || "(no body)"}`);
  return raw ? JSON.parse(raw) : {};
}

export const asText = (data: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
});

export async function getAccount() {
  return asText(await spRequest("/account?include=usage"));
}

// ... remaining 7 handlers exported similarly
```

```typescript
// index.ts — thin entry
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { spRequest, asText, getAccount, listTemplates /* ... */ } from "./src/sparkpost.js";

const API_KEY = process.env.SPARKPOST_API_KEY;
if (!API_KEY) {
  console.error("Missing required env var SPARKPOST_API_KEY");
  process.exit(1);
}

const server = new McpServer({ name: "sparkpost-eu", version: "1.0.0" });

server.tool("get_account", "Get SparkPost EU account info and usage", {}, getAccount);
// ... remaining tools
```

**Note on import extension:** `tsconfig.json` uses `"module": "nodenext"` + `"moduleResolution": "nodenext"`. Import paths in `.ts` source files must use `.js` extension (e.g., `import ... from "./src/sparkpost.js"`) — this is the nodenext convention. tsx handles the `.js` → `.ts` resolution at runtime.

### Pattern 2: Mock Response Helper (D-05)

`new Response("", { status: 204 })` throws in Node 24's built-in undici. Use a duck-typed object instead:

```typescript
// test helper — put in test/helpers.ts or inline
function mockResponse(body: string, status: number, statusText = "OK"): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    text: async () => body,
  } as unknown as Response;
}
```

### Pattern 3: node:test fetch mocking (D-05)

```typescript
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

let savedFetch: typeof globalThis.fetch;
beforeEach(() => { savedFetch = globalThis.fetch; });
afterEach(() => { globalThis.fetch = savedFetch; });

test("stub fetch", async () => {
  globalThis.fetch = async (_url, _init) =>
    mockResponse('{"results":{}}', 200);
  // ... call handler or spRequest
});
```

### Anti-Patterns to Avoid

- **`new Response("", { status: 204 })`:** Node 24 undici rejects status 204 in Response constructor. Use the duck-typed `mockResponse` helper.
- **`node --import tsx` from outside the project directory:** tsx must be resolvable from `node_modules`. Always run via `npm test` (which sets `NODE_PATH`) or from the project root.
- **`globalThis.fetch = stub` without restore:** Leaks within the test file. Use `beforeEach`/`afterEach`. Between files it's isolated (each file runs in its own process on Node 22+).
- **`"include": ["index.ts"]` in tsconfig:** Keeps test files outside tsc's view — they're transpiled by tsx at runtime but not type-checked by `npm run typecheck`. Widen to include `test/` and `src/`.
- **Registering handlers inside exported functions:** The handler callbacks passed to `server.tool()` are plain `async (args) => CallToolResult` functions. Export them directly. Do NOT wrap in a factory or class — D-02 says call directly.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Test assertions | custom assertion library | `node:assert/strict` | stdlib, deep equality built-in |
| Async error assertion | manual try/catch | `assert.rejects(fn, matcher)` | built-in, handles async throws cleanly |
| Test lifecycle | manual setup/teardown arrays | `beforeEach`/`afterEach` from `node:test` | stdlib, runs per test |
| HTTP mock library | undici MockAgent or nock | `globalThis.fetch = stub` + restore | D-05 locked; 3 lines per test |

---

## Common Pitfalls

### Pitfall 1: `Response` constructor rejects status 204
**What goes wrong:** `new Response("", { status: 204, statusText: "No Content" })` throws `TypeError: Response constructor: Invalid response status code 204` in Node 24 (undici enforcement of Fetch spec §4.2 which restricts null-body statuses).
**Why it happens:** Node's built-in undici strictly enforces the Fetch Living Standard: 204/205/304 bodies must be `null`. The `Response` constructor enforces this.
**How to avoid:** Use the duck-typed `mockResponse(body, status, statusText)` helper above — it bypasses the constructor entirely.
**Warning signs:** `TypeError: Response constructor: Invalid response status code 204` in test output.

### Pitfall 2: `node:test` default discovery does NOT include `.ts` without tsx
**What goes wrong:** Running `node --test` (no `--import tsx`) with a `test/` directory containing `.ts` files will skip them. The default discovery patterns are `**/*.test.{js,cjs,mjs}` — no `.ts`.
**How to avoid:** Always use `node --import tsx --test`. With tsx loaded, Node's discovery DOES pick up `.ts` test files (verified on this machine). Alternatively pass explicit paths.
**Warning signs:** `ℹ tests 0` with no error when running from a dir containing only `.ts` test files.

### Pitfall 3: `tsconfig.json` `include` misses test + src files
**What goes wrong:** `tsc --noEmit` only typechecks `index.ts` if `include` is not widened. Test files and the extracted `src/sparkpost.ts` are silently skipped. Type errors in tests don't surface in CI.
**How to avoid:** Update `tsconfig.json` `include` to `["index.ts", "src/**/*.ts", "test/**/*.ts"]`. Verified: `tsc --noEmit` passes cleanly with this change.
**Warning signs:** `npm run typecheck` exits 0 even when test files have type errors.

### Pitfall 4: `import` extension in `nodenext` mode
**What goes wrong:** `import { spRequest } from "./src/sparkpost"` (no extension) fails at runtime with `nodenext` module resolution. Node ESM requires explicit extensions.
**How to avoid:** Use `import { spRequest } from "./src/sparkpost.js"` in `.ts` source. tsx resolves `.js` → `.ts` at runtime. `tsc --noEmit` with `nodenext` also enforces this.

### Pitfall 5: `SPARKPOST_API_KEY` read at module top in extracted module
**What goes wrong:** If `src/sparkpost.ts` reads `process.env.SPARKPOST_API_KEY` into a const at module top and uses it in the `headers` object, tests that import without setting the env var will have `Authorization: undefined` in headers. Not a hard failure but silently wrong.
**How to avoid:** Read env inside the function (`getHeaders()` helper, or inline in `spRequest`). For tests, it doesn't matter since fetch is mocked, but it's the correct pattern for D-03.

---

## Code Examples

### TEST-01: All 4 spRequest cases (verified working)

```typescript
// test/spRequest.test.ts
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { spRequest } from "../src/sparkpost.js";

function mockResponse(body: string, status: number, statusText = "OK"): Response {
  return { ok: status >= 200 && status < 300, status, statusText, text: async () => body } as unknown as Response;
}

let savedFetch: typeof globalThis.fetch;
beforeEach(() => { savedFetch = globalThis.fetch; });
afterEach(() => { globalThis.fetch = savedFetch; });

test("2xx: returns parsed JSON", async () => {
  globalThis.fetch = async () => mockResponse('{"results":{"balance":100}}', 200);
  const data = await spRequest("/account");
  assert.deepEqual(data, { results: { balance: 100 } });
});

test("non-OK: throws SparkPost <status>: <body>", async () => {
  globalThis.fetch = async () => mockResponse('{"errors":[{"message":"Forbidden"}]}', 403, "Forbidden");
  await assert.rejects(
    () => spRequest("/account"),
    (err: Error) => { assert.match(err.message, /^SparkPost 403 Forbidden:/); return true; }
  );
});

test("empty body (200 with no content): returns {}", async () => {
  globalThis.fetch = async () => mockResponse("", 200, "OK");
  const data = await spRequest("/account");
  assert.deepEqual(data, {});
});

test("fetch rejects (AbortError/timeout): propagates", async () => {
  globalThis.fetch = async () => { throw new DOMException("The operation was aborted", "AbortError"); };
  await assert.rejects(() => spRequest("/account"), { name: "AbortError" });
});
```

### TEST-02: Handler test pattern (example: create_template)

```typescript
// test/handlers.test.ts (excerpt)
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createTemplate } from "../src/sparkpost.js";
import { z } from "zod";

function mockResponse(body: string, status: number, statusText = "OK"): Response {
  return { ok: status >= 200 && status < 300, status, statusText, text: async () => body } as unknown as Response;
}

let savedFetch: typeof globalThis.fetch;
let capturedRequest: { url: string; init: RequestInit } | null = null;

beforeEach(() => {
  savedFetch = globalThis.fetch;
  capturedRequest = null;
  globalThis.fetch = async (url: RequestInfo | URL, init?: RequestInit) => {
    capturedRequest = { url: String(url), init: init ?? {} };
    return mockResponse('{"results":{"id":"tpl-1"}}', 200);
  };
});
afterEach(() => { globalThis.fetch = savedFetch; });

test("createTemplate: builds correct POST to /templates", async () => {
  const result = await createTemplate({
    id: "tpl-1",
    name: "Test",
    subject: "Hello",
    html: "<p>hi</p>",
    from_email: "sender@example.com",
  });

  // Assert request shape
  assert.ok(capturedRequest?.url.endsWith("/templates"));
  assert.equal(capturedRequest?.init.method, "POST");
  const body = JSON.parse(capturedRequest?.init.body as string);
  assert.equal(body.id, "tpl-1");
  assert.equal(body.content.from.email, "sender@example.com");

  // Assert asText output
  assert.equal(result.content[0].type, "text");
  const parsed = JSON.parse(result.content[0].text);
  assert.deepEqual(parsed, { results: { id: "tpl-1" } });
});

test("createTemplate: zod rejects invalid from_email", async () => {
  // Test the zod schema directly (bypass handler — schema is exported separately or inline)
  const schema = z.object({ from_email: z.email() });
  assert.throws(
    () => schema.parse({ from_email: "not-an-email" }),
    /Invalid email address/
  );
});
```

**Note:** For the zod validation test, either: (a) export the zod schemas from `src/sparkpost.ts` alongside the handlers, or (b) test validation by calling the handler with invalid args and asserting it throws. Option (a) is cleaner. The MCP SDK validates schemas before calling handlers — in direct tests (D-02), the handler is called directly so SDK validation is bypassed. Testing the zod schema directly is the correct approach.

### Handler extraction pattern (all 8 tools)

The 8 handlers in `index.ts` follow one of two shapes:

**No-arg handlers** (`get_account`, `list_templates`, `list_sending_domains`):
```typescript
export async function getAccount() {
  return asText(await spRequest("/account?include=usage"));
}
```

**Parameterized handlers** (remaining 5 tools):
The args object is typed by zod shape. Export the handler as a plain async function:
```typescript
export async function getTemplate({ template_id, draft }: { template_id: string; draft?: boolean }) {
  return asText(await spRequest(`/templates/${template_id}${draft ? "?draft=true" : ""}`));
}
```

In `index.ts`, register as: `server.tool("get_template", "...", { template_id: z.string(), draft: z.boolean().optional().default(false) }, getTemplate);`

The zod schemas should be exported from `src/sparkpost.ts` for use in both `index.ts` (registration) and test files (validation assertions):
```typescript
export const GetTemplateSchema = { template_id: z.string(), draft: z.boolean().optional().default(false) };
```

### GitHub Actions CI (TEST-03)

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: "npm"
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
```

**Notes:**
- Node 22 is Active LTS as of June 2026. Node 24 is current stable. Either works; 22 is the safer LTS pin for CI.
- `cache: "npm"` caches `~/.npm` via `actions/setup-node`. No additional caching config needed.
- No `SPARKPOST_API_KEY` secret required — tests monkeypatch `globalThis.fetch`.
- `on: push` + `on: pull_request` (no branch filter) runs on all branches. Add `branches: [main]` to push if desired, but the CONTEXT says push + PR which implies all branches.

---

## Validation Architecture

> `nyquist_validation: true` in `.planning/config.json`.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:test` (Node 24 stdlib) |
| Config file | none — no config file needed |
| Quick run command | `node --import tsx --test "test/spRequest.test.ts"` |
| Full suite command | `node --import tsx --test "test/**/*.test.ts"` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TEST-01 | `spRequest` 2xx JSON success | unit | `node --import tsx --test "test/spRequest.test.ts"` | Wave 0 |
| TEST-01 | `spRequest` non-OK throws with status | unit | same | Wave 0 |
| TEST-01 | `spRequest` empty/204 body → `{}` | unit | same | Wave 0 |
| TEST-01 | `spRequest` fetch rejects → propagates | unit | same | Wave 0 |
| TEST-02 | Each of 8 handlers builds correct URL/method/body | unit | `node --import tsx --test "test/handlers.test.ts"` | Wave 0 |
| TEST-02 | `asText` wraps result in `{ content: [{ type: "text", text: ... }] }` | unit | same | Wave 0 |
| TEST-02 | Zod schemas reject invalid email inputs | unit | same | Wave 0 |
| TEST-03 | CI workflow exists + passes on push/PR | smoke | `gh act push` or verify via GitHub UI | Wave 0 |

### Sampling Rate
- **Per task commit:** `node --import tsx --test "test/spRequest.test.ts"` (fast, covers TEST-01)
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** `npm run typecheck && npm test` before `/gsd-verify-work`

### Wave 0 Gaps (files that must be created)
- [ ] `src/sparkpost.ts` — extracted module (no tests of its own; enables tests)
- [ ] `test/spRequest.test.ts` — covers TEST-01 (4 cases)
- [ ] `test/handlers.test.ts` — covers TEST-02 (8 tools)
- [ ] `.github/workflows/ci.yml` — covers TEST-03
- [ ] `tsconfig.json` update — widen `include` to cover `src/` and `test/`
- [ ] `package.json` update — add `"test"` script

---

## Security Domain

> `security_enforcement: true`, `security_asvs_level: 1` in config.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | n/a (test-only phase; no new auth paths) |
| V3 Session Management | no | n/a |
| V4 Access Control | no | n/a |
| V5 Input Validation | yes | `node:assert/strict` validates shapes; zod schemas verified via direct parse |
| V6 Cryptography | no | n/a |

**Threat patterns for this phase:**

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Hardcoded API key in test files | Information Disclosure | Never set `SPARKPOST_API_KEY` in test env; monkeypatch `globalThis.fetch` instead |
| Secret leak in CI logs | Information Disclosure | No `SPARKPOST_API_KEY` secret in Actions; confirmed by D-07 |
| Test files touching real SparkPost API | Tampering | All tests fully mocked — `globalThis.fetch` replaced before any call |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Test runner + CI | ✓ | 24.18.0 (local), 22 LTS (CI) | — |
| tsx | `node --import tsx` | ✓ | 4.22.4 (already devDep) | — |
| TypeScript | `tsc --noEmit` | ✓ | 6.0.x (already devDep) | — |
| GitHub Actions | TEST-03 | ✓ (repo needs `.github/` dir) | N/A | — |

**Missing dependencies with no fallback:** None.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Node 22 is Active LTS as of June 2026 | CI workflow | Could use a non-LTS — low risk; 22.x is in long-term support |
| A2 | `actions/checkout@v4` + `actions/setup-node@v4` are current stable | CI workflow | If a v5 exists, v4 still works — low risk |
| A3 | `on: push` (no branch filter) is acceptable per D-06 intent | CI workflow | May trigger on feature branches unnecessarily — negligible |

**All execution-critical claims (Node test command, mock patterns, tsconfig change) were verified by running commands on this machine.**

---

## Sources

### Primary (VERIFIED by execution on this machine — HIGH confidence)
- Node 24.18.0 + tsx 4.22.4 local execution — `node --import tsx --test` command variants
- `node:test` and `node:assert/strict` stdlib — all test patterns run green on this machine
- `tsc --noEmit` with widened `include` — verified passes cleanly
- Mock response duck-typing pattern — verified 204 `Response` constructor issue and workaround
- File isolation behavior (Node 22+ child_process per test file) — verified with two-file test

### Secondary (CITED from codebase inspection — HIGH confidence)
- `index.ts` — full handler signatures, `spRequest` error format, `asText` shape, zod schemas
- `package.json` — existing scripts, devDependencies (tsx 4.22.4, tsc 6.0.x, @types/node ^26)
- `tsconfig.json` — `"module": "nodenext"`, `"include": ["index.ts"]`
- `@modelcontextprotocol/sdk` dist types — `ToolCallback` and `CallToolResult` type shapes

### Tertiary (ASSUMED — LOW confidence)
- None: all claims verified by execution or codebase inspection.

---

## Metadata

**Confidence breakdown:**
- Test runner invocation: HIGH — executed and verified all variants
- Mock patterns: HIGH — executed; 204 gotcha reproduced and fixed
- Module split: HIGH — grounded in actual `index.ts` code
- CI workflow: HIGH — standard GitHub Actions config; no novel features
- tsconfig fix: HIGH — verified `tsc --noEmit` passes with widened include

**Research date:** 2026-06-25
**Valid until:** 2026-12-25 (stable stack — Node LTS cycle, tsx semver, GH Actions)
