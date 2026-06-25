# sparkpost-mcp

MCP server exposing the [SparkPost](https://www.sparkpost.com/) (EU) email API as tools — account, templates, sending, suppression, and sending domains.

## Setup

```bash
npm install
export SPARKPOST_API_KEY=your-key   # required; server exits if missing
export SPARKPOST_API_BASE=...        # optional; defaults to EU. US: https://api.sparkpost.com/api/v1
npm start
```

## MCP client config

```json
{
  "mcpServers": {
    "sparkpost": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/index.ts"],
      "env": { "SPARKPOST_API_KEY": "your-key" }
    }
  }
}
```

## Tools

| Tool | Description |
|------|-------------|
| `get_account` | Account info + usage |
| `list_templates` | List all templates |
| `get_template` | Get one template (optional draft) |
| `create_template` | Create a template |
| `update_template` | Update a template |
| `send_email` | Send transactional email (inline or by template) |
| `check_suppression` | Check if an address is suppressed |
| `list_sending_domains` | List verified sending domains |

## Dev

```bash
npm run typecheck   # tsc --noEmit
```
