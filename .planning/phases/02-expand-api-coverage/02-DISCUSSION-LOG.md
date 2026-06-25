# Phase 2: Expand API Coverage - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-25
**Phase:** 02-expand-api-coverage
**Areas discussed:** Pagination & size, Events/metrics surface, Destructive-op safety, Suppression add shape

---

## Pagination & result size

| Option | Description | Selected |
|--------|-------------|----------|
| One page, expose params | Expose per_page/cursor (or limit), return one page + next-cursor; AI paginates | ✓ |
| Auto-aggregate all pages | Loop until all results fetched, return everything | |
| One page, fixed small cap | Hardcode small per_page, no cursor control | |

**User's choice:** One page, expose params
**Notes:** Keeps tool output token-bounded for the LLM client; message-events can return thousands of records.

---

## Events / metrics query surface (COV-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Curated filters, ISO-8601 dates | Typed zod fields for common filters (from/to, recipient/domain, event types, metrics, group_by); RFC3339 dates | ✓ |
| Broad param passthrough | Open params object forwarded verbatim | |
| Minimal: date range only | Just from/to with defaults | |

**User's choice:** Curated filters, ISO-8601 dates
**Notes:** Predictable + validated surface; no relative-date parsing in v1.1.

---

## Destructive-op safety (delete_webhook, remove_suppression)

| Option | Description | Selected |
|--------|-------------|----------|
| Trust caller, exact-id only | No-friction like existing tools, but single id/address required — no bulk/wildcard | ✓ |
| Add confirm/dry-run flag | Require confirm:true or support dry-run | |
| No special handling | Identical to other tools, no constraints | |

**User's choice:** Trust caller, exact-id only
**Notes:** Consistent with the existing 8 tools; the narrow single-target schema is the guardrail. No confirm flag.

---

## Suppression add shape (COV-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Single address + type | One email/call (mirrors check_suppression), type transactional\|non_transactional (default non_transactional) + optional description | ✓ |
| Bulk list | Array of {email, type} batch upsert | |
| Single default + optional list | Single by default, optional array for bulk | |

**User's choice:** Single address + type
**Notes:** Symmetric with check/remove (all single-address). PUT /suppression-list/{email} upsert.

---

## Claude's Discretion

- Exact tool names + precise SparkPost endpoints/params (researcher confirms against API docs).
- Required vs optional fields for each create_* tool.
- Test depth where tools are near-identical (representative coverage).
- Tool-to-plan assignment within the roadmap's 3 plans.

## Deferred Ideas

- Auto-pagination/aggregation helper (rejected v1.1).
- Bulk suppression add (rejected v1.1).
- COV-06/07/08 (inbound relay, A/B testing, template preview) — tracked v2.
- Retry/backoff + rate-limit handling — out of scope per REQUIREMENTS.
