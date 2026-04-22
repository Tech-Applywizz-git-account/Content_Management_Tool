import re

# Read the file
with open('WriterDashboard.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Define the old code pattern
old_code = '''    const videoUploadProjects = videoApprovalProjects.filter(p => 
        p.current_stage === WorkflowStage.WRITER_REVISION
    );'''

# Define the new code
new_code = '''    // Video upload projects (processed videos for JobBoard/LeadMagnet)
    // Filter to show only:
    // 1. Projects with brand = JOBBOARD or LEAD_MAGNET (check brand, content_type, channel, or data.brand)
    // 2. Only to the writer who submitted the script (created_by_user_id or writer_id)
    // 3. Only after CEO approval (history has FINAL_REVIEW_CEO with APPROVED action)
    const videoUploadProjects = videoApprovalProjects.filter(p => {
        if (p.current_stage !== WorkflowStage.WRITER_REVISION) {
            return false;
        }

        // Check if brand is JOBBOARD or LEAD_MAGNET
        const brandSelection = p.brand || p.data?.brand || p.brandSelected;
        const contentType = p.content_type || p.contentType;
        const channel = p.channel;
        
        const isJobBoardOrLeadMagnet = 
            ['APPLYWIZZ_JOB_BOARD', 'LEAD_MAGNET_RTW'].includes(brandSelection) ||
            ['JOBBOARD', 'LEAD_MAGNET'].includes(contentType) ||
            ['JOBBOARD', 'LEAD_MAGNET'].includes(channel);

        if (!isJobBoardOrLeadMagnet) {
            return false;
        }

        // Check if current user is the writer who submitted the script
        const isScriptSubmitter = p.created_by_user_id === user.id || p.writer_id === user.id;
        if (!isScriptSubmitter) {
            return false;
        }

        // Check if CEO has approved
        const hasCEOApproval = p.history?.some(
            h => h.stage === WorkflowStage.FINAL_REVIEW_CEO && h.action === 'APPROVED'
        );
        if (!hasCEOApproval) {
            return false;
        }

        return true;
    });'''

# Replace the old code with new code
new_content = content.replace(old_code, new_code)

# Write the file back
with open('WriterDashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Successfully updated WriterDashboard.tsx")
