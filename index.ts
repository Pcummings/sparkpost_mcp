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
  listWebhooks,
  createWebhook,
  CreateWebhookSchema,
  deleteWebhook,
  DeleteWebhookSchema,
  listSubaccounts,
  createSubaccount,
  CreateSubaccountSchema,
  searchMessageEvents,
  SearchMessageEventsSchema,
  getDeliverabilityMetrics,
  GetDeliverabilityMetricsSchema,
  listRecipientLists,
  getRecipientList,
  GetRecipientListSchema,
  createRecipientList,
  CreateRecipientListSchema,
  addSuppression,
  AddSuppressionSchema,
  removeSuppression,
  RemoveSuppressionSchema,
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
server.tool("list_webhooks", "List all webhooks", {}, listWebhooks);
server.tool("create_webhook", "Create a webhook (name, target URL, events)", CreateWebhookSchema, createWebhook);
server.tool("delete_webhook", "Delete a single webhook by id", DeleteWebhookSchema, deleteWebhook);
server.tool("list_subaccounts", "List all subaccounts", {}, listSubaccounts);
server.tool("create_subaccount", "Create a subaccount with an API key (name, key_label, key_grants)", CreateSubaccountSchema, createSubaccount);
server.tool("search_message_events", "Search message events (one page; cursor + per_page for paging)", SearchMessageEventsSchema, searchMessageEvents);
server.tool("get_deliverability_metrics", "Get deliverability metrics (from + metrics required; group_by selects a breakdown dimension)", GetDeliverabilityMetricsSchema, getDeliverabilityMetrics);

server.tool("list_recipient_lists", "List all recipient lists", {}, listRecipientLists);
server.tool("get_recipient_list", "Get a recipient list by id (optionally with recipients)", GetRecipientListSchema, getRecipientList);
server.tool("create_recipient_list", "Create a recipient list (recipients required; id/name auto-generated if omitted)", CreateRecipientListSchema, createRecipientList);
server.tool("add_suppression", "Add or update a suppression entry for one email", AddSuppressionSchema, addSuppression);
server.tool("remove_suppression", "Remove the suppression entry for one email", RemoveSuppressionSchema, removeSuppression);

const transport = new StdioServerTransport();
await server.connect(transport);
