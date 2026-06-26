---
phase: 03
slug: publish-docs
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-26
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: 03-RESEARCH.md `## Validation Architecture`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in test runner (`node --test`) — already installed (Phase 1) |
| **Config file** | none — command in `package.json` scripts |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test && npm run typecheck` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test && npm run typecheck`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Req ID | Behavior | Test Type | Automated Command | File Exists | Status |
|--------|----------|-----------|-------------------|-------------|--------|
| PKG-02 | `prepublishOnly` typecheck passes | automated | `npm publish --dry-run` (triggers `tsc --noEmit`) | ✅ | ⬜ pending |
| PKG-02 | `files` allowlist produces clean minimal tarball | manual | `npm pack --dry-run` (inspect file list) | ✅ | ⬜ pending |
| PKG-02 | LICENSE present + license field = MIT | manual | `ls LICENSE && node -p "require('./package.json').license"` | ✅ | ⬜ pending |
| PKG-01 | README documents all 20 tools | manual-only | n/a — visual inspection of rendered README | ✅ | ⬜ pending |
| PKG-01 | MCP client config block present (published + local-dev forms) | manual-only | n/a — visual inspection | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Phase gate:** `npm publish --dry-run` exits 0 with the expected file list (`index.ts`, `src/`, `README.md`, `LICENSE`, `tsconfig.json`, `package.json`).

---

## Wave 0 Requirements

Existing infrastructure covers all automated phase requirements — `node --test` harness and `tsc --noEmit` typecheck were established in Phase 1. No new framework install needed.

- [ ] No new test files required (this phase changes packaging metadata + docs, not runtime behavior).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| README covers all 20 tools in a categorized table | PKG-01 | Doc content correctness is not machine-assertable beyond presence | Render README; confirm every `server.tool(...)` name in `index.ts` appears in the table |
| README shows MCP client config (published `npx -y sparkpost-mcp` form + local-dev form) | PKG-01 | Config correctness verified by human reading | Confirm both JSON blocks present with `SPARKPOST_API_KEY` env |
| Tarball is clean + minimal | PKG-02 | Requires human judgment on "minimal" | `npm pack --dry-run`; confirm no `test/`, `.planning/`, `.github/`, `tsconfig.json.bak` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or are explicitly manual-only with instructions
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify (manual-only acceptable for doc-content tasks)
- [ ] Wave 0 covers all MISSING references (none — existing infra)
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter (set by planner/auditor once plans carry verify fields)

**Approval:** pending
