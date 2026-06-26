# Phase 3: Publish & Docs - Research

**Researched:** 2026-06-26
**Domain:** npm packaging, no-build TypeScript bin publishing, MCP client config
**Confidence:** MEDIUM (npm docs verified via official source; MCP config and tsx patterns LOW via websearch)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** License = MIT. Add LICENSE file at repo root. Set `package.json` `"license": "MIT"` (currently ISC).
- **D-02:** `package.json` `author` = `Peter Cummings <peter@linuxguard.io>`. Omit `repository`/`homepage`/`bugs` (no git remote).
- **D-03:** Move `tsx` from `devDependencies` → `dependencies`. Keep existing shebang `#!/usr/bin/env -S npx tsx`. With tsx as dep, published client config uses `npx sparkpost-mcp` bin form.
- **D-04:** README documents every tool in a single categorized table grouped by area. Worked usage examples for key/most-used tools only. "Documents every tool" = table covers all 20; "with a usage example" = representative examples present. Do NOT treat "no example for every tool" as a coverage gap.
- **D-05:** `scripts.prepublishOnly` = `"tsc --noEmit"`. `files` allowlist = `index.ts`, `src/`, `README.md`, `LICENSE`, `tsconfig.json`. Phase stops at `npm publish --dry-run`.

### Claude's Discretion
- Exact MIT copyright line format/year.
- Exact wording and payloads of README usage examples.
- Whether to add `engines.node` (>=18 recommended; `fetch`/`AbortSignal.timeout` are used).
- Whether to add npm `keywords` (`mcp`, `sparkpost`, `email`).
- Whether to delete `tsconfig.json.bak` (recommend yes; at minimum exclude from tarball).
- Published client-config exact shape (`"command": "npx", "args": ["-y", "sparkpost-mcp"]` vs variations).

### Deferred Ideas (OUT OF SCOPE)
- `repository`/`homepage`/`bugs` metadata — add once a public git remote exists.
- Actual `npm publish` — this phase stops at `--dry-run`.
- CHANGELOG / release automation / version bump tooling.
- US-region as a separate package.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PKG-01 | Per-tool usage examples + MCP client config docs (Claude Desktop and generic) | D-04 defines scope; Section "MCP Client Config Patterns" covers exact JSON shapes; tool inventory in Section "All 20 Tools" |
| PKG-02 | npm publish readiness — `files` allowlist, LICENSE, metadata, `prepublishOnly` typecheck | D-01/D-02/D-03/D-05 define exact values; Sections "files Field" and "Lifecycle Scripts" cover mechanics |
</phase_requirements>

---

## Summary

Phase 3 is a pure configuration-and-docs phase: no new tools, no behavior changes. All implementation decisions are locked in CONTEXT.md. Research confirms the locked decisions are sound and fills in the mechanical details the planner needs.

The two plans (03-01 publish-readiness, 03-02 docs) are independent and can execute in parallel, but 03-01 must be committed before `npm publish --dry-run` can run as the final gate.

**Primary recommendation:** Follow CONTEXT.md decisions exactly. The only non-obvious mechanical detail is that `prepublishOnly` does NOT run during `npm pack --dry-run` — use `npm pack --dry-run` to inspect tarball contents, and `npm publish --dry-run` to trigger the full publish lifecycle including `prepublishOnly`.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| npm package metadata | Package config | — | package.json fields; no runtime tier involved |
| Tarball contents | Package config | — | files allowlist; purely static |
| Typecheck gate | CI / publish lifecycle | — | prepublishOnly; runs at publish time |
| README docs | Docs artifact | — | static markdown; consumed by npm registry and users |
| MCP client config | Client config (user machine) | — | JSON snippet user copies; no server-side change |

---

## Standard Stack

### Core (no new packages; all changes are config edits)

| Item | Current | Change | Why |
|------|---------|--------|-----|
| `tsx` | `devDependencies ^4.22.4` | Move to `dependencies` | Published bin requires tsx at runtime [VERIFIED: npm registry — created 2015, 68M weekly downloads] |
| `typescript` | `devDependencies` | Keep as devDep | Only needed for `tsc --noEmit` gate; not required at runtime |
| `@types/node` | `devDependencies` | Keep as devDep | Type-check only |

**No new packages needed.**

### Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `tsx` | npm | 11 yrs (created 2015-08-20) | 68M/wk | github.com/privatenumber/tsx | SUS (seam: too-new latest publish) | Approved — seam flagged the 2026-05-31 latest-version publish date, not the package age; 11-year-old package with 68M weekly downloads and known repo is legitimate [VERIFIED: npm registry] |

**Packages removed due to SLOP verdict:** none
**Packages flagged as suspicious SUS:** tsx — seam false positive on publish recency; safe to approve [VERIFIED: npm registry, created 2015-08-20]

---

## npm `files` Field Mechanics

[CITED: docs.npmjs.com/cli/v11/configuring-npm/package-json]

### Allowlist semantics

The `files` field is an inclusion allowlist. When set, npm publishes only the listed paths plus the always-included items.

**Precedence order:**
1. `files` field in `package.json` — wins at repo root
2. `.npmignore` at root — cannot override `files` but overrides in subdirectories
3. `.gitignore` — used as fallback only when `.npmignore` is absent entirely

**Key rule:** A subdirectory `.npmignore` CAN exclude files within a directory listed in `files`. (Not relevant here since we have no `.npmignore`.)

### Always included (regardless of `files`)

- `package.json`
- `README` (any case, any extension)
- `LICENSE` / `LICENCE` (any case, any extension)
- `CHANGES` / `CHANGELOG` / `HISTORY` (any case, any extension)
- `NOTICE`
- File(s) listed in the `main` field
- File(s) listed in the `bin` field

**Practical implication for this package:** `index.ts` is already always-included (it is in `bin`). Including it in `files` is redundant but harmless and makes intent explicit.

### Always excluded (cannot override)

- `.git`
- `.npmrc`
- `node_modules/`
- `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `bun.lockb`

**Practical implication:** `package-lock.json` is automatically excluded — do not list it in `files`.

### D-05 `files` value confirmed correct

```json
"files": ["index.ts", "src/", "README.md", "LICENSE", "tsconfig.json"]
```

This produces a tarball containing:
- `package.json` (always)
- `README.md` (always + in files)
- `LICENSE` (always + in files)
- `index.ts` (always via bin + in files)
- `src/sparkpost.ts` (via `src/` glob)
- `tsconfig.json` (needed for `tsc --noEmit` to work post-install if user runs it)

**Explicitly excluded by omission:** `.planning/`, `.github/`, `test/`, `tsconfig.json.bak`, `.gitignore`, `package-lock.json` (auto-excluded).

### Inspecting the tarball

```bash
# Dry run — lists files + sizes, does not write a .tgz
npm pack --dry-run

# Full pack — writes sparkpost-mcp-1.0.0.tgz, can be inspected
npm pack
tar -tzf sparkpost-mcp-1.0.0.tgz
```

`npm publish --dry-run` runs the full publish lifecycle (including `prepublishOnly`) without uploading.

---

## Lifecycle Scripts

[CITED: docs.npmjs.com/cli/v11/using-npm/scripts/]

### Script execution timing

| Script | npm publish | npm pack | npm install | npm ci |
|--------|-------------|----------|-------------|--------|
| `prepublishOnly` | YES (first) | NO | NO | NO |
| `prepack` | YES | YES | NO | NO |
| `prepare` | YES | YES | YES | NO |
| `postpack` | YES | YES | NO | NO |

### Order during `npm publish`

```
prepublishOnly → prepack → prepare → postpack → publish → postpublish
```

### D-05 `prepublishOnly` confirmed correct

```json
"scripts": {
  "prepublishOnly": "tsc --noEmit"
}
```

`tsc --noEmit` runs only on `npm publish` — not on `npm install` or `npm pack`. This is exactly what D-05 specifies.

**Implication for verification:** Running `npm pack --dry-run` does NOT trigger `prepublishOnly`. To test the full gate, run `npm publish --dry-run`.

---

## No-Build tsx-Run Publishing

[LOW confidence — websearch + training knowledge]

### How it works

`index.ts` has shebang `#!/usr/bin/env -S npx tsx`. npm's bin mechanism creates a platform wrapper at install time:

- **macOS/Linux:** symlink to `index.ts`; shebang is executed by the kernel; env `-S` splits the remainder as separate args so `npx tsx` is called correctly
- **Windows:** npm generates a `.cmd` wrapper that invokes `node node_modules/.bin/tsx index.ts` explicitly — shebang is NOT needed on Windows; the `.cmd` wrapper handles it

[ASSUMED] npm automatically generates a `.cmd` bin wrapper on Windows even for non-.js files listed in `bin`.

### Why tsx must be in `dependencies` (D-03)

When a user runs `npx sparkpost-mcp` or installs the package globally:

1. npm installs `sparkpost-mcp` and its `dependencies`
2. `tsx` is in `dependencies` → installed into `node_modules/.bin/tsx`
3. The shebang `#!/usr/bin/env -S npx tsx` resolves `tsx` from the local `node_modules/.bin` via PATH

If `tsx` were in `devDependencies`:
- It is NOT installed when users `npm install sparkpost-mcp`
- `npx sparkpost-mcp` would break at runtime: `tsx: command not found`

### Known pitfalls

| Pitfall | Detail | Mitigation |
|---------|--------|------------|
| tsx not found | tsx in devDeps only | Move to deps (D-03) |
| bin not executable | index.ts missing executable bit | Already `chmod +x` per CONTEXT.md |
| PATH in Claude Desktop | Claude Desktop launches with minimal PATH; `npx` may not resolve | Use full path workaround in config (see MCP Config section) |
| Windows shebang | `#!/usr/bin/env -S` not supported on Windows | npm .cmd wrapper handles Windows; shebang only needed for Unix |
| `type: module` + tsx | Package is ESM (`"type": "module"`); tsx handles ESM natively | No action needed |

---

## MCP Client Config Patterns

[CITED: modelcontextprotocol.io/quickstart/user — official MCP docs]

### Published package (post-Phase 3 target)

```json
{
  "mcpServers": {
    "sparkpost": {
      "command": "npx",
      "args": ["-y", "sparkpost-mcp"],
      "env": {
        "SPARKPOST_API_KEY": "your-key"
      }
    }
  }
}
```

The `-y` flag auto-confirms `npx`'s install prompt on first run. Without `-y`, Claude Desktop would hang waiting for user confirmation.

### Local dev (current form, keep as alternative)

```json
{
  "mcpServers": {
    "sparkpost": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/sparkpost-mcp/index.ts"],
      "env": {
        "SPARKPOST_API_KEY": "your-key"
      }
    }
  }
}
```

### Claude Code (`~/.claude/settings.json` or `.claude/settings.json`)

```json
{
  "mcpServers": {
    "sparkpost": {
      "command": "npx",
      "args": ["-y", "sparkpost-mcp"],
      "env": {
        "SPARKPOST_API_KEY": "your-key"
      }
    }
  }
}
```

### PATH pitfall for Claude Desktop

Claude Desktop launches MCP servers with a minimal `$PATH` — shell rc files are not sourced. On macOS with nvm or Homebrew, `npx` may not be on this minimal PATH.

**Workaround:** Use full path to npx:
```json
"command": "/usr/local/bin/npx"
```
or for Homebrew:
```json
"command": "/opt/homebrew/bin/npx"
```

**Finding your npx path:** `which npx` in a terminal.

**Logs for debugging:** `~/Library/Logs/Claude/mcp-server-sparkpost.log` (macOS)

### Config file locations
- **Claude Desktop macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Claude Desktop Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **Claude Code:** `~/.claude/settings.json` (global) or `.claude/settings.json` (project)

---

## All 20 Tools (Source of Truth for README Table)

Extracted from `index.ts` `server.tool(...)` registrations. Grouped for D-04 categorized table:

### Account
| Tool | Description |
|------|-------------|
| `get_account` | Get SparkPost EU account info and usage |

### Templates
| Tool | Description |
|------|-------------|
| `list_templates` | List all email templates |
| `get_template` | Get a specific template by ID |
| `create_template` | Create a new email template |
| `update_template` | Update an existing template |

### Send
| Tool | Description |
|------|-------------|
| `send_email` | Send a test/transactional email |

### Suppression
| Tool | Description |
|------|-------------|
| `check_suppression` | Check if an address is suppressed |
| `add_suppression` | Add or update a suppression entry for one email |
| `remove_suppression` | Remove the suppression entry for one email |

### Sending Domains
| Tool | Description |
|------|-------------|
| `list_sending_domains` | List all verified sending domains |

### Webhooks
| Tool | Description |
|------|-------------|
| `list_webhooks` | List all webhooks |
| `create_webhook` | Create a webhook (name, target URL, events) |
| `delete_webhook` | Delete a single webhook by id |

### Subaccounts
| Tool | Description |
|------|-------------|
| `list_subaccounts` | List all subaccounts |
| `create_subaccount` | Create a subaccount with an API key (name, key_label, key_grants) |

### Message Events
| Tool | Description |
|------|-------------|
| `search_message_events` | Search message events (one page; cursor + per_page for paging) |
| `get_deliverability_metrics` | Get deliverability metrics (from + metrics required; group_by selects a breakdown dimension) |

### Recipient Lists
| Tool | Description |
|------|-------------|
| `list_recipient_lists` | List all recipient lists |
| `get_recipient_list` | Get a recipient list by id (optionally with recipients) |
| `create_recipient_list` | Create a recipient list (recipients required; id/name auto-generated if omitted) |

**Total: 20 tools across 8 categories.**

### Key tools for worked examples (D-04)

Per D-04, examples are provided for key/most-used tools only:

1. **`send_email`** — most important capability; two modes (inline content vs template)
2. **`create_template`** — common setup step
3. **`search_message_events`** — analytics/debugging use case

---

## package.json Changes Required (PKG-02)

| Field | Current | Required | Decision |
|-------|---------|----------|----------|
| `license` | `"ISC"` | `"MIT"` | D-01 |
| `author` | `""` | `"Peter Cummings <peter@linuxguard.io>"` | D-02 |
| `files` | absent | `["index.ts", "src/", "README.md", "LICENSE", "tsconfig.json"]` | D-05 |
| `scripts.prepublishOnly` | absent | `"tsc --noEmit"` | D-05 |
| `tsx` location | devDependencies | dependencies | D-03 |
| `keywords` | `[]` | `["mcp", "sparkpost", "email"]` (discretion) | Claude's Discretion |
| `engines.node` | absent | `">=18"` (discretion) | Claude's Discretion |

**New file required:** `LICENSE` (MIT text, copyright `2026 Peter Cummings`).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tarball inspection | Custom script | `npm pack --dry-run` | Built-in, shows file list + sizes |
| Publish gate | Custom pre-commit hook | `prepublishOnly` | Standard npm lifecycle; runs only on publish |
| TypeScript check | Custom build script | `tsc --noEmit` | Already in package.json as `typecheck`; reuse in prepublishOnly |

---

## Common Pitfalls

### Pitfall 1: tsx in devDependencies after publish
**What goes wrong:** `npx sparkpost-mcp` works locally (tsx in devDeps, installed) but fails for other users with `tsx: command not found`.
**Why it happens:** `devDependencies` are not installed by consumers.
**How to avoid:** D-03 is exactly the fix — move tsx to `dependencies`.
**Warning signs:** Test by running `npm install --omit=dev` in the project, then trying the bin.

### Pitfall 2: bin file not executable
**What goes wrong:** `permission denied` when running the bin after install.
**Why it happens:** `npm pack` does not chmod the file; npm sets bin permissions from the file's current mode.
**How to avoid:** index.ts is already `chmod +x` per CONTEXT.md — verify before publishing.
**Warning signs:** `ls -la index.ts` should show `-rwxr-xr-x`.

### Pitfall 3: prepublishOnly not triggered by npm pack --dry-run
**What goes wrong:** Developer runs `npm pack --dry-run` to validate, assumes typecheck ran, publishes a broken package.
**Why it happens:** `prepublishOnly` only runs during `npm publish`, not `npm pack`.
**How to avoid:** For final validation, run `npm publish --dry-run` (not just `npm pack --dry-run`).
**Warning signs:** No "tsc" output seen when running `npm pack --dry-run`.

### Pitfall 4: Claude Desktop PATH missing npx
**What goes wrong:** MCP server fails to start; log shows `spawn npx ENOENT`.
**Why it happens:** Claude Desktop launches with minimal system PATH; shell rc files not sourced.
**How to avoid:** README should document the full-path workaround and where to find logs.
**Warning signs:** `mcp-server-sparkpost.log` showing ENOENT.

### Pitfall 5: tsconfig.json.bak in tarball
**What goes wrong:** Stray backup file ships to consumers.
**Why it happens:** Not listed in `files`, so it would be excluded with the D-05 allowlist.
**How to avoid:** The D-05 `files` allowlist already excludes it. Recommend deleting the file outright.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in test runner (`node --test`) |
| Config file | none — command in package.json scripts |
| Quick run command | `npm test` |
| Full suite command | `npm test && npm run typecheck` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | Notes |
|--------|----------|-----------|-------------------|-------|
| PKG-01 | README has all 20 tools | manual-only | n/a | Visual inspection of rendered README |
| PKG-01 | MCP client config block present | manual-only | n/a | Visual inspection |
| PKG-02 | `files` allowlist produces correct tarball | manual | `npm pack --dry-run` | Check output for expected files |
| PKG-02 | `prepublishOnly` typecheck passes | automated | `npm publish --dry-run` | Triggers `tsc --noEmit` |
| PKG-02 | LICENSE present, license field MIT | manual | `ls LICENSE && node -p "require('./package.json').license"` | Quick shell check |

### Phase Gate

`npm publish --dry-run` exits 0 with expected files listed.

---

## Security Domain

`security_enforcement: true`, `security_asvs_level: 1`.

### Applicable ASVS Categories (Phase 3 scope: docs + packaging)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Phase 3 adds no auth code |
| V3 Session Management | No | Phase 3 adds no session code |
| V4 Access Control | No | Phase 3 adds no access control code |
| V5 Input Validation | No | Phase 3 adds no input handling code |
| V6 Cryptography | No | Phase 3 adds no crypto code |

**Note:** The MIT LICENSE file itself and npm package metadata carry no security risk. The `prepublishOnly` typecheck is a quality gate, not a security control. SPARKPOST_API_KEY handling already exists and is unchanged.

**Supply chain note:** tsx is moved from devDeps → deps, increasing the published package's dependency surface. tsx is a well-established package (68M weekly downloads, created 2015) [VERIFIED: npm registry]. No postinstall scripts [VERIFIED: npm registry].

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | `npm pack`, `npm publish --dry-run`, typecheck | Yes | v24.18.0 | — |
| npm | `npm pack --dry-run`, `npm publish --dry-run` | Yes | 11.16.0 | — |
| tsc (`typescript`) | `prepublishOnly: tsc --noEmit` | Yes (devDep) | 6.0.3 | — |

**Missing dependencies:** None.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | npm generates a .cmd wrapper on Windows for non-.js bin entries listed in `bin` field, so the shebang is not needed on Windows | No-Build tsx-Run Publishing | Low — bin may not work on Windows; not a stated requirement |
| A2 | `chmod +x` status of `index.ts` is preserved through git checkout on the dev machine | No-Build tsx-Run Publishing | Low — if lost, bin fails on Unix; easy to fix with `chmod +x index.ts` |

---

## Open Questions

1. **`engines.node` floor value**
   - What we know: The package uses `fetch` (native in Node 18+) and `AbortSignal.timeout` (Node 17.3+). Node 18 is the lowest LTS that covers both.
   - What's unclear: Whether to set `engines.node` at all (npm won't block install, just warns).
   - Recommendation: Add `"engines": { "node": ">=18" }` — harmless, documents the real minimum.

2. **`npm publish --dry-run` vs `npm pack --dry-run` for phase gate**
   - What we know: Only `npm publish --dry-run` triggers `prepublishOnly`.
   - What's unclear: Whether the task description "npm publish --dry-run produces a clean, minimal tarball" means we also need to verify file list separately.
   - Recommendation: Use both — `npm pack --dry-run` to verify file list, `npm publish --dry-run` for the full lifecycle gate.

---

## Sources

### Primary (MEDIUM confidence — official docs)
- [docs.npmjs.com/cli/v11/configuring-npm/package-json](https://docs.npmjs.com/cli/v11/configuring-npm/package-json) — files field, always-included/excluded, bin field behavior
- [docs.npmjs.com/cli/v11/using-npm/scripts/](https://docs.npmjs.com/cli/v11/using-npm/scripts/) — prepublishOnly, prepare, prepack lifecycle order
- [docs.npmjs.com/cli/v11/commands/npm-pack](https://docs.npmjs.com/cli/v11/commands/npm-pack) — npm pack --dry-run behavior

### Secondary (MEDIUM confidence — official MCP docs)
- [modelcontextprotocol.io/quickstart/user](https://modelcontextprotocol.io/quickstart/user) — claude_desktop_config.json format, npx -y pattern

### Tertiary (LOW confidence — websearch)
- npm publish --dry-run / files field community articles — confirmed official doc findings
- tsx shebang Windows behavior — training knowledge + websearch, marked [ASSUMED] where unverified
- Claude Desktop PATH pitfall — multiple community reports, consistent finding

---

## Metadata

**Confidence breakdown:**
- npm files/lifecycle mechanics: MEDIUM — fetched from docs.npmjs.com
- tsx runtime dep requirement: MEDIUM — logical from npm dep semantics + websearch confirmation
- MCP client config shape: MEDIUM — fetched from modelcontextprotocol.io official docs
- Windows shebang behavior: LOW — training knowledge, not verified against tsx docs

**Research date:** 2026-06-26
**Valid until:** 2026-07-26 (npm packaging semantics are stable)
