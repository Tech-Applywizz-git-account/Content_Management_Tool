import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Manually load .env file
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '.env');

if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
            process.env[key.trim()] = value.trim();
        }
    });
    console.log('✅ Loaded environment variables from .env');
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://zxnevoulicmapqmniaos.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
    console.error('❌ VITE_SUPABASE_SERVICE_ROLE_KEY not found in environment');
    console.error('Please add it to your .env file');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const sql = `
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE public.users ADD CONSTRAINT users_role_check 
CHECK (role IN ('ADMIN', 'WRITER', 'CINE', 'EDITOR', 'DESIGNER', 'CMO', 'CEO', 'OPS', 'OBSERVER'));
`;

async function runMigration() {
    console.log('🔄 Running OBSERVER role migration...');

    try {
        const { data, error } = await supabase.rpc('exec_sql', { sql });

        if (error) {
            console.error('❌ Migration failed:', error.message);
            process.exit(1);
        }

        console.log('✅ Migration successful!');
        console.log('OBSERVER role is now available for user creation.');

    } catch (err) {
        console.error('❌ Error:', err.message);
        console.log('\n📝 Please run this SQL manually in Supabase SQL Editor:');
        console.log(sql);
        process.exit(1);
    }
}

runMigration();
