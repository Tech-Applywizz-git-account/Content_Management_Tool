// Test script to verify the rework visibility logic

console.log('Testing rework visibility logic...\n');

// Simulate the isProjectVisibleToUser function logic
function isProjectVisibleToUser(project, user) {
    // If project is not in REWORK status, it's visible
    if (project.status !== 'REWORK') {
        return true;
    }
    
    // If project is in REWORK status but not from MULTI_WRITER_APPROVAL, it's visible
    if (project.data?.rework_initiator_stage !== 'MULTI_WRITER_APPROVAL') {
        return true;
    }
    
    // If project is in REWORK status from MULTI_WRITER_APPROVAL but has no target role, it's visible
    if (!project.data?.rework_target_role) {
        return true;
    }
    
    // For REWORK projects from MULTI_WRITER_APPROVAL with a target role:
    // Only show to users whose role matches the rework_target_role
    // AND if assigned_to_user_id exists → only that user
    if (project.data?.rework_target_role === user.role) {
        // If assigned to a specific user, only that user can see it
        if (project.assigned_to_user_id) {
            return project.assigned_to_user_id === user.id;
        }
        // Otherwise, anyone with the matching role can see it
        return true;
    }
    
    // For all other cases, the project is not visible to this user
    return false;
}

// Test case 1: Writer trying to see a rework project targeted to SUB_EDITOR
console.log('Test Case 1: Writer trying to see a rework project targeted to SUB_EDITOR');
const testCase1 = {
    status: 'REWORK',
    data: {
        rework_initiator_stage: 'MULTI_WRITER_APPROVAL',
        rework_target_role: 'SUB_EDITOR'
    },
    assigned_to_user_id: null
};

const writerUser = { id: 'writer123', role: 'WRITER' };
console.log('Expected: false, Actual:', isProjectVisibleToUser(testCase1, writerUser));
console.log('Result:', isProjectVisibleToUser(testCase1, writerUser) === false ? 'PASS' : 'FAIL');
console.log('');

// Test case 2: SUB_EDITOR trying to see a rework project targeted to SUB_EDITOR
console.log('Test Case 2: SUB_EDITOR trying to see a rework project targeted to SUB_EDITOR');
const testCase2 = {
    status: 'REWORK',
    data: {
        rework_initiator_stage: 'MULTI_WRITER_APPROVAL',
        rework_target_role: 'SUB_EDITOR'
    },
    assigned_to_user_id: null
};

const subEditorUser = { id: 'subeditor123', role: 'SUB_EDITOR' };
console.log('Expected: true, Actual:', isProjectVisibleToUser(testCase2, subEditorUser));
console.log('Result:', isProjectVisibleToUser(testCase2, subEditorUser) === true ? 'PASS' : 'FAIL');
console.log('');

// Test case 3: Writer trying to see a rework project targeted to WRITER
console.log('Test Case 3: Writer trying to see a rework project targeted to WRITER');
const testCase3 = {
    status: 'REWORK',
    data: {
        rework_initiator_stage: 'MULTI_WRITER_APPROVAL',
        rework_target_role: 'WRITER'
    },
    assigned_to_user_id: null
};

console.log('Expected: true, Actual:', isProjectVisibleToUser(testCase3, writerUser));
console.log('Result:', isProjectVisibleToUser(testCase3, writerUser) === true ? 'PASS' : 'FAIL');
console.log('');

// Test case 4: Project not in rework status
console.log('Test Case 4: Project not in rework status');
const testCase4 = {
    status: 'WAITING_APPROVAL',
    data: {}
};

console.log('Expected: true, Actual:', isProjectVisibleToUser(testCase4, writerUser));
console.log('Result:', isProjectVisibleToUser(testCase4, writerUser) === true ? 'PASS' : 'FAIL');
console.log('');

// Test case 5: Rework project not from MULTI_WRITER_APPROVAL
console.log('Test Case 5: Rework project not from MULTI_WRITER_APPROVAL');
const testCase5 = {
    status: 'REWORK',
    data: {
        rework_initiator_stage: 'SCRIPT_REVIEW_L1'
    }
};

console.log('Expected: true, Actual:', isProjectVisibleToUser(testCase5, writerUser));
console.log('Result:', isProjectVisibleToUser(testCase5, writerUser) === true ? 'PASS' : 'FAIL');
console.log('');

// Test case 6: Rework project from MULTI_WRITER_APPROVAL but no target role
console.log('Test Case 6: Rework project from MULTI_WRITER_APPROVAL but no target role');
const testCase6 = {
    status: 'REWORK',
    data: {
        rework_initiator_stage: 'MULTI_WRITER_APPROVAL'
    }
};

console.log('Expected: true, Actual:', isProjectVisibleToUser(testCase6, writerUser));
console.log('Result:', isProjectVisibleToUser(testCase6, writerUser) === true ? 'PASS' : 'FAIL');
console.log('');

// Test case 7: Rework project targeted to specific user
console.log('Test Case 7: Rework project targeted to specific user');
const testCase7 = {
    status: 'REWORK',
    data: {
        rework_initiator_stage: 'MULTI_WRITER_APPROVAL',
        rework_target_role: 'EDITOR'
    },
    assigned_to_user_id: 'editor456'
};

const editorUser = { id: 'editor456', role: 'EDITOR' };
const otherEditorUser = { id: 'editor789', role: 'EDITOR' };

console.log('Expected for correct user: true, Actual:', isProjectVisibleToUser(testCase7, editorUser));
console.log('Result:', isProjectVisibleToUser(testCase7, editorUser) === true ? 'PASS' : 'FAIL');

console.log('Expected for wrong user: false, Actual:', isProjectVisibleToUser(testCase7, otherEditorUser));
console.log('Result:', isProjectVisibleToUser(testCase7, otherEditorUser) === false ? 'PASS' : 'FAIL');

console.log('\nAll tests completed!');