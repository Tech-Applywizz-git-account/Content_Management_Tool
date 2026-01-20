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

async function completeBackfill() {
  console.log('Starting complete editor/designer name backfill...');

  try {
    // First, fetch projects with just basic fields to avoid column errors
    const { data: projects, error } = await supabase
      .from('projects')
      .select('id, data, assigned_to_user_id, assigned_to_role, current_stage, editor_uploaded_at')
      .limit(1000);

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
      
      // Check if we have editor timestamp but no name
      if (project.editor_uploaded_at && !updatedData.editor_name) {
        // Look for the editor who uploaded in workflow history
        const { data: historyData } = await supabase
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
          console.log(`Updated project ${project.id} with editor name: ${updatedData.editor_name}`);
        }
      } else {
        skippedCount++;
      }
    }

    console.log(`Phase 1 completed. Updated: ${updatedCount}, Skipped: ${skippedCount}`);

    // Now run a second query to try to add designer and sub-editor columns if they exist
    // and fetch projects with those columns
    try {
      const { data: projectsExtended, error: extendedError } = await supabase
        .from('projects')
        .select('id, data, assigned_to_user_id, assigned_to_role, current_stage, editor_uploaded_at, designer_uploaded_at, sub_editor_uploaded_at')
        .limit(1000);

      if (!extendedError) {
        console.log(`Found ${projectsExtended.length} projects for extended backfill`);
        
        let extendedUpdatedCount = 0;
        
        for (const project of projectsExtended) {
          let needsUpdate = false;
          const updatedData = { ...project.data };

          // Check designer timestamp
          if (project.designer_uploaded_at && !updatedData.designer_name) {
            const { data: historyData } = await supabase
              .from('workflow_history')
              .select('actor_name, actor_id')
              .eq('project_id', project.id)
              .ilike('action', '%UPLOAD%')
              .or('to_stage.eq.THUMBNAIL_DESIGN,to_stage.eq.CREATIVE_DESIGN')
              .order('timestamp', { ascending: false })
              .limit(1);
              
            if (historyData && historyData.length > 0) {
              updatedData.designer_name = historyData[0].actor_name;
              needsUpdate = true;
            }
          }
          
          // Check sub-editor timestamp
          if (project.sub_editor_uploaded_at && !updatedData.sub_editor_name) {
            const { data: historyData } = await supabase
              .from('workflow_history')
              .select('actor_name, actor_id')
              .eq('project_id', project.id)
              .ilike('action', '%UPLOAD%')
              .eq('to_stage', 'SUB_EDITOR_PROCESSING')
              .order('timestamp', { ascending: false })
              .limit(1);
              
            if (historyData && historyData.length > 0) {
              updatedData.sub_editor_name = historyData[0].actor_name;
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
              extendedUpdatedCount++;
              if (updatedData.designer_name) {
                console.log(`Updated project ${project.id} with designer name: ${updatedData.designer_name}`);
              } else if (updatedData.sub_editor_name) {
                console.log(`Updated project ${project.id} with sub-editor name: ${updatedData.sub_editor_name}`);
              }
            }
          }
        }
        
        console.log(`Phase 2 completed. Updated: ${extendedUpdatedCount}`);
      } else {
        console.log('Designer/sub-editor columns not available, skipping extended backfill');
      }
    } catch (extendedErr) {
      console.log('Designer/sub-editor columns not available, skipping extended backfill');
    }

    console.log(`Complete backfill process finished.`);
  } catch (err) {
    console.error('Unexpected error during backfill:', err);
  }
}

// Run the backfill
completeBackfill()
  .then(() => {
    console.log('Complete backfill process completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Complete backfill process failed:', error);
    process.exit(1);
  });