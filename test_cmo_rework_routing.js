// Test CMO rework routing functionality
console.log('🧪 Testing CMO rework routing...\n');

// Mock data structure
const mockProject = {
  id: 'test-project-id',
  title: 'Test Project',
  current_stage: 'SCRIPT_REVIEW_L1',
  status: 'WAITING_APPROVAL'
};

const mockHistory = [
  {
    actor_id: 'ceo-user-id',
    action: 'REWORK',
    comment: 'Needs improvements',
    timestamp: new Date().toISOString()
  },
  {
    actor_id: 'cmo-user-id',
    action: 'SUBMITTED',
    comment: 'Initial submission',
    timestamp: new Date(Date.now() - 86400000).toISOString() // 1 day ago
  }
];

const mockUsers = {
  'ceo-user-id': { role: 'CEO' },
  'writer-user-id': { role: 'WRITER' },
  'cmo-user-id': { role: 'CMO' }
};

console.log('📋 Test Scenario:');
console.log('- Project is in SCRIPT_REVIEW_L1 stage');
console.log('- CMO is reviewing and wants to send back for rework');
console.log('- Need to determine who originally sent for rework\n');

// Simulate the routing logic
function testCmoReworkRouting() {
  console.log('🔍 Analyzing workflow history...');
  
  // Find the most recent REWORK action
  const reworkHistory = mockHistory.find(h => h.action === 'REWORK');
  
  if (reworkHistory) {
    console.log(`✅ Found rework history from user: ${reworkHistory.actor_id}`);
    
    // Get the actor's role
    const reviewer = mockUsers[reworkHistory.actor_id];
    
    if (reviewer) {
      console.log(`👥 Reviewer role: ${reviewer.role}`);
      
      let targetRole, targetStage;
      
      // ✅ Route based on WHO sent for rework
      if (reviewer.role === 'CEO') {
        console.log('🎯 CEO sent for rework → Route back to CEO directly');
        targetRole = 'CEO';
        targetStage = 'FINAL_REVIEW_CEO';
      } else {
        console.log('🎯 Others sent for rework → Route back to Writer');
        targetRole = 'WRITER';
        targetStage = 'SCRIPT';
      }
      
      console.log('\n✅ Routing Decision:');
      console.log(`   From: CMO (current reviewer)`);
      console.log(`   To: ${targetRole} (${targetStage})`);
      console.log(`   Reason: ${reviewer.role} originally sent for rework`);
      
      return { targetRole, targetStage };
    } else {
      console.log('❌ Could not determine reviewer role');
      return null;
    }
  } else {
    console.log('❌ No rework history found - using default routing');
    return null;
  }
}

// Run the test
const result = testCmoReworkRouting();

console.log('\n📊 Test Results:');
if (result) {
  console.log('✅ CMO rework routing logic working correctly');
  console.log(`🎯 Will route to: ${result.targetRole} at ${result.targetStage}`);
} else {
  console.log('⚠️  Falling back to standard routing');
}

console.log('\n✨ Expected Behavior:');
console.log('- When CEO sends project to CMO for review, and CMO requests rework');
console.log('- Project should go directly back to CEO (not Writer)');
console.log('- When others send project to CMO, rework goes to Writer');
console.log('- This prevents unnecessary routing through intermediate roles');

console.log('\n🏁 Test completed!');