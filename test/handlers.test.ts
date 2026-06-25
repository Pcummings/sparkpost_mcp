import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import {
  getAccount,
  listTemplates,
  listSendingDomains,
  getTemplate,
  createTemplate,
  updateTemplate,
  sendEmail,
  checkSuppression,
  GetTemplateSchema,
  CreateTemplateSchema,
  UpdateTemplateSchema,
  SendEmailSchema,
  CheckSuppressionSchema,
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

// --- No-arg handlers ---

test("getAccount: GET /account?include=usage", async () => {
  const result = await getAccount();
  assert.ok(capturedRequest?.url.endsWith("/account?include=usage"));
  assert.equal(capturedRequest?.init.method, "GET");
  assert.equal(result.content[0].type, "text");
  assert.deepEqual(JSON.parse(result.content[0].text), MOCK_DATA);
});

test("listTemplates: GET /templates", async () => {
  const result = await listTemplates();
  assert.ok(capturedRequest?.url.endsWith("/templates"));
  assert.equal(capturedRequest?.init.method, "GET");
  assert.equal(result.content[0].type, "text");
  assert.deepEqual(JSON.parse(result.content[0].text), MOCK_DATA);
});

test("listSendingDomains: GET /sending-domains", async () => {
  const result = await listSendingDomains();
  assert.ok(capturedRequest?.url.endsWith("/sending-domains"));
  assert.equal(capturedRequest?.init.method, "GET");
  assert.equal(result.content[0].type, "text");
  assert.deepEqual(JSON.parse(result.content[0].text), MOCK_DATA);
});

// --- getTemplate ---

test("getTemplate: GET /templates/:id (no draft)", async () => {
  const result = await getTemplate({ template_id: "abc" });
  assert.ok(capturedRequest?.url.endsWith("/templates/abc"));
  assert.equal(capturedRequest?.init.method, "GET");
  assert.equal(result.content[0].type, "text");
  assert.deepEqual(JSON.parse(result.content[0].text), MOCK_DATA);
});

test("getTemplate: GET /templates/:id?draft=true", async () => {
  await getTemplate({ template_id: "abc", draft: true });
  assert.ok(capturedRequest?.url.endsWith("/templates/abc?draft=true"));
});

// --- createTemplate ---

test("createTemplate: POST /templates with correct body", async () => {
  const result = await createTemplate({
    id: "tpl-1",
    name: "Test",
    subject: "Hello",
    html: "<p>hi</p>",
    from_email: "sender@example.com",
  });
  assert.ok(capturedRequest?.url.endsWith("/templates"));
  assert.equal(capturedRequest?.init.method, "POST");
  const body = JSON.parse(capturedRequest?.init.body as string);
  assert.equal(body.id, "tpl-1");
  assert.equal(body.name, "Test");
  assert.equal(body.content.from.email, "sender@example.com");
  assert.equal(body.content.subject, "Hello");
  assert.equal(body.content.html, "<p>hi</p>");
  assert.equal(result.content[0].type, "text");
  assert.deepEqual(JSON.parse(result.content[0].text), MOCK_DATA);
});

// --- updateTemplate ---

test("updateTemplate: PUT /templates/:id with defined keys only", async () => {
  const result = await updateTemplate({ template_id: "tpl-1", subject: "New Subject" });
  assert.ok(capturedRequest?.url.endsWith("/templates/tpl-1"));
  assert.equal(capturedRequest?.init.method, "PUT");
  const body = JSON.parse(capturedRequest?.init.body as string);
  assert.equal(body.content.subject, "New Subject");
  assert.equal(body.content.html, undefined);  // not passed → absent
  assert.equal(result.content[0].type, "text");
  assert.deepEqual(JSON.parse(result.content[0].text), MOCK_DATA);
});

test("updateTemplate: PUT /templates/:id?update_published=true", async () => {
  await updateTemplate({ template_id: "tpl-1", subject: "S", update_published: true });
  assert.ok(capturedRequest?.url.endsWith("/templates/tpl-1?update_published=true"));
});

// --- sendEmail ---

test("sendEmail: POST /transmissions (inline content)", async () => {
  const result = await sendEmail({
    to: "to@example.com",
    from_email: "from@example.com",
    subject: "Hi",
    html: "<p>body</p>",
  });
  assert.ok(capturedRequest?.url.endsWith("/transmissions"));
  assert.equal(capturedRequest?.init.method, "POST");
  const body = JSON.parse(capturedRequest?.init.body as string);
  assert.equal(body.recipients[0].address.email, "to@example.com");
  assert.equal(body.content.from, "from@example.com");
  assert.equal(body.content.subject, "Hi");
  assert.equal(body.content.html, "<p>body</p>");
  assert.equal(body.content.template_id, undefined);
  assert.equal(result.content[0].type, "text");
  assert.deepEqual(JSON.parse(result.content[0].text), MOCK_DATA);
});

test("sendEmail: POST /transmissions (template branch)", async () => {
  await sendEmail({ to: "to@example.com", from_email: "from@example.com", template_id: "my-tpl" });
  const body = JSON.parse(capturedRequest?.init.body as string);
  assert.equal(body.content.template_id, "my-tpl");
  assert.equal(body.content.from, undefined);  // inline from not set in template branch
});

// --- checkSuppression ---

test("checkSuppression: GET /suppression-list/:encodedEmail", async () => {
  const result = await checkSuppression({ email: "a@b.com" });
  assert.ok(capturedRequest?.url.endsWith(`/suppression-list/${encodeURIComponent("a@b.com")}`));
  assert.equal(capturedRequest?.init.method, "GET");
  assert.equal(result.content[0].type, "text");
  assert.deepEqual(JSON.parse(result.content[0].text), MOCK_DATA);
});

// --- Zod schema rejection tests ---

test("GetTemplateSchema: rejects non-string template_id", () => {
  assert.throws(
    () => z.object(GetTemplateSchema).parse({ template_id: 42 }),
    /expected string/i,
  );
});

test("CreateTemplateSchema: rejects invalid from_email", () => {
  assert.throws(
    () => z.object(CreateTemplateSchema).parse({
      id: "x", name: "n", subject: "s", html: "<p/>", from_email: "not-an-email",
    }),
    /Invalid email address/,
  );
});

test("UpdateTemplateSchema: rejects non-string template_id", () => {
  assert.throws(
    () => z.object(UpdateTemplateSchema).parse({ template_id: 99 }),
    /expected string/i,
  );
});

test("SendEmailSchema: rejects invalid to email", () => {
  assert.throws(
    () => z.object(SendEmailSchema).parse({ to: "not-an-email", from_email: "ok@example.com" }),
    /Invalid email address/,
  );
});

test("SendEmailSchema: rejects invalid from_email", () => {
  assert.throws(
    () => z.object(SendEmailSchema).parse({ to: "ok@example.com", from_email: "not-an-email" }),
    /Invalid email address/,
  );
});

test("CheckSuppressionSchema: rejects non-email", () => {
  assert.throws(
    () => z.object(CheckSuppressionSchema).parse({ email: "notanemail" }),
    /Invalid email address/,
  );
});
