# sparkpost-mcp

MCP server exposing the [SparkPost](https://www.sparkpost.com/) (EU) email API as 20 tools — account, templates, transactional sends, suppression, sending domains, webhooks, subaccounts, message events, deliverability metrics, and recipient lists.

Published on npm as [`@pcummings/sparkpost-mcp`](https://www.npmjs.com/package/@pcummings/sparkpost-mcp).

## Install into an AI agent

You need a `SPARKPOST_API_KEY` (SparkPost EU dashboard → API Keys). For the US region, also set `SPARKPOST_API_BASE=https://api.sparkpost.com/api/v1`.

> The commands below fetch the server from npm via `npx -y @pcummings/sparkpost-mcp`. To run from a local clone instead, replace `npx -y @pcummings/sparkpost-mcp` with `npx tsx /absolute/path/to/index.ts`.

**Claude Code**

```bash
claude mcp add sparkpost -e SPARKPOST_API_KEY=your-key -- npx -y @pcummings/sparkpost-mcp
```

Add `--scope user` to make it available in every project.

**OpenAI Codex**

```bash
codex mcp add sparkpost --env SPARKPOST_API_KEY=your-key -- npx -y @pcummings/sparkpost-mcp
```

**Gemini CLI**

```bash
gemini mcp add -e SPARKPOST_API_KEY=your-key sparkpost npx -y @pcummings/sparkpost-mcp
```

**US region** — append the base-URL env to any command above (`-e` for Claude/Gemini, `--env` for Codex):

```
SPARKPOST_API_BASE=https://api.sparkpost.com/api/v1
```

**Any other MCP client** (Claude Desktop, Cursor, Windsurf, VS Code, Cline, Zed …) — add this to the client's MCP config:

```json
{
  "mcpServers": {
    "sparkpost": {
      "command": "npx",
      "args": ["-y", "@pcummings/sparkpost-mcp"],
      "env": { "SPARKPOST_API_KEY": "your-key" }
    }
  }
}
```

For a local clone, use `"args": ["tsx", "/absolute/path/to/index.ts"]`.

## Run from source

```bash
npm install
export SPARKPOST_API_KEY=your-key   # required; server exits if missing
export SPARKPOST_API_BASE=...        # optional; defaults to EU. US: https://api.sparkpost.com/api/v1
npm start
```

## Tools

| Tool | Description |
|------|-------------|
| `get_account` | Get SparkPost EU account info and usage |
| `list_templates` | List all email templates |
| `get_template` | Get a specific template by ID |
| `create_template` | Create a new email template |
| `update_template` | Update an existing template |
| `send_email` | Send a test/transactional email |
| `check_suppression` | Check if an address is suppressed |
| `list_sending_domains` | List all verified sending domains |
| `list_webhooks` | List all webhooks |
| `create_webhook` | Create a webhook (name, target URL, events) |
| `delete_webhook` | Delete a single webhook by id |
| `list_subaccounts` | List all subaccounts |
| `create_subaccount` | Create a subaccount with an API key (name, key_label, key_grants) |
| `search_message_events` | Search message events (one page; cursor + per_page for paging) |
| `get_deliverability_metrics` | Get deliverability metrics (from + metrics required; group_by selects a breakdown dimension) |
| `list_recipient_lists` | List all recipient lists |
| `get_recipient_list` | Get a recipient list by id (optionally with recipients) |
| `create_recipient_list` | Create a recipient list (recipients required; id/name auto-generated if omitted) |
| `add_suppression` | Add or update a suppression entry for one email |
| `remove_suppression` | Remove the suppression entry for one email |

## Usage examples

**Send an email:**
> Send a transactional email to alice@example.com from noreply@yourdomain.com with subject "Hello" and body "<p>Hi Alice</p>"

**Create a template:**
> Create an email template with id "welcome", name "Welcome Email", subject "Welcome to {{company}}!", html "<p>Hi {{name}}</p>", from noreply@yourdomain.com

**Search recent bounces:**
> Search message events for bounce events in the last 24 hours for recipient domain example.com

## Dev

```bash
npm run typecheck   # tsc --noEmit
npm test            # node:test suite (44 tests)
```
