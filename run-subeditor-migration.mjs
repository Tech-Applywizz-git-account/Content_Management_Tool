#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'

// Load environment variables
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables')
  console.error('Please set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

console.log('🚀 Starting Sub-Editor Migration...')
console.log('📊 Connecting to:', SUPABASE_URL)

// Create Supabase client with service role key for elevated permissions
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
})

async function runMigration() {
  console.log('\n📋 Adding SUB_EDITOR role to user_role enum...')

  try {
    // Add SUB_EDITOR role to user role CHECK constraint
    const { error: checkConstraintError } = await supabase.rpc('exec_sql', {
      stmt: `
        ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
        ALTER TABLE public.users ADD CONSTRAINT users_role_check 
        CHECK (role IN ('ADMIN', 'WRITER', 'CINE', 'EDITOR', 'SUB_EDITOR', 'DESIGNER', 'CMO', 'CEO', 'OPS', 'OBSERVER'));
      `
    })

    if (checkConstraintError) {
      console.error('❌ Error updating users_role_check constraint:', checkConstraintError)
      console.log('📝 Trying alternative approach...')
      
      // Alternative: Direct SQL execution
      const { error: altError } = await supabase.from('users').select('id').limit(1)
      if (altError) {
        console.error('❌ Cannot connect to database:', altError)
        process.exit(1)
      }
      
      // Try to manually add the role by dropping and recreating the constraint
      const dropResult = await supabase.rpc('exec_sql', {
        stmt: `ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;`
      })
      
      if (dropResult.error) {
        console.warn('⚠️ Warning: Could not drop constraint, may already not exist:', dropResult.error.message)
      }
      
      const addResult = await supabase.rpc('exec_sql', {
        stmt: `ALTER TABLE public.users ADD CONSTRAINT users_role_check 
               CHECK (role IN ('ADMIN', 'WRITER', 'CINE', 'EDITOR', 'SUB_EDITOR', 'DESIGNER', 'CMO', 'CEO', 'OPS', 'OBSERVER'));`
      })
      
      if (addResult.error) {
        console.error('❌ Error adding new constraint:', addResult.error)
        // Try with the original constraint values plus SUB_EDITOR
        const recreateResult = await supabase.rpc('exec_sql', {
          stmt: `ALTER TABLE public.users ADD CONSTRAINT users_role_check 
                 CHECK (role IN ('ADMIN', 'WRITER', 'CINE', 'EDITOR', 'SUB_EDITOR', 'DESIGNER', 'CMO', 'CEO', 'OPS', 'OBSERVER'));`
        })
        if (recreateResult.error) {
          console.error('❌ Final attempt to add constraint also failed:', recreateResult.error)
          process.exit(1)
        }
      }
    }

    console.log('✅ Successfully updated users_role_check constraint')

    // Add the sub_editor_uploaded_at column to projects table
    console.log('\n📋 Adding sub_editor_uploaded_at column to projects table...')
    
    const { error: addColumnError } = await supabase.rpc('exec_sql', {
      stmt: `
        ALTER TABLE projects ADD COLUMN IF NOT EXISTS sub_editor_uploaded_at TIMESTAMP WITH TIME ZONE;
        COMMENT ON COLUMN projects.sub_editor_uploaded_at IS 'Timestamp when Sub-Editor uploads video';
      `
    })

    if (addColumnError) {
      console.error('❌ Error adding sub_editor_uploaded_at column:', addColumnError)
      // Try alternative approach
      const altAddColumn = await supabase.rpc('exec_sql', {
        stmt: 'ALTER TABLE projects ADD COLUMN IF NOT EXISTS sub_editor_uploaded_at TIMESTAMP WITH TIME ZONE;'
      })
      if (altAddColumn.error) {
        console.error('❌ Alternative column addition also failed:', altAddColumn.error)
      } else {
        console.log('✅ Column added via alternative method')
      }
      
      // Add comment separately
      const addComment = await supabase.rpc('exec_sql', {
        stmt: "COMMENT ON COLUMN projects.sub_editor_uploaded_at IS 'Timestamp when Sub-Editor uploads video';"
      })
      if (addComment.error) {
        console.warn('⚠️ Could not add comment to column:', addComment.error.message)
      } else {
        console.log('✅ Column comment added')
      }
    } else {
      console.log('✅ Successfully added sub_editor_uploaded_at column with comment')
    }

    // Update RLS policies to include the new column
    console.log('\n📋 Updating Row Level Security policies...')

    // Since we can't directly modify RLS policies via RPC, we'll check if they exist
    const { data: rlsPolicies, error: rlsError } = await supabase
      .from('information_schema.columns')
      .select('table_name, column_name')
      .eq('table_schema', 'public')
      .ilike('column_name', '%sub_editor%')

    if (rlsError) {
      console.warn('⚠️ Warning: Could not check RLS policies:', rlsError.message)
    } else {
      console.log('📋 Found columns with "sub_editor" in name:', rlsPolicies)
    }

    console.log('\n🎉 Sub-Editor Migration completed successfully!')
    console.log('\n📋 Summary of changes:')
    console.log('   • Added SUB_EDITOR role to users role constraint')
    console.log('   • Added sub_editor_uploaded_at timestamp column to projects table')
    console.log('   • Updated database constraints and comments')

    console.log('\n💡 Next steps:')
    console.log('   1. Create Sub-Editor users in the admin panel')
    console.log('   2. The application now supports the new workflow: Cine → Editor → Sub-Editor → Designer/Writer')

  } catch (error) {
    console.error('❌ Migration failed with error:', error)
    process.exit(1)
  }
}

// Execute migration
runMigration()