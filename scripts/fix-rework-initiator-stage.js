import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://fwsfbrctqgwtpypcuyyp.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ3c2ZicmN0cWd3dHB5cGN1eXlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjI4NzE1NDIsImV4cCI6MjAzODQ0NzU0Mn0.SwO6zg0uRt9pRJyKvTz6RJiI2IyWwPwTb2c8d5e8f9g'
);

async function fixReworkInitiatorStages() {
  console.log('🔍 Checking rework projects...');

  // First, let's see what rework projects we have
  const { data: reworkProjects, error: fetchError } = await supabase
    .from('projects')
    .select('id, title, rework_initiator_stage, status, current_stage')
    .eq('status', 'REWORK')
    .limit(10);

  if (fetchError) {
    console.error('❌ Error fetching rework projects:', fetchError);
    return;
  }

  console.log(`Found ${reworkProjects?.length || 0} rework projects:`);
  reworkProjects?.forEach(project => {
    console.log(`  - ${project.title} (${project.id}): ${project.rework_initiator_stage} -> ${project.current_stage}`);
  });

  // Fix projects where rework_initiator_stage is incorrect
  // We need to check if the current_stage makes sense with the rework_initiator_stage
  const updates = [];
  
  for (const project of reworkProjects || []) {
    let correctInitiatorStage = null;
    
    // Based on the current stage, determine what the correct rework_initiator_stage should be
    switch (project.current_stage) {
      case 'VIDEO_EDITING':
        // If it's in VIDEO_EDITING stage, it was likely sent back from CMO_REVIEW
        correctInitiatorStage = 'CMO_REVIEW';
        break;
      case 'VIDEO_EDITING_APPROVAL':
        // If it's in VIDEO_EDITING_APPROVAL, it was likely sent back from CMO_REVIEW
        correctInitiatorStage = 'CMO_REVIEW';
        break;
      case 'POST_WRITER_REVIEW':
        // If it's in POST_WRITER_REVIEW, it was likely sent back from CMO_REVIEW
        correctInitiatorStage = 'CMO_REVIEW';
        break;
      default:
        // For other stages, we might need to check workflow history
        console.log(`  ⚠️  Unclear case for ${project.title}: ${project.current_stage}`);
        continue;
    }

    if (correctInitiatorStage && project.rework_initiator_stage !== correctInitiatorStage) {
      console.log(`  🔄 Fixing ${project.title}: ${project.rework_initiator_stage} -> ${correctInitiatorStage}`);
      updates.push({
        id: project.id,
        rework_initiator_stage: correctInitiatorStage
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
    .select('id, title, rework_initiator_stage, status, current_stage')
    .eq('status', 'REWORK')
    .limit(10);

  if (verifyError) {
    console.error('❌ Error verifying fixes:', verifyError);
    return;
  }

  console.log('Updated rework projects:');
  updatedProjects?.forEach(project => {
    console.log(`  - ${project.title}: ${project.rework_initiator_stage}`);
  });
}

fixReworkInitiatorStages().catch(console.error);