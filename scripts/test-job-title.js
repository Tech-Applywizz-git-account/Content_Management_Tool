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

async function testJobTitleColumn() {
    console.log('🚀 Testing job_title column...');
    
    try {
        // Try to insert a test user with job_title
        const testUser = {
            email: 'test.observer@example.com',
            full_name: 'Test Observer',
            role: 'OBSERVER',
            job_title: 'CTO',
            status: 'ACTIVE'
        };
        
        const { data, error } = await supabase
            .from('users')
            .insert([testUser])
            .select();
        
        if (error) {
            console.error('❌ Error inserting test user with job_title:', error);
            return;
        }
        
        console.log('✅ Successfully inserted test user with job_title:', data[0]);
        
        // Clean up - delete the test user
        const { error: deleteError } = await supabase
            .from('users')
            .delete()
            .eq('email', testUser.email);
        
        if (deleteError) {
            console.warn('⚠️ Warning: Could not delete test user:', deleteError);
        } else {
            console.log('✅ Test user cleaned up successfully');
        }
        
    } catch (error) {
        console.error('❌ Unexpected error:', error);
    }
}

testJobTitleColumn();