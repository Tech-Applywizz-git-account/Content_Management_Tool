import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://fwsfbrctqgwtpypcuyyp.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ3c2ZicmN0cWd3dHB5cGN1eXlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjI4NzE1NDIsImV4cCI6MjAzODQ0NzU0Mn0.SwO6zg0uRt9pRJyKvTz6RJiI2IyWwPwTb2c8d5e8f9g'
);

async function fixProjectReworkStages() {
  console.log('🔍 Checking projects in VIDEO_EDITING stage with REWORK status...');

  // Find projects that are in VIDEO_EDITING stage with REWORK status
  const { data: reworkProjects, error: fetchError } = await supabase
    .from('projects')
    .select('id, title, rework_initiator_stage, status, current_stage, assigned_to_role')
    .eq('status', 'REWORK')
    .eq('current_stage', 'VIDEO_EDITING')
    .limit(20);

  if (fetchError) {
    console.error('❌ Error fetching rework projects:', fetchError);
    return;
  }

  console.log(`Found ${reworkProjects?.length || 0} projects in VIDEO_EDITING stage with REWORK status:`);
  reworkProjects?.forEach(project => {
    console.log(`  - ${project.title} (${project.id}): ${project.rework_initiator_stage} -> assigned_to_role: ${project.assigned_to_role}`);
  });

  // Update projects where rework_initiator_stage is POST_WRITER_REVIEW but should be CMO_REVIEW
  // when the project is assigned to EDITOR in VIDEO_EDITING stage
  const updates = [];
  
  for (const project of reworkProjects || []) {
    if (project.rework_initiator_stage === 'POST_WRITER_REVIEW' && 
        project.assigned_to_role === 'EDITOR' && 
        project.current_stage === 'VIDEO_EDITING') {
      console.log(`  🔄 Fixing ${project.title}: changing rework_initiator_stage from '${project.rework_initiator_stage}' to 'CMO_REVIEW'`);
      updates.push({
        id: project.id,
        rework_initiator_stage: 'CMO_REVIEW'
      });
    }
  }

  // Apply the fixes
  if (updates.length > 0) {
    console.log(`\n🛠️  Applying ${updates.length} fixes...`);
    
    for (const update of updates) {
      const { error } = await supabase
        .from('projects')
        .update({ rework_initiator_stage: update.rework_initiator_stage })
        .eq('id', update.id);
      
      if (error) {
        console.error(`❌ Failed to update project ${update.id}:`, error);
      } else {
        console.log(`  ✅ Updated project ${update.id}`);
      }
    }
  } else {
    console.log('\n✅ No fixes needed');
  }

  // Verify the fixes
  console.log('\n🔍 Verifying fixes...');
  const { data: updatedProjects, error: verifyError } = await supabase
    .from('projects')
    .select('id, title, rework_initiator_stage, status, current_stage, assigned_to_role')
    .eq('status', 'REWORK')
    .eq('current_stage', 'VIDEO_EDITING')
    .limit(20);

  if (verifyError) {
    console.error('❌ Error verifying fixes:', verifyError);
    return;
  }

  console.log('Updated projects:');
  updatedProjects?.forEach(project => {
    console.log(`  - ${project.title}: ${project.rework_initiator_stage} (assigned to: ${project.assigned_to_role})`);
  });

  console.log('\n✅ Script completed!');
}

fixProjectReworkStages().catch(console.error);