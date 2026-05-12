
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateProject() {
  const projectId = 'eb2c8ae4-8dd8-4d44-b388-0e9e3f312465';
  const userId = '8a8b7c92-b92f-4d8a-bdf3-41bc1da635a6';

  console.log(`🔄 Updating project ${projectId}...`);

  const { data, error } = await supabase
    .from('projects')
    .update({
      current_stage: 'PA_FINAL_REVIEW',
      assigned_to_role: 'PARTNER_ASSOCIATE',
      assigned_to_user_id: userId,
      status: 'IN_PROGRESS',
      task_status: 'IN_PROGRESS'
    })
    .eq('id', projectId)
    .select();

  if (error) {
    console.error('❌ Error updating project:', error);
  } else {
    console.log('✅ Project updated successfully:', data);
  }
}

updateProject();
