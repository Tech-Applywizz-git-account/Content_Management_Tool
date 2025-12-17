import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://zxnevoulicmapqmniaos.supabase.co";
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
    console.error('❌ ERROR: SERVICE_ROLE_KEY environment variable not set');
    console.log('\nRun this first:');
    console.log('$env:SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4bmV2b3VsaWNtYXBxbW5pYW9zIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDYwMjM1NiwiZXhwIjoyMDgwMTc4MzU2fQ.drPYqcrPuCAsijag-gZIFcr5MDU7wAPYCRuSzhylCAY"');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
});

// Observer users to create
const OBSERVER_USERS = [
    {
        email: 'coo@applywizz.com',
        password: 'coo123',
        full_name: 'John Smith',
        role: 'OBSERVER',
        job_title: 'COO'
    },
    {
        email: 'cro@applywizz.com',
        password: 'cro123',
        full_name: 'Sarah Johnson',
        role: 'OBSERVER',
        job_title: 'CRO'
    },
    {
        email: 'cto@applywizz.com',
        password: 'cto123',
        full_name: 'Mike Chen',
        role: 'OBSERVER',
        job_title: 'CTO'
    },
];

async function createObserver(userData) {
    const { email, password, full_name, role, job_title } = userData;

    try {
        console.log(`\n📝 Creating ${job_title}: ${email}`);

        // Create auth user with password
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: email,
            password: password,
            email_confirm: true,
            user_metadata: {
                full_name: full_name,
                role: role,
                job_title: job_title
            }
        });

        if (authError) {
            // User might already exist
            if (authError.message.includes('already registered')) {
                console.log(`   ⚠️  User already exists, skipping...`);
                return { success: true, existed: true };
            }
            throw authError;
        }

        console.log(`   ✅ Auth user created: ${authData.user.id}`);

        // Create database user record with job_title
        const { error: dbError } = await supabase
            .from('users')
            .upsert({
                id: authData.user.id,
                email: email,
                full_name: full_name,
                role: role,
                job_title: job_title,
                status: 'ACTIVE',
                last_login: new Date().toISOString()
            }, {
                onConflict: 'id'
            });

        if (dbError) {
            console.warn(`   ⚠️  Database error: ${dbError.message}`);
        } else {
            console.log(`   ✅ Database record created with job_title: ${job_title}`);
        }

        return { success: true, userId: authData.user.id, existed: false };

    } catch (error) {
        console.error(`   ❌ Error creating ${email}:`, error.message);
        return { success: false, error: error.message };
    }
}

async function createObservers() {
    console.log('\n🌱 CREATING OBSERVER TEST USERS\n');
    console.log('='.repeat(50));

    console.log('\n👁️ Creating observer users...\n');

    for (const user of OBSERVER_USERS) {
        await createObserver(user);
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('\n\n🎉 OBSERVER USERS CREATED!');
    console.log('\n📋 Login with these credentials:\n');

    OBSERVER_USERS.forEach(user => {
        console.log(`   ${user.job_title.padEnd(10)} - ${user.email.padEnd(25)} - ${user.password}`);
    });

    console.log('\n🌐 Open http://localhost:3000 and test!\n');
}

createObservers().catch(error => {
    console.error('\n❌ CREATION FAILED:', error);
    process.exit(1);
});
