import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://zxnevoulicmapqmniaos.supabase.co";
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
});

async function resetAdminPassword() {
    console.log('Resetting password for ramakrishna@applywizz.com...');

    try {
        // List all users to find the admin
        const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();

        if (listError) {
            console.error('Error listing users:', listError.message);
            return;
        }

        console.log(`Found ${users.length} total users`);

        // Find the admin user
        const adminUser = users.find(u => u.email === 'ramakrishna@applywizz.com');

        if (!adminUser) {
            console.error('Admin user not found!');
            console.log('Available users:');
            users.forEach(u => console.log(`  - ${u.email} (ID: ${u.id})`));
            return;
        }

        console.log(`Found admin user: ${adminUser.id}`);

        // Reset password
        const newPassword = 'Admin@123';
        const { data, error } = await supabase.auth.admin.updateUserById(
            adminUser.id,
            {
                password: newPassword,
                email_confirm: true
            }
        );

        if (error) {
            console.error('Error updating password:', error.message);
            return;
        }

        console.log('✅ Password reset successfully!');
        console.log('\nLogin credentials:');
        console.log(`Email: ramakrishna@applywizz.com`);
        console.log(`Password: ${newPassword}`);

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

resetAdminPassword();
