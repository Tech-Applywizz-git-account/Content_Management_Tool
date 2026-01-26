# Email Notification Pause

## Action
Temporarily disabled email output in `supabase/functions/workflow-notifications/index.ts`.

## Changes
- Commented out `await sendGraphMail(...)`.
- Added console logging to track who *would* have received the email.

## How to Resume
1. Open `supabase/functions/workflow-notifications/index.ts`.
2. Uncomment line 229: `await sendGraphMail(...)`.
3. Deploy the function again.
