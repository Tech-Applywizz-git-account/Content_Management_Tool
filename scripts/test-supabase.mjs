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

console.log('--- SUPABASE DIAGNOSTIC ---');
console.log('URL:', supabaseUrl);
console.log('Service Key Loaded:', serviceKey ? 'YES' : 'NO');
if (serviceKey) console.log('Service Key Length:', serviceKey.length);

if (!supabaseUrl || !serviceKey) {
    console.error('❌ Missing URL or Key. Cannot proceed.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function testConnection() {
    console.log('\n1. Testing Database Connection...');
    const { data, error } = await supabase
  .from('users')
  .select('*');

if (error) {
  console.error('❌ Database connection failed:', error.message);
  return false;
}

console.log('✅ USERS FROM DB:', data);
console.log('✅ USER COUNT:', data.length);

    if (error) {
        console.error('❌ Database connection failed:', error.message);
        return false;
    }
    console.log('✅ Connected to database. User count:', count);
    return true;
}

async function testAuthCreation() {
    console.log('\n2. Testing Auth User Creation...');
    const testEmail = `test-${Date.now()}@example.com`;
    console.log(`Attempting to create user: ${testEmail}`);

    const { data, error } = await supabase.auth.admin.createUser({
        email: testEmail,
        password: 'password123',
        email_confirm: true,
        user_metadata: { full_name: 'Test User', role: 'OBSERVER' }
    });

    if (error) {
        console.error('❌ Auth creation failed:', error.message);
        return null;
    }

    console.log('✅ Auth user created. ID:', data.user.id);
    return { id: data.user.id, email: testEmail };
}

async function testDbInsertion(user) {
    console.log('\n3. Testing Public DB Insertion...');
    const { error } = await supabase.from('users').insert({
        id: user.id,
        email: user.email,
        full_name: 'Test User',
        role: 'OBSERVER',
        status: 'Active'
    });

    if (error) {
        console.error('❌ DB Insertion failed:', error.message);
        return false;
    }
    console.log('✅ Public DB record inserted successfully.');
    return true;
}

async function cleanup(user) {
    console.log('\n4. Cleaning up test user...');
    await supabase.auth.admin.deleteUser(user.id);
    await supabase.from('users').delete().eq('id', user.id);
    console.log('✅ Cleanup complete.');
}

async function run() {
    try {
        if (!await testConnection()) return;
        const user = await testAuthCreation();
        if (user) {
            await testDbInsertion(user);
            await cleanup(user);
            console.log('\n🎉 DIAGNOSTICS PASSED: Your keys and database are working correctly.');
        }
    } catch (e) {
        console.error('Unexpected error:', e);
    }
}

run();
