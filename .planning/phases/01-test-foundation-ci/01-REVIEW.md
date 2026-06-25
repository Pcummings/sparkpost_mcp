---
phase: 01-test-foundation-ci
reviewed: 2026-06-25T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - src/sparkpost.ts
  - index.ts
  - test/spRequest.test.ts
  - test/handlers.test.ts
  - .github/workflows/ci.yml
findings:
  critical: 0
  warning: 2
  info: 1
  total: 3
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-06-25
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

The index.ts → src/sparkpost.ts split is behaviorally correct. All 8 handlers
produce identical URLs, methods, and request bodies compared to the original.
The `getHeaders()` deferral satisfies D-02. The key-guard and `server.connect()`
live only in `index.ts` (D-03). Tests are real (all assertions are meaningful,
fetch is restored in `afterEach`, no real API key needed). CI has no secret
leakage. Tests pass: 21/21.

Two warnings: a falsy-string silent-drop bug in `updateTemplate` (pre-existing,
carried forward) and a coverage gap where the `updateTemplate` test does not
catch it. One info item on `API_BASE` module-level read.

---

## Warnings

### WR-01: updateTemplate silently drops empty-string field values

**File:** `src/sparkpost.ts:115-117`
**Issue:** The guard `if (subject)`, `if (html)`, `if (text)` treats empty string
`""` as falsy and silently omits the field from the API request. A caller passing
`subject: ""` to clear a subject line gets a no-op PUT instead of an error or
the intended update. This bug existed in the original `index.ts` and was carried
forward unchanged — it is not a regression introduced here, but it is the right
moment to note it before Phase 2 adds more callers.
**Fix:**
```typescript
if (subject !== undefined) content.subject = subject;
if (html !== undefined) content.html = html;
if (text !== undefined) content.text = text;
```

### WR-02: updateTemplate test does not cover the falsy-string drop path

**File:** `test/handlers.test.ts:112-121`
**Issue:** The test for `updateTemplate` only asserts that a provided field
(`subject: "New Subject"`) is present in the body and that an absent field
(`html`) is `undefined`. It does not test the empty-string case (`subject: ""`),
so the WR-01 bug passes silently. The test gives false confidence that partial
updates work correctly.
**Fix:** Add a case:
```typescript
test("updateTemplate: empty string subject is sent (not dropped)", async () => {
  await updateTemplate({ template_id: "tpl-1", subject: "" });
  const body = JSON.parse(capturedRequest?.init.body as string);
  assert.equal(body.content.subject, ""); // fails today; documents the bug
});
```
This test will fail until WR-01 is fixed, making the gap visible.

---

## Info

### IN-01: API_BASE read at module import time (not deferred)

**File:** `src/sparkpost.ts:3`
**Issue:** `const API_BASE = process.env.SPARKPOST_API_BASE ?? "..."` is
evaluated once when the module is first imported, not at call time. This means
changing `SPARKPOST_API_BASE` after import (e.g., in a per-test `beforeEach`)
would have no effect. The context (D-02) only required deferring
`SPARKPOST_API_KEY`; `API_BASE` deferral was not required. Current tests use
`.endsWith()` URL checks and are unaffected. Flagged only so future test authors
know they cannot override the base URL per-test without a refactor.
**Fix:** If per-test base URL overrides become needed, move the read into
`spRequest` alongside `getHeaders()`, or accept as a known limitation.

---

_Reviewed: 2026-06-25_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
