// Fix project stuck in VIDEO_EDITING stage after editor upload
// This script will advance the project to the correct stage based on is_pa_brand flag

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in .env file');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixStuckProject() {
    const projectId = '51b2d2bd-8fbe-4985-a5c5-55745bd2ae50';
    
    console.log('🔍 Fetching project...');
    const { data: project, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();
    
    if (error) {
        console.error('❌ Error fetching project:', error);
        return;
    }
    
    console.log('\n📋 Project Details:');
    console.log('  Title:', project.title);
    console.log('  Current Stage:', project.current_stage);
    console.log('  Status:', project.status);
    console.log('  Brand:', project.brand);
    console.log('  is_pa_brand:', project.data?.is_pa_brand);
    console.log('  editor_uploaded_at:', project.editor_uploaded_at);
    console.log('  edited_video_link:', project.edited_video_link ? '✓ Present' : '✗ Missing');
    
    if (project.current_stage !== 'VIDEO_EDITING') {
        console.log('\n✅ Project is not in VIDEO_EDITING stage. No fix needed.');
        return;
    }
    
    if (!project.editor_uploaded_at) {
        console.log('\n❌ Editor has not uploaded video yet. Cannot advance.');
        return;
    }
    
    // Determine next stage
    let nextStage = 'MULTI_WRITER_APPROVAL';
    let nextRole = 'WRITER';
    
    if (project.data?.is_pa_brand) {
        nextStage = 'PA_FINAL_REVIEW';
        nextRole = 'PARTNER_ASSOCIATE';
        console.log('\n🎯 PA Brand detected → Advancing to PA_FINAL_REVIEW');
    } else if (project.data?.needs_sub_editor) {
        nextStage = 'SUB_EDITOR_ASSIGNMENT';
        nextRole = 'EDITOR';
        console.log('\n🎯 Sub-editor needed → Advancing to SUB_EDITOR_ASSIGNMENT');
    } else if (project.data?.thumbnail_required) {
        nextStage = 'THUMBNAIL_DESIGN';
        nextRole = 'DESIGNER';
        console.log('\n🎯 Thumbnail required → Advancing to THUMBNAIL_DESIGN');
    } else {
        console.log('\n🎯 Standard flow → Advancing to MULTI_WRITER_APPROVAL');
    }
    
    // Update project
    console.log('\n🔄 Updating project...');
    const { error: updateError } = await supabase
        .from('projects')
        .update({
            current_stage: nextStage,
            assigned_to_role: nextRole,
            status: 'WAITING_APPROVAL',
            visible_to_roles: nextStage === 'PA_FINAL_REVIEW' 
                ? ['PARTNER_ASSOCIATE', 'OPS'] 
                : ['WRITER', 'OPS'],
            updated_at: new Date().toISOString()
        })
        .eq('id', projectId);
    
    if (updateError) {
        console.error('❌ Error updating project:', updateError);
        return;
    }
    
    console.log('✅ Project stage updated successfully!');
    
    // Record workflow history
    console.log('\n📝 Recording workflow history...');
    const { error: historyError } = await supabase
        .from('workflow_history')
        .insert({
            project_id: projectId,
            stage: nextStage,
            action: 'SUBMITTED',
            actor_name: project.editor_name || 'Pavan',
            actor_role: 'EDITOR',
            comment: `Edited video uploaded. Advanced from VIDEO_EDITING to ${nextStage}.`,
            timestamp: new Date().toISOString()
        });
    
    if (historyError) {
        console.error('❌ Error recording workflow history:', historyError);
        return;
    }
    
    console.log('✅ Workflow history recorded!');
    
    console.log('\n✨ FIX COMPLETE!');
    console.log(`   Project advanced from VIDEO_EDITING → ${nextStage}`);
    console.log(`   Assigned to: ${nextRole}`);
}

fixStuckProject().catch(console.error);
