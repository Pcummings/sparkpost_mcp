import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import {
  listRecipientLists,
  getRecipientList,
  GetRecipientListSchema,
  createRecipientList,
  CreateRecipientListSchema,
  addSuppression,
  AddSuppressionSchema,
  removeSuppression,
  RemoveSuppressionSchema,
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

// --- listRecipientLists ---

test("listRecipientLists: GET /recipient-lists", async () => {
  const result = await listRecipientLists();
  assert.ok(capturedRequest?.url.endsWith("/recipient-lists"));
  assert.equal(capturedRequest?.init.method, "GET");
  assert.equal(result.content[0].type, "text");
  assert.deepEqual(JSON.parse(result.content[0].text), MOCK_DATA);
});

// --- getRecipientList ---

test("getRecipientList: GET /recipient-lists/:id (no show_recipients)", async () => {
  await getRecipientList({ id: "list-1" });
  assert.ok(capturedRequest?.url.endsWith("/recipient-lists/list-1"));
  assert.equal(capturedRequest?.init.method, "GET");
});

test("getRecipientList: GET /recipient-lists/:id?show_recipients=true", async () => {
  await getRecipientList({ id: "list-1", show_recipients: true });
  assert.ok(capturedRequest?.url.endsWith("/recipient-lists/list-1?show_recipients=true"));
});

// --- createRecipientList ---

test("createRecipientList: POST /recipient-lists, reshapes recipients", async () => {
  await createRecipientList({
    recipients: [{ email: "alice@example.com", name: "Alice" }],
  });
  assert.ok(capturedRequest?.url.endsWith("/recipient-lists"));
  assert.equal(capturedRequest?.init.method, "POST");
  const body = JSON.parse(capturedRequest?.init.body as string);
  assert.equal(body.recipients[0].address.email, "alice@example.com");
  assert.equal(body.recipients[0].address.name, "Alice");
  // id/name omitted when not supplied
  assert.equal(body.id, undefined);
});

test("createRecipientList: rejects empty recipients array", () => {
  assert.throws(
    () => z.object(CreateRecipientListSchema).parse({ recipients: [] }),
    /invalid|too_small|at least|expected/i,
  );
});

// --- addSuppression ---

test("addSuppression: PUT /suppression-list/:encodedEmail with type+description", async () => {
  const email = "a@b.com";
  await addSuppression({ email, type: "transactional", description: "hard bounce" });
  assert.ok(capturedRequest?.url.endsWith(`/suppression-list/${encodeURIComponent(email)}`));
  assert.equal(capturedRequest?.init.method, "PUT");
  const body = JSON.parse(capturedRequest?.init.body as string);
  assert.equal(body.type, "transactional");
  assert.equal(body.description, "hard bounce");
});

test("addSuppression: rejects invalid type", () => {
  assert.throws(
    () => z.object(AddSuppressionSchema).parse({ email: "a@b.com", type: "bogus" }),
    /invalid|expected/i,
  );
});

// --- removeSuppression ---

test("removeSuppression: DELETE /suppression-list/:encodedEmail", async () => {
  const email = "a@b.com";
  await removeSuppression({ email });
  assert.ok(capturedRequest?.url.endsWith(`/suppression-list/${encodeURIComponent(email)}`));
  assert.equal(capturedRequest?.init.method, "DELETE");
});
