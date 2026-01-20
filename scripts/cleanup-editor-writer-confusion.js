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

async function cleanupEditorWriterConfusion() {
  console.log('Starting cleanup of incorrect editor names that match writer names...');

  try {
    // Fetch all projects where editor name equals writer name (which is incorrect)
    const { data: projects, error } = await supabase
      .from('projects')
      .select('id, editor_name, writer_name, created_by_name, data')
      .or('editor_name.not.is.null, data->>editor_name.not.is.null')
      .limit(1000);

    if (error) {
      console.error('Error fetching projects:', error);
      return;
    }

    console.log(`Found ${projects.length} projects with editor names to check`);

    let cleanedCount = 0;

    for (const project of projects) {
      let needsUpdate = false;
      const updates = {};
      let updatedData = { ...project.data };

      // Check if direct editor_name matches writer_name (and it's not null/empty)
      if (project.editor_name && 
          (project.editor_name === project.writer_name || 
           project.editor_name === project.created_by_name)) {
        console.log(`Found incorrect editor name match in project ${project.id}: ${project.editor_name}`);
        updates.editor_name = null; // Remove incorrect editor name
        needsUpdate = true;
      }

      // Check if editor_name in data field matches writer_name
      if (project.data?.editor_name && 
          (project.data.editor_name === project.writer_name || 
           project.data.editor_name === project.created_by_name)) {
        console.log(`Found incorrect editor name in data field match in project ${project.id}: ${project.data.editor_name}`);
        updatedData.editor_name = null; // Remove incorrect editor name from data
        needsUpdate = true;
      }

      // Also check sub-editor and designer names for similar issues
      if (project.sub_editor_name && 
          (project.sub_editor_name === project.writer_name || 
           project.sub_editor_name === project.created_by_name)) {
        console.log(`Found incorrect sub_editor name match in project ${project.id}: ${project.sub_editor_name}`);
        updates.sub_editor_name = null;
        needsUpdate = true;
      }

      if (project.designer_name && 
          (project.designer_name === project.writer_name || 
           project.designer_name === project.created_by_name)) {
        console.log(`Found incorrect designer name match in project ${project.id}: ${project.designer_name}`);
        updates.designer_name = null;
        needsUpdate = true;
      }

      // Check data field for sub-editor and designer name issues too
      if (project.data?.sub_editor_name && 
          (project.data.sub_editor_name === project.writer_name || 
           project.data.sub_editor_name === project.created_by_name)) {
        updatedData.sub_editor_name = null;
        needsUpdate = true;
      }

      if (project.data?.designer_name && 
          (project.data.designer_name === project.writer_name || 
           project.data.designer_name === project.created_by_name)) {
        updatedData.designer_name = null;
        needsUpdate = true;
      }

      // Update the project if corrections are needed
      if (needsUpdate) {
        const updatePayload = { ...updates };
        if (Object.keys(updatedData).some(key => updatedData[key] !== project.data[key])) {
          updatePayload.data = updatedData;
        }

        const { error: updateError } = await supabase
          .from('projects')
          .update(updatePayload)
          .eq('id', project.id);

        if (updateError) {
          console.error(`Error updating project ${project.id}:`, updateError);
        } else {
          cleanedCount++;
          console.log(`Cleaned up project ${project.id}`);
        }
      }
    }

    console.log(`Cleanup completed. Cleaned: ${cleanedCount} projects`);
  } catch (err) {
    console.error('Unexpected error during cleanup:', err);
  }
}

// Run the cleanup
cleanupEditorWriterConfusion()
  .then(() => {
    console.log('Cleanup process completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Cleanup process failed:', error);
    process.exit(1);
  });