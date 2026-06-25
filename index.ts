#!/usr/bin/env -S npx tsx
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_BASE = process.env.SPARKPOST_API_BASE ?? "https://api.eu.sparkpost.com/api/v1";
const API_KEY = process.env.SPARKPOST_API_KEY;
if (!API_KEY) {
  console.error("Missing required env var SPARKPOST_API_KEY");
  process.exit(1);
}

const headers = {
  "Authorization": API_KEY,
  "Content-Type": "application/json",
};

async function spRequest(path: string, method = "GET", body?: unknown) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    // ponytail: fixed 30s timeout; make env-configurable if some calls need longer
    signal: AbortSignal.timeout(30_000),
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`SparkPost ${res.status} ${res.statusText}: ${raw || "(no body)"}`);
  return raw ? JSON.parse(raw) : {};
}

// ponytail: collapse the 8 identical tool responses into one helper
const asText = (data: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
});

const server = new McpServer({ name: "sparkpost-eu", version: "1.0.0" });

// Account info
server.tool("get_account", "Get SparkPost EU account info and usage", {}, async () => {
  const data = await spRequest("/account?include=usage");
  return asText(data);
});

// List templates
server.tool("list_templates", "List all email templates", {}, async () => {
  const data = await spRequest("/templates");
  return asText(data);
});

// Get single template (with draft content)
server.tool("get_template", "Get a specific template by ID", {
  template_id: z.string(),
  draft: z.boolean().optional().default(false),
}, async ({ template_id, draft }) => {
  const data = await spRequest(`/templates/${template_id}${draft ? "?draft=true" : ""}`);
  return asText(data);
});

// Create template
server.tool("create_template", "Create a new email template", {
  id: z.string().describe("Template ID/slug"),
  name: z.string(),
  subject: z.string(),
  html: z.string(),
  text: z.string().optional(),
  from_email: z.email(),
  from_name: z.string().optional(),
}, async ({ id, name, subject, html, text, from_email, from_name }) => {
  const data = await spRequest("/templates", "POST", {
    id,
    name,
    content: {
      from: { email: from_email, name: from_name },
      subject,
      html,
      text,
    },
  });
  return asText(data);
});

// Update template
server.tool("update_template", "Update an existing template", {
  template_id: z.string(),
  subject: z.string().optional(),
  html: z.string().optional(),
  text: z.string().optional(),
  update_published: z.boolean().optional().default(false),
}, async ({ template_id, subject, html, text, update_published }) => {
  const content: Record<string, unknown> = {};
  if (subject) content.subject = subject;
  if (html) content.html = html;
  if (text) content.text = text;
  const data = await spRequest(
    `/templates/${template_id}${update_published ? "?update_published=true" : ""}`,
    "PUT",
    { content },
  );
  return asText(data);
});

// Send test email (inline or via template)
server.tool("send_email", "Send a test/transactional email", {
  to: z.email().describe("Recipient email"),
  from_email: z.email(),
  subject: z.string().optional(),
  html: z.string().optional(),
  template_id: z.string().optional().describe("Use stored template instead of inline content"),
  substitution_data: z.record(z.string(), z.unknown()).optional(),
}, async ({ to, from_email, subject, html, template_id, substitution_data }) => {
  const payload: Record<string, unknown> = {
    recipients: [{ address: { email: to } }],
    ...(substitution_data && { substitution_data }),
  };
  if (template_id) {
    payload.content = { template_id };
  } else {
    payload.content = { from: from_email, subject, html };
  }
  const data = await spRequest("/transmissions", "POST", payload);
  return asText(data);
});

// Suppression list check
server.tool("check_suppression", "Check if an address is suppressed", {
  email: z.email(),
}, async ({ email }) => {
  const data = await spRequest(`/suppression-list/${encodeURIComponent(email)}`);
  return asText(data);
});

// List sending domains
server.tool("list_sending_domains", "List all verified sending domains", {}, async () => {
  const data = await spRequest("/sending-domains");
  return asText(data);
});

const transport = new StdioServerTransport();
await server.connect(transport);