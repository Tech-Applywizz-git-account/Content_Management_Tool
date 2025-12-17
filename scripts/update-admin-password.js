import { createClient } from '@supabase/supabase-js';

// IMPORTANT: This script uses the SERVICE_ROLE_KEY - keep it secure!
const supabaseUrl = 'https://zxnevoulicmapqmniaos.supabase.co';
const serviceRoleKey = process.env.SERVICE_ROLE_KEY; // Set this as environment variable

if (!serviceRoleKey) {
    console.error('ERROR: SERVICE_ROLE_KEY environment variable not set');
    console.log('Run: $env:SERVICE_ROLE_KEY="your-service-role-key"; node scripts/update-admin-password.js');
    process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function updateAdminPassword() {
    const email = 'ramakrishna@applywizz';
    const newPassword = 'Admin@123'; // Change this to your desired password

    console.log(`Updating password for: ${email}`);

    try {
        // Get user by email
        const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();

        if (listError) {
            throw listError;
        }

        const user = users.find(u => u.email === email);

        if (!user) {
            console.error(`User not found: ${email}`);
            process.exit(1);
        }

        console.log(`Found user: ${user.id}`);

        // Update password
        const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
            user.id,
            { password: newPassword }
        );

        if (error) {
            throw error;
        }

        console.log('✅ Password updated successfully!');
        console.log(`You can now login with: ${email} / ${newPassword}`);

    } catch (error) {
        console.error('❌ Error updating password:', error.message);
        process.exit(1);
    }
}

updateAdminPassword();
