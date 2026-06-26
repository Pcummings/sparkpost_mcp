# Requirements: SparkPost MCP

**Defined:** 2026-06-25
**Core Value:** An AI client can drive SparkPost email operations through typed, validated MCP tools without touching the raw REST API.

## Shipped (Validated)

Already implemented in `index.ts`. Locked — changing requires explicit discussion.

### Tools

- [x] **SP-01**: `get_account` — account info + usage
- [x] **SP-02**: `list_templates` — list all templates
- [x] **SP-03**: `get_template` — get one template (optional draft)
- [x] **SP-04**: `create_template` — create a template
- [x] **SP-05**: `update_template` — update a template
- [x] **SP-06**: `send_email` — transactional send (inline or by template)
- [x] **SP-07**: `check_suppression` — check if an address is suppressed
- [x] **SP-08**: `list_sending_domains` — list verified sending domains

### Infrastructure

- [x] **INF-01**: Server exits with clear error if `SPARKPOST_API_KEY` is missing
- [x] **INF-02**: Base URL overridable via `SPARKPOST_API_BASE` (EU default)
- [x] **INF-03**: 30s request timeout; HTTP status surfaced in errors; empty/non-JSON bodies handled
- [x] **INF-04**: Email inputs validated; strict `tsconfig` + `npm run typecheck`

## v1 Requirements

Milestone v1.1 active scope. Each maps to a roadmap phase.

### Testing & CI

- [x] **TEST-01**: `spRequest` has unit tests (success, non-OK with status, empty body, timeout) with mocked `fetch`
- [x] **TEST-02**: Tool handlers have tests asserting payload shaping + zod validation against mocked SparkPost
- [x] **TEST-03**: GitHub Actions runs install → typecheck → test on push and PR

### API Coverage

- [x] **COV-01**: Webhook tools — list, create, delete
- [ ] **COV-02**: Message-events / analytics tools — event search + deliverability metrics
- [ ] **COV-03**: Recipient-list tools — list, get, create
- [ ] **COV-04**: Suppression management — add and remove entries (not just check)
- [x] **COV-05**: Subaccount tools — list, create

### Packaging

- [ ] **PKG-01**: Per-tool usage examples + MCP client config docs (Claude Desktop and generic)
- [ ] **PKG-02**: npm publish readiness — `files` allowlist, LICENSE, metadata, `prepublishOnly` typecheck

## v2 Requirements

Deferred, tracked, not in current roadmap.

### API Coverage

- **COV-06**: Inbound relay webhooks
- **COV-07**: A/B testing transmissions
- **COV-08**: Template preview/render endpoint

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multi-provider abstraction | SparkPost-specific server; no consumer needs it |
| Build/bundle step | `tsx` runs source directly |
| Separate US package | Covered by `SPARKPOST_API_BASE` override |
| Custom retry/backoff layer | Add only if rate-limit errors observed in practice |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| TEST-01 | Phase 1 | Complete |
| TEST-02 | Phase 1 | Complete |
| TEST-03 | Phase 1 | Complete |
| COV-01 | Phase 2 | Complete |
| COV-02 | Phase 2 | Pending |
| COV-03 | Phase 2 | Pending |
| COV-04 | Phase 2 | Pending |
| COV-05 | Phase 2 | Complete |
| PKG-01 | Phase 3 | Pending |
| PKG-02 | Phase 3 | Pending |

**Coverage:**

- v1 requirements: 10 total
- Mapped to phases: 10
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-25*
*Last updated: 2026-06-25 after brownfield init*
