import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js";
import { Resend } from "https://esm.sh/resend";

serve(async (req) => {
  const { project_id, assigned_to_role } = await req.json();

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // 1️⃣ Fetch project
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("title, rejected_reason")
    .eq("id", project_id)
    .single();

  if (projectError) {
    console.error("Project fetch error", projectError);
    return new Response("Project fetch failed", { status: 500 });
  }

  // 2️⃣ Fetch latest workflow action
  const { data: history } = await supabase
    .from("workflow_history")
    .select("action, actor_name, comment")
    .eq("project_id", project_id)
    .order("timestamp", { ascending: false })
    .limit(1)
    .single();

  // 3️⃣ Fetch users for assigned role
  const { data: users } = await supabase
    .from("users")
    .select("email")
    .eq("role", assigned_to_role)
    .eq("status", "ACTIVE");

  if (!users || users.length === 0) {
    return new Response("No users to notify", { status: 200 });
  }

  // 4️⃣ Decide mail type
  const isRework =
    history?.action === "REWORKED" ||
    history?.action === "REWORK";

  const subject = isRework
    ? `Rework Required: ${project.title}`
    : `Action Required: ${project.title}`;

  const html = isRework
    ? `
      <p>The project <b>${project.title}</b> has been sent back for rework.</p>
      <p><b>Reason:</b> ${project.rejected_reason || history?.comment || "Please review"}</p>
    `
    : `
      <p>The project <b>${project.title}</b> is now assigned to you.</p>
      <p>Please log in and take action.</p>
    `;

  // 5️⃣ Send emails
  const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

  for (const user of users) {
    await resend.emails.send({
      from: "workflow@yourdomain.com",
      to: user.email,
      subject,
      html,
    });
  }

  return new Response("Emails sent successfully", { status: 200 });
});
