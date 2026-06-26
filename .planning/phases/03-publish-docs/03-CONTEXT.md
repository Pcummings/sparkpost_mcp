# Phase 3: Publish & Docs - Context

**Gathered:** 2026-06-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the **existing** 20-tool SparkPost MCP server installable from npm and documented — no behavior change to any tool. Two deliverables, fixed by ROADMAP:

- **PKG-02** npm publish readiness — LICENSE, `files` allowlist, author/metadata, `prepublishOnly` typecheck, `tsx` made runtime-resolvable. Bar: `npm publish --dry-run` produces a clean, minimal tarball.
- **PKG-01** Usage docs — README documents every tool + shows MCP client config for a published package.

This phase ships **no real `npm publish`** — the success bar is `--dry-run` only. Actual publish is a manual follow-up. No new tools, no infra change. Roadmap plan split is fixed: 03-01 publish readiness · 03-02 docs.

</domain>

<decisions>
## Implementation Decisions

### License & metadata
- **D-01:** License = **MIT**. Add a `LICENSE` file at repo root (standard MIT text, copyright "Peter Cummings"). Set `package.json` `"license": "MIT"` (currently `ISC` — change it so file and field match).
- **D-02:** `package.json` `author` = `Peter Cummings <peter@linuxguard.io>` (matches the repo's git commit identity). **Omit** `repository` / `homepage` / `bugs` for now — no git remote exists. Add them when a public repo is created (see Deferred).

### bin & no-build runtime
- **D-03:** Move **`tsx` from `devDependencies` → `dependencies`** so the published bin runs reliably after install. Keep the existing shebang `#!/usr/bin/env -S npx tsx` in `index.ts` (already present; file is executable). With tsx resolvable as a dependency, the published client config can invoke the package by bin name (`npx sparkpost-mcp`) instead of an absolute path to `index.ts`. No build step — `.ts` ships and runs via tsx (locked project constraint).

### README documentation (PKG-01)
- **D-04:** README documents **every** tool (all 20) in a single **categorized table** grouped by area (account · templates · send · suppression check/add/remove · sending-domains · webhooks · subaccounts · message-events · deliverability metrics · recipient-lists). Worked **usage examples for the key/most-used tools only** (e.g. `send_email`, `create_template`, `search_message_events`) — not one example per tool. **Interpretation of ROADMAP success criterion 1** ("documents every tool with a usage example"): "documents every tool" = the table covers all 20; "with a usage example" = representative examples present. This is a deliberate user decision — downstream agents should NOT treat "no example for every single tool" as a coverage gap. Update the MCP client config block to the published-package form and keep a local-dev (`tsx index.ts`) form.

### Publish gates & tarball (PKG-02)
- **D-05:** `package.json` `scripts.prepublishOnly` = `"tsc --noEmit"` (**typecheck only** — matches success criterion 2). `files` allowlist = `index.ts`, `src/`, `README.md`, `LICENSE`, `tsconfig.json`. Excludes `test/`, `.planning/`, `.github/`, `tsconfig.json.bak`, `*.log`, `.env` (npm already drops `node_modules`/`.git`). Target: `npm publish --dry-run` → clean minimal tarball (success criterion 3).

### Claude's Discretion
- Exact MIT copyright line format/year; exact wording and payloads of the README usage examples.
- Whether to add `engines.node` (a sane floor like `>=18` is reasonable — `fetch` / `AbortSignal.timeout` are used) and npm `keywords` (`mcp`, `sparkpost`, `email`) for discoverability — low-risk niceties.
- Whether to delete the stray `tsconfig.json.bak` (recommend yes; at minimum keep it out of the tarball).
- Published client-config exact shape (`"command": "npx", "args": ["sparkpost-mcp"]` vs `"command": "sparkpost-mcp"`) — follows from the bin.
- Which exact tools land in which of the 2 fixed plans beyond the stated 03-01 / 03-02 grouping.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external ADRs/specs in-repo. Requirements captured in `.planning/REQUIREMENTS.md` (PKG-01, PKG-02) and the decisions above.

Research targets (not repo docs — for the researcher to verify; user chose to research before planning):
- **npm packaging** — `files` allowlist semantics and precedence vs `.npmignore`/`.gitignore`; what npm always includes (package.json, README, LICENSE) and always excludes; `npm publish --dry-run` tarball inspection (`npm pack --dry-run`).
- **`prepublishOnly` lifecycle** — when it runs (publish only, not on install), correct script wiring.
- **Publishing a no-build, tsx-run TypeScript package** — shipping `.ts` as the entry, bin shebang `#!/usr/bin/env -S npx tsx`, and tsx-as-runtime-dependency so `npx <pkg>` resolves without a cold fetch; known pitfalls.
- **MCP client config for a published npm server** — Claude Desktop `claude_desktop_config.json` stdio shape and generic form using `npx <pkg>` (vs the current absolute-path `tsx` form).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `README.md` already has Setup + MCP client config + an 8-tool table — **extend, don't rewrite**. Client config currently uses the absolute-path tsx form (`"args": ["tsx", "/absolute/path/to/index.ts"]`).
- `index.ts` already carries the shebang `#!/usr/bin/env -S npx tsx` and is executable (`chmod +x`) — the bin works locally today; installed use just needs tsx resolvable.
- The 20 tool names + descriptions are the README table's source of truth: `server.tool(...)` registrations in `index.ts` and the exported handlers/schemas in `src/sparkpost.ts`.

### Established Patterns
- **No build step** — tsx runs `.ts` directly. `package.json`: `main: index.ts`, `bin: { "sparkpost-mcp": "index.ts" }`, `type: module`.
- Currently `license: ISC`, `author: ""`, no `files`, no `prepublishOnly` — all addressed here.

### Integration Points
- `package.json`: add `files`, change `license` → MIT, set `author`, add `scripts.prepublishOnly`, move `tsx` devDep → dep, optional `engines`/`keywords`.
- New file: `LICENSE` (repo root, MIT).
- `README.md`: expand tool table to all 20 + key usage examples + published-package client config.

</code_context>

<specifics>
## Specific Ideas

- Keep the existing `#!/usr/bin/env -S npx tsx` shebang — the fix is making tsx resolvable (move to `dependencies`), not changing the shebang.
- Current README client config: `{ "command": "npx", "args": ["tsx", "/absolute/path/to/index.ts"], "env": { "SPARKPOST_API_KEY": "..." } }` — update to the published-package form, keep a local-dev variant.
- `tsconfig.json.bak` is stray cruft in repo root — exclude from the tarball (and likely delete).
- `.gitignore` already covers `node_modules/`, `*.log`, `.env`.

</specifics>

<deferred>
## Deferred Ideas

- **`repository` / `homepage` / `bugs` metadata** — add once a public git remote / GitHub repo exists (D-02). No remote today.
- **Actual `npm publish`** — this phase stops at `--dry-run`; real publish (and npm account/2FA) is a manual follow-up.
- **CHANGELOG / release automation / version bump tooling** — not in v1.1 scope.
- **US-region as a separate package** — already out of scope (covered by `SPARKPOST_API_BASE`).

None of these block Phase 3.

</deferred>

---

*Phase: 03-publish-docs*
*Context gathered: 2026-06-26*
