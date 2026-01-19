// Test script to check sub-editors in the database
import { createClient } from '@supabase/supabase-js';

// Replace with your actual Supabase credentials
const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSubEditors() {
  console.log('🔍 Testing sub-editor query...');
  
  try {
    // Test the exact query used in getSubEditors()
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'SUB_EDITOR')
      .eq('status', 'ACTIVE');

    if (error) {
      console.error('❌ Query error:', error);
      return;
    }

    console.log('✅ Query successful!');
    console.log('📊 Number of sub-editors found:', data.length);
    console.log('📋 Sub-editors data:');
    data.forEach((user, index) => {
      console.log(`  ${index + 1}. ${user.full_name} (${user.email}) - ID: ${user.id}`);
    });

    // Also check all users with SUB_EDITOR role regardless of status
    console.log('\n🔍 Checking all SUB_EDITOR users (any status):');
    const { data: allSubEditors, error: allError } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'SUB_EDITOR');

    if (allError) {
      console.error('❌ All sub-editors query error:', allError);
    } else {
      console.log('📊 Total SUB_EDITOR users:', allSubEditors.length);
      allSubEditors.forEach((user, index) => {
        console.log(`  ${index + 1}. ${user.full_name} (${user.email}) - Status: ${user.status}`);
      });
    }

    // Check what roles actually exist in the database
    console.log('\n🔍 Checking all roles in database:');
    const { data: roles, error: rolesError } = await supabase
      .from('users')
      .select('role')
      .neq('role', null);

    if (!rolesError) {
      const uniqueRoles = [...new Set(roles.map(r => r.role))];
      console.log('📋 Unique roles found:', uniqueRoles);
    }

  } catch (err) {
    console.error('❌ Script error:', err);
  }
}

testSubEditors();