// Run this script to fix the PA CMO Review stage migration
// Usage: node run_migration.cjs

const SUPABASE_URL = 'https://kifpnlyljlxppuzizmsf.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpZnBubHlsamx4cHB1eml6bXNmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDAzNTE5NSwiZXhwIjoyMDg1NjExMTk1fQ.dJv-w9RzsdnaS-Oy7yb6p7fDg_ln2DnGUI0zdikRRxM';

const sql = `
-- Step 1: Drop existing constraint and recreate with PA_VIDEO_CMO_REVIEW
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'projects_current_stage_check'
  ) THEN
    ALTER TABLE projects DROP CONSTRAINT projects_current_stage_check;
  END IF;
END $$;

ALTER TABLE projects 
ADD CONSTRAINT projects_current_stage_check 
CHECK (current_stage = ANY (ARRAY[
  'SCRIPT'::text,
  'SCRIPT_REVIEW_L1'::text,
  'SCRIPT_REVIEW_L2'::text,
  'CINEMATOGRAPHY'::text,
  'VIDEO_EDITING'::text,
  'SUB_EDITOR_ASSIGNMENT'::text,
  'SUB_EDITOR_PROCESSING'::text,
  'THUMBNAIL_DESIGN'::text,
  'CREATIVE_DESIGN'::text,
  'FINAL_REVIEW_CMO'::text,
  'FINAL_REVIEW_CEO'::text,
  'FINAL_REVIEW_CEO_POST_APPROVAL'::text,
  'WRITER_VIDEO_APPROVAL'::text,
  'MULTI_WRITER_APPROVAL'::text,
  'POST_WRITER_REVIEW'::text,
  'OPS_SCHEDULING'::text,
  'POSTED'::text,
  'REWORK'::text,
  'WRITER_REVISION'::text,
  'PARTNER_REVIEW'::text,
  'SENT_TO_INFLUENCER'::text,
  'PA_FINAL_REVIEW'::text,
  'PA_VIDEO_CMO_REVIEW'::text
]));

-- Step 2: Add RLS UPDATE policy for PARTNER_ASSOCIATE role
DROP POLICY IF EXISTS "PA users can update their influencer projects" ON public.projects;
CREATE POLICY "PA users can update their influencer projects" ON public.projects FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'PARTNER_ASSOCIATE')
  AND (
    assigned_to_user_id = auth.uid()
    OR created_by_user_id = auth.uid()
    OR assigned_to_role = 'PARTNER_ASSOCIATE'
  )
);

DROP POLICY IF EXISTS "PA users can update sent-to-influencer projects" ON public.projects;
CREATE POLICY "PA users can update sent-to-influencer projects" ON public.projects FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'PARTNER_ASSOCIATE')
  AND current_stage IN ('SENT_TO_INFLUENCER', 'PARTNER_REVIEW', 'PA_FINAL_REVIEW', 'PA_VIDEO_CMO_REVIEW')
);
`;

async function runMigration() {
  console.log('Running PA CMO Review migration...');
  
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: sql })
  });
  
  if (!response.ok) {
    // Try the pg query endpoint instead
    const response2 = await fetch(`${SUPABASE_URL}/pg/query`, {
      method: 'POST', 
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: sql })
    });
    
    const text2 = await response2.text();
    console.log('Response 2:', response2.status, text2);
    return;
  }
  
  const text = await response.text();
  console.log('Migration result:', response.status, text);
}

runMigration().catch(console.error);
