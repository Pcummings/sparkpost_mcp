import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { spRequest } from "../src/sparkpost.js";

// ponytail: duck-typed mock avoids Node 24 undici Response constructor 204 bug
function mockResponse(body: string, status: number, statusText = "OK"): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    text: async () => body,
  } as unknown as Response;
}

let savedFetch: typeof globalThis.fetch;
beforeEach(() => { savedFetch = globalThis.fetch; });
afterEach(() => { globalThis.fetch = savedFetch; });

test("2xx JSON: resolves parsed body", async () => {
  globalThis.fetch = async () => mockResponse('{"results":{"balance":100}}', 200);
  const data = await spRequest("/account?include=usage");
  assert.deepEqual(data, { results: { balance: 100 } });
});

test("non-OK throws with status in message", async () => {
  globalThis.fetch = async () => mockResponse("Forbidden", 403, "Forbidden");
  await assert.rejects(
    () => spRequest("/account?include=usage"),
    (err: Error) => {
      assert.match(err.message, /^SparkPost 403 Forbidden:/);
      return true;
    },
  );
});

test("empty/204 body resolves {}", async () => {
  globalThis.fetch = async () => mockResponse("", 200);
  const data = await spRequest("/transmissions", "POST", { test: true });
  assert.deepEqual(data, {});
});

test("fetch rejects (AbortError) propagates", async () => {
  globalThis.fetch = async () => { throw new DOMException("The operation was aborted", "AbortError"); };
  await assert.rejects(
    () => spRequest("/account?include=usage"),
    { name: "AbortError" },
  );
});
