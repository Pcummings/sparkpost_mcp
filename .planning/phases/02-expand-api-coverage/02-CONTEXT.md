# Phase 2: Expand API Coverage - Context

**Gathered:** 2026-06-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Add the next tier of SparkPost tools to the **existing** server, each following the Phase 1 module pattern (typed, zod-validated, tested, registered in `index.ts`). Five areas, ~13 new tools:

- **COV-01** Webhooks — list, create, delete
- **COV-05** Subaccounts — list, create
- **COV-02** Message events + deliverability metrics — search events, get metrics
- **COV-03** Recipient lists — list, get, create
- **COV-04** Suppression management — add, remove (the existing `check_suppression` already covers read)

No behavior change to the 8 shipped tools. No new infrastructure (reuse `spRequest`/`asText`/`getHeaders`). Roadmap plan split is fixed: 02-01 webhooks+subaccounts · 02-02 events+metrics · 02-03 recipient-lists+suppression.

</domain>

<decisions>
## Implementation Decisions

### Pagination & result size
- **D-01:** List/events tools return **one page**, never auto-aggregate. Expose pagination params (`per_page`, plus `cursor` for cursor-paginated endpoints like message-events; `limit`/`offset` where an endpoint uses that) and return the page **plus any next-cursor / paging links** so the AI client can fetch more itself. Rationale: bound token cost when results feed an LLM — message-events can return thousands of records.

### Events & metrics query surface (COV-02)
- **D-02:** Expose a **curated set of typed zod filters**, not an open params passthrough. Message events (`/events/message`): `from`, `to`, recipient / recipient-domain, event types, `per_page`/`cursor`. Deliverability metrics (`/metrics/deliverability`): `from`, `to`, `metrics` (list), and a `group_by`/dimension selector — all as typed fields. Unknown/rarely-used filters are out (researcher confirms the exact curated set against SparkPost docs).
- **D-03:** Dates are required as **ISO-8601 / RFC3339 strings**, validated by zod. No relative-date ("last 7 days") parsing in v1.1.

### Destructive operations (COV-01 delete, COV-04 remove)
- **D-04:** Same **no-guardrail posture as the existing tools**, but **exact-single-id only**. `delete_webhook` takes one webhook id; `remove_suppression` takes one email. No bulk delete, no wildcard, no "delete all". **No** `confirm`/dry-run flag — keeps these consistent with every other tool. Safety comes from the narrow single-target schema, not extra friction.

### Suppression add shape (COV-04)
- **D-05:** `add_suppression` takes a **single** email + `type` (`transactional` | `non_transactional`, default `non_transactional`) + optional `description`. Mirrors `check_suppression` / `remove_suppression` (all single-address). SparkPost upsert is `PUT /suppression-list/{email}` with `{ type, description }`. No bulk list in v1.1.

### Claude's Discretion
Decide via the Phase 1 conventions + researcher confirmation against SparkPost API docs:
- **Exact tool names** (snake_case verb_noun) and endpoints. Working set: `list_webhooks` (GET /webhooks), `create_webhook` (POST /webhooks), `delete_webhook` (DELETE /webhooks/{id}), `list_subaccounts` (GET /subaccounts), `create_subaccount` (POST /subaccounts), `search_message_events` (GET /events/message), `get_deliverability_metrics` (GET /metrics/deliverability[/{group_by}]), `list_recipient_lists` (GET /recipient-lists), `get_recipient_list` (GET /recipient-lists/{id}), `create_recipient_list` (POST /recipient-lists), `add_suppression` (PUT /suppression-list/{email}), `remove_suppression` (DELETE /suppression-list/{email}).
- **Required vs optional fields** for each `create_*` tool (webhook `name`/`target`/`events`/auth; subaccount `name`/`key_label`/`key_grants`; recipient-list `id`/`name`/`recipients`) — pick a minimal sensible set, researcher verifies which the API requires.
- **Test depth** where tools are near-identical — representative coverage like Phase 1 (every tool gets at least URL/method/body + one zod-rejection assertion).
- Which exact tools land in which of the 3 roadmap plans beyond the stated grouping.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external ADRs/specs in-repo. Requirements captured in `.planning/REQUIREMENTS.md` (COV-01..05) and decisions above.

Research targets (not repo docs — for the researcher to verify against the SparkPost API):
- Webhooks API — `GET/POST /webhooks`, `DELETE /webhooks/{id}`; create payload (name, target, events, auth).
- Message Events API — `GET /events/message`; **cursor-based pagination** model (cursor + `per_page` + paging links/total_count), available `events` types and recipient filters.
- Metrics (Deliverability) API — `GET /metrics/deliverability` and its group-by variants (e.g. `/domain`, `/sending-domain`); the `metrics` list and `group_by` dimensions; required `from`/`to`.
- Recipient Lists API — `GET /recipient-lists`, `GET /recipient-lists/{id}`, `POST /recipient-lists`; create payload (id, name, recipients[]).
- Suppression List API — `PUT /suppression-list/{email}` (upsert: type, description), `DELETE /suppression-list/{email}`.
- Subaccounts API — `GET /subaccounts`, `POST /subaccounts`; create payload (name, key_label, key_grants).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `spRequest(path, method, body)` — the single HTTP choke point; every new tool calls it. Throws `SparkPost <status>: <body>` on !ok, returns `{}` on empty. No change needed.
- `asText(data)` — wraps any result in `{ content: [{ type: "text", text: JSON.stringify(...) }] }`. Every new handler returns `asText(await spRequest(...))`.
- `getHeaders()` — call-time auth; new tools inherit it automatically.

### Established Patterns (the exact template to copy — `src/sparkpost.ts`)
- Per tool: `export const XxxSchema = { ...raw zod fields };` + `export async function xxx(args: {...}) { return asText(await spRequest(path, method, body)); }`. The `GetTemplate`/`CreateTemplate`/`UpdateTemplate` triplet is the closest analog for get/create/update shapes; `checkSuppression` is the analog for single-id path tools.
- Registration: `index.ts` calls `server.tool(name, description, XxxSchema, handler)` for each — new tools append here, key-guard/connect stay as-is.
- Tests: `node:test` + `tsx`, monkeypatched `globalThis.fetch` capturing `{ url, init }`, restored per test; one test per tool (URL/method/body + zod rejection). New `test/*.test.ts` (or extend `test/handlers.test.ts`).

### Integration Points
- New handlers + schemas append to `src/sparkpost.ts`. New `server.tool()` registrations in `index.ts`. New tests follow `test/handlers.test.ts`. CI (`.github/workflows/ci.yml`) already runs typecheck + test — new tests are picked up automatically by the `test/**/*.test.ts` glob.

</code_context>

<specifics>
## Specific Ideas

- Message-events pagination is cursor-based — expose `cursor` + `per_page` and surface the returned cursor/links so the AI can page forward (D-01).
- Deliverability metrics has group-by endpoint variants — model a `group_by`/dimension selector that maps to the right endpoint path (D-02).
- Suppression add is an **upsert** (`PUT /suppression-list/{email}`), so "add" semantics also update an existing entry — fine, mirrors SparkPost behavior (D-05).
- Destructive tools take exactly one id/email; the schema itself is the guardrail (D-04).

</specifics>

<deferred>
## Deferred Ideas

- **Auto-pagination / aggregation helper** — explicitly rejected for v1.1 (D-01). Revisit if AI clients struggle to drive cursor pagination themselves.
- **Bulk suppression add** (array of `{email, type}`) — rejected for v1.1 (D-05). Revisit if a bulk use-case appears.
- **COV-06** inbound relay webhooks, **COV-07** A/B testing transmissions, **COV-08** template preview/render — tracked v2 in REQUIREMENTS.md, out of the current roadmap.
- **Retry/backoff + rate-limit handling** — already out of scope per REQUIREMENTS ("add only if rate-limit errors observed in practice").

None of these block Phase 2.

</deferred>

---

*Phase: 02-expand-api-coverage*
*Context gathered: 2026-06-25*
