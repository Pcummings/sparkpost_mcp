---
phase: 02-expand-api-coverage
reviewed: 2026-06-26T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - src/sparkpost.ts
  - index.ts
  - test/phase2-webhooks-subaccounts.test.ts
  - test/phase2-events-metrics.test.ts
  - test/phase2-lists-suppression.test.ts
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-06-26
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Phase 02 adds 12 zod-validated MCP tools (webhooks, subaccounts, message events,
deliverability metrics, recipient lists, suppression) plus handlers and tests.
The implementation is well-aligned with the Phase-1 patterns and with the
project's own cited SparkPost API research (`02-RESEARCH.md`): all path params
are `encodeURIComponent`-wrapped, query strings use `URLSearchParams` (so commas,
`@`, and `:` are correctly encoded — no injection via query params), `group_by`
is correctly a path suffix (not a query param), the message-event enum is the
documented subset, and recipient/suppression body reshaping is correct.
`undefined` optional fields are correctly dropped by `JSON.stringify`.

All 44 tests pass and `tsc --noEmit` is clean — which is exactly why the
remaining findings matter: **the test suite asserts the happy paths and the
specific pitfalls the author was watching for, but does not exercise the
trust-boundary validation gaps or the non-functional schema branches below.**

**No BLOCKERs found.** No injection, no path-traversal, no data-loss, no crash.
Path interpolation is safe everywhere. The findings are validation gaps at
trust boundaries and contract-completeness issues against `02-RESEARCH.md`, all
of which surface as opaque SparkPost 400s the AI client cannot self-correct.

There was no `<structural_findings>` block provided, so this report contains
only narrative findings.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: `from`/`to` accepted as unvalidated free strings despite a required, documented date format

**File:** `src/sparkpost.ts:254-255` (message events), `src/sparkpost.ts:293,297` (metrics)
**Issue:** `02-RESEARCH.md:199` documents `from` for deliverability metrics as
**REQUIRED**, ISO-8601, format `YYYY-MM-DDTHH:MM`. The schema declares it as a
bare `z.string()` with no format constraint (same for the optional `to`, and for
message-events `from`/`to`). Any non-date string ("yesterday", "", "2024-13-99")
passes zod validation, is URL-encoded verbatim, and is sent to SparkPost, which
returns an opaque `400` the model cannot diagnose. This is a missing-validation
gap at a trust boundary: the whole point of the typed-zod design (D-02) is to
reject bad input before it reaches the API. The existing tests only ever pass
the well-formed literal `"2024-01-01T00:00:00Z"`, so the gap is invisible.
**Fix:** Constrain the date params with a regex (or `z.iso.datetime()` if the
API accepts full RFC-3339). Minimal version matching the documented format:
```ts
const spDate = z.string().regex(
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:?\d{2})?$/,
  "Expected ISO-8601 datetime, e.g. 2024-01-01T00:00",
);
// metrics:
from: spDate.describe("Start of time range (ISO-8601, required)"),
to: spDate.optional().describe("End of time range (ISO-8601)"),
// message events: from: spDate.optional(), to: spDate.optional(),
```

### WR-02: `create_webhook` allows `auth_type: "basic" | "oauth2"` but never sends credentials — those branches are guaranteed 400s

**File:** `src/sparkpost.ts:180-203`
**Issue:** `CreateWebhookSchema` accepts `auth_type` of `"basic"` or `"oauth2"`,
but the handler body is `{ name, target, events, auth_type }` and never collects
or sends `auth_credentials` (required for `basic`) or `auth_request_details`
(required for `oauth2`) — see `02-RESEARCH.md:92-94`. So any caller that selects
`basic`/`oauth2` (a value the schema actively offers) produces a webhook-create
call that SparkPost rejects with a `400`. The research (`02-RESEARCH.md:98`)
explicitly decided to defer auth-credentials to a later version and to "**flag in
schema description**" — but the `auth_type` field has no `.describe()` warning, so
the contract advertises a capability the tool cannot fulfill. (Note: sending
`auth_type: "none"` for the common no-auth path is fine — `"none"` is the
documented default value per `02-RESEARCH.md:92`, so this is not a 400 on the
default path.)
**Fix:** Either drop the non-functional values from the enum, or document the
limitation as the research instructed:
```ts
// Option A — only expose what works in v1.1:
auth_type: z.literal("none").optional().default("none"),

// Option B — keep enum but warn (matches RESEARCH.md:98 "flag in schema description"):
auth_type: z.enum(["none", "basic", "oauth2"]).optional().default("none")
  .describe("Only 'none' is functional in this version; 'basic'/'oauth2' require auth_credentials which this tool does not yet collect and will be rejected by the API."),
```

### WR-03: `get_deliverability_metrics` omits the documented `precision` parameter — time-series breakdowns are unreachable

**File:** `src/sparkpost.ts:292-301, 378-403`
**Issue:** `02-RESEARCH.md:204` lists `precision` (`hour|day|week|month`) as a
supported optional param used to request time-series metrics. The schema and
handler expose `from`, `metrics`, `to`, `group_by`, `limit`, `timezone` but not
`precision`. Without it, callers cannot retrieve any time-bucketed metric series
— a core analytics use case for this tool. This is a curated param that the
project's own research enumerated and that was not recorded as a deliberate
deferral (unlike the webhook-credentials cut, which was explicitly scoped out).
**Fix:** Add to schema and pass through like the other optional query params:
```ts
// schema:
precision: z.enum(["hour", "day", "week", "month"]).optional()
  .describe("Time-series bucket size"),
// handler, alongside the other optional setters:
if (precision) params.set("precision", precision);
```

### WR-04: `limit` is always sent, but only applies to group-by endpoints

**File:** `src/sparkpost.ts:398`
**Issue:** `02-RESEARCH.md:202` notes `limit` "Caps result rows for group-by
endpoints." The handler sets `limit` whenever provided, including on the base
`/metrics/deliverability` call where `group_by` is absent and `limit` has no
meaning. SparkPost currently ignores the stray param, so this is non-breaking,
but it ships a request that contradicts the documented contract and could become
a `400` if the API tightens validation. Lower severity than WR-01..03 because
it does not break a supported call path today.
**Fix:** Gate `limit` on `group_by` (the only context where it is meaningful):
```ts
if (group_by && limit !== undefined) params.set("limit", String(limit));
```

## Info

### IN-01: Dead `MOCK_DATA` constant in webhooks/subaccounts test

**File:** `test/phase2-webhooks-subaccounts.test.ts:28`
**Issue:** `const MOCK_DATA = { results: { id: "tpl-1" } };` is declared but never
referenced in this file (confirmed by grep — it is only used in
`phase2-lists-suppression.test.ts:50`). Copy-paste residue from the shared test
template. Also note `MOCK_DATA` does not match `MOCK_BODY`'s payload anyway.
**Fix:** Delete the unused line.

### IN-02: Five test files duplicate the `mockResponse` + fetch-capture harness verbatim

**File:** `test/phase2-webhooks-subaccounts.test.ts:17-42`, `test/phase2-events-metrics.test.ts:13-40`, `test/phase2-lists-suppression.test.ts:16-41` (also the two Phase-1 test files)
**Issue:** The `mockResponse` duck-type, `savedFetch`/`capturedRequest` state, and
`beforeEach`/`afterEach` fetch swap are copy-pasted identically across all test
files. A change to the capture shape (e.g. capturing headers to assert the
`Authorization` header is set) must be made in five places. Not a correctness
issue; flagged as maintenance coupling.
**Fix:** Extract to `test/helpers.ts` exporting `mockResponse` and an
`installFetchCapture()` that returns a `() => capturedRequest` accessor; import
in each suite. Low priority.

### IN-03: `WEBHOOK_EVENTS` and `MESSAGE_EVENT_TYPES` are near-identical arrays with no enforced relationship

**File:** `src/sparkpost.ts:171-178` and `src/sparkpost.ts:246-251`
**Issue:** `MESSAGE_EVENT_TYPES` is documented (and correct) as the strict subset
of `WEBHOOK_EVENTS` that `/events/message` accepts (the `// Pitfall 3` comment and
`02-RESEARCH.md:185` both call this out). The two lists are maintained by hand
with no compile-time link, so a future edit to `WEBHOOK_EVENTS` can silently
desync the documented subset relationship. The current values are correct — this
is purely a note on the maintenance trap, not a present bug.
**Fix (optional):** Derive the relationship instead of restating it, e.g. define
the message subset explicitly and assert at module load that it is a subset of
`WEBHOOK_EVENTS`, or keep as-is given the inline pitfall comment already warns
maintainers. No change required for correctness.

---

_Reviewed: 2026-06-26_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
