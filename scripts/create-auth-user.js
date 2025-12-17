import { createClient } from '@supabase/supabase-js';

// IMPORTANT: This script uses the SERVICE_ROLE_KEY - keep it secure!
const supabaseUrl = 'https://zxnevoulicmapqmniaos.supabase.co';
const serviceRoleKey = process.env.SERVICE_ROLE_KEY; // Set this as environment variable

if (!serviceRoleKey) {
    console.error('ERROR: SERVICE_ROLE_KEY environment variable not set');
    console.log('Run: $env:SERVICE_ROLE_KEY="your-service-role-key"; node scripts/create-auth-user.js');
    process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function createAuthUser() {
    const email = 'ramakrishna@applywizz';
    const password = 'Admin@123'; // Change this to your desired password

    console.log(`Creating auth user for: ${email}`);

    try {
        // First, get the existing user from public.users table
        const { data: existingUser, error: fetchError } = await supabaseAdmin
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (fetchError) {
            console.error('Error fetching user from database:', fetchError.message);
            process.exit(1);
        }

        console.log('Found user in database:', existingUser);

        // Create auth user with the same ID as the database user
        const { data: authUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email: email,
            password: password,
            // email_confirm: true, // Auto-confirm email
            user_metadata: {
                full_name: existingUser.full_name,
                role: existingUser.role,
                phone: existingUser.phone
            }
        });

        if (createError) {
            console.error('Error creating auth user:', createError.message);
            process.exit(1);
        }

        console.log('✅ Auth user created successfully!');
        console.log(`User ID: ${authUser.user.id}`);

        // Update the public.users table with the new auth user ID
        const { error: updateError } = await supabaseAdmin
            .from('users')
            .update({ id: authUser.user.id })
            .eq('email', email);

        if (updateError) {
            console.error('Warning: Could not update user ID in database:', updateError.message);
        }

        console.log('✅ Setup complete!');
        console.log(`You can now login with:`);
        console.log(`Email: ${email}`);
        console.log(`Password: ${password}`);

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

createAuthUser();
