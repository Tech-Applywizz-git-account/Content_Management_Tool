// Run this to create the source_brand_mapping table in Supabase
// Usage: node run_source_brand_migration.cjs

const SUPABASE_URL = 'https://kifpnlyljlxppuzizmsf.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpZnBubHlsamx4cHB1eml6bXNmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDAzNTE5NSwiZXhwIjoyMDg1NjExMTk1fQ.dJv-w9RzsdnaS-Oy7yb6p7fDg_ln2DnGUI0zdikRRxM';

const sql = `
CREATE TABLE IF NOT EXISTS source_brand_mapping (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    source_name TEXT NOT NULL UNIQUE,
    brand_name  TEXT,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE source_brand_mapping ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "source_brand_mapping_select" ON source_brand_mapping;
CREATE POLICY "source_brand_mapping_select"
    ON source_brand_mapping FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "source_brand_mapping_insert" ON source_brand_mapping;
CREATE POLICY "source_brand_mapping_insert"
    ON source_brand_mapping FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "source_brand_mapping_update" ON source_brand_mapping;
CREATE POLICY "source_brand_mapping_update"
    ON source_brand_mapping FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "source_brand_mapping_delete" ON source_brand_mapping;
CREATE POLICY "source_brand_mapping_delete"
    ON source_brand_mapping FOR DELETE TO authenticated USING (true);
`;

async function runMigration() {
  console.log('Running source_brand_mapping migration...');

  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: sql })
  });

  const text = await response.text();

  if (!response.ok) {
    console.log('RPC endpoint failed, trying pg/query...');
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
    console.log('pg/query result:', response2.status, text2);
    return;
  }

  console.log('Migration result:', response.status, text);
  console.log('✅ source_brand_mapping table created successfully!');
}

runMigration().catch(console.error);
