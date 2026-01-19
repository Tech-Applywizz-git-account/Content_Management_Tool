// Script to update existing projects assigned to sub-editors with correct status
// This will make them visible in the sub-editor dashboard after our fixes

import { createClient } from '@supabase/supabase-js';

// Note: Make sure your .env.local file has the correct Supabase credentials
// Or run this script in an environment where VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are available

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function updateSubEditorProjectStatuses() {
  console.log('🔧 Updating sub-editor project statuses...\n');
  
  try {
    // Find projects that are assigned to sub-editors but have incorrect status
    const { data: projectsToUpdate, error: fetchError } = await supabase
      .from('projects')
      .select('id, title, current_stage, assigned_to_role, status, data')
      .or('assigned_to_role.eq.SUB_EDITOR,assigned_to_role.eq.SUB_EDITOR')
      .in('current_stage', ['SUB_EDITOR_ASSIGNMENT', 'SUB_EDITOR_PROCESSING'])
      .neq('status', 'DONE'); // Only update projects that aren't already done
      
    if (fetchError) {
      console.error('❌ Error fetching projects to update:', fetchError.message);
      return;
    }
    
    console.log(`📊 Found ${projectsToUpdate.length} projects assigned to sub-editors to review/update:\n`);
    
    for (const project of projectsToUpdate) {
      console.log(`📝 Project: ${project.title} (${project.id})`);
      console.log(`   Stage: ${project.current_stage}`);
      console.log(`   Assigned Role: ${project.assigned_to_role}`);
      console.log(`   Current Status: ${project.status}`);
      
      // Determine correct status based on stage
      let newStatus = project.status; // Default to current status
      
      if (project.current_stage === 'SUB_EDITOR_ASSIGNMENT' && project.status === 'WAITING_APPROVAL') {
        newStatus = 'WAITING_APPROVAL'; // This is correct
      } else if (project.current_stage === 'SUB_EDITOR_PROCESSING' && project.status === 'IN_PROGRESS') {
        newStatus = 'IN_PROGRESS'; // This is correct
      } else if (project.current_stage === 'SUB_EDITOR_PROCESSING' && project.status !== 'IN_PROGRESS') {
        // If processing stage but not IN_PROGRESS, update to IN_PROGRESS
        newStatus = 'IN_PROGRESS';
      } else if (project.current_stage === 'SUB_EDITOR_ASSIGNMENT' && project.status !== 'WAITING_APPROVAL') {
        // If assignment stage but not WAITING_APPROVAL, update to WAITING_APPROVAL
        newStatus = 'WAITING_APPROVAL';
      }
      
      if (newStatus !== project.status) {
        console.log(`   🔄 Updating status from "${project.status}" to "${newStatus}"`);
        
        const { error: updateError } = await supabase
          .from('projects')
          .update({ status: newStatus })
          .eq('id', project.id);
          
        if (updateError) {
          console.error(`   ❌ Error updating project ${project.id}:`, updateError.message);
        } else {
          console.log(`   ✅ Successfully updated status to "${newStatus}"`);
        }
      } else {
        console.log(`   ✅ Status "${project.status}" is already correct`);
      }
      
      console.log(''); // Empty line for readability
    }
    
    console.log('🎉 Sub-editor project status update complete!');
    console.log('💡 Projects should now be visible in the sub-editor dashboard.');
    
  } catch (error) {
    console.error('❌ Script failed:', error.message);
  }
}

updateSubEditorProjectStatuses();