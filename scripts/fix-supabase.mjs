import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env
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

if (!supabaseUrl || !serviceKey) {
    console.error('❌ Missing Supabase URL or Service Role Key in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function syncUsers() {
    console.log('🔄 Syncing Public Users to Auth...');

    // 1. Get all public users
    const { data: publicUsers, error: dbError } = await supabase
        .from('users')
        .select('*');

    if (dbError) {
        console.error('Failed to fetch public users:', dbError.message);
        return;
    }

    console.log(`Found ${publicUsers.length} users in public database.`);

    // 2. For each, check if they exist in Auth
    for (const user of publicUsers) {
        // Try to get user by email from Admin API
        const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
        const authUser = users.find(u => u.email === user.email);

        if (!authUser) {
            console.log(`Creating Auth user for: ${user.email}`);
            const { error: createError } = await supabase.auth.admin.createUser({
                email: user.email,
                password: 'password123', // Default password
                email_confirm: true,
                user_metadata: { full_name: user.full_name, role: user.role }
            });

            if (createError) console.error(`Failed to create auth for ${user.email}:`, createError.message);
            else console.log(`✅ Created Auth user for ${user.email} (Password: password123)`);
        } else {
            console.log(`✓ Auth exists for ${user.email}`);
        }
    }
}

async function runMigration() {
    console.log('\n🔄 Updating Database Constraints...');
    const sql = `
    ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
    ALTER TABLE public.users ADD CONSTRAINT users_role_check 
    CHECK (role IN ('ADMIN', 'WRITER', 'CINE', 'EDITOR', 'DESIGNER', 'CMO', 'CEO', 'OPS', 'OBSERVER'));
    `;

    // We can't run raw SQL easily without the specialized RPC 'exec_sql' which might not exist on all projects.
    // Standard Supabase doesn't expose raw SQL execution via JS client unless you have a stored procedure.
    // We will assume the RPC exists (as per previous scripts) or skip it.

    try {
        const { error } = await supabase.rpc('exec_sql', { sql });
        if (error) {
            // Only verify/warn, don't crash
            console.warn('⚠️ Could not run SQL migration automatically (RPC exec_sql missing?).');
            console.warn('Please run this in Supabase SQL Editor:\n' + sql);
        } else {
            console.log('✅ constraints updated.');
        }
    } catch (e) {
        console.warn('⚠️ Migration check failed (continuing)');
    }
}

async function main() {
    await runMigration();
    await syncUsers();
}

main();
