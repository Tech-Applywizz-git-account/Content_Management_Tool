/// <reference lib="deno.ns" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

// Environment variables
const TENANT_ID = Deno.env.get("TENANT_ID")!;
const CLIENT_ID = Deno.env.get("CLIENT_ID")!;
const CLIENT_SECRET = Deno.env.get("CLIENT_SECRET")!;
const SENDER_EMAIL = Deno.env.get("SENDER_EMAIL")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET")!;
const BASE_URL = Deno.env.get("BASE_URL") || "https://support.applywizz.com";

// Initialize Supabase Admin Client
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Helper: Get Microsoft Graph OAuth Token
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
    return json.access_token;
}

// Helper: Send Mail via Microsoft Graph
async function sendGraphMail(
    toRecipients: string[],
    subject: string,
    content: string,
    type: "Text" | "HTML" = "HTML"
) {
    const token = await getGraphToken();
    const endpoint = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(
        SENDER_EMAIL
    )}/sendMail`;

    const payload = {
        message: {
            subject,
            body: { contentType: type, content },
            toRecipients: toRecipients.map((email: string) => ({
                emailAddress: { address: email },
            })),
        },
        saveToSentItems: "true",
    };

    const res = await fetch(endpoint, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error(`sendMail error ${res.status}: ${await res.text()}`);
}

// Helper: Get User Email by ID
async function getUserEmail(userId: string): Promise<string | null> {
    const { data, error } = await supabaseAdmin
        .from("users")
        .select("email")
        .eq("id", userId)
        .single();
    if (error || !data) return null;
    return data.email;
}

// Helper: Get Active User Emails by Role
async function getRoleEmails(role: string): Promise<string[]> {
    const { data, error } = await supabaseAdmin
        .from("users")
        .select("email")
        .eq("role", role.toUpperCase())
        .eq("status", "ACTIVE");
    if (error || !data) return [];
    return data.map((u: any) => u.email).filter(Boolean);
}

// Helper: Type check for Supabase DB Webhook
function isDbWebhookPayload(body: any) {
    return (
        body &&
        body.schema === "public" &&
        body.table === "workflow_history" &&
        body.type === "INSERT"
    );
}

Deno.serve(async (req: Request) => {
    // CORS handling
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
        const body = await req.json();
        console.log("Webhook Body:", JSON.stringify(body, null, 2));

        if (!isDbWebhookPayload(body)) {
            return new Response(JSON.stringify({ ok: true, skipped: true }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const record = body.record;
        const { project_id, action, from_role, to_role, metadata = {}, comment, actor_name } = record;

        if (action === "CREATED") {
            return new Response(JSON.stringify({ ok: true, msg: "No email for CREATED" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // Fetch project details
        const { data: project, error: pErr } = await supabaseAdmin
            .from("projects")
            .select("title, created_by_user_id, writer_id, assigned_to_user_id, assigned_to_role")
            .eq("id", project_id)
            .single();

        if (pErr || !project) {
            throw new Error(`Project not found: ${project_id}`);
        }

        // Resolve Recipients based on Action
        let recipients: string[] = [];

        if (action === "REJECTED") {
            // Email goes to Project Creator (WRITER)
            const rolesToNotify = ["WRITER"];
            for (const role of rolesToNotify) {
                const emails = await getRoleEmails(role);
                // Only notify the specific writer if we have their ID
                const specificEmail = await getUserEmail(project.writer_id || project.created_by_user_id);
                if (specificEmail) recipients.push(specificEmail);
                else recipients.push(...emails);
            }
        } else if (action === "REWORK_VIDEO_SUBMITTED") {
            // Email goes to the role that requested rework (from_role)
            if (from_role) {
                const emails = await getRoleEmails(from_role);
                recipients.push(...emails);
            }
        } else {
            // For SUBMITTED, APPROVED, REWORK => Email goes to to_role
            const targetRole = to_role || project.assigned_to_role;
            const targetUserId = metadata.assigned_to || project.assigned_to_user_id;

            if (targetUserId) {
                const email = await getUserEmail(targetUserId);
                if (email) recipients.push(email);
            }

            if (recipients.length === 0 && targetRole) {
                const emails = await getRoleEmails(targetRole);
                recipients.push(...emails);
            }
        }

        // Remove duplicates
        recipients = [...new Set(recipients.filter(Boolean))];

        if (recipients.length === 0) {
            return new Response(JSON.stringify({ ok: true, msg: "No recipients found" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // Email Content Generation
        const highlightColor = action === "REWORK" || action === "REJECTED" ? "#E53E3E" : "#3182CE";
        const statusNote = metadata.rework_reason || comment || "No specific comments provided.";
        const projectLink = `${BASE_URL}/project/${project_id}`;

        const htmlBody = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #edf2f7; border-radius: 10px; overflow: hidden; background-color: #ffffff;">
        <div style="background-color: ${highlightColor}; padding: 30px; text-align: center; color: #ffffff;">
          <h1 style="margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: 2px;">Workflow Update</h1>
        </div>
        <div style="padding: 40px; color: #2d3748;">
          <p style="font-size: 18px; font-weight: 600;">Action Required / Notification</p>
          <p style="font-size: 16px; line-height: 1.6;">
            The project <strong>"${project.title}"</strong> has been updated.
          </p>
          
          <div style="margin: 30px 0; padding: 20px; background-color: #f7fafc; border-radius: 8px;">
            <p style="margin: 0 0 10px 0;"><strong>Action:</strong> <span style="color: ${highlightColor}; font-weight: bold;">${action}</span></p>
            <p style="margin: 0 0 10px 0;"><strong>Performed By:</strong> ${actor_name || from_role || "System"}</p>
            <p style="margin: 0;"><strong>Notes:</strong><br><span style="color: #4a5568; font-style: italic;">"${statusNote}"</span></p>
          </div>
 
          <div style="text-align: center; margin-top: 40px;">
            <a href="${projectLink}" style="background-color: ${highlightColor}; color: #ffffff; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; display: inline-block;">View Project Dashboard</a>
          </div>
        </div>
        <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #edf2f7; font-size: 12px; color: #a0aec0;">
          This is an automated production workflow notification.<br>
          Sent via ${BASE_URL}
        </div>
      </div>
    `;

        // Send Email
        await sendGraphMail(recipients, `[${action}] ${project.title}`, htmlBody);

        return new Response(JSON.stringify({ ok: true, sentTo: recipients }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err: any) {
        console.error("Critical Error:", err.message);
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: corsHeaders,
        });
    }
});
