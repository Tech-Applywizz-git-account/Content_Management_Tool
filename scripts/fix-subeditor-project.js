// Script to fix existing sub-editor project status
import { createClient } from '@supabase/supabase-js';

// Replace with your actual Supabase credentials
const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixSubEditorProject() {
  console.log('🔧 Fixing sub-editor project status...');
  
  try {
    // Update the specific project you mentioned
    const projectId = 'ae29bde8-4616-41d0-9f2f-18dbb3a0a35e';
    
    const { data, error } = await supabase
      .from('projects')
      .update({
        status: 'IN_PROGRESS'  // Change from WAITING_APPROVAL to IN_PROGRESS
      })
      .eq('id', projectId)
      .select();

    if (error) {
      console.error('❌ Update error:', error);
      return;
    }

    console.log('✅ Project updated successfully!');
    console.log('📊 Updated project:', data[0]);

    // Verify the update
    const { data: verifyData, error: verifyError } = await supabase
      .from('projects')
      .select('id, title, current_stage, status, assigned_to_role')
      .eq('id', projectId);

    if (verifyError) {
      console.error('❌ Verification error:', verifyError);
    } else {
      console.log('🔍 Verification result:');
      console.log('   ID:', verifyData[0].id);
      console.log('   Title:', verifyData[0].title);
      console.log('   Stage:', verifyData[0].current_stage);
      console.log('   Status:', verifyData[0].status);
      console.log('   Assigned Role:', verifyData[0].assigned_to_role);
    }

  } catch (err) {
    console.error('❌ Script error:', err);
  }
}

fixSubEditorProject();