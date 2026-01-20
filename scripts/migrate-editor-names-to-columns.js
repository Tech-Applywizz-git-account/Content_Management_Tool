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

async function migrateEditorNamesToColumns() {
  console.log('Starting migration of editor names from data field to direct columns...');

  try {
    // Fetch all projects that have editor names stored in the data JSON field
    const { data: projects, error } = await supabase
      .from('projects')
      .select('id, data')
      .or('data->>editor_name.not.is.null,data->>designer_name.not.is.null,data->>sub_editor_name.not.is.null')
      .limit(1000); // Process in batches

    if (error) {
      console.error('Error fetching projects:', error);
      return;
    }

    console.log(`Found ${projects.length} projects with names in data field to migrate`);

    let migratedCount = 0;

    for (const project of projects) {
      const updates = {};
      
      // Check if editor name exists in data and should be migrated
      if (project.data?.editor_name && !project.editor_name) {
        updates.editor_name = project.data.editor_name;
      }
      
      // Check if designer name exists in data and should be migrated
      if (project.data?.designer_name && !project.designer_name) {
        updates.designer_name = project.data.designer_name;
      }
      
      // Check if sub-editor name exists in data and should be migrated
      if (project.data?.sub_editor_name && !project.sub_editor_name) {
        updates.sub_editor_name = project.data.sub_editor_name;
      }

      // Only update if there are fields to migrate
      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase
          .from('projects')
          .update(updates)
          .eq('id', project.id);

        if (updateError) {
          console.error(`Error updating project ${project.id}:`, updateError);
        } else {
          migratedCount++;
          console.log(`Migrated names for project ${project.id}:`, updates);
        }
      }
    }

    console.log(`Migration completed. Migrated: ${migratedCount} projects`);
  } catch (err) {
    console.error('Unexpected error during migration:', err);
  }
}

// Run the migration
migrateEditorNamesToColumns()
  .then(() => {
    console.log('Migration process completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration process failed:', error);
    process.exit(1);
  });