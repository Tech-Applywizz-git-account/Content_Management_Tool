const SUPABASE_URL = 'https://kifpnlyljlxppuzizmsf.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpZnBubHlsamx4cHB1eml6bXNmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDAzNTE5NSwiZXhwIjoyMDg1NjExMTk1fQ.dJv-w9RzsdnaS-Oy7yb6p7fDg_ln2DnGUI0zdikRRxM';

const sql = `
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'influencers' AND COLUMN_NAME = 'product_received') THEN
        ALTER TABLE public.influencers ADD COLUMN product_received TEXT DEFAULT 'no';
    END IF;
END $$;
`;

async function runMigration() {
  console.log('Running Product Received column migration via /pg/query...');
  
  try {
    const response = await fetch(`${SUPABASE_URL}/pg/query`, {
      method: 'POST',
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: sql })
    });
    
    const text = await response.text();
    if (response.ok) {
      console.log('Migration successful:', text);
    } else {
      console.error('Migration failed:', response.status, text);
    }
  } catch (err) {
    console.error('Network error during migration:', err);
  }
}

runMigration();
