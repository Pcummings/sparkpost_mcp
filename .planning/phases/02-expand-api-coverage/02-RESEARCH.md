# Phase 2: Expand API Coverage — Research

**Researched:** 2026-06-25
**Domain:** SparkPost REST API — Webhooks, Subaccounts, Message Events, Deliverability Metrics, Recipient Lists, Suppression List
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** List/events tools return one page, never auto-aggregate. Expose pagination params (`per_page`, plus `cursor` for cursor-paginated endpoints; `limit`/`offset` where applicable) and return the page plus any next-cursor/paging links.
- **D-02:** Expose a curated set of typed zod filters, not an open params passthrough. Message events: `from`, `to`, recipient/recipient-domain, event types, `per_page`/`cursor`. Deliverability metrics: `from`, `to`, `metrics` list, and a `group_by`/dimension selector — all typed.
- **D-03:** Dates as ISO-8601/RFC3339 strings, validated by zod. No relative-date parsing in v1.1.
- **D-04:** Destructive operations take exact-single-id only. No bulk delete, no wildcard, no `confirm`/dry-run flag.
- **D-05:** `add_suppression` takes a single email + `type` (`transactional` | `non_transactional`, default `non_transactional`) + optional `description`. SparkPost upsert is `PUT /suppression-list/{email}` with `{ type, description }`.

### Claude's Discretion

- Exact tool names (snake_case verb_noun) and endpoints.
- Required vs optional fields for each `create_*` tool.
- Test depth for near-identical tools.
- Which exact tools land in which of the 3 roadmap plans.

### Deferred Ideas (OUT OF SCOPE)

- Auto-pagination/aggregation helper (D-01, explicitly rejected for v1.1)
- Bulk suppression add (D-05, rejected for v1.1)
- COV-06 inbound relay webhooks, COV-07 A/B testing transmissions, COV-08 template preview/render
- Retry/backoff + rate-limit handling
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COV-01 | Webhook tools — list, create, delete | Endpoints, required fields, event type enum, DELETE→204 confirmed |
| COV-02 | Message-events / analytics tools — event search + deliverability metrics | Cursor pagination model confirmed, event types listed, metrics list + group_by paths confirmed |
| COV-03 | Recipient-list tools — list, get, create | Required fields: `recipients[]` only; `id`/`name` optional (auto-generated) |
| COV-04 | Suppression management — add and remove entries | `type` is single required enum field (`transactional`/`non_transactional`); DELETE→204 |
| COV-05 | Subaccount tools — list, create | Required: `name` + (`key_label` + `key_grants` when `setup_api_key=true`, which is the default) |
</phase_requirements>

---

## Summary

SparkPost exposes all six resource areas under `/api/v1` — the same base that `spRequest` already prefixes. No path changes needed to existing infrastructure. All new tools follow the same `XxxSchema + async function → asText(await spRequest(...))` pattern verbatim.

The most important API clarifications for planning: (1) Deliverability metrics has **two required params** — `from` AND `metrics` (a list of metric names). The group-by dimension is encoded as a **URL path segment** (`/metrics/deliverability/domain` not a query param), so `group_by` maps to a path suffix. (2) Message events pagination is **cursor-based**: `cursor` + `per_page`, response includes a `links.next` URL with the cursor prefilled. (3) Suppression upsert uses a single `type` enum field, not separate booleans. (4) Webhook `events` is a **required array** (not optional) containing flat string event names. (5) For recipient lists, only `recipients[]` is required — `id` and `name` are both auto-generated if omitted.

**Primary recommendation:** Copy the `checkSuppression` pattern (single path-param tool) for `delete_webhook`, `remove_suppression`, and `get_recipient_list`. Copy the `createTemplate` pattern (POST with body-building) for `create_webhook`, `create_subaccount`, and `create_recipient_list`. Use a query-string builder for the filter-heavy `search_message_events` and `get_deliverability_metrics` tools.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Webhook CRUD | API / Backend (SparkPost) | MCP tool layer | SparkPost owns webhook lifecycle; MCP just proxies |
| Subaccount management | API / Backend (SparkPost) | MCP tool layer | SparkPost owns subaccount state |
| Message event search | API / Backend (SparkPost) | MCP tool layer | Cursor pagination state lives on SparkPost side |
| Deliverability metrics | API / Backend (SparkPost) | MCP tool layer | Aggregation computed by SparkPost; MCP selects dimensions |
| Recipient list CRUD | API / Backend (SparkPost) | MCP tool layer | Lists stored in SparkPost; MCP shapes create payload |
| Suppression add/remove | API / Backend (SparkPost) | MCP tool layer | Suppression state is SparkPost-side; MCP is a thin proxy |

---

## Endpoint Reference Tables

### COV-01: Webhooks

**Base path:** `/webhooks` (under `/api/v1`) [CITED: developers.sparkpost.com/api/webhooks/]

#### GET /webhooks

No query params. Returns array of webhook objects.

Response fields per webhook: `id`, `name`, `target`, `events[]`, `auth_type`, `auth_credentials`, `auth_request_details`, `auth_token` (deprecated), `last_successful`, `last_failure`, `custom_headers`, `active`, `links[]`.

#### POST /webhooks

| Field | Required | Type | Notes |
|-------|----------|------|-------|
| `name` | **REQUIRED** | string | Display name |
| `target` | **REQUIRED** | string (URL) | Ports 80/443 only |
| `events` | **REQUIRED** | string[] | See event type enum below |
| `active` | optional | boolean | Default: `true` |
| `auth_type` | optional | enum | `"none"` (default), `"basic"`, `"oauth2"` |
| `auth_credentials` | conditional | object | Required when `auth_type="basic"` |
| `auth_request_details` | conditional | object | Required when `auth_type="oauth2"` |
| `custom_headers` | optional | object | |
| `exception_subaccounts` | optional | string[] | |

**MCP tool design:** Expose `name`, `target`, `events` (required); `auth_type` optional (default `none`). Skip `auth_credentials`/`auth_request_details` in v1.1 — auth setup is rarely needed from AI clients and the conditional requirement makes the schema complex. Flag in schema description.

#### DELETE /webhooks/{id}

Path param: `id` (UUID string). Returns **204 No Content** (empty body). [CITED: developers.sparkpost.com/api/webhooks/]

`spRequest` already returns `{}` on empty body — no special handling needed.

#### Valid webhook event types [CITED: developers.sparkpost.com/api/webhooks/]

```
bounce, delivery, injection, spam_complaint, out_of_band, policy_rejection, delay,
click, open, initial_open, amp_click, amp_open, amp_initial_open,
generation_failure, generation_rejection, list_unsubscribe, link_unsubscribe,
relay_injection, relay_rejection, relay_delivery, relay_tempfail, relay_permfail,
ab_test_completed, ab_test_cancelled, success, error
```

Zod: `z.array(z.enum([...]))` for `events`. This matches the message-events type list (same strings, slightly different set — webhooks includes relay/ab-test/success/error that events API does not surface as searchable types).

---

### COV-05: Subaccounts

**Base path:** `/subaccounts` [CITED: developers.sparkpost.com/api/subaccounts/]

#### GET /subaccounts

No required params. Returns list with id, name, status, compliance_status, ip_pool, options.

#### POST /subaccounts

| Field | Required | Type | Notes |
|-------|----------|------|-------|
| `name` | **REQUIRED** | string | Max 64 chars |
| `key_label` | **REQUIRED** (when `setup_api_key=true`) | string | Default: `setup_api_key=true` |
| `key_grants` | **REQUIRED** (when `setup_api_key=true`) | string[] | See grants enum |
| `key_valid_ips` | optional | string[] | IP allowlist for the new key |
| `ip_pool` | optional | string | |
| `setup_api_key` | optional | boolean | Default: `true` |

**MCP tool design:** Treat `name`, `key_label`, `key_grants` as all required (since `setup_api_key` defaults to `true`). This is the common case.

**Valid `key_grants` values** [CITED: developers.sparkpost.com/api/subaccounts/]:

```
smtp/inject, sending_domains/manage, tracking_domains/view, tracking_domains/manage,
message_events/view, suppression_lists/manage, transmissions/view, transmissions/modify,
webhooks/view, webhooks/modify
```

Zod: `z.array(z.enum([...]))` for `key_grants`.

**Create response:** Returns `id`, `key`, `key_label`, `short_key` (4-char prefix) on HTTP 200.

---

### COV-02: Message Events

**Base path:** `/events/message` [CITED: developers.sparkpost.com/api/events/]

#### GET /events/message

All params optional. Curated set per D-02:

| Param | Zod type | Notes |
|-------|----------|-------|
| `from` | `z.string()` (ISO-8601) | D-03: string, not Date |
| `to` | `z.string()` (ISO-8601) | |
| `events` | `z.array(z.enum([...]))` optional | See event types below |
| `recipients` | `z.string()` optional | Comma-delimited emails |
| `recipient_domains` | `z.string()` optional | Domain segment keyword search |
| `per_page` | `z.number().int().min(1).max(10000)` optional | Default: 1000 |
| `cursor` | `z.string()` optional | From previous response `links.next` |

**Pagination model:** Cursor-based. [CITED: developers.sparkpost.com/api/events/]
- Request: `cursor` (default value `"initial"` on first call — omit to get first page), `per_page` (max 10,000)
- Response: `{ results: [...], links: { next: "<url-with-cursor>" }, total_count: N }`
- Next page: extract cursor from `links.next` URL and pass as `cursor` param

**Available `events` types for message events** [CITED: developers.sparkpost.com/api/events/]:
```
bounce, delivery, injection, spam_complaint, out_of_band, policy_rejection, delay,
click, open, initial_open, amp_click, amp_open, amp_initial_open,
generation_failure, generation_rejection, list_unsubscribe, link_unsubscribe
```

Note: This is a subset of the webhook event types — relay/ab-test/success/error are NOT valid for `/events/message` query.

**Query string construction:** Build params object, omit undefined, use `URLSearchParams`. For `events` array: join as comma-delimited string (SparkPost uses comma-delimited, not repeated params).

---

### COV-02: Deliverability Metrics

**Base path:** `/metrics/deliverability` [CITED: developers.sparkpost.com/api/metrics/]

#### GET /metrics/deliverability[/{group_by}]

| Param | Required | Type | Notes |
|-------|----------|------|-------|
| `from` | **REQUIRED** | string (ISO-8601, format `YYYY-MM-DDTHH:MM`) | D-03 |
| `metrics` | **REQUIRED** | string (comma-delimited list) | At least one metric name |
| `to` | optional | string (ISO-8601) | |
| `limit` | optional | int 1–10000 | Caps result rows for group-by endpoints |
| `timezone` | optional | string | IANA tz name |
| `precision` | optional | string | For time-series: `hour`, `day`, `week`, `month` |

**`group_by` encoding:** Maps to a **URL path suffix**, not a query param. [CITED: developers.sparkpost.com/api/metrics/]

| `group_by` value | Endpoint path |
|-----------------|---------------|
| `""` (none) | `/metrics/deliverability` |
| `"domain"` | `/metrics/deliverability/domain` |
| `"sending-ip"` | `/metrics/deliverability/sending-ip` |
| `"ip-pool"` | `/metrics/deliverability/ip-pool` |
| `"sending-domain"` | `/metrics/deliverability/sending-domain` |
| `"subaccount"` | `/metrics/deliverability/subaccount` |
| `"campaign"` | `/metrics/deliverability/campaign` |
| `"template"` | `/metrics/deliverability/template` |

Handler logic: `const path = group_by ? /metrics/deliverability/${group_by} : "/metrics/deliverability"`.

**Zod for `group_by`:** `z.enum(["domain","sending-ip","ip-pool","sending-domain","subaccount","campaign","template"]).optional()`

**Pagination:** `limit` parameter only (1–10000). No cursor. Single-page result by design. Response: `{ results: [...], links: [{href, rel, method}] }`. The `links` array is for discoverability, not pagination.

**Available `metrics` values** (expose in zod enum or as `z.array(z.string())` — see note below):

Common useful subset: `count_injected`, `count_bounce`, `count_rejected`, `count_delivered`, `count_accepted`, `count_sent`, `count_targeted`, `count_clicked`, `count_unique_clicked`, `count_rendered`, `count_unique_confirmed_opened`, `count_spam_complaint`, `count_delayed`, `count_soft_bounce`, `count_hard_bounce`, `count_block_bounce`.

Full list (50+ values) — see Don't Hand-Roll note below on whether to zod-enum all 50.

**Planner note on `metrics` zod type:** `z.array(z.string())` is simpler and future-proof (SparkPost adds metrics without breaking the tool). A zod enum gives autocomplete/rejection but requires updating when SparkPost adds metrics. Given D-02 says "curated typed fields", use `z.array(z.string())` with a `.min(1)` constraint and document the valid values in the field description.

---

### COV-03: Recipient Lists

**Base path:** `/recipient-lists` [CITED: developers.sparkpost.com/api/recipient-lists/]

#### GET /recipient-lists

No required params. Returns abbreviated list objects (without recipients array).

#### GET /recipient-lists/{id}

| Param | Type | Notes |
|-------|------|-------|
| `id` | string (path) | Required |
| `show_recipients` | boolean (query) | When `true`, includes full recipients array |

`num_rcpt_errors` applies to POST/PUT only, not GET.

#### POST /recipient-lists

| Field | Required | Type | Notes |
|-------|----------|------|-------|
| `recipients` | **REQUIRED** | array (min 1) | Each must have `address` |
| `id` | optional | string (max 64 bytes) | Auto-generated UUID if omitted |
| `name` | optional | string (max 64 bytes) | Defaults to `id` if omitted |
| `description` | optional | string (max 1024 bytes) | |

**Recipient object shape:**

| Field | Required | Notes |
|-------|----------|-------|
| `address` | **REQUIRED** | Object `{ email: string, name?: string }` or plain email string |
| `address.email` | **REQUIRED** | Valid email |
| `address.name` | optional | Display name |
| `substitution_data` | optional | Template variables object |
| `tags` | optional | string[] (max 10) |
| `metadata` | optional | key/value object (max 10KB) |

**MCP tool design:** Expose `id` (optional), `name` (optional), `recipients` (required) with each recipient as `{ email: string, name?: string }`. Flatten address object for simplicity — handler builds `{ address: { email, name } }` internally.

**`num_rcpt_errors` query param on POST:** Optional, limits how many recipient validation errors are returned. Expose as optional `z.number().int().optional()` — useful for large creates.

---

### COV-04: Suppression List

**Base path:** `/suppression-list` [CITED: developers.sparkpost.com/api/suppression-list/]

#### PUT /suppression-list/{email}

| Field | Required | Type | Notes |
|-------|----------|------|-------|
| `type` | **REQUIRED** | enum | `"transactional"` or `"non_transactional"` |
| `description` | optional | string | Human-readable note |
| `list_id` | optional | string | Associate with a specific list |

**Type is a single enum field** — NOT separate booleans. Deprecated boolean fields (`transactional`, `non_transactional`) are no longer used. [CITED: developers.sparkpost.com/api/suppression-list/]

D-05 is correct: `PUT /suppression-list/{email}` with body `{ type, description }`.

**MCP tool:** `email` as path param (URI-encoded, per existing `checkSuppression` pattern), `type` enum required, `description` optional.

#### DELETE /suppression-list/{email}

Returns **204 No Content** (empty body). `spRequest` returns `{}` — no special handling needed.

---

## Standard Stack

No new libraries. All tools use existing `spRequest`/`asText`/`getHeaders` + `zod` (already installed). [VERIFIED from codebase]

| Library | Purpose | Status |
|---------|---------|--------|
| `zod` | Schema validation | Already installed |
| `@modelcontextprotocol/sdk` | MCP server | Already installed |
| `tsx` | TypeScript execution | Already installed |

**Zero new dependencies.**

---

## Package Legitimacy Audit

No new packages to install. N/A.

---

## Architecture Patterns

### Pattern 1: No-arg list tool (listWebhooks, listSubaccounts, listRecipientLists)

```typescript
// Follows existing listTemplates / listSendingDomains pattern
export async function listWebhooks() {
  return asText(await spRequest("/webhooks"));
}
```

### Pattern 2: Single path-param tool (deleteWebhook, removeSuppression)

```typescript
// Follows existing checkSuppression pattern
export const DeleteWebhookSchema = {
  id: z.string().describe("Webhook UUID"),
};
export async function deleteWebhook({ id }: { id: string }) {
  return asText(await spRequest(`/webhooks/${encodeURIComponent(id)}`, "DELETE"));
}
```

### Pattern 3: POST create tool (createWebhook, createSubaccount, createRecipientList)

```typescript
// Follows existing createTemplate pattern
export const CreateWebhookSchema = {
  name: z.string(),
  target: z.string().url(),
  events: z.array(z.enum(WEBHOOK_EVENT_TYPES)),
  auth_type: z.enum(["none", "basic", "oauth2"]).optional().default("none"),
};
export async function createWebhook({ name, target, events, auth_type }: {...}) {
  return asText(await spRequest("/webhooks", "POST", { name, target, events, auth_type }));
}
```

### Pattern 4: Filter tool with query string (searchMessageEvents, getDeliverabilityMetrics)

```typescript
export async function searchMessageEvents(args: {...}) {
  const params = new URLSearchParams();
  if (args.from) params.set("from", args.from);
  if (args.events?.length) params.set("events", args.events.join(","));
  if (args.per_page) params.set("per_page", String(args.per_page));
  if (args.cursor) params.set("cursor", args.cursor);
  const qs = params.toString();
  return asText(await spRequest(`/events/message${qs ? "?" + qs : ""}`));
}
```

### Pattern 5: getDeliverabilityMetrics with group_by path suffix

```typescript
export async function getDeliverabilityMetrics(args: {...}) {
  const { from, to, metrics, group_by, limit, timezone } = args;
  const params = new URLSearchParams();
  params.set("from", from);
  params.set("metrics", metrics.join(","));
  if (to) params.set("to", to);
  if (limit) params.set("limit", String(limit));
  if (timezone) params.set("timezone", timezone);
  const suffix = group_by ? `/${group_by}` : "";
  return asText(await spRequest(`/metrics/deliverability${suffix}?${params.toString()}`));
}
```

### Recommended File Layout

```
src/
└── sparkpost.ts        # All handlers + schemas (append-only per Phase 1 pattern)
index.ts                # server.tool() registrations (append 12 new lines)
test/
└── handlers.test.ts    # Extend with new tool tests (or add 02-handlers.test.ts)
```

Ponytail note: keep everything in `sparkpost.ts` rather than splitting into modules — there are only ~400 LOC total after Phase 2, no need for a module boundary yet.

### Anti-Patterns to Avoid

- **Building a query-string helper:** `URLSearchParams` does it. One per handler function, not a shared util.
- **Zod enum for all 50+ metric names:** Use `z.array(z.string()).min(1)` — document valid values in `.describe()`.
- **Encoding `group_by` as a query param:** It's a URL path segment. `params.set("group_by", ...)` would 404.
- **Not URI-encoding email in suppression paths:** Emails contain `@` and `+`. Use `encodeURIComponent` as in existing `checkSuppression`.
- **Passing `cursor: "initial"` explicitly:** Just omit the cursor param on first call. SparkPost uses `initial` as internal default; sending it explicitly is harmless but unnecessary.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Query string construction | Custom string concat | `URLSearchParams` (stdlib) |
| HTTP with auth + timeout | Custom fetch wrapper | Existing `spRequest` |
| Response wrapping | New response format | Existing `asText` |
| JSON body with optional fields | Conditional spread everywhere | Build object, delete undefined keys or use `if` guards (existing pattern) |

---

## Common Pitfalls

### Pitfall 1: metrics deliverability — `metrics` param is required

**What goes wrong:** Calling `GET /metrics/deliverability` without the `metrics` query param returns a 400 error from SparkPost.
**Why it happens:** Unlike most list endpoints, this one doesn't have a sensible default.
**How to avoid:** Zod `z.array(z.string()).min(1)` enforces at least one metric. Join array as comma-delimited string in the query param.

### Pitfall 2: group_by is a path segment, not a query param

**What goes wrong:** Sending `?group_by=domain` returns 200 with aggregate results (the query param is silently ignored), not per-domain breakdown.
**How to avoid:** Map `group_by` → path suffix in the handler. Test asserts URL ends with `/domain` not `?group_by=domain`.

### Pitfall 3: Webhook events vs Message events — different enum sets

**What goes wrong:** Using the message-events enum for webhook `events` field (or vice versa) causes a 422 from SparkPost on create.
**How to avoid:** Define two separate string literal arrays: `WEBHOOK_EVENTS` (includes relay/ab-test/success/error) and `MESSAGE_EVENT_TYPES` (subset). Export both for use in tests.

### Pitfall 4: Suppression type field

**What goes wrong:** Sending `{ transactional: true }` (old boolean style) instead of `{ type: "transactional" }` to the PUT endpoint — SparkPost still accepts it for backwards compatibility but it's deprecated and may stop working.
**How to avoid:** D-05 is already correct: zod enum `z.enum(["transactional", "non_transactional"])`.

### Pitfall 5: DELETE returns 204, `spRequest` must handle empty body

**What goes wrong:** If SparkPost returns 204 with no body, `JSON.parse("")` throws. `spRequest` already handles this with `return raw ? JSON.parse(raw) : {}`. No action needed — but tests should verify the handler doesn't throw on empty-body mock.
**Warning signs:** Test mock returning status 204 with empty string body throws JSON parse error — means `spRequest` was changed.

### Pitfall 6: Recipient list `id` auto-generation

**What goes wrong:** Assuming `id` is required and throwing a zod error when the user omits it. SparkPost auto-generates a UUID.
**How to avoid:** `id: z.string().optional()` in `CreateRecipientListSchema`.

---

## Validation Architecture

`nyquist_validation: true` in config.json — include full test mapping.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:test` + `tsx` |
| Config file | none (glob in package.json scripts) |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COV-01 | `listWebhooks` GET /webhooks | unit | `npm test` | ❌ Wave 0 |
| COV-01 | `createWebhook` POST /webhooks with required body | unit | `npm test` | ❌ Wave 0 |
| COV-01 | `createWebhook` zod rejects missing `name`/`target`/`events` | unit | `npm test` | ❌ Wave 0 |
| COV-01 | `deleteWebhook` DELETE /webhooks/{id} | unit | `npm test` | ❌ Wave 0 |
| COV-05 | `listSubaccounts` GET /subaccounts | unit | `npm test` | ❌ Wave 0 |
| COV-05 | `createSubaccount` POST /subaccounts with required body | unit | `npm test` | ❌ Wave 0 |
| COV-05 | `createSubaccount` zod rejects invalid key_grants | unit | `npm test` | ❌ Wave 0 |
| COV-02 | `searchMessageEvents` builds correct query string | unit | `npm test` | ❌ Wave 0 |
| COV-02 | `searchMessageEvents` surfaces `links` (cursor) in response | unit | `npm test` | ❌ Wave 0 |
| COV-02 | `searchMessageEvents` zod rejects unknown event types | unit | `npm test` | ❌ Wave 0 |
| COV-02 | `getDeliverabilityMetrics` builds path with group_by suffix | unit | `npm test` | ❌ Wave 0 |
| COV-02 | `getDeliverabilityMetrics` zod rejects missing `from` + `metrics` | unit | `npm test` | ❌ Wave 0 |
| COV-03 | `listRecipientLists` GET /recipient-lists | unit | `npm test` | ❌ Wave 0 |
| COV-03 | `getRecipientList` GET /recipient-lists/{id} with show_recipients | unit | `npm test` | ❌ Wave 0 |
| COV-03 | `createRecipientList` POST with recipients body | unit | `npm test` | ❌ Wave 0 |
| COV-03 | `createRecipientList` zod rejects empty recipients array | unit | `npm test` | ❌ Wave 0 |
| COV-04 | `addSuppression` PUT /suppression-list/{email} with type | unit | `npm test` | ❌ Wave 0 |
| COV-04 | `addSuppression` zod rejects invalid type enum | unit | `npm test` | ❌ Wave 0 |
| COV-04 | `removeSuppression` DELETE /suppression-list/{email} | unit | `npm test` | ❌ Wave 0 |

### Sampling Rate

- Per task commit: `npm test`
- Per wave merge: `npm test`
- Phase gate: Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `test/phase2-handlers.test.ts` — all COV-01..05 tool tests (or extend `test/handlers.test.ts`)
- [ ] No new framework setup needed — `node:test`/`tsx` already configured

---

## Security Domain

`security_enforcement: true`, `security_asvs_level: 1` in config.json.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | API key injected via `getHeaders()` — existing, unchanged |
| V3 Session Management | no | Stateless MCP tools |
| V4 Access Control | no | SparkPost enforces per-key grants; MCP layer is a proxy |
| V5 Input Validation | yes | Zod validates all inputs at schema boundary |
| V6 Cryptography | no | No crypto in tool layer |

### Known Threat Patterns for this Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Email path traversal (`foo@bar.com/../../etc`) | Tampering | `encodeURIComponent` on all path-interpolated values (existing pattern in `checkSuppression`) |
| Webhook target SSRF | Tampering | SparkPost enforces ports 80/443 server-side; MCP layer does not make outbound requests to target |
| Overprivileged subaccount grants | Elevation of privilege | Zod enum limits `key_grants` to the known valid set; user must explicitly choose grants |
| Metric injection via untrusted metric names | Tampering | SparkPost validates metric names server-side and returns 400; `z.array(z.string()).min(1)` ensures non-empty |

---

## CONTEXT.md Endpoint Accuracy Check

Checking the working endpoint set from CONTEXT.md against docs:

| Tool in CONTEXT.md | Endpoint in CONTEXT.md | Doc Verdict |
|---------------------|------------------------|-------------|
| `list_webhooks` | GET /webhooks | CORRECT |
| `create_webhook` | POST /webhooks | CORRECT |
| `delete_webhook` | DELETE /webhooks/{id} | CORRECT — returns 204 |
| `list_subaccounts` | GET /subaccounts | CORRECT |
| `create_subaccount` | POST /subaccounts | CORRECT — `name`+`key_label`+`key_grants` all required in default config |
| `search_message_events` | GET /events/message | CORRECT — all params optional |
| `get_deliverability_metrics` | GET /metrics/deliverability[/{group_by}] | CORRECT — `from` AND `metrics` required; `group_by` is path suffix |
| `list_recipient_lists` | GET /recipient-lists | CORRECT |
| `get_recipient_list` | GET /recipient-lists/{id} | CORRECT — `show_recipients` query param confirmed |
| `create_recipient_list` | POST /recipient-lists | CORRECTION: `id` and `name` are optional (auto-generated); only `recipients[]` is required |
| `add_suppression` | PUT /suppression-list/{email} | CORRECT — D-05 shape matches docs |
| `remove_suppression` | DELETE /suppression-list/{email} | CORRECT — returns 204 |

**One correction from docs:** `create_recipient_list` — CONTEXT.md implies `id/name/recipients[]` as candidates for required, but docs confirm only `recipients[]` is required. `id` and `name` are optional (auto-generated). Planner should make only `recipients` required in the schema.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `from` format for metrics is `YYYY-MM-DDTHH:MM` (no seconds) | Deliverability Metrics | SparkPost may also accept full ISO-8601 with seconds; accept `z.string()` and let SparkPost validate format |
| A2 | `links.next` in message events response contains a cursor URL (not just the cursor token itself) | Message Events | If it's just the token, extract differently; treat as opaque string and surface whole response |
| A3 | Metrics `/metrics/deliverability/time-series` and `/bounce-reason` etc. are available to all SparkPost EU plans | Deliverability Metrics | Some advanced group-by paths may require higher-tier plans; exclude from curated `group_by` enum to keep simple |

For A1 and A2: `z.string()` on dates and returning raw SparkPost response via `asText` means the planner/implementer doesn't need to make assumptions — SparkPost validates dates, and the full `links` object is returned as-is.

---

## Sources

### Primary (HIGH confidence — CITED from official docs)
- [developers.sparkpost.com/api/webhooks/](https://developers.sparkpost.com/api/webhooks/) — POST required fields, DELETE 204, event types list
- [developers.sparkpost.com/api/events/](https://developers.sparkpost.com/api/events/) — cursor pagination model, event type enum, recipient filters
- [developers.sparkpost.com/api/metrics/](https://developers.sparkpost.com/api/metrics/) — required params (`from`, `metrics`), group-by path list, limit param, response shape
- [developers.sparkpost.com/api/subaccounts/](https://developers.sparkpost.com/api/subaccounts/) — required fields, key_grants enum
- [developers.sparkpost.com/api/recipient-lists/](https://developers.sparkpost.com/api/recipient-lists/) — only `recipients[]` required, `show_recipients` param
- [developers.sparkpost.com/api/suppression-list/](https://developers.sparkpost.com/api/suppression-list/) — `type` is single enum field (not booleans), DELETE 204

### Secondary (LOW confidence)
- WebSearch result confirming metrics endpoint param names — corroborated by primary source above
