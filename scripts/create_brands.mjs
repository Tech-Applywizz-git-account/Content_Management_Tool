import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../.env');
const env = {};

if (fs.existsSync(envPath)) {
    const data = fs.readFileSync(envPath, 'utf8');
    data.split('\n').forEach(line => {
        const [k, v] = line.split('=');
        if (k && v) env[k.trim()] = v.trim();
    });
}

const supabaseUrl = env.VITE_SUPABASE_URL;
const serviceKey = env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceKey);

async function main() {
    console.log('Creating brands table...');
    const sql = `
        CREATE TABLE IF NOT EXISTS public.brands (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            name TEXT UNIQUE NOT NULL,
            campaign_objective TEXT,
            target_audience TEXT,
            deliverables TEXT,
            created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
        );

        -- Optional RLS
        ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_policies WHERE tablename = 'brands' AND policyname = 'Enable all for authenticated users'
            ) THEN
                CREATE POLICY "Enable all for authenticated users" ON public.brands FOR ALL USING (auth.role() = 'authenticated');
            END IF;
        END $$;
    `;

    const { data, error } = await supabase.rpc('exec_sql', { sql });
    
    if (error) {
        console.error('Error executing SQL:', error);
    } else {
        console.log('Success:', data);
    }
}

main();
