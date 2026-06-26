# Milestones

## v1.1 Expand & Publish (Shipped: 2026-06-26)

**Delivered:** A test-and-CI-backed SparkPost MCP server, doubled from 8 to 20 tools and ready to publish to npm.

**Scope:** 3 phases, 8 plans · 10/10 v1 requirements (TEST-01..03, COV-01..05, PKG-01..02) · verified closeout (artifact audit clean)

**Stats:** 56 commits · 2026-06-25 → 2026-06-26 (2 days) · ~1089 LOC TypeScript · 44 tests · branch `main`

**Key accomplishments:**

- **Test foundation + CI** — `node:test`/tsx harness, `src/sparkpost.ts` extracted as a side-effect-free module, 44 tests (4 `spRequest` cases + URL/method/body contract + zod-rejection for all 8 tools), GitHub Actions gating every push/PR on typecheck + test (TEST-01..03)
- **API coverage doubled to 20 tools** — webhooks (list/create/delete), subaccounts (list/create), message-events search, deliverability metrics, recipient lists (list/get/create), suppression add/remove; each typed, zod-validated, tested, with `encodeURIComponent` path safety (COV-01..05)
- **npm publish-ready** — MIT LICENSE, `package.json` `files` allowlist + metadata + `prepublishOnly` typecheck, `tsx` moved to runtime deps; `npm publish --dry-run` → clean 6-file tarball (PKG-02)
- **Usage docs** — README 20-tool table (verbatim from `index.ts`), key-tool usage examples, published (`npx -y sparkpost-mcp`) + local-dev MCP client config (PKG-01)

---
