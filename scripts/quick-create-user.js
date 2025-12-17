import { createClient } from '@supabase/supabase-js';
import * as readline from 'readline';

const SUPABASE_URL = "https://zxnevoulicmapqmniaos.supabase.co";
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
    console.error('❌ ERROR: SERVICE_ROLE_KEY environment variable not set');
    console.log('\nRun this first:');
    console.log('$env:SERVICE_ROLE_KEY="your-service-role-key"');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
});

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(prompt) {
    return new Promise((resolve) => {
        rl.question(prompt, resolve);
    });
}

async function createUser() {
    console.log('\n=== QUICK USER CREATION ===\n');

    const fullName = await question('Full Name: ');
    const email = await question('Email: ');
    const role = await question('Role (WRITER/DESIGNER/EDITOR/CINE/CMO/CEO/OPS/ADMIN): ');
    const phone = await question('Phone (optional, press Enter to skip): ');

    console.log('\n📝 Creating user...');
    console.log(`   Name: ${fullName}`);
    console.log(`   Email: ${email}`);
    console.log(`   Role: ${role}`);
    console.log(`   Phone: ${phone || 'N/A'}`);

    try {
        // Step 1: Create auth user and send invitation email
        console.log('\n1️⃣  Creating authentication user...');
        const { data: authData, error: authError } = await supabase.auth.admin.inviteUserByEmail(
            email,
            {
                data: {
                    full_name: fullName,
                    role: role,
                    phone: phone || null
                },
                redirectTo: `https://content-final-ebon.vercel.app/set-password?email=${encodeURIComponent(email)}&role=${role}`
            }
        );

        if (authError) {
            throw new Error(`Auth error: ${authError.message}`);
        }

        console.log(`   ✅ Auth user created: ${authData.user.id}`);
        console.log(`   📧 Invitation email sent to: ${email}`);

        // Step 2: Create database user record
        console.log('\n2️⃣  Creating database record...');
        const { error: dbError } = await supabase
            .from('users')
            .upsert({
                id: authData.user.id,
                email: email,
                full_name: fullName,
                role: role,
                phone: phone || null,
                status: 'ACTIVE'
            });

        if (dbError) {
            console.warn(`   ⚠️  Warning: Database record creation failed: ${dbError.message}`);
            console.log('   Note: User can still login, but may need manual database entry');
        } else {
            console.log(`   ✅ Database record created`);
        }

        console.log('\n✅ SUCCESS! User created:\n');
        console.log(`   Email: ${email}`);
        console.log(`   User ID: ${authData.user.id}`);
        console.log(`   Status: Invitation sent`);
        console.log(`\n📧 The user will receive an email with a link to set their password.`);

    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        process.exit(1);
    }

    rl.close();
}

createUser();
