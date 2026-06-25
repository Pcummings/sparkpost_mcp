#!/usr/bin/env -S npx tsx
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  getAccount,
  listTemplates,
  listSendingDomains,
  getTemplate,
  GetTemplateSchema,
  createTemplate,
  CreateTemplateSchema,
  updateTemplate,
  UpdateTemplateSchema,
  sendEmail,
  SendEmailSchema,
  checkSuppression,
  CheckSuppressionSchema,
} from "./src/sparkpost.js";

const API_KEY = process.env.SPARKPOST_API_KEY;
if (!API_KEY) {
  console.error("Missing required env var SPARKPOST_API_KEY");
  process.exit(1);
}

const server = new McpServer({ name: "sparkpost-eu", version: "1.0.0" });

server.tool("get_account", "Get SparkPost EU account info and usage", {}, getAccount);
server.tool("list_templates", "List all email templates", {}, listTemplates);
server.tool("get_template", "Get a specific template by ID", GetTemplateSchema, getTemplate);
server.tool("create_template", "Create a new email template", CreateTemplateSchema, createTemplate);
server.tool("update_template", "Update an existing template", UpdateTemplateSchema, updateTemplate);
server.tool("send_email", "Send a test/transactional email", SendEmailSchema, sendEmail);
server.tool("check_suppression", "Check if an address is suppressed", CheckSuppressionSchema, checkSuppression);
server.tool("list_sending_domains", "List all verified sending domains", {}, listSendingDomains);

const transport = new StdioServerTransport();
await server.connect(transport);
