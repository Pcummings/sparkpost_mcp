import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import {
  searchMessageEvents,
  getDeliverabilityMetrics,
  SearchMessageEventsSchema,
  GetDeliverabilityMetricsSchema,
  MESSAGE_EVENT_TYPES,
} from "../src/sparkpost.js";

// ponytail: duck-typed mock avoids Node 24 undici Response constructor 204 bug
function mockResponse(body: string, status: number, statusText = "OK"): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    text: async () => body,
  } as unknown as Response;
}

const MOCK_BODY = '{"results":{"id":"tpl-1"}}';
const MOCK_BODY_WITH_LINKS = JSON.stringify({
  results: [{ type: "delivery", transmission_id: "abc" }],
  links: { next: "https://api.eu.sparkpost.com/api/v1/events/message?cursor=WycxNzUw'" },
});

let savedFetch: typeof globalThis.fetch;
let capturedRequest: { url: string; init: RequestInit } | null = null;

beforeEach(() => {
  savedFetch = globalThis.fetch;
  capturedRequest = null;
  globalThis.fetch = async (url: RequestInfo | URL, init?: RequestInit) => {
    capturedRequest = { url: String(url), init: init ?? {} };
    return mockResponse(MOCK_BODY, 200);
  };
});

afterEach(() => { globalThis.fetch = savedFetch; });

// --- searchMessageEvents ---

test("searchMessageEvents: GET /events/message (no filters)", async () => {
  await searchMessageEvents({});
  assert.ok(capturedRequest?.url.includes("/events/message"), "url must include /events/message");
  // no query string when nothing provided
  assert.ok(!capturedRequest?.url.includes("?"), "no query string when no params");
  assert.equal(capturedRequest?.init.method, "GET");
});

test("searchMessageEvents: builds query string with events and per_page", async () => {
  await searchMessageEvents({ events: ["delivery", "bounce"], per_page: 2 });
  const url = capturedRequest!.url;
  assert.ok(url.includes("events=delivery%2Cbounce"), "events joined comma-encoded");
  assert.ok(url.includes("per_page=2"), "per_page present");
  assert.ok(!url.includes("cursor="), "no cursor when not supplied");
});

test("searchMessageEvents: surfaces links/cursor in response unchanged", async () => {
  globalThis.fetch = async (url: RequestInfo | URL, init?: RequestInit) => {
    capturedRequest = { url: String(url), init: init ?? {} };
    return mockResponse(MOCK_BODY_WITH_LINKS, 200);
  };
  const result = await searchMessageEvents({});
  const parsed = JSON.parse(result.content[0].text);
  assert.ok(parsed.links, "links key is present in response");
  assert.ok(parsed.links.next, "links.next is present");
});

test("searchMessageEvents: zod rejects unknown event type", () => {
  assert.throws(
    () => z.object(SearchMessageEventsSchema).parse({ events: ["not_a_real_event"] }),
    /invalid|expected/i,
  );
});

// --- getDeliverabilityMetrics ---

test("getDeliverabilityMetrics: group_by becomes path suffix, not query param", async () => {
  await getDeliverabilityMetrics({
    from: "2024-01-01T00:00:00Z",
    metrics: ["count_delivered", "count_bounce"],
    group_by: "domain",
  });
  const url = capturedRequest!.url;
  assert.ok(url.includes("/metrics/deliverability/domain"), "group_by is path suffix");
  assert.ok(!url.includes("group_by="), "group_by must NOT be a query param");
  assert.ok(url.includes("from="), "from is in query");
  assert.ok(url.includes("metrics=count_delivered%2Ccount_bounce"), "metrics joined comma-encoded");
});

test("getDeliverabilityMetrics: no group_by → /metrics/deliverability (no suffix)", async () => {
  await getDeliverabilityMetrics({
    from: "2024-01-01T00:00:00Z",
    metrics: ["count_delivered"],
  });
  const url = capturedRequest!.url;
  assert.ok(url.includes("/metrics/deliverability"), "base path present");
  // path must end at /deliverability (no extra segment)
  const pathPart = new URL(url).pathname;
  assert.equal(pathPart, "/api/v1/metrics/deliverability", "path has no extra segment");
  assert.ok(!url.includes("group_by="), "no group_by query param");
});

test("getDeliverabilityMetrics: zod rejects missing from AND metrics", () => {
  assert.throws(
    () => z.object(GetDeliverabilityMetricsSchema).parse({}),
    /invalid|required|expected/i,
  );
});

test("getDeliverabilityMetrics: zod rejects missing metrics when from is set", () => {
  assert.throws(
    () => z.object(GetDeliverabilityMetricsSchema).parse({ from: "2024-01-01T00:00:00Z" }),
    /invalid|required|expected/i,
  );
});
