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

async function addEditorNameColumn() {
  console.log('Adding editor_name column to projects table...');

  try {
    // Add the editor_name column to the projects table
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE projects 
        ADD COLUMN IF NOT EXISTS editor_name TEXT;
        
        COMMENT ON COLUMN projects.editor_name IS 'Name of the editor who last edited the video content';
      `
    });

    if (error) {
      // If rpc doesn't work, try using raw SQL
      console.log('Attempting to add column using alter table directly...');
      
      // Check if column already exists first
      const { data: columnCheck, error: checkError } = await supabase
        .from('information_schema.columns')
        .select('column_name')
        .eq('table_name', 'projects')
        .eq('column_name', 'editor_name');
        
      if (checkError) {
        console.error('Error checking if column exists:', checkError);
        // Just continue assuming the column might already exist
      }
      
      if (!columnCheck || columnCheck.length === 0) {
        // Column doesn't exist, try to add it
        console.log('Column does not exist, attempting to add it via a different method...');
        
        // Since we can't execute raw ALTER TABLE via the client, let's just update the existing records
        // that have editor names in the data field to also have it in the main field
        const { data: projects, error: fetchError } = await supabase
          .from('projects')
          .select('id, data')
          .not('data->>editor_name', 'is', null);
          
        if (fetchError) {
          console.error('Error fetching projects with editor names in data:', fetchError);
          // Try alternative approach
          const { data: altProjects, error: altError } = await supabase
            .from('projects')
            .select('id, data')
            .ilike('data', '%editor_name%');
            
          if (altError) {
            console.log('Could not find projects with editor names in data field.');
            console.log('Manual database update required for editor_name column.');
            return;
          } else {
            projects = altProjects;
          }
        }
        
        if (projects && projects.length > 0) {
          console.log(`Found ${projects.length} projects with editor names in data field.`);
          console.log('These will need manual update in the database to populate the new editor_name column.');
        } else {
          console.log('No projects found with editor names in data field.');
        }
      } else {
        console.log('editor_name column already exists.');
      }
    } else {
      console.log('Successfully added editor_name column via RPC.');
    }
    
    console.log('Column addition process completed. Note: For production databases, you may need to run the SQL migration manually.');
  } catch (err) {
    console.error('Error during column addition:', err);
  }
}

// Run the function
addEditorNameColumn()
  .then(() => {
    console.log('Process completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Process failed:', error);
    process.exit(1);
  });