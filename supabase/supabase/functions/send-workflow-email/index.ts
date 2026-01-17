// @ts-nocheck

/// <reference lib="deno.ns" />
/// <reference lib="dom" />

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ===== ENV =====
const TENANT_ID = Deno.env.get("TENANT_ID")!;
const CLIENT_ID = Deno.env.get("CLIENT_ID")!;
const CLIENT_SECRET = Deno.env.get("CLIENT_SECRET")!;
const SENDER_EMAIL = Deno.env.get("SENDER_EMAIL")!;
const PROJECT_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET") || "";
const BASE_URL = Deno.env.get("BASE_URL") || "https://support.applywizz.com";

// Supabase admin client
const sb = createClient(PROJECT_URL, SERVICE_ROLE_KEY);

// ===== Microsoft Graph helpers =====
async function getGraphToken(): Promise<string> {
  const body = new URLSearchParams();
  body.set("client_id", CLIENT_ID);
  body.set("client_secret", CLIENT_SECRET);
  body.set("scope", "https://graph.microsoft.com/.default");
  body.set("grant_type", "client_credentials");

  const res = await fetch(
    `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
    { method: "POST", body }
  );
  if (!res.ok) throw new Error(`Token error ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.access_token as string;
}

async function sendGraphMail(
  toRecipients: string[],
  subject: string,
  content: string,
  type: "Text" | "HTML" = "HTML"
) {
  const token = await getGraphToken();
  const endpoint = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(SENDER_EMAIL)}/sendMail`;

  const payload = {
    message: {
      subject,
      body: { contentType: type, content },
      toRecipients: toRecipients.map(email => ({
        emailAddress: { address: email },
      })),
    },
    saveToSentItems: true,
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error(`sendMail failed ${res.status}: ${await res.text()}`);
}

// ===== Helper: Get User Emails =====
async function getUserEmail(userId: string): Promise<string | null> {
  const { data } = await sb.from("users").select("email").eq("id", userId).single();
  return data?.email || null;
}

async function getRoleEmails(role: string): Promise<string[]> {
  const { data } = await sb.from("users").select("email").eq("role", role.toUpperCase()).eq("status", "ACTIVE");
  return data?.map(u => u.email).filter(Boolean) || [];
}

// ===== DB Webhook helpers =====
function isDbWebhookPayload(x: any) {
  return x && typeof x === "object" && "type" in x && "table" in x && "record" in x;
}

// ===== Logic Implementation for Workflow =====
async function handleWorkflowNotification(record: any) {
  console.log("Processing Workflow Record:", JSON.stringify(record, null, 2));

  if (!record || record.action === "CREATED") {
    return { ok: true, msg: "Skipped" };
  }

  const { project_id, action, from_role, to_role, actor_name, metadata = {}, comment } = record;

  // Fetch Project Context
  const { data: project } = await sb.from("projects").select("title, writer_id, created_by_user_id").eq("id", project_id).single();
  if (!project) throw new Error("Project not found");

  let recipientEmails: string[] = [];

  // 🔹 Recipient Routing Logic
  switch (action) {
    case "REJECTED":
      // Send to WRITER (creator)
      const writerId = project.writer_id || project.created_by_user_id;
      const writerEmail = await getUserEmail(writerId);
      if (writerEmail) recipientEmails.push(writerEmail);
      break;

    case "REWORK_VIDEO_SUBMITTED":
      // Send to from_role (the role that requested rework)
      if (from_role) {
        const emails = await getRoleEmails(from_role);
        recipientEmails.push(...emails);
      }
      break;

    case "PUBLISHED":
      // Send to OPS
      const opsEmails = await getRoleEmails("OPS");
      recipientEmails.push(...opsEmails);
      break;

    case "SUBMITTED":
    case "APPROVED":
    case "REWORK":
      // Send to to_role
      if (to_role) {
        const emails = await getRoleEmails(to_role);
        recipientEmails.push(...emails);
      }
      break;

    default:
      console.log(`Action ${action} has no routing rule.`);
      break;
  }

  recipientEmails = [...new Set(recipientEmails.filter(Boolean))];

  if (recipientEmails.length === 0) {
    return { ok: true, msg: "No recipients" };
  }

  // 🔹 Build Email Content
  let subject = "";
  if (action === "REWORK") subject = `Rework Required: ${project.title}`;
  else if (action === "REJECTED") subject = `Action Required: ${project.title}`;
  else if (action === "APPROVED") subject = `Approved: ${project.title}`;
  else if (action === "REWORK_VIDEO_SUBMITTED") subject = `Rework Resubmitted: ${project.title}`;
  else subject = `Action Required: ${project.title}`;

  const highlightColor = action === "REWORK" || action === "REJECTED" ? "#E53E3E" : "#3182CE";
  const reworkReason = metadata.rework_reason || comment || "No comments provided.";

  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        .container { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border: 1px solid #edf2f7; }
        .header { background: linear-gradient(135deg, ${highlightColor} 0%, #1a202c 100%); padding: 40px 20px; text-align: center; color: white; }
        .content { padding: 40px; color: #2d3748; }
        .badge { display: inline-block; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 800; text-transform: uppercase; background-color: ${highlightColor}15; color: ${highlightColor}; margin-bottom: 20px; }
        .project-title { font-size: 24px; font-weight: 800; margin: 0 0 24px 0; color: #1a202c; letter-spacing: -0.5px; }
        .info-card { background-color: #f7fafc; border-radius: 12px; padding: 24px; margin-bottom: 30px; }
        .info-row { display: flex; padding: 8px 0; border-bottom: 1px solid #edf2f7; }
        .info-row:last-child { border-bottom: none; }
        .label { font-size: 13px; color: #718096; width: 100px; flex-shrink: 0; font-weight: 600; text-transform: uppercase; }
        .value { font-size: 15px; color: #2d3748; font-weight: 500; }
        .comment-box { margin-top: 10px; padding: 16px; background-color: white; border: 1px solid #edf2f7; border-radius: 8px; font-style: italic; color: #4a5568; }
        .button { display: block; background-color: ${highlightColor}; color: white !important; text-decoration: none; padding: 18px 30px; border-radius: 8px; font-weight: bold; text-align: center; margin-top: 30px; box-shadow: 0 4px 12px ${highlightColor}40; }
        .footer { padding: 30px; text-align: center; font-size: 12px; color: #a0aec0; background-color: #f8fafc; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0; font-size: 20px; letter-spacing: 2px;">WORKFLOW UPDATE</h1>
        </div>
        <div class="content">
          <div class="badge">${action}</div>
          <h2 class="project-title">${project.title}</h2>
          
          <div class="info-card">
            <div class="info-row">
              <div class="label">Initiated By</div>
              <div class="value">👤 ${actor_name || "System"}</div>
            </div>
            <div class="info-row">
              <div class="label">Assigned To</div>
              <div class="value">🎯 ${to_role || "No assignment"}</div>
            </div>
            <div class="info-row">
              <div class="label">Previous</div>
              <div class="value">⬅️ ${from_role || "None"}</div>
            </div>
            
            <p style="margin: 20px 0 10px 0; font-size: 12px; font-weight: bold; color: #718096; text-transform: uppercase;">Message / Review Notes:</p>
            <div class="comment-box">
              "${reworkReason}"
            </div>
          </div>

          <a href="${BASE_URL}/project/${project_id}" class="button">View Task Details</a>
        </div>
        <div class="footer">
          This automated notification was sent from ApplyWizz Production Studio.<br>
          <a href="${BASE_URL}" style="color: ${highlightColor}; text-decoration: none;">Launch Dashboard</a>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendGraphMail(recipientEmails, subject, htmlBody);
  return { ok: true, sentTo: recipientEmails };
}

// ===== HTTP handler =====
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Security check: Webhook Secret
  const secret = req.headers.get("x-webhook-secret");
  if (secret !== WEBHOOK_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: corsHeaders,
    });
  }

  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    if (isDbWebhookPayload(body)) {
      // If table is workflow_history, handle it
      if (body.table === "workflow_history") {
        const result = await handleWorkflowNotification(body.record);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // If table is mentors, we could add that logic here too if needed
      // But for now, we focus on the workflow email system
    }

    return new Response(JSON.stringify({ ok: true, skipped: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("Critical Function Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
