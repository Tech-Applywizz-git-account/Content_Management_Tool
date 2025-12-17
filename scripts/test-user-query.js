import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

// Load environment variables from .env file
dotenv.config();

// Alternative: manually read .env file if dotenv doesn't work
if (!process.env.VITE_SUPABASE_SERVICE_ROLE_KEY) {
    try {
        const envContent = fs.readFileSync('.env', 'utf8');
        const lines = envContent.split('\n');
        lines.forEach(line => {
            if (line.startsWith('VITE_SUPABASE_SERVICE_ROLE_KEY=')) {
                process.env.VITE_SUPABASE_SERVICE_ROLE_KEY = line.split('=')[1];
            }
            if (line.startsWith('VITE_SUPABASE_URL=')) {
                process.env.VITE_SUPABASE_URL = line.split('=')[1];
            }
        });
    } catch (err) {
        console.error('Could not read .env file:', err);
    }
}

// Get the Supabase URL and service role key from environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://zxnevoulicmapqmniaos.supabase.co';
const serviceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
    console.error('❌ VITE_SUPABASE_SERVICE_ROLE_KEY environment variable is not set');
    process.exit(1);
}

// Create a Supabase client with the service role key (admin privileges)
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function testUserQuery() {
    console.log('🚀 Testing user query...');
    
    try {
        // Try to select users with explicit column names (without job_title first)
        console.log('Testing query without job_title...');
        const { data: data1, error: error1 } = await supabase
            .from('users')
            .select(`
                id,
                email,
                full_name,
                role,
                status,
                phone,
                last_login,
                created_at,
                updated_at
            `)
            .limit(5);
        
        if (error1) {
            console.error('❌ Error querying users without job_title:', error1);
        } else {
            console.log('✅ Successfully queried users without job_title:', data1?.length || 0, 'users found');
            if (data1 && data1.length > 0) {
                console.log('Sample user:', data1[0]);
            }
        }
        
        // Try to select users with job_title column
        console.log('\nTesting query with job_title...');
        const { data: data2, error: error2 } = await supabase
            .from('users')
            .select(`
                id,
                email,
                full_name,
                role,
                job_title,
                status,
                phone,
                last_login,
                created_at,
                updated_at
            `)
            .limit(5);
        
        if (error2) {
            console.warn('⚠️ Warning querying users with job_title:', error2.message);
            console.log('This is expected if the column does not exist yet');
        } else {
            console.log('✅ Successfully queried users with job_title:', data2?.length || 0, 'users found');
            if (data2 && data2.length > 0) {
                console.log('Sample user:', data2[0]);
            }
        }
        
        // Try with wildcard select
        console.log('\nTesting query with wildcard select...');
        const { data: data3, error: error3 } = await supabase
            .from('users')
            .select('*')
            .limit(5);
        
        if (error3) {
            console.error('❌ Error querying users with wildcard:', error3);
        } else {
            console.log('✅ Successfully queried users with wildcard:', data3?.length || 0, 'users found');
            if (data3 && data3.length > 0) {
                console.log('Sample user keys:', Object.keys(data3[0]));
            }
        }
        
    } catch (error) {
        console.error('❌ Unexpected error:', error);
    }
}

testUserQuery();