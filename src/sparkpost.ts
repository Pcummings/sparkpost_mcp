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
