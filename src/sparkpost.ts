import { z } from "zod";

const API_BASE = process.env.SPARKPOST_API_BASE ?? "https://api.eu.sparkpost.com/api/v1";

function getHeaders() {
  return {
    "Authorization": process.env.SPARKPOST_API_KEY ?? "",
    "Content-Type": "application/json",
  };
}

export async function spRequest(path: string, method = "GET", body?: unknown) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: getHeaders(),
    body: body ? JSON.stringify(body) : undefined,
    // ponytail: fixed 30s timeout; make env-configurable if some calls need longer
    signal: AbortSignal.timeout(30_000),
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`SparkPost ${res.status} ${res.statusText}: ${raw || "(no body)"}`);
  return raw ? JSON.parse(raw) : {};
}

// ponytail: collapse the 8 identical tool responses into one helper
export const asText = (data: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
});

// No-arg handlers
export async function getAccount() {
  return asText(await spRequest("/account?include=usage"));
}

export async function listTemplates() {
  return asText(await spRequest("/templates"));
}

export async function listSendingDomains() {
  return asText(await spRequest("/sending-domains"));
}

// Parameterized handlers + their exported zod schemas

export const GetTemplateSchema = {
  template_id: z.string(),
  draft: z.boolean().optional().default(false),
};

export async function getTemplate({ template_id, draft }: { template_id: string; draft?: boolean }) {
  return asText(await spRequest(`/templates/${template_id}${draft ? "?draft=true" : ""}`));
}

export const CreateTemplateSchema = {
  id: z.string().describe("Template ID/slug"),
  name: z.string(),
  subject: z.string(),
  html: z.string(),
  text: z.string().optional(),
  from_email: z.email(),
  from_name: z.string().optional(),
};

export async function createTemplate({
  id,
  name,
  subject,
  html,
  text,
  from_email,
  from_name,
}: {
  id: string;
  name: string;
  subject: string;
  html: string;
  text?: string;
  from_email: string;
  from_name?: string;
}) {
  return asText(await spRequest("/templates", "POST", {
    id,
    name,
    content: {
      from: { email: from_email, name: from_name },
      subject,
      html,
      text,
    },
  }));
}

export const UpdateTemplateSchema = {
  template_id: z.string(),
  subject: z.string().optional(),
  html: z.string().optional(),
  text: z.string().optional(),
  update_published: z.boolean().optional().default(false),
};

export async function updateTemplate({
  template_id,
  subject,
  html,
  text,
  update_published,
}: {
  template_id: string;
  subject?: string;
  html?: string;
  text?: string;
  update_published?: boolean;
}) {
  const content: Record<string, unknown> = {};
  if (subject) content.subject = subject;
  if (html) content.html = html;
  if (text) content.text = text;
  return asText(await spRequest(
    `/templates/${template_id}${update_published ? "?update_published=true" : ""}`,
    "PUT",
    { content },
  ));
}

export const SendEmailSchema = {
  to: z.email().describe("Recipient email"),
  from_email: z.email(),
  subject: z.string().optional(),
  html: z.string().optional(),
  template_id: z.string().optional().describe("Use stored template instead of inline content"),
  substitution_data: z.record(z.string(), z.unknown()).optional(),
};

export async function sendEmail({
  to,
  from_email,
  subject,
  html,
  template_id,
  substitution_data,
}: {
  to: string;
  from_email: string;
  subject?: string;
  html?: string;
  template_id?: string;
  substitution_data?: Record<string, unknown>;
}) {
  const payload: Record<string, unknown> = {
    recipients: [{ address: { email: to } }],
    ...(substitution_data && { substitution_data }),
  };
  if (template_id) {
    payload.content = { template_id };
  } else {
    payload.content = { from: from_email, subject, html };
  }
  return asText(await spRequest("/transmissions", "POST", payload));
}

export const CheckSuppressionSchema = {
  email: z.email(),
};

export async function checkSuppression({ email }: { email: string }) {
  return asText(await spRequest(`/suppression-list/${encodeURIComponent(email)}`));
}

// --- Webhook tools ---

export const WEBHOOK_EVENTS = [
  "bounce", "delivery", "injection", "spam_complaint", "out_of_band",
  "policy_rejection", "delay", "click", "open", "initial_open",
  "amp_click", "amp_open", "amp_initial_open", "generation_failure",
  "generation_rejection", "list_unsubscribe", "link_unsubscribe",
  "relay_injection", "relay_rejection", "relay_delivery", "relay_tempfail",
  "relay_permfail", "ab_test_completed", "ab_test_cancelled", "success", "error",
] as const;

export const CreateWebhookSchema = {
  name: z.string(),
  target: z.string().url(),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1),
  auth_type: z.enum(["none", "basic", "oauth2"]).optional().default("none"),
};

export async function listWebhooks() {
  return asText(await spRequest("/webhooks"));
}

export async function createWebhook({
  name,
  target,
  events,
  auth_type,
}: {
  name: string;
  target: string;
  events: string[];
  auth_type?: string;
}) {
  return asText(await spRequest("/webhooks", "POST", { name, target, events, auth_type }));
}

export const DeleteWebhookSchema = {
  id: z.string().describe("Webhook UUID"),
};

export async function deleteWebhook({ id }: { id: string }) {
  return asText(await spRequest(`/webhooks/${encodeURIComponent(id)}`, "DELETE"));
}

// --- Subaccount tools ---

export const KEY_GRANTS = [
  "smtp/inject", "sending_domains/manage", "tracking_domains/view",
  "tracking_domains/manage", "message_events/view", "suppression_lists/manage",
  "transmissions/view", "transmissions/modify", "webhooks/view", "webhooks/modify",
] as const;

export const CreateSubaccountSchema = {
  name: z.string(),
  key_label: z.string(),
  key_grants: z.array(z.enum(KEY_GRANTS)).min(1),
};

export async function listSubaccounts() {
  return asText(await spRequest("/subaccounts"));
}

export async function createSubaccount({
  name,
  key_label,
  key_grants,
}: {
  name: string;
  key_label: string;
  key_grants: string[];
}) {
  return asText(await spRequest("/subaccounts", "POST", { name, key_label, key_grants }));
}

// --- Events + Metrics tools ---

// MESSAGE_EVENT_TYPES is the message-events subset — DISTINCT from WEBHOOK_EVENTS (Pitfall 3)
export const MESSAGE_EVENT_TYPES = [
  "bounce", "delivery", "injection", "spam_complaint", "out_of_band",
  "policy_rejection", "delay", "click", "open", "initial_open",
  "amp_click", "amp_open", "amp_initial_open", "generation_failure",
  "generation_rejection", "list_unsubscribe", "link_unsubscribe",
] as const;

export const SearchMessageEventsSchema = {
  from: z.string().optional().describe("Start of time range (ISO-8601)"),
  to: z.string().optional().describe("End of time range (ISO-8601)"),
  events: z.array(z.enum(MESSAGE_EVENT_TYPES)).optional().describe("Filter by event types"),
  recipients: z.string().optional().describe("Comma-delimited recipient emails"),
  recipient_domains: z.string().optional().describe("Comma-delimited recipient domains"),
  per_page: z.number().int().min(1).max(10000).optional().describe("Results per page (1–10000)"),
  cursor: z.string().optional().describe("Pagination cursor from previous response links"),
};

export async function searchMessageEvents({
  from,
  to,
  events,
  recipients,
  recipient_domains,
  per_page,
  cursor,
}: {
  from?: string;
  to?: string;
  events?: string[];
  recipients?: string;
  recipient_domains?: string;
  per_page?: number;
  cursor?: string;
}) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (events?.length) params.set("events", events.join(","));
  if (recipients) params.set("recipients", recipients);
  if (recipient_domains) params.set("recipient_domains", recipient_domains);
  if (per_page !== undefined) params.set("per_page", String(per_page));
  if (cursor) params.set("cursor", cursor);
  const qs = params.toString();
  return asText(await spRequest(`/events/message${qs ? "?" + qs : ""}`, "GET"));
}

export const GetDeliverabilityMetricsSchema = {
  from: z.string().describe("Start of time range (ISO-8601, required)"),
  metrics: z.array(z.string()).min(1).describe(
    "Metrics to retrieve (e.g. count_delivered, count_bounce, count_accepted, open_rate, click_rate)",
  ),
  to: z.string().optional().describe("End of time range (ISO-8601)"),
  group_by: z.enum(["domain", "sending-ip", "ip-pool", "sending-domain", "subaccount", "campaign", "template"]).optional().describe("Breakdown dimension (becomes a URL path suffix)"),
  limit: z.number().int().min(1).max(10000).optional(),
  timezone: z.string().optional(),
};

// --- Recipient list tools ---

export const GetRecipientListSchema = {
  id: z.string(),
  show_recipients: z.boolean().optional().default(false),
};

export async function listRecipientLists() {
  return asText(await spRequest("/recipient-lists"));
}

export async function getRecipientList({ id, show_recipients }: { id: string; show_recipients?: boolean }) {
  return asText(await spRequest(
    `/recipient-lists/${encodeURIComponent(id)}${show_recipients ? "?show_recipients=true" : ""}`,
  ));
}

export const CreateRecipientListSchema = {
  recipients: z.array(z.object({ email: z.email(), name: z.string().optional() })).min(1),
  id: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
};

export async function createRecipientList({
  recipients,
  id,
  name,
  description,
}: {
  recipients: Array<{ email: string; name?: string }>;
  id?: string;
  name?: string;
  description?: string;
}) {
  return asText(await spRequest("/recipient-lists", "POST", {
    recipients: recipients.map(r => ({ address: { email: r.email, name: r.name } })),
    ...(id && { id }),
    ...(name && { name }),
    ...(description && { description }),
  }));
}

// --- Suppression management tools ---

export const AddSuppressionSchema = {
  email: z.email(),
  type: z.enum(["transactional", "non_transactional"]).default("non_transactional"),
  description: z.string().optional(),
};

export async function addSuppression({
  email,
  type,
  description,
}: {
  email: string;
  type: string;
  description?: string;
}) {
  return asText(await spRequest(
    `/suppression-list/${encodeURIComponent(email)}`,
    "PUT",
    { type, ...(description && { description }) },
  ));
}

export const RemoveSuppressionSchema = {
  email: z.email(),
};

export async function removeSuppression({ email }: { email: string }) {
  return asText(await spRequest(`/suppression-list/${encodeURIComponent(email)}`, "DELETE"));
}

export async function getDeliverabilityMetrics({
  from,
  metrics,
  to,
  group_by,
  limit,
  timezone,
}: {
  from: string;
  metrics: string[];
  to?: string;
  group_by?: string;
  limit?: number;
  timezone?: string;
}) {
  const params = new URLSearchParams();
  // from + metrics are required — always set
  params.set("from", from);
  params.set("metrics", metrics.join(","));
  if (to) params.set("to", to);
  if (limit !== undefined) params.set("limit", String(limit));
  if (timezone) params.set("timezone", timezone);
  // group_by is a PATH segment, never a query param (Pitfall 2)
  const suffix = group_by ? `/${group_by}` : "";
  return asText(await spRequest(`/metrics/deliverability${suffix}?${params.toString()}`, "GET"));
}
