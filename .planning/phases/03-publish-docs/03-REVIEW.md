---
phase: 03-publish-docs
reviewed: 2026-06-26T00:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - LICENSE
  - README.md
  - package.json
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-06-26
**Depth:** standard
**Files Reviewed:** 3 (LICENSE, README.md, package.json)
**Status:** issues_found

## Summary

Phase 03 is a packaging + documentation phase. I reviewed `package.json`,
`README.md`, and `LICENSE`, and to validate the claims those files make I
cross-referenced the real entrypoint (`index.ts`), the tool source
(`src/sparkpost.ts`), and `tsconfig.json`. I also packed the project with
`npm pack`, installed the resulting tarball into a clean consumer project,
and executed the published bin end-to-end.

**The core packaging is sound and the headline claims check out:**

- `npm pack` ships exactly the right minimal set — `LICENSE`, `README.md`,
  `package.json`, `tsconfig.json`, `index.ts`, `src/sparkpost.ts`. No tests,
  no `.planning/`, no `.env`, no lockfile, no secrets leak into the tarball.
- All **20** README tool-table names match the **20** `server.tool(...)`
  registrations in `index.ts` exactly (byte-for-byte; verified by diff).
- `bin: { "sparkpost-mcp": "index.ts" }` works: in a clean tarball install
  the `npx -y sparkpost-mcp` form runs, executes `index.ts` via its
  `#!/usr/bin/env -S npx tsx` shebang, and exits 1 with the correct
  missing-key message.
- `tsx` belongs in `dependencies`: the published bin is a `.ts` file run by
  tsx at runtime, and it is bundled transitively into a consumer install
  (verified). Placement is correct, not a mistake.
- `LICENSE` is verbatim MIT with the year (2026) and holder (Peter Cummings)
  present. `z.email()` exists in the installed zod 4.4.3, `AbortSignal.timeout`
  is available for `engines: node >=18`, and `prepublishOnly: tsc --noEmit`
  runs clean.

No BLOCKERs. The findings below are publish foot-guns and metadata
inconsistencies — things that bite a subset of install paths or mislead a
reader, not things that break the happy path.

## Warnings

### WR-01: `npx tsx` shebang can hang the MCP server on a cold npx cache (no `-y`)

**File:** `index.ts:1` (the bin entry referenced by `package.json:8`)
**Issue:** The bin shebang is `#!/usr/bin/env -S npx tsx`. In the normal
install path this is fine — `tsx` is bundled as a dependency, so the `npx`
in the shebang resolves it locally and never prompts (verified end-to-end in
a tarball install). But the shebang itself carries **no `-y`/`--yes`**. On any
path where `npx` cannot resolve a local/cached `tsx` (cold npx cache, a
pnpm/Yarn-PnP layout where the package's `tsx` isn't a visible sibling, or a
partial install), `npx` drops into an **interactive** "Ok to proceed? (y)"
prompt. An MCP server is launched over stdio by a client with no TTY, so that
prompt has nothing to answer it and the process hangs instead of starting —
the worst failure mode for an MCP server (silent, no error). The README's
`npx -y sparkpost-mcp` only adds `-y` to the *outer* invocation; it does not
propagate into the shebang's inner `npx tsx`.
**Fix:** Make the bin self-executing without a second `npx` round-trip.
Cleanest is to invoke the bundled tsx loader directly so no install/prompt
can ever occur:
```ts
#!/usr/bin/env -S node --import tsx
```
(`node --import tsx` uses the locally-installed tsx as a loader — same
mechanism as the `test` script already in `package.json:14` — and removes the
nested-`npx` prompt entirely.) If you must keep `npx`, at minimum add `-y`:
`#!/usr/bin/env -S npx -y tsx` so a cold cache auto-installs instead of
hanging.

### WR-02: `prepublishOnly` typechecks `test/**` but tests are not shipped, coupling the publish gate to dev-only files

**File:** `package.json:15` (`"prepublishOnly": "tsc --noEmit"`) + `tsconfig.json:11`
**Issue:** `prepublishOnly` runs `tsc --noEmit`, and `tsconfig.json`'s
`include` is `["index.ts", "src/**/*.ts", "test/**/*.ts"]`. So the
publish-readiness gate also typechecks the test suite — files that are
deliberately excluded from the published tarball (`files` allowlist omits
`test/`, confirmed by `npm pack`). The consequence: a type error in a test
file blocks `npm publish` even though that file never ships, and conversely
the gate's scope no longer matches "what gets published." It also means the
shipped `tsconfig.json` references a `test/` directory that does not exist in
the installed package, so a consumer running `tsc` against it gets "no inputs
were found" noise for that glob.
**Fix:** Decouple the publish gate from test sources. Either point
`prepublishOnly` at a tsconfig that includes only shipped code:
```jsonc
// package.json
"prepublishOnly": "tsc --noEmit -p tsconfig.build.json"
// tsconfig.build.json -> extends ./tsconfig.json, "include": ["index.ts", "src/**/*.ts"]
```
or, if you want one config, drop `test/**/*.ts` from the shipped
`tsconfig.json`'s `include` and run tests via their own `node --import tsx`
invocation (which doesn't need the glob). Lowest-effort acceptable option:
keep behavior but exclude `tsconfig.json` from the `files` allowlist so you
don't ship a config that points at non-existent dirs (see IN-02).

### WR-03: README local-dev config silently requires a prior `npm install` in the cloned repo

**File:** `README.md:29-40`
**Issue:** The "Local dev" MCP config is
`"args": ["tsx", "/absolute/path/to/index.ts"]` with `command: "npx"`.
Unlike the published form, `npx tsx <path>` here resolves `tsx` from
**whatever directory the MCP client spawns the process in**, not from the
repo. If the user hasn't run `npm install` in the clone (so there's no local
`tsx`), `npx tsx` falls back to downloading tsx from the registry, and —
again with no `-y` — can hit the same interactive-prompt hang as WR-01 the
first time, or silently run a different tsx version than the project pins.
The Setup section (`README.md:7-12`) does say `npm install`, but the
local-dev config block is copy-pasted standalone and doesn't restate that
precondition, so a reader who jumps straight to "MCP client config" gets a
config that may hang or behave unexpectedly.
**Issue (secondary):** The published-form `command: "npx"` also assumes the
end user has `npx`/Node on PATH at all; worth a one-line note since MCP
clients are often used by non-developers.
**Fix:** Add a one-line precondition to the local-dev block, e.g. "Requires
`npm install` in the cloned repo first," and prefer the more robust invocation
that uses the project's installed tsx as a loader:
```json
"command": "node",
"args": ["--import", "tsx", "/absolute/path/to/index.ts"]
```
which never reaches for the network and matches the bin fix in WR-01.

## Info

### IN-01: `main: "index.ts"` is misleading for an executable-only package

**File:** `package.json:5`
**Issue:** `index.ts` is the CLI entrypoint and exports nothing (verified — no
`export` statements). `main` advertises a programmatic import surface that does
not exist; `require("sparkpost-mcp")` / `import "sparkpost-mcp"` would execute
the server as a side effect, not return an API. Harmless for an MCP CLI but
inaccurate metadata.
**Fix:** Drop the `main` field (a package with only a `bin` doesn't need it),
or set `"private": false` intent clearly. Removing it is the lazy correct move.

### IN-02: Shipping `tsconfig.json` to consumers serves no runtime purpose

**File:** `package.json:10` (`files` includes `tsconfig.json`)
**Issue:** tsx executes `.ts` without reading the project `tsconfig.json` for
its `include`/`noEmit` settings, and consumers don't compile the package. The
shipped `tsconfig.json` also references a `test/**` glob that isn't in the
tarball (see WR-02). It's dead weight in the published package.
**Fix:** Remove `tsconfig.json` from the `files` allowlist. The publish-time
typecheck (`prepublishOnly`) runs from the source tree where the config still
exists, so nothing is lost.
```json
"files": ["index.ts", "src/", "README.md", "LICENSE"]
```

### IN-03: Author email in `package.json` differs from documented contact / git identity

**File:** `package.json:18` (`"Peter Cummings <peter@linuxguard.io>"`)
**Issue:** Not a defect, just a consistency flag: the author email here
(`peter@linuxguard.io`) differs from the copyright holder context elsewhere in
the project tooling. Confirm this is the intended public-facing contact for the
npm package before publishing, since it's permanent in the registry metadata.
**Fix:** None required if intentional. Verify it's the address you want
associated with the published package.

### IN-04: `engines: node >=18` is satisfiable but untested at the floor

**File:** `package.json:20-22`
**Issue:** The code uses `AbortSignal.timeout` (Node ≥17.3) and `fetch`
(stable/global since Node 18, experimental-with-warning in 18.x, unflagged
from 21). On Node 18.0–18.x, global `fetch` emits an
`ExperimentalWarning` to stderr on first use — harmless but noisy for an MCP
stdio server, and the floor isn't exercised in CI (dev environment runs Node
24). Not a bug; a known-ceiling note.
**Fix:** Optional. Either bump the engines floor to `>=20` (where `fetch` is
stable and quiet) to match what you actually run, or leave as-is and accept the
experimental-warning noise on 18.x. No action needed if 18 support is a
deliberate, accepted target.

---

_Reviewed: 2026-06-26_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
