import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
  console.error('Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function backfillEditorNames() {
  console.log('Starting editor name backfill...');
  
  try {
    // Fetch all projects with their workflow history
    const { data: projects, error } = await supabase
      .from('projects')
      .select('id, data, assigned_to_user_id, assigned_to_role, current_stage, editor_uploaded_at')
      .limit(1000); // Limit to avoid memory issues

    if (error) {
      console.error('Error fetching projects:', error);
      return;
    }

    console.log(`Found ${projects.length} projects to process`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const project of projects) {
      let needsUpdate = false;
      const updatedData = { ...project.data };

      // Check if we need to add editor name based on assigned role and user ID
      if ((project.assigned_to_role === 'EDITOR' || project.assigned_to_role === 'SUB_EDITOR') && 
          project.assigned_to_user_id && 
          !updatedData.editor_name && 
          !updatedData.sub_editor_name) {
        
        // Fetch the user details
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('full_name, email')
          .eq('id', project.assigned_to_user_id)
          .single();
          
        if (userData) {
          if (project.assigned_to_role === 'EDITOR' && !updatedData.editor_name) {
            updatedData.editor_name = userData.full_name || userData.email || 'Unknown Editor';
            needsUpdate = true;
          } else if (project.assigned_to_role === 'SUB_EDITOR' && !updatedData.sub_editor_name) {
            updatedData.sub_editor_name = userData.full_name || userData.email || 'Unknown Sub-Editor';
            needsUpdate = true;
          }
        }
      }
      
      // Check if we have timestamps but no names
      if (project.editor_uploaded_at && !updatedData.editor_name) {
        // Look for the editor who uploaded
        const { data: historyData, error: historyError } = await supabase
          .from('workflow_history')
          .select('actor_name, actor_id')
          .eq('project_id', project.id)
          .ilike('action', '%UPLOAD%')
          .or('to_stage.eq.VIDEO_EDITING,to_stage.eq.FINAL_REVIEW_CMO')
          .order('timestamp', { ascending: false })
          .limit(1);
          
        if (historyData && historyData.length > 0) {
          updatedData.editor_name = historyData[0].actor_name;
          needsUpdate = true;
        }
      }

      // Update the project if we found new information
      if (needsUpdate) {
        const { error: updateError } = await supabase
          .from('projects')
          .update({ data: updatedData })
          .eq('id', project.id);

        if (updateError) {
          console.error(`Error updating project ${project.id}:`, updateError);
        } else {
          updatedCount++;
          console.log(`Updated project ${project.id} with editor/designer names`);
        }
      } else {
        skippedCount++;
      }
    }

    console.log(`Backfill completed. Updated: ${updatedCount}, Skipped: ${skippedCount}`);
  } catch (err) {
    console.error('Unexpected error during backfill:', err);
  }
}

// Run the backfill
backfillEditorNames()
  .then(() => {
    console.log('Backfill process completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Backfill process failed:', error);
    process.exit(1);
  });