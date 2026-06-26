# SparkPost MCP

## What This Is

An MCP (Model Context Protocol) server that exposes the SparkPost (EU) email API as tools, so an AI client can manage account info, email templates, transactional sends, suppression, and sending domains. Single-file TypeScript server run via `tsx` over stdio.

## Core Value

An AI client can drive SparkPost email operations (templates + sends) through typed, validated MCP tools without touching the raw REST API.

## Requirements

### Validated

<!-- Shipped and confirmed working in index.ts. -->

- ✓ 8 SparkPost tools: account, template CRUD (list/get/create/update), send, suppression check, sending-domains list — v1.0
- ✓ Startup hardening: required-key guard, region-overridable base URL, 30s fetch timeout, email validation, defensive response parsing — v1.0
- ✓ Type safety: strict `tsconfig`, `npm run typecheck` — v1.0
- ✓ Test coverage + CI: `node:test`+`tsx` unit tests for `spRequest` (4 cases) + all 8 handlers and zod schemas (21 tests total), GitHub Actions typecheck+test on push/PR — v1.1 (Phase 1)
- ✓ Expanded API coverage: 12 new typed/zod-validated tools — webhooks (list/create/delete), subaccounts (list/create), message events search, deliverability metrics, recipient lists (list/get/create), suppression add/remove; 23 new tests (44 total). COV-01..05 — v1.1 (Phase 2)

### Active

<!-- Milestone v1.1 scope. -->

- [ ] Publish readiness (npm metadata, LICENSE, usage examples, MCP client docs)

### Out of Scope

- Multi-provider abstraction (Mailgun/SES/etc.) — this is a SparkPost-specific server; abstraction adds complexity with no current consumer
- A build/bundling step — `tsx` runs the source directly; no need to emit JS until/unless a `node`-only runtime is required
- US-region as a separate package — covered by the `SPARKPOST_API_BASE` env override

## Context

- Brownfield: started from a working 127-line `index.ts` (MCP SDK + zod v4, stdio transport).
- Hardening pass already applied (see Validated). Region defaults to EU; `SPARKPOST_API_BASE` overrides for US.
- No automated tests yet — the single biggest gap before expanding the tool surface.
- GSD research subagents were skipped at init (well-understood REST-wrapper domain); run `/gsd-plan-phase` research per-phase if depth is wanted.

## Constraints

- **Tech stack**: TypeScript + `@modelcontextprotocol/sdk` + zod v4, run via `tsx` — established by existing code
- **Runtime**: ESM, top-level await, Node with `tsx` loader
- **API**: SparkPost EU by default (`api.eu.sparkpost.com`), single API key via `SPARKPOST_API_KEY`
- **Auth/secrets**: API key only from env, never committed

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Run `.ts` directly via `tsx`, no build | Smallest setup for a single-file stdio server | ✓ Good |
| Region via `SPARKPOST_API_BASE` env, EU default | Support US without a second package | ✓ Good |
| Skip multi-agent research at init | Domain is a known REST wrapper | — Pending |
| `node:test` for tests | Stdlib, no test-framework dependency | ✓ Good (Phase 1: 21 tests, no new deps) |

---
*Last updated: 2026-06-26 after Phase 2 (Expand API Coverage) complete — 20 tools total*
