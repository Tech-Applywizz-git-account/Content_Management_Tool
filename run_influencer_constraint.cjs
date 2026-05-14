const SUPABASE_URL = 'https://kifpnlyljlxppuzizmsf.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpZnBubHlsamx4cHB1eml6bXNmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDAzNTE5NSwiZXhwIjoyMDg1NjExMTk1fQ.dJv-w9RzsdnaS-Oy7yb6p7fDg_ln2DnGUI0zdikRRxM';

const sql = `
ALTER TABLE public.influencers 
DROP CONSTRAINT IF EXISTS influencers_name_brand_key;

ALTER TABLE public.influencers 
ADD CONSTRAINT influencers_name_brand_key UNIQUE (influencer_name, brand_name);
`;

async function runMigration() {
  console.log('Running Influencer Constraint migration...');
  
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
    const text = await response.text();
    console.error('Migration failed:', response.status, text);
    return;
  }
  
  const text = await response.text();
  console.log('Migration result:', response.status, text);
}

runMigration().catch(console.error);
