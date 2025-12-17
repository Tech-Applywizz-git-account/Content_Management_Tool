import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://zxnevoulicmapqmniaos.supabase.co";
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
});

async function createAdminUser() {
    console.log('Creating admin user...');

    const { data, error } = await supabase.auth.admin.createUser({
        email: "ramakrishna@applywizz.com",
        password: "Admin@123",
        email_confirm: true,
        user_metadata: {
            role: "ADMIN",
            full_name: "Ramakrishna"
        }
    });

    if (error) {
        console.error("❌ Create user error:", error.message);
        return;
    }

    console.log("✅ Created auth user successfully!");
    console.log("User ID:", data.user.id);
    console.log("Email:", data.user.email);
    console.log("\nYou can now login with:");
    console.log("Email: ramakrishna@applywizz.com");
    console.log("Password: Admin@123");
}

createAdminUser();
