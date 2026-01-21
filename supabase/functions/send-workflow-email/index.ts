// Edge Function: send-workflow-email
// Handles all workflow-related email notifications

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

interface EmailContent {
  subject: string;
  html: string;
}

interface Recipient {
  email: string;
  name: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get the request body
    const { event, data, recipient_role, recipient_user_id, upload_type } = await req.json();
    
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Processing workflow notification:', { event, data });

    let recipients: Recipient[] = [];
    let emailContent: EmailContent = { subject: '', html: '' };
    
    // Handle different notification types
    switch (event) {
      case 'sub_editor_assigned':
        // Get the specific sub-editor user
        if (recipient_user_id) {
          const { data: user, error: userError } = await supabaseClient
            .from('users')
            .select('id, email, full_name')
            .eq('id', recipient_user_id)
            .single();
          
          if (user && !userError) {
            recipients = [{
              email: user.email,
              name: user.full_name || 'Sub-Editor'
            }];
            
            emailContent = {
              subject: `New Project Assigned: ${data.project_title}`,
              html: `
                <h2>New Project Assignment</h2>
                <p>Hello ${user.full_name || 'Sub-Editor'},</p>
                <p>You have been assigned a new project:</p>
                <ul>
                  <li><strong>Project:</strong> ${data.project_title}</li>
                  <li><strong>Assigned at:</strong> ${new Date(data.assigned_at).toLocaleString()}</li>
                </ul>
                <p>Please log in to your dashboard to view and work on this project.</p>
              `
            };
          }
        }
        break;

      case 'video_uploaded':
        // Notify the next role in workflow
        const nextRole = getNextRoleInWorkflow(data.current_stage, data.assigned_to_role);
        const { data: nextUsers, error: usersError } = await supabaseClient
          .from('users')
          .select('id, email, full_name')
          .eq('role', nextRole)
          .eq('status', 'ACTIVE');
        
        if (nextUsers && !usersError) {
          recipients = nextUsers.map(user => ({
            email: user.email,
            name: user.full_name || nextRole
          }));
          
          const uploader = upload_type === 'SUB_EDITOR' ? 'Sub-Editor' : 'Editor';
          emailContent = {
            subject: `New Video Uploaded: ${data.project_title}`,
            html: `
              <h2>Video Upload Notification</h2>
              <p>A ${uploader.toLowerCase()} has uploaded a video for project: ${data.project_title}</p>
              <ul>
                <li><strong>Upload Type:</strong> ${upload_type}</li>
                <li><strong>Uploaded at:</strong> ${new Date(data.uploaded_at).toLocaleString()}</li>
                <li><strong>Current Stage:</strong> ${data.current_stage}</li>
              </ul>
              <p>Please review and proceed with the next steps in the workflow.</p>
            `
          };
        }
        break;

      case 'rework_initiated':
        // Handle rework notifications based on routing
        const reworkRecipients = await getReworkRecipients(supabaseClient, data);
        recipients = reworkRecipients;
        
        emailContent = {
          subject: `Rework Required: ${data.project_title}`,
          html: `
            <h2>Rework Required</h2>
            <p>Rework has been initiated for project: ${data.project_title}</p>
            <ul>
              <li><strong>Reason:</strong> ${data.rework_reason || 'No reason provided'}</li>
              <li><strong>Routed to:</strong> ${data.routed_to_role}</li>
              <li><strong>Initiated by:</strong> ${data.initiator_role}</li>
            </ul>
            <p>Please review the feedback and make the necessary changes.</p>
          `
        };
        break;

      default:
        console.log('Unknown event type:', event);
        return new Response(JSON.stringify({ message: 'Unknown event type' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        });
    }

    // Send emails to all recipients
    const emailResults = [];
    for (const recipient of recipients) {
      try {
        const emailResult = await sendEmail({
          to: recipient.email,
          subject: emailContent.subject,
          html: emailContent.html
        });
        emailResults.push({ email: recipient.email, success: true, result: emailResult });
      } catch (error) {
        console.error(`Failed to send email to ${recipient.email}:`, error);
        emailResults.push({ email: recipient.email, success: false, error: error.message });
      }
    }

    // Log notification in database
    await logNotification(supabaseClient, {
      event,
      data,
      recipients: recipients.map(r => r.email),
      results: emailResults
    });

    return new Response(JSON.stringify({ 
      message: 'Notifications processed',
      recipients: recipients.length,
      results: emailResults
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('Error processing workflow notification:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});

// Helper functions
function getNextRoleInWorkflow(currentStage: string, assignedRole: string): string {
  const workflowMap: Record<string, string> = {
    'VIDEO_EDITING': 'DESIGNER',
    'SUB_EDITOR_PROCESSING': 'DESIGNER',
    'THUMBNAIL_DESIGN': 'CMO_REVIEW',
    'CMO_REVIEW': 'CEO_REVIEW',
    'CEO_REVIEW': 'PUBLISHING'
  };
  
  return workflowMap[currentStage] || 'ADMIN';
}

async function getReworkRecipients(supabaseClient: any, data: any): Promise<Recipient[]> {
  // Get users based on who should receive rework notification
  const { data: users, error } = await supabaseClient
    .from('users')
    .select('id, email, full_name')
    .eq('role', data.routed_to_role)
    .eq('status', 'ACTIVE');
  
  if (error) {
    console.error('Error fetching rework recipients:', error);
    return [];
  }
  
  return users.map((user: any) => ({
    email: user.email,
    name: user.full_name || data.routed_to_role
  }));
}

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

async function sendEmail({ to, subject, html }: EmailOptions) {
  // Integration with your email service (e.g., SendGrid, SMTP, etc.)
  // This is a placeholder - replace with your actual email service
  
  console.log('Sending email:', { to, subject });
  
  // Example using SMTP or other service:
  /*
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('SENDGRID_API_KEY')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: 'notifications@yourcompany.com' },
      subject: subject,
      content: [{ type: 'text/html', value: html }]
    })
  });
  
  if (!response.ok) {
    throw new Error(`Email sending failed: ${response.statusText}`);
  }
  
  return await response.json();
  */
  
  // For now, just log that we would send an email
  return { messageId: `mock-${Date.now()}`, status: 'sent' };
}

async function logNotification(supabaseClient: any, notificationData: any) {
  try {
    await supabaseClient
      .from('notifications')
      .insert({
        type: 'WORKFLOW_EMAIL',
        recipient_emails: notificationData.recipients,
        subject: notificationData.data?.subject || 'Workflow Notification',
        content: JSON.stringify(notificationData),
        status: 'SENT',
        sent_at: new Date().toISOString()
      });
  } catch (error) {
    console.error('Failed to log notification:', error);
  }
}