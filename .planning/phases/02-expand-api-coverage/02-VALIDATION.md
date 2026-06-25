---
phase: 2
slug: expand-api-coverage
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-25
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `02-RESEARCH.md` ## Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` + `tsx` |
| **Config file** | none — glob in `package.json` scripts (`test/**/*.test.ts`) |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~2 seconds |

No new framework setup — `node:test`/`tsx` already configured (Phase 1).

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~2 seconds

---

## Per-Task Verification Map

Task IDs are assigned by the planner; rows below are seeded from the RESEARCH.md
requirement→test map and finalized against PLAN.md task IDs at execute time.

| Plan | Requirement | Secure Behavior (Threat Ref) | Test Type | Automated Command | File Exists | Status |
|------|-------------|------------------------------|-----------|-------------------|-------------|--------|
| 02-01 | COV-01 | `listWebhooks` GET /webhooks | unit | `npm test` | ❌ W0 | ⬜ pending |
| 02-01 | COV-01 | `createWebhook` POST + zod rejects missing name/target/events | unit | `npm test` | ❌ W0 | ⬜ pending |
| 02-01 | COV-01 | `deleteWebhook` DELETE /webhooks/{id} | unit | `npm test` | ❌ W0 | ⬜ pending |
| 02-01 | COV-05 | `listSubaccounts` GET /subaccounts | unit | `npm test` | ❌ W0 | ⬜ pending |
| 02-01 | COV-05 | `createSubaccount` POST + zod rejects invalid key_grants (T: overprivileged grants) | unit | `npm test` | ❌ W0 | ⬜ pending |
| 02-02 | COV-02 | `searchMessageEvents` query string + surfaces `links` cursor | unit | `npm test` | ❌ W0 | ⬜ pending |
| 02-02 | COV-02 | `searchMessageEvents` zod rejects unknown event types | unit | `npm test` | ❌ W0 | ⬜ pending |
| 02-02 | COV-02 | `getDeliverabilityMetrics` builds path with group_by suffix | unit | `npm test` | ❌ W0 | ⬜ pending |
| 02-02 | COV-02 | `getDeliverabilityMetrics` zod rejects missing `from`+`metrics` | unit | `npm test` | ❌ W0 | ⬜ pending |
| 02-03 | COV-03 | `listRecipientLists` / `getRecipientList` (show_recipients) | unit | `npm test` | ❌ W0 | ⬜ pending |
| 02-03 | COV-03 | `createRecipientList` POST + zod rejects empty recipients[] | unit | `npm test` | ❌ W0 | ⬜ pending |
| 02-03 | COV-04 | `addSuppression` PUT /suppression-list/{email} + zod rejects invalid type enum | unit | `npm test` | ❌ W0 | ⬜ pending |
| 02-03 | COV-04 | `removeSuppression` DELETE /suppression-list/{email} (email `encodeURIComponent`; T: path traversal) | unit | `npm test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/phase2-handlers.test.ts` (or extend `test/handlers.test.ts`) — stubs for COV-01..05
- [ ] No framework install — `node:test`/`tsx` already present

---

## Manual-Only Verifications

All phase behaviors have automated verification — handlers are pure request-shapers
tested via monkeypatched `globalThis.fetch` capturing `{ url, init }`. No live SparkPost
call is required for any acceptance criterion.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
