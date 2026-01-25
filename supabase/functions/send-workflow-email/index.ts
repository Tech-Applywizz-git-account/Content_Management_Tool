/// <reference lib="deno.ns" />
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
                toRecipients: to.map((email: string) => ({ emailAddress: { address: email } })),
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
    return data?.map((u: any) => u.email).filter(Boolean) || [];
}

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    // Safety check: Webhook Secret
    if (req.headers.get("x-webhook-secret") !== WEBHOOK_SECRET) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    try {
        const { record } = await req.json();
        console.log("=== EMAIL ROUTING DEBUG ===");
        console.log("Action:", record.action);
        console.log("From Role:", record.from_role);
        console.log("To Role:", record.to_role);
        console.log("Project ID:", record.project_id);
        console.log("Actor:", record.actor_name);
        console.log("Processing Record:", JSON.stringify(record, null, 2));

        if (!record || record.action === "CREATED") {
            return new Response(JSON.stringify({ ok: true, msg: "Skipped" }), { headers: corsHeaders });
        }

        const { project_id, action, from_role, to_role, actor_name, metadata = {}, comment } = record;

        // Fetch Project Context (including assignment info for REWORK routing)
        const { data: project } = await supabaseAdmin
            .from("projects")
            .select("title, writer_id, created_by_user_id, assigned_to_user_id, assigned_to_role, rework_target_role, rework_initiator_role, rework_initiator_stage")
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
            case "REWORK_SUBMITTED":
            case "REWORK_EDIT_SUBMITTED":
            case "REWORK_DESIGN_SUBMITTED":
                // Route back to the role that initiated the rework
                const initiatorRole = project.rework_initiator_role || from_role;
                if (initiatorRole) {
                    const emails = await getRoleEmails(initiatorRole);
                    // Strictly exclude CEO from receiving rework submission emails
                    const filteredEmails = emails.filter(email => initiatorRole !== "CEO");
                    recipientEmails.push(...filteredEmails);
                    console.log(`REWORK_SUBMITTED: Routing back to initiator role: ${initiatorRole}`);
                }
                break;

            case "PUBLISHED":
                // Send to OPS
                const opsEmails = await getRoleEmails("OPS");
                recipientEmails.push(...opsEmails);
                break;

            case "SUBMITTED":
            case "SUB_EDITOR_VIDEO_UPLOADED":
                // For writer submissions after rework, don't email CEO
                // Also handle Sub-Editor video uploads
                if (to_role) {
                    const emails = await getRoleEmails(to_role);

                    // Filter out CEO emails for writer submissions
                    if (to_role === "CMO") {
                        // Get CMO emails but exclude CEO
                        const ceoEmails = await getRoleEmails("CEO");
                        const filteredEmails = emails.filter(email => !ceoEmails.includes(email));
                        recipientEmails.push(...filteredEmails);
                    }
                    // For SUB_EDITOR_VIDEO_UPLOADED, check if thumbnail is required
                    else if (action === "SUB_EDITOR_VIDEO_UPLOADED") {
                        // Need to fetch project data to check thumbnail_required
                        const { data: fullProject } = await supabaseAdmin
                            .from("projects")
                            .select("data")
                            .eq("id", project_id)
                            .single();

                        if (fullProject && fullProject.data && fullProject.data.thumbnail_required === true) {
                            // If thumbnail is required, send to Designer instead of Multi-Writer Approval
                            const designerEmails = await getRoleEmails("DESIGNER");
                            recipientEmails.push(...designerEmails);
                            console.log(`SUB_EDITOR_VIDEO_UPLOADED: Sent to Designer role (thumbnail_required = true)`);
                        } else {
                            // If no thumbnail required, send to Multi-Writer Approval
                            recipientEmails.push(...emails);
                            console.log(`SUB_EDITOR_VIDEO_UPLOADED: Sent to Multi-Writer Approval role (thumbnail_required = false or undefined)`);
                        }
                    } else {
                        recipientEmails.push(...emails);
                    }
                }
                break;

            case "APPROVED":
                // When CMO approves, don't email CEO
                // When other roles approve, apply appropriate filtering
                if (to_role) {
                    const emails = await getRoleEmails(to_role);

                    // If CMO is approving and sending to next role, exclude CEO
                    if (from_role === "CMO") {
                        const ceoEmails = await getRoleEmails("CEO");
                        const filteredEmails = emails.filter(email => !ceoEmails.includes(email));
                        recipientEmails.push(...filteredEmails);
                    }
                    // For other approvals, apply general filtering
                    else {
                        // Exclude unnecessary cross-role emails
                        const filteredEmails = emails.filter(email => {
                            // Don't send approval emails to roles that don't need them
                            if (to_role === "CEO" && from_role !== "CMO") {
                                // Only CMO should send to CEO for approvals
                                return false;
                            }
                            return true;
                        });
                        recipientEmails.push(...filteredEmails);
                    }
                }
                break;

            case "REWORK":
                // REWORK emails should go to the targeted role
                const targetedRole = project.rework_target_role || to_role;
                if (targetedRole) {
                    console.log(`REWORK: Sending to role: ${targetedRole}`);

                    // Get all users with the target role
                    const roleUsers = await getRoleEmails(to_role);

                    if (roleUsers && roleUsers.length > 0) {
                        recipientEmails.push(...roleUsers);
                        console.log(`REWORK: Sending to ${roleUsers.length} users with role ${to_role}`);
                    } else {
                        console.warn(`REWORK: No active users found for role: ${to_role}`);
                    }
                } else {
                    // Fallback to writer if no to_role specified
                    const writerId = project.writer_id || project.created_by_user_id;
                    const writerEmail = await getUserEmail(writerId);
                    if (writerEmail) {
                        recipientEmails.push(writerEmail);
                        console.log(`REWORK: Fallback - sending to writer: ${writerEmail}`);
                    }
                }

                // CRITICAL: No additional recipients for REWORK - only send to the specified role
                break;

            case "SUB_EDITOR_ASSIGNED":
                // When an Editor assigns a project to a Sub-Editor, the Sub-Editor should receive an email
                if (project.assigned_to_user_id) {
                    const subEditorEmail = await getUserEmail(project.assigned_to_user_id);
                    if (subEditorEmail) {
                        recipientEmails.push(subEditorEmail);
                        console.log(`SUB_EDITOR_ASSIGNED: Sending to assigned Sub-Editor: ${subEditorEmail}`);
                    }
                } else if (to_role === "SUB_EDITOR") {
                    // Fallback to all Sub-Editors if no specific user assigned
                    const subEditorEmails = await getRoleEmails("SUB_EDITOR");
                    recipientEmails.push(...subEditorEmails);
                }
                break;



            case "VIDEO_REWORK_ROUTED_TO_SUB_EDITOR":
                // When rework is specifically routed to Sub-Editor, notify the Sub-Editor
                if (project.assigned_to_user_id) {
                    const subEditorEmail = await getUserEmail(project.assigned_to_user_id);
                    if (subEditorEmail) {
                        recipientEmails.push(subEditorEmail);
                    }
                } else {
                    // Fallback to all Sub-Editors if no specific user assigned
                    const subEditorEmails = await getRoleEmails("SUB_EDITOR");
                    recipientEmails.push(...subEditorEmails);
                }
                break;

            default:
                console.log(`Action ${action} has no routing rule.`);
                break;
        }

        // Apply final filtering to prevent unnecessary emails
        const ceoEmails = await getRoleEmails("CEO");

        // Remove CEO emails for ALL rework-related actions
        recipientEmails = recipientEmails.filter(email => {
            const isCeoEmail = ceoEmails.includes(email);

            if (isCeoEmail) {
                // CEO should NEVER receive rework or rework-submission emails
                const reworkActions = [
                    "REWORK",
                    "REWORK_VIDEO_SUBMITTED",
                    "REWORK_SUBMITTED",
                    "REWORK_EDIT_SUBMITTED",
                    "REWORK_DESIGN_SUBMITTED",
                    "VIDEO_REWORK_ROUTED_TO_SUB_EDITOR"
                ];

                if (reworkActions.includes(action)) {
                    console.log(`FILTERED: CEO blocked from ${action} email: ${email}`);
                    return false;
                }

                // CEO should also not receive CMO approvals
                if (action === "APPROVED" && from_role === "CMO") {
                    console.log(`FILTERED: Not sending CMO approval email to CEO: ${email}`);
                    return false;
                }
            }

            return true;
        });

        // Remove duplicates and empty values
        recipientEmails = [...new Set(recipientEmails.filter(Boolean))];

        if (recipientEmails.length === 0) {
            console.log(`No valid recipients after filtering for action: ${action}`);
            return new Response(JSON.stringify({ ok: true, msg: "No recipients after filtering" }), { headers: corsHeaders });
        }

        console.log(`Final recipients for ${action}:`, recipientEmails);

        // 🔹 Build Email Content
        let subject = "";
        if (action === "REWORK") subject = `Rework Required: ${project.title}`;
        else if (action === "REJECTED") subject = `Action Required: ${project.title}`;
        else if (action === "APPROVED") subject = `Approved: ${project.title}`;
        else if (action === "REWORK_VIDEO_SUBMITTED") subject = `Rework Resubmitted: ${project.title}`;
        else if (action === "SUB_EDITOR_ASSIGNED") subject = `Project Assigned: ${project.title}`;
        else if (action === "VIDEO_REWORK_ROUTED_TO_SUB_EDITOR") subject = `Rework Required: ${project.title}`;
        else subject = `Action Required: ${project.title}`;

        const highlightColor = action === "REWORK" || action === "REJECTED" ? "#E53E3E" : (action === "SUB_EDITOR_ASSIGNED" ? "#38A169" : "#3182CE");
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

    } catch (err: any) {
        console.error("Critical Function Error:", err.message);
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
    }
});