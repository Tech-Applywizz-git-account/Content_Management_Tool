// Test script to verify EditorProjectDetail rework functionality
import { getWorkflowStateForRole } from './services/workflowUtils.js';

console.log('🧪 Testing EditorProjectDetail rework functionality...\n');

// Test Case 1: Project in REWORK status assigned to EDITOR role
const testProject1 = {
  status: 'REWORK',
  assigned_to_role: 'EDITOR',
  current_stage: 'VIDEO_EDITING',
  history: [
    {
      action: 'REWORK',
      to_role: 'EDITOR',
      comment: 'The video quality needs improvement, please enhance the audio clarity.',
      actor_name: 'CMO',
      timestamp: '2026-01-26T12:44:39.136379+00'
    }
  ],
  edited_video_link: 'https://drive.google.com/file/d/previous',
  video_link: 'https://drive.google.com/file/d/original',
  delivery_date: '2026-01-27',
  shoot_date: '2026-01-26',
  content_type: 'VIDEO',
  priority: 'NORMAL',
  created_at: '2026-01-26T10:00:00.000Z',
  data: {
    script_content: '<p>Sample script content</p>'
  }
};

console.log('Test Case 1: Project in REWORK status assigned to EDITOR role');
console.log('Input:', { 
  status: testProject1.status, 
  assigned_to_role: testProject1.assigned_to_role,
  current_stage: testProject1.current_stage
});
const workflowState1 = getWorkflowStateForRole(testProject1, 'EDITOR');
console.log('Workflow State:', workflowState1);
console.log('isRework:', workflowState1.isRework);
console.log('isTargetedRework:', workflowState1.isTargetedRework);
console.log('Expected: Both isRework and isTargetedRework should be true\n');

// Test Case 2: Different role accessing the same rework project
const workflowState2 = getWorkflowStateForRole(testProject1, 'CINE');
console.log('Test Case 2: CINE role accessing the same REWORK project');
console.log('Workflow State for CINE:', workflowState2);
console.log('Expected: Both isRework and isTargetedRework should be false\n');

// Test Case 3: Regular project (not in rework)
const testProject3 = {
  status: 'IN_PROGRESS',
  assigned_to_role: 'EDITOR',
  current_stage: 'VIDEO_EDITING',
  history: [
    {
      action: 'SUBMITTED',
      to_role: 'EDITOR',
      comment: 'Initial submission',
      actor_name: 'WRITER',
      timestamp: '2026-01-26T10:00:00.000Z'
    }
  ]
};

console.log('Test Case 3: Regular project not in REWORK status');
console.log('Input:', { 
  status: testProject3.status, 
  assigned_to_role: testProject3.assigned_to_role,
  current_stage: testProject3.current_stage
});
const workflowState3 = getWorkflowStateForRole(testProject3, 'EDITOR');
console.log('Workflow State:', workflowState3);
console.log('isRework:', workflowState3.isRework);
console.log('Expected: isRework should be false\n');

console.log('✅ Test script completed!');