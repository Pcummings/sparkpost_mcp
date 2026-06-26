# Phase 3: Publish & Docs - Discussion Log

**Date:** 2026-06-26
**Mode:** default (interactive)

Human-reference only. Decisions of record live in `03-CONTEXT.md`.

## Areas selected
License & metadata · bin under npx · README depth (20 tools) · Publish gates & files (all four).

## Q&A

### License
- Options: MIT / ISC / Apache-2.0
- **Chose: MIT** → LICENSE file + `package.json` license (from ISC).

### Metadata (author/repo)
- Options: cummings.dk no repo / linuxguard.io no repo / provide repo URL
- **Chose: linuxguard.io, no repo** → author `Peter Cummings <peter@linuxguard.io>`; repository/homepage/bugs omitted (no git remote).

### bin / npx runtime
- Options: tsx as runtime dependency / keep tsx as devDependency
- **Chose: tsx as runtime dependency** → move devDep→dep; keep `#!/usr/bin/env -S npx tsx` shebang; published config can use `npx sparkpost-mcp`.

### README depth (20 tools)
- Options: grouped table + per-group examples / full example per tool / table + a few key examples
- **Chose: table + a few key examples** → all 20 tools in a categorized table; usage examples for key tools only (send_email, create_template, search_message_events). Logged interpretation of success-criterion 1 in CONTEXT (table = "every tool"; key examples = "with a usage example").

### Publish gate & tarball
- Options: typecheck only / typecheck + test / typecheck only, drop tsconfig
- **Chose: typecheck only** → `prepublishOnly: tsc --noEmit`; `files` = index.ts, src/, README.md, LICENSE, tsconfig.json.

## Deferred
repository/homepage/bugs metadata (await public remote) · actual `npm publish` (phase stops at `--dry-run`) · CHANGELOG/release automation.

## Claude's discretion
MIT copyright line · example payloads · optional `engines.node`/`keywords` · delete `tsconfig.json.bak` · published client-config exact shape · tool→plan split beyond 03-01/03-02.
