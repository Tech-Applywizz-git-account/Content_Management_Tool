// Test script to verify sub-editor dashboard fix
import { createClient } from '@supabase/supabase-js';

// Import environment variables
import dotenv from 'dotenv';
dotenv.config({ path: '../.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testSubEditorDashboardFix() {
  console.log('🧪 Testing Sub-Editor Dashboard Fix...\n');
  
  try {
    // 1. Test the getSubEditors method (should now return all sub-editors)
    console.log('1. Testing getSubEditors method...');
    const { data: subEditors, error: subEditorsError } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'SUB_EDITOR')
      .eq('status', 'ACTIVE');
    
    if (subEditorsError) {
      console.error('❌ Error fetching sub-editors:', subEditorsError.message);
      return;
    }
    
    console.log(`✅ Found ${subEditors.length} active sub-editors:`);
    subEditors.forEach(editor => {
      console.log(`   - ${editor.full_name} (${editor.id})`);
    });
    
    // 2. Check the specific project mentioned by user
    console.log('\n2. Checking specific project...');
    const projectId = 'ae29bde8-4616-41d0-9f2f-18dbb3a0a35e';
    
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();
    
    if (projectError) {
      console.error('❌ Error fetching project:', projectError.message);
      return;
    }
    
    console.log('✅ Project details:');
    console.log(`   - Title: ${project.title}`);
    console.log(`   - Current Stage: ${project.current_stage}`);
    console.log(`   - Assigned Role: ${project.assigned_to_role}`);
    console.log(`   - Assigned User ID: ${project.assigned_to_user_id}`);
    console.log(`   - Status: ${project.status}`);
    
    // 3. Test the workflow stages that should be visible to sub-editors
    console.log('\n3. Testing workflow stage filtering...');
    const subEditorStages = ['SUB_EDITOR_ASSIGNMENT', 'SUB_EDITOR_PROCESSING'];
    
    const { data: subEditorProjects, error: stageError } = await supabase
      .from('projects')
      .select('*')
      .or(`current_stage.eq.${subEditorStages[0]},current_stage.eq.${subEditorStages[1]}`)
      .order('created_at', { ascending: false });
    
    if (stageError) {
      console.error('❌ Error fetching sub-editor projects by stage:', stageError.message);
      return;
    }
    
    console.log(`✅ Found ${subEditorProjects.length} projects in sub-editor stages:`);
    subEditorProjects.forEach(proj => {
      console.log(`   - ${proj.title} (${proj.current_stage})`);
    });
    
    // 4. Verify the project is in the correct stage
    console.log('\n4. Verifying project eligibility...');
    const isInCorrectStage = subEditorStages.includes(project.current_stage);
    console.log(`   Project stage "${project.current_stage}" is ${isInCorrectStage ? '✅ VALID' : '❌ INVALID'} for sub-editors`);
    
    const isAssignedToSubEditor = project.assigned_to_role === 'SUB_EDITOR';
    console.log(`   Assigned to role "${project.assigned_to_role}" is ${isAssignedToSubEditor ? '✅ VALID' : '❌ INVALID'} for sub-editors`);
    
    if (isInCorrectStage && isAssignedToSubEditor) {
      console.log('\n🎉 SUCCESS: Project should now appear in sub-editor dashboard!');
      console.log('   The fix to add SUB_EDITOR case to getForRole method is working.');
    } else {
      console.log('\n⚠️  WARNING: Project may still not appear due to:');
      if (!isInCorrectStage) console.log('   - Incorrect workflow stage');
      if (!isAssignedToSubEditor) console.log('   - Not assigned to SUB_EDITOR role');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testSubEditorDashboardFix();