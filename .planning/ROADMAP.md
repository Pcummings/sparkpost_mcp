# Roadmap: SparkPost MCP

## Overview

Starting from a hardened 8-tool server, milestone v1.1 makes it safe to grow and ready to share: first a test+CI safety net, then a wider SparkPost API surface, then npm publish readiness. Tests come first so the coverage expansion in Phase 2 lands on a verified request layer.

## Phases

- [ ] **Phase 1: Test Foundation & CI** - Lock in current behavior with tests and automated checks
- [ ] **Phase 2: Expand API Coverage** - Webhooks, events/analytics, lists, suppression mgmt, subaccounts
- [ ] **Phase 3: Publish & Docs** - npm publish readiness and usage documentation

## Phase Details

### Phase 1: Test Foundation & CI

**Goal**: The existing request layer and tool handlers are covered by tests that run in CI, so future changes can't silently break shipped tools.
**Depends on**: Nothing (first phase)
**Requirements**: TEST-01, TEST-02, TEST-03
**Success Criteria** (what must be TRUE):

  1. `spRequest` is tested for success, non-OK (status in error), empty body, and timeout with mocked `fetch`
  2. Each shipped tool has a test asserting its payload shaping and zod validation
  3. GitHub Actions runs typecheck + tests on every push and PR, green on `main`

**Plans**: 1/3 plans executed

Plans:
**Wave 1**

- [x] 01-01-PLAN.md — Extract `src/sparkpost.ts` + thin `index.ts`; node:test/tsx harness; `spRequest` unit tests (TEST-01)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 01-02-PLAN.md — Tool-handler tests: payload shaping + zod validation for the 8 shipped tools (TEST-02)
- [ ] 01-03-PLAN.md — GitHub Actions CI: install → typecheck → test on push/PR (TEST-03)

### Phase 2: Expand API Coverage

**Goal**: The server exposes the next tier of SparkPost operations, each typed, validated, and tested like the existing tools.
**Depends on**: Phase 1
**Requirements**: COV-01, COV-02, COV-03, COV-04, COV-05
**Success Criteria** (what must be TRUE):

  1. New tools exist for webhooks (list/create/delete) and subaccounts (list/create)
  2. New tools exist for message events and deliverability metrics
  3. New tools exist for recipient lists (list/get/create) and suppression add/remove
  4. Every new tool has tests and passes typecheck

**Plans**: 3 plans

Plans:

- [ ] 02-01: Webhook + subaccount tools
- [ ] 02-02: Message-events + metrics/reports tools
- [ ] 02-03: Recipient-list + suppression add/remove tools

### Phase 3: Publish & Docs

**Goal**: The server is documented and ready to publish to npm so others can install and configure it in an MCP client.
**Depends on**: Phase 2
**Requirements**: PKG-01, PKG-02
**Success Criteria** (what must be TRUE):

  1. README documents every tool with a usage example and shows MCP client config
  2. `package.json` has `files` allowlist, LICENSE, and `prepublishOnly` typecheck
  3. `npm publish --dry-run` produces a clean, minimal tarball

**Plans**: 2 plans

Plans:

- [ ] 03-01: npm publish readiness (LICENSE, files, metadata, prepublishOnly)
- [ ] 03-02: Per-tool usage examples + MCP client config docs

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Test Foundation & CI | 1/3 | In Progress|  |
| 2. Expand API Coverage | 0/3 | Not started | - |
| 3. Publish & Docs | 0/2 | Not started | - |
