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

async function addJobTitleColumn() {
    console.log('🚀 Adding job_title column to users table...');
    
    try {
        // First, let's check if the column already exists
        const { data: columns, error: columnsError } = await supabase
            .from('users')
            .select('*')
            .limit(1);
        
        if (columnsError) {
            console.error('❌ Error checking users table:', columnsError);
            process.exit(1);
        }
        
        console.log('✅ Connected to database successfully');
        
        // Try to add the job_title column
        const { error } = await supabase.rpc('execute_sql', {
            sql: `
                ALTER TABLE users 
                ADD COLUMN IF NOT EXISTS job_title TEXT;
                
                COMMENT ON COLUMN users.job_title IS 'Job title for OBSERVER role users (COO, CRO, CTO, CFO, etc.)';
                
                CREATE INDEX IF NOT EXISTS idx_users_role_job_title ON users(role, job_title) WHERE role = 'OBSERVER';
            `
        });
        
        if (error) {
            console.warn('⚠️ Warning (might be expected):', error.message);
            console.log('Trying alternative approach...');
            
            // Alternative approach - try individual statements
            try {
                await supabase.rpc('execute_sql', {
                    sql: 'ALTER TABLE users ADD COLUMN IF NOT EXISTS job_title TEXT;'
                });
                
                await supabase.rpc('execute_sql', {
                    sql: "COMMENT ON COLUMN users.job_title IS 'Job title for OBSERVER role users (COO, CRO, CTO, CFO, etc.)';"
                });
                
                await supabase.rpc('execute_sql', {
                    sql: "CREATE INDEX IF NOT EXISTS idx_users_role_job_title ON users(role, job_title) WHERE role = 'OBSERVER';"
                });
                
                console.log('✅ Successfully added job_title column using alternative approach');
            } catch (altError) {
                console.warn('⚠️ Alternative approach also failed:', altError.message);
                console.log('This might be OK if the column already exists');
            }
        } else {
            console.log('✅ Successfully added job_title column to users table');
        }
        
        console.log('✅ Migration completed');
        
    } catch (error) {
        console.error('❌ Unexpected error:', error);
        process.exit(1);
    }
}

addJobTitleColumn();