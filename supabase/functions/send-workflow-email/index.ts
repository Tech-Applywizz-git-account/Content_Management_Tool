// @ts-nocheck

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

// Environment Setup
const TENANT_ID = Deno.env.get("TENANT_ID")!;
const CLIENT_ID = Deno.env.get("CLIENT_ID")!;
const CLIENT_SECRET = Deno.env.get("CLIENT_SECRET")!;
const SENDER_EMAIL = Deno.env.get("SENDER_EMAIL")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET")!;
const BASE_URL = Deno.env.get("BASE_URL") || "https://support.applywizz.com";

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Helper: Get Microsoft Graph OAuth Token
async function getGraphToken(): Promise<string> {
    const body = new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
    });
    const res = await fetch(`https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`, { method: "POST", body });
    if (!res.ok) throw new Error(`Token error: ${await res.text()}`);
    const json = await res.json();
    return json.access_token;
}

// Helper: Send HTML Email via Microsoft Graph
async function sendEmail(to: string[], subject: string, html: string) {
    const token = await getGraphToken();
    const endpoint = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(SENDER_EMAIL)}/sendMail`;

    const res = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
            message: {
                subject,
                body: { contentType: "HTML", content: html },
                toRecipients: to.map(email => ({ emailAddress: { address: email } })),
            },
        }),
    });
    if (!res.ok) throw new Error(`Email failed: ${await res.text()}`);
}

// Helper: Fetch user emails by ID
async function getUserEmail(userId: string): Promise<string | null> {
    const { data } = await supabaseAdmin.from("users").select("email").eq("id", userId).single();
    return data?.email || null;
}

// Helper: Fetch emails for a specific role
async function getRoleEmails(role: string): Promise<string[]> {
    const { data } = await supabaseAdmin.from("users").select("email").eq("role", role.toUpperCase()).eq("status", "ACTIVE");
    return data?.map(u => u.email).filter(Boolean) || [];
}

// Helper: Count approved writers for a project in MULTI_WRITER_APPROVAL stage
async function getWriterApprovalCount(projectId: string): Promise<number> {
    // Get all approvals for this project in MULTI_WRITER_APPROVAL stage
    const { data: approvals, error } = await supabaseAdmin
        .from("workflow_history")
        .select("actor_id")
        .eq("project_id", projectId)
        .eq("stage", "MULTI_WRITER_APPROVAL")
        .eq("action", "APPROVED");

    if (error || !approvals) return 0;

    // Get active writers to ensure we only count valid approvals
    const { data: writers } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("role", "WRITER")
        .eq("status", "ACTIVE");

    if (!writers) return 0;
    const writerIds = new Set(writers.map(w => w.id));

    // Filter approvals to matches from active writers
    const uniqueApprovals = new Set(approvals.filter(a => writerIds.has(a.actor_id)).map(a => a.actor_id));
    return uniqueApprovals.size;
}

serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    // Safety check: Webhook Secret
    if (req.headers.get("x-webhook-secret") !== WEBHOOK_SECRET) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    try {
        const { record } = await req.json();
        console.log("Processing Record:", JSON.stringify(record, null, 2));

        if (!record || record.action === "CREATED") {
            return new Response(JSON.stringify({ ok: true, msg: "Skipped" }), { headers: corsHeaders });
        }

        const { project_id, action, from_role, to_role, actor_name, metadata = {}, comment, stage } = record;

        // Fetch Project Context (including assignment info for REWORK routing)
        const { data: project } = await supabaseAdmin
            .from("projects")
            .select("title, writer_id, created_by_user_id, assigned_to_user_id, assigned_to_role")
            .eq("id", project_id)
            .single();
        if (!project) throw new Error("Project not found");

        let recipientEmails: string[] = [];

        // 🔹 Recipient Routing Logic (As per requirements)
        switch (action) {
            case "REJECTED":
                // Send to WRITER (creator)
                const writerId = project.writer_id || project.created_by_user_id;
                const writerEmail = await getUserEmail(writerId);
                if (writerEmail) recipientEmails.push(writerEmail);
                break;

            case "REWORK_VIDEO_SUBMITTED":
                // Send to from_role (the role that requested rework)
                // SPECIAL CASE: CEO should never receive any emails
                if (from_role && from_role !== "CEO") {
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
                // SPECIAL CASE: CEO should never receive any emails
                if (to_role && to_role !== "CEO") {
                    const emails = await getRoleEmails(to_role);
                    recipientEmails.push(...emails);
                }
                break;

            case "APPROVED":
                // Special Handling: MULTI_WRITER_APPROVAL
                // When the 3rd writer approves, notify BOTH CMO and OPS in parallel.
                if (stage === "MULTI_WRITER_APPROVAL") {
                    const count = await getWriterApprovalCount(project_id);
                    console.log(`MULTI_WRITER_APPROVAL Check: ${count} approvals found.`);

                    if (count === 3) {
                        console.log("3rd Writer Approved! Sending parallel notification to CMO + OPS.");
                        const cmoEmails = await getRoleEmails("CMO");
                        const opsEmails = await getRoleEmails("OPS");
                        recipientEmails.push(...cmoEmails, ...opsEmails);

                        // Break here to avoid falling back to standard to_role logic
                        // (Requirement: Do NOT rely on to_role for this case)
                        break;
                    }
                }

                // Standard Logic: Send to to_role
                // SPECIAL CASE: CEO should never receive any emails
                if (to_role && to_role !== "CEO") {
                    const emails = await getRoleEmails(to_role);
                    recipientEmails.push(...emails);
                }
                break;

            case "REWORK":
                // FIX: Strictly use to_role for routing.
                // Do NOT use assigned_to_user_id because in rework flow, it often points to the reviewer (Actor).

                // SPECIAL CASE: CEO should never receive any emails
                if (to_role && to_role !== "CEO") {
                    if (to_role === "WRITER") {
                        // Specific handling for WRITER: Send to the content creator
                        const writerId = project.writer_id || project.created_by_user_id;
                        const writerEmail = await getUserEmail(writerId);

                        if (writerEmail) {
                            recipientEmails.push(writerEmail);
                            console.log(`REWORK: Sending to specific writer: ${writerEmail}`);
                        } else {
                            // Fallback to all writers if specific writer not found (rare)
                            console.warn("REWORK: Specific writer not found, broadcasting to all WRITERs");
                            const emails = await getRoleEmails("WRITER");
                            recipientEmails.push(...emails);
                        }
                    } else {
                        // For all other roles (CINE, EDITOR, DESIGNER, etc.), broadcast to the role
                        // This ensures it goes to the correct target group
                        console.log(`REWORK: Broadcasting to role: ${to_role}`);
                        const emails = await getRoleEmails(to_role);
                        recipientEmails.push(...emails);
                    }
                } else {
                    console.warn("REWORK: No to_role specified or CEO role blocked, cannot route email.");
                }
                break;

            default:
                console.log(`Action ${action} has no routing rule.`);
                break;
        }

        recipientEmails = [...new Set(recipientEmails.filter(Boolean))];

        if (recipientEmails.length === 0) {
            return new Response(JSON.stringify({ ok: true, msg: "No recipients" }), { headers: corsHeaders });
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
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: ${highlightColor}; padding: 24px; text-align: center; color: white;">
          <h2 style="margin: 0; text-transform: uppercase; letter-spacing: 1px;">Project Notification</h2>
        </div>
        <div style="padding: 32px; color: #2d3748; line-height: 1.6;">
          <p style="font-size: 18px; font-weight: bold; margin-bottom: 24px;">Update for "${project.title}"</p>
          
          <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
            <tr><td style="padding: 8px 0; color: #718096; width: 120px;">Action:</td><td style="font-weight: bold; color: ${highlightColor};">${action}</td></tr>
            <tr><td style="padding: 8px 0; color: #718096;">From Role:</td><td>${from_role || "N/A"}</td></tr>
            <tr><td style="padding: 8px 0; color: #718096;">To Role:</td><td>${to_role || "N/A"}</td></tr>
            <tr><td style="padding: 8px 0; color: #718096;">Actor:</td><td>${actor_name || "N/A"}</td></tr>
          </table>
 
          <div style="margin-top: 24px; padding: 16px; background-color: #f7fafc; border-left: 4px solid ${highlightColor}; border-radius: 4px;">
            <p style="margin: 0; font-weight: bold; color: #4a5568; font-size: 14px; text-transform: uppercase; margin-bottom: 8px;">Comments / Reason:</p>
            <p style="margin: 0; font-style: italic;">"${reworkReason}"</p>
          </div>
 
          <div style="margin-top: 40px; text-align: center;">
            <a href="${BASE_URL}/project/${project_id}" style="display: inline-block; padding: 16px 32px; background-color: ${highlightColor}; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">View Project Dashboard</a>
          </div>
        </div>
        <div style="background-color: #f8fafc; padding: 16px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8;">
          This is an automated production workflow notification sent via ${BASE_URL}
        </div>
      </div>
    `;

        await sendEmail(recipientEmails, subject, htmlBody);

        return new Response(JSON.stringify({ ok: true, sentTo: recipientEmails }), { headers: corsHeaders });

    } catch (err) {
        console.error("Critical Function Error:", err.message);
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
    }
});
