// Test script to verify the getLatestReworkRejectComment function
import { getLatestReworkRejectComment } from './services/workflowUtils.js';

console.log('🧪 Testing getLatestReworkRejectComment function...\n');

// Test Case 1: Project in REWORK status assigned to EDITOR role
const testProject1 = {
  status: 'REWORK',
  assigned_to_role: 'EDITOR',
  history: [
    {
      action: 'REWORK',
      to_role: 'EDITOR',
      comment: 'The video quality needs improvement, please enhance the audio clarity.',
      actor_name: 'CMO',
      timestamp: '2026-01-26T12:44:39.136379+00'
    }
  ]
};

console.log('Test Case 1: Project in REWORK status assigned to EDITOR role');
console.log('Input:', { status: testProject1.status, assigned_to_role: testProject1.assigned_to_role });
const result1 = getLatestReworkRejectComment(testProject1, 'EDITOR');
console.log('Output:', result1);
console.log('Expected: Should return the rework comment\n');

// Test Case 2: Project in REWORK status assigned to different role
const testProject2 = {
  status: 'REWORK',
  assigned_to_role: 'EDITOR',
  history: [
    {
      action: 'REWORK',
      to_role: 'EDITOR',
      comment: 'The video needs color correction.',
      actor_name: 'CEO',
      timestamp: '2026-01-26T12:44:39.136379+00'
    }
  ]
};

console.log('Test Case 2: Same project accessed by CINE role (should return null)');
console.log('Input:', { status: testProject2.status, assigned_to_role: testProject2.assigned_to_role });
const result2 = getLatestReworkRejectComment(testProject2, 'CINE');
console.log('Output:', result2);
console.log('Expected: Should return null since CINE is not assigned to this project\n');

// Test Case 3: Project not in REWORK status
const testProject3 = {
  status: 'IN_PROGRESS',
  assigned_to_role: 'EDITOR',
  history: [
    {
      action: 'REWORK',
      to_role: 'EDITOR',
      comment: 'Previous rework request.',
      actor_name: 'CMO',
      timestamp: '2026-01-25T12:44:39.136379+00'
    }
  ]
};

console.log('Test Case 3: Project not in REWORK status');
console.log('Input:', { status: testProject3.status, assigned_to_role: testProject3.assigned_to_role });
const result3 = getLatestReworkRejectComment(testProject3, 'EDITOR');
console.log('Output:', result3);
console.log('Expected: Should return the rework comment from history if to_role matches\n');

// Test Case 4: Project with forwarded_comments
const testProject4 = {
  status: 'REWORK',
  assigned_to_role: 'EDITOR',
  history: [],
  forwarded_comments: [
    { comment: 'Please fix the intro section.', actor_name: 'CMO' },
    { comment: 'Also adjust the outro timing.', actor_name: 'CEO' }
  ]
};

console.log('Test Case 4: Project in REWORK status with forwarded_comments');
console.log('Input:', { 
  status: testProject4.status, 
  assigned_to_role: testProject4.assigned_to_role,
  has_forwarded_comments: testProject4.forwarded_comments.length > 0
});
const result4 = getLatestReworkRejectComment(testProject4, 'EDITOR');
console.log('Output:', result4);
console.log('Expected: Should return the latest forwarded comment\n');

console.log('✅ Test script completed!');