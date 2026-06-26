import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import {
  listWebhooks,
  createWebhook,
  deleteWebhook,
  listSubaccounts,
  createSubaccount,
  CreateWebhookSchema,
  DeleteWebhookSchema,
  CreateSubaccountSchema,
  WEBHOOK_EVENTS,
  KEY_GRANTS,
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
const MOCK_DATA = { results: { id: "tpl-1" } };

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

// --- listWebhooks ---

test("listWebhooks: GET /webhooks", async () => {
  const result = await listWebhooks();
  assert.ok(capturedRequest?.url.endsWith("/webhooks"));
  assert.equal(capturedRequest?.init.method, "GET");
  assert.equal(result.content[0].type, "text");
});

// --- createWebhook ---

test("createWebhook: POST /webhooks with correct body", async () => {
  const result = await createWebhook({
    name: "My Webhook",
    target: "https://example.com/hook",
    events: ["delivery"],
  });
  assert.ok(capturedRequest?.url.endsWith("/webhooks"));
  assert.equal(capturedRequest?.init.method, "POST");
  const body = JSON.parse(capturedRequest?.init.body as string);
  assert.equal(body.name, "My Webhook");
  assert.equal(body.target, "https://example.com/hook");
  assert.ok(Array.isArray(body.events));
  assert.equal(result.content[0].type, "text");
});

// --- createWebhook zod rejection ---

test("CreateWebhookSchema: rejects missing name/target/events", () => {
  assert.throws(
    () => z.object(CreateWebhookSchema).parse({}),
    /invalid|required/i,
  );
});

// --- deleteWebhook ---

test("deleteWebhook: DELETE /webhooks/:id", async () => {
  await deleteWebhook({ id: "wh-123" });
  assert.ok(capturedRequest?.url.endsWith("/webhooks/wh-123"));
  assert.equal(capturedRequest?.init.method, "DELETE");
});

// --- listSubaccounts ---

test("listSubaccounts: GET /subaccounts", async () => {
  const result = await listSubaccounts();
  assert.ok(capturedRequest?.url.endsWith("/subaccounts"));
  assert.equal(capturedRequest?.init.method, "GET");
  assert.equal(result.content[0].type, "text");
});

// --- createSubaccount ---

test("createSubaccount: POST /subaccounts with correct body", async () => {
  const result = await createSubaccount({
    name: "Test Sub",
    key_label: "test-key",
    key_grants: ["transmissions/view"],
  });
  assert.ok(capturedRequest?.url.endsWith("/subaccounts"));
  assert.equal(capturedRequest?.init.method, "POST");
  const body = JSON.parse(capturedRequest?.init.body as string);
  assert.equal(body.name, "Test Sub");
  assert.equal(body.key_label, "test-key");
  assert.ok(Array.isArray(body.key_grants));
  assert.equal(result.content[0].type, "text");
});

// --- createSubaccount zod rejection ---

test("CreateSubaccountSchema: rejects invalid key_grants", () => {
  assert.throws(
    () => z.object(CreateSubaccountSchema).parse({
      name: "Sub",
      key_label: "lbl",
      key_grants: ["bogus/grant"],
    }),
    /invalid|expected/i,
  );
});
