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

// Optional: Dedicated PA Credentials (if different from default)
const PA_TENANT_ID = Deno.env.get("PA_TENANT_ID") || TENANT_ID;
const PA_CLIENT_ID = Deno.env.get("PA_CLIENT_ID") || CLIENT_ID;
const PA_CLIENT_SECRET = Deno.env.get("PA_CLIENT_SECRET") || CLIENT_SECRET;

const DEFAULT_SENDER = Deno.env.get("SENDER_EMAIL") || "support@applywizz.com";
const INFLUENCER_SENDER = Deno.env.get("INFLUENCER_SENDER_EMAIL") || "hello@readytowork.agency";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET")!;
const BASE_URL = Deno.env.get("BASE_URL") || "https://support.applywizz.com";

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Helper: Get Microsoft Graph OAuth Token
async function getGraphToken(tenantId = TENANT_ID, clientId = CLIENT_ID, clientSecret = CLIENT_SECRET): Promise<string> {
    const body = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
    });
    const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, { method: "POST", body });
    if (!res.ok) throw new Error(`Token error: ${await res.text()}`);
    const json = await res.json();
    return json.access_token;
}

// Helper: Send HTML Email via Microsoft Graph
async function sendEmail(sender: string, to: string[], subject: string, html: string, creds?: { tenant: string, client: string, secret: string }) {
    const token = await getGraphToken(creds?.tenant, creds?.client, creds?.secret);
    const endpoint = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`;

    const res = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
            message: {
                subject,
                body: { contentType: "HTML", content: html },
                toRecipients: to.map((email: string) => ({ emailAddress: { address: email } })),
            },
            saveToSentItems: true,
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

Deno.serve(async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    // Safety check: Webhook Secret or Service Role Key
    const authHeader = req.headers.get("authorization");
    const webhookSecret = req.headers.get("x-webhook-secret");
    const isServiceRole = authHeader === `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;
    const isValidWebhook = webhookSecret === WEBHOOK_SECRET;

    // Allow service role, valid webhook secret, OR any authenticated user from our project
    let isUserAuthenticated = false;
    if (authHeader && !isServiceRole) {
        const token = authHeader.replace("Bearer ", "");
        try {
            const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
            if (user && !authError) {
                isUserAuthenticated = true;
            }
        } catch (e) {
            console.error("Auth token verification failed:", e);
        }
    }

    if (!isValidWebhook && !isServiceRole && !isUserAuthenticated) {
        console.error("Auth mismatch:", {
            hasWebhookSecret: !!webhookSecret,
            hasAuthHeader: !!authHeader,
            isServiceRoleMatch: isServiceRole,
            isUserAuthenticated
        });
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    try {
        const body = await req.json();
        console.log("=== EMAIL ROUTING DEBUG ===");
        console.log("Received Body:", JSON.stringify(body, null, 2));

        let project_id: string = "", action: string = "", from_role: string = "", to_role: string = "", actor_name: string = "", metadata: any = {}, comment: string = "", history_stage: string = "";
        let recipient_user_id: string | undefined;

        if (body.record) {
            // Legacy / Standard Workflow History Trigger format
            project_id = body.record.project_id;
            action = (body.record.action || "").toUpperCase();
            // Robust role identification: check specific role fields first, then fallback to stage-based roles
            from_role = (body.record.from_role || body.record.from_stage || "").toUpperCase();
            to_role = (body.record.to_role || body.record.to_stage || "").toUpperCase();
            history_stage = (body.record.stage || "").toUpperCase();

            actor_name = body.record.actor_name;
            metadata = body.record.metadata || {};
            comment = body.record.comment || "";
        } else if (body.event) {
            // New direct-from-table trigger format (e.g. from sub-editor assignment or video upload)
            project_id = body.data?.project_id;
            action = body.event.toUpperCase();
            if (action === "VIDEO_UPLOADED") action = "SUBMITTED"; // Normalize

            to_role = (body.recipient_role || body.data?.assigned_to_role || "").toUpperCase();
            recipient_user_id = body.recipient_user_id || body.data?.assigned_to_user_id;
            actor_name = body.data?.actor_name || "System";
            metadata = body.data || {};
            comment = body.data?.comment || "No comments provided.";
            // For direct events, we might not have the history stage, but we can infer it if needed
        }

        if (!project_id) {
            console.log("Missing project_id, skipping execution");
            return new Response(JSON.stringify({ ok: true, msg: "Skipped - No Project ID" }), { headers: corsHeaders });
        }

        if (action === "CREATED") {
            return new Response(JSON.stringify({ ok: true, msg: "Skipped - Created Action" }), { headers: corsHeaders });
        }

        console.log("Action:", action);
        console.log("From Role:", from_role);
        console.log("To Role:", to_role);
        console.log("History Stage:", history_stage);
        console.log("Project ID:", project_id);
        console.log("Actor:", actor_name);

        // Exit early if internal update (no role change and generic submitted action)
        if (from_role === to_role && action === "SUBMITTED" && !body.event) {
            console.log("Internal role update, skipping email");
            return new Response(JSON.stringify({ ok: true, msg: "Skipped - Internal Update" }), { headers: corsHeaders });
        }

        // Fetch Project Context (including assignment info for REWORK routing)
        const { data: project } = await supabaseAdmin
            .from("projects")
            .select("title, writer_id, created_by_user_id, assigned_to_user_id, assigned_to_role, rework_target_role, rework_initiator_role, rework_initiator_stage")
            .eq("id", project_id)
            .single();
        if (!project) throw new Error("Project not found");

        let recipientEmails: string[] = [];

        // 🔹 Direct Recipient (if user_id provided)
        if (recipient_user_id) {
            const directEmail = await getUserEmail(recipient_user_id);
            if (directEmail) {
                recipientEmails.push(directEmail);
                console.log(`Using direct recipient email: ${directEmail}`);
            }
        } else if (body.recipient_email) {
            recipientEmails.push(body.recipient_email);
            console.log(`Using raw recipient email: ${body.recipient_email}`);
        }

        // 🔹 Recipient Routing Logic (If no direct recipient)
        if (recipientEmails.length === 0) {
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
                    // Determine if this is a rework submission
                    // 1. If to_role is the rework initiator
                    // 2. If action specifically says REWORK
                    const isReworkSubmission = (to_role && to_role === project.rework_initiator_role) ||
                        (action as string).includes("REWORK") ||
                        (action as string) === "REWORK_SUBMITTED" ||
                        (action as string) === "REWORK_VIDEO_SUBMITTED";

                    if (isReworkSubmission) {
                        const initiatorRole = project.rework_initiator_role || to_role;
                        if (initiatorRole) {
                            const emails = await getRoleEmails(initiatorRole);
                            // Strictly exclude CEO from receiving rework submission emails
                            const filteredEmails = emails.filter(email => initiatorRole !== "CEO");
                            recipientEmails.push(...filteredEmails);
                            console.log(`REWORK_SUBMITTED: Routing back to initiator role: ${initiatorRole}`);
                        }
                    } else {
                        const targetRole = to_role || project.assigned_to_role;
                        if (targetRole) {
                            const emails = await getRoleEmails(targetRole);

                            // Stage-based specialized routing

                            // 1. Cine -> Writer (Single Writer Approval)
                            if (targetRole === "WRITER" && (history_stage === "CINEMATOGRAPHY" || from_role === "CINE")) {
                                const writerId = project.writer_id || project.created_by_user_id;
                                const writerEmail = await getUserEmail(writerId);
                                if (writerEmail) {
                                    recipientEmails.push(writerEmail);
                                    console.log(`CINE_UPLOAD: Routing to specific assigned writer: ${writerEmail}`);
                                } else {
                                    recipientEmails.push(...emails);
                                }
                            }
                            // 2. Editor/Sub-Editor -> Designer or Writer
                            else if (history_stage === "SUB_EDITOR_PROCESSING" || from_role === "SUB_EDITOR" || from_role === "EDITOR") {
                                // Check thumbnail requirement
                                const { data: fullProject } = await supabaseAdmin
                                    .from("projects")
                                    .select("data")
                                    .eq("id", project_id)
                                    .single();

                                if (fullProject?.data?.thumbnail_required === true || fullProject?.data?.cine_thumbnail_required === true) {
                                    const designerEmails = await getRoleEmails("DESIGNER");
                                    recipientEmails.push(...designerEmails);
                                    console.log(`EDITOR_UPLOAD: Sent to Designer (thumbnail required)`);
                                } else {
                                    // Multi-writer approval
                                    recipientEmails.push(...emails);
                                    console.log(`EDITOR_UPLOAD: Sent to Multi-Writer Approval`);
                                }
                            }
                            // 3. Regular CMO submission
                            else if (targetRole === "CMO") {
                                const ceoEmails = await getRoleEmails("CEO");
                                const filteredEmails = emails.filter(email => !ceoEmails.includes(email));
                                recipientEmails.push(...filteredEmails);
                            }
                            else {
                                recipientEmails.push(...emails);
                            }
                        }
                    }
                    break;

                case "APPROVED":
                    // When CMO approves, don't email CEO
                    // When other roles approve, apply appropriate filtering
                    if (to_role) {
                        const emails = await getRoleEmails(to_role);

                        // If moving to WRITER role, check if it's the specific assigned writer or all writers (multi-writer)
                        if (to_role === "WRITER") {
                            // If coming from CINEMATOGRAPHY, it's the single writer approval stage
                            if (history_stage === "CINEMATOGRAPHY") {
                                const writerId = project.writer_id || project.created_by_user_id;
                                const writerEmail = await getUserEmail(writerId);
                                if (writerEmail) {
                                    recipientEmails.push(writerEmail);
                                    console.log(`APPROVED: Routing to specific assigned writer: ${writerEmail}`);
                                } else {
                                    recipientEmails.push(...emails);
                                }
                            } else {
                                // Default to all writers (e.g. MULTI_WRITER_APPROVAL)
                                recipientEmails.push(...emails);
                                console.log(`APPROVED: Routing to all writers for stage: ${history_stage}`);
                            }
                        }
                        // 🔹 Special Case: CEO Approved Script for PA Brand
                        else if (to_role === "PARTNER_ASSOCIATE" && from_role === "CEO") {
                            recipientEmails.push(...emails);
                            console.log(`CEO_PA_APPROVAL: Routing to all Partner Associates: ${emails.length} users`);
                        }
                        // If CMO is approving and sending to next role, exclude CEO
                        else if (from_role === "CMO") {
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
                        const roleUsers = await getRoleEmails(targetedRole);

                        if (roleUsers && roleUsers.length > 0) {
                            recipientEmails.push(...roleUsers);
                            console.log(`REWORK: Sending to ${roleUsers.length} users with role ${targetedRole}`);
                        } else {
                            console.warn(`REWORK: No active users found for role: ${targetedRole}`);
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
                    break;

                case "SUB_EDITOR_ASSIGNED":
                    // When an Editor assigns a project to a Sub-Editor, the Sub-Editor should receive an email
                    if (project.assigned_to_user_id) {
                        const subEditorEmail = await getUserEmail(project.assigned_to_user_id);
                        if (subEditorEmail) {
                            recipientEmails.push(subEditorEmail);
                            console.log(`SUB_EDITOR_ASSIGNED: Sending to assigned Sub-Editor: ${subEditorEmail}`);
                        }
                    } else {
                        // Fallback to all Sub-Editors
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
                        // Fallback to all Sub-Editors
                        const subEditorEmails = await getRoleEmails("SUB_EDITOR");
                        recipientEmails.push(...subEditorEmails);
                    }
                    break;

                case "SEND_TO_INFLUENCER":
                    console.log("SEND_TO_INFLUENCER: Using provided recipient_email");
                    break;

                default:
                    console.log(`Action ${action} has no routing rule.`);
                    break;
            }
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
        else if (action === "SEND_TO_INFLUENCER") subject = `Script Content: ${project.title}`;
        else subject = `Action Required: ${project.title}`;

        const highlightColor = action === "REWORK" || action === "REJECTED" ? "#E53E3E" : (action === "SUB_EDITOR_ASSIGNED" ? "#38A169" : "#3182CE");
        const reworkReason = metadata.rework_reason || comment || "No comments provided.";

        const htmlBody = action === "SEND_TO_INFLUENCER" ? `
          <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background-color: white;">
            <div style="background-color: #3182CE; padding: 24px; text-align: center; color: white;">
              <h2 style="margin: 0; text-transform: uppercase; letter-spacing: 1px;">Ready To Work - Script Content</h2>
            </div>
            <div style="padding: 32px; color: #2d3748; line-height: 1.6;">
              <p style="font-size: 18px; font-weight: bold; margin-bottom: 24px;">Project: ${project.title}</p>
              
              <div style="margin-bottom: 30px;">
                <h3 style="color: #4a5568; font-size: 14px; text-transform: uppercase; border-bottom: 2px solid #edf2f7; padding-bottom: 8px;">Content Description</h3>
                <p style="white-space: pre-wrap; color: #4a5568;">${metadata.content_description || "No description provided."}</p>
              </div>

              <div style="margin-bottom: 30px;">
                <h3 style="color: #4a5568; font-size: 14px; text-transform: uppercase; border-bottom: 2px solid #edf2f7; padding-bottom: 8px;">Script Content</h3>
                <div style="background-color: #f7fafc; padding: 20px; border-radius: 6px; border: 1px solid #e2e8f0;">
                  <div style="white-space: pre-wrap; font-family: monospace;">${metadata.script_content || "No script content provided."}</div>
                </div>
              </div>

              <p style="font-size: 12px; color: #718096; margin-top: 40px; text-align: center;">Sent from Ready To Work Agency</p>
            </div>
          </div>
        ` : `
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

        try {
            const isInfluencer = action === "SEND_TO_INFLUENCER";
            const sender = isInfluencer ? INFLUENCER_SENDER : DEFAULT_SENDER;
            const creds = isInfluencer ? { tenant: PA_TENANT_ID, client: PA_CLIENT_ID, secret: PA_CLIENT_SECRET } : undefined;
            
            await sendEmail(sender, recipientEmails, subject, htmlBody, creds);
        } catch (emailError: any) {
            console.error("Email sending failed but continuing workflow:", emailError.message);
        }

        return new Response(JSON.stringify({ ok: true, sentTo: recipientEmails }), { headers: corsHeaders });

    } catch (err: any) {
        console.error("Critical Function Error:", err.message);
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
    }
});
