# CEO Rework Routing Fix

## Problem
When CEO sent a project for rework to Writer, after the Writer resubmitted, the project was going to CMO instead of returning to CEO.

## Root Cause
The rework routing logic had a condition that required **BOTH**:
1. `isFromRework` flag (from workflow history check)
2. `rework_initiator_role` and `rework_initiator_stage` metadata

**The bug:**
```typescript
// OLD CODE - BUGGY
if (isFromRework && project.data?.rework_initiator_role && project.data?.rework_initiator_stage) {
    // Route back to initiator
}
```

When the Writer was at `SCRIPT` stage and resubmitted, the code would sometimes not detect `isFromRework` correctly, causing it to fall through to the normal workflow routing (`helpers.getNextStage()`), which routes SCRIPT → SCRIPT_REVIEW_L1 (CMO).

## Solution
Remove the `isFromRework` requirement and check **only** for the metadata:

```typescript
// NEW CODE - FIXED
if (project.data?.rework_initiator_role && project.data?.rework_initiator_stage) {
    // Route back to initiator
}
```

This ensures that whenever rework metadata exists, the routing **always** goes back to the initiator, regardless of workflow history checks.

## Changes Made

### File: `services/supabaseDb.ts` (lines 2904-2931)

**Before:**
```typescript
// CHECK FOR REWORK ROUTING: If this project has a rework_initiator_role, route back to them
if (isFromRework && project.data?.rework_initiator_role && project.data?.rework_initiator_stage) {
    console.log('🔄 Rework detected - routing back to initiator:', project.data.rework_initiator_role);
    // ... routing logic
}
```

**After:**
```typescript
// CHECK FOR REWORK ROUTING: If this project has a rework_initiator_role, route back to them
// Priority check - this takes precedence over normal workflow routing
if (project.data?.rework_initiator_role && project.data?.rework_initiator_stage) {
    console.log('🔄 Rework metadata found - routing back to initiator:', project.data.rework_initiator_role);
    console.log('🔄 Initiator stage:', project.data.rework_initiator_stage);
    
    // ... routing logic
    
    console.log('🔄 Clearing rework metadata after routing');
    // ... clear metadata
    console.log('✅ Rework metadata cleared successfully');
}
```

## How It Works Now

### Scenario 1: CEO → Writer Rework

1. **CEO at `FINAL_REVIEW_CEO`** sends rework to Writer
2. **Metadata stored**:
   ```javascript
   rework_initiator_role: "CEO"
   rework_initiator_stage: "FINAL_REVIEW_CEO"
   ```
3. **Project moves to**: `SCRIPT` stage, assigned to Writer
4. **Writer resubmits** from `SCRIPT` stage
5. **advanceWorkflow checks**: Does `rework_initiator_role` exist? **YES**
6. **Routes to**: `FINAL_REVIEW_CEO` (CEO) ✅
7. **Skips**: CMO review ✅
8. **Clears metadata**: Removes `rework_initiator_role` and `rework_initiator_stage`

### Scenario 2: CMO → Writer Rework

1. **CMO at `FINAL_REVIEW_CMO`** sends rework to Writer
2. **Metadata stored**:
   ```javascript
   rework_initiator_role: "CMO"
   rework_initiator_stage: "FINAL_REVIEW_CMO"
   ```
3. **Project moves to**: `SCRIPT` stage, assigned to Writer
4. **Writer resubmits** from `SCRIPT` stage
5. **advanceWorkflow checks**: Does `rework_initiator_role` exist? **YES**
6. **Routes to**: `FINAL_REVIEW_CMO` (CMO) ✅
7. **Clears metadata**: Removes `rework_initiator_role` and `rework_initiator_stage`

### Scenario 3: CEO → Cine Rework

1. **CEO at `FINAL_REVIEW_CEO`** sends rework to Cine
2. **Metadata stored**:
   ```javascript
   rework_initiator_role: "CEO"
   rework_initiator_stage: "FINAL_REVIEW_CEO"
   ```
3. **Project moves to**: `CINEMATOGRAPHY` stage, assigned to Cine
4. **Cine resubmits** video
5. **advanceWorkflow checks**: Does `rework_initiator_role` exist? **YES**
6. **Routes to**: `FINAL_REVIEW_CEO` (CEO) ✅
7. **Skips**: Normal video workflow (Editor → Designer → Writer → CMO) ✅
8. **Clears metadata**: Removes `rework_initiator_role` and `rework_initiator_stage`

## Testing

### Test 1: CEO → Writer Rework
1. CEO sends project for rework to Writer
2. Writer resubmits
3. ✅ **Verify**: Project goes to CEO (not CMO)
4. ✅ **Check console logs**:
   - `🔄 Rework metadata found - routing back to initiator: CEO`
   - `🔄 Initiator stage: FINAL_REVIEW_CEO`
   - `🔄 Clearing rework metadata after routing`
   - `✅ Rework metadata cleared successfully`

### Test 2: CMO → Writer Rework
1. CMO sends project for rework to Writer
2. Writer resubmits
3. ✅ **Verify**: Project goes to CMO
4. ✅ **Check console logs**: Same pattern as above, but with CMO

### Test 3: CEO → Cine Rework
1. CEO sends project for rework to Cine
2. Cine uploads new video and submits
3. ✅ **Verify**: Project goes to CEO (not Editor/Designer/Writer/CMO)
4. ✅ **Check console logs**: Same pattern as above

## Benefits

✅ **Reliable routing**: Metadata-based routing is more reliable than history-based detection  
✅ **Priority handling**: Rework routing takes precedence over all other routing logic  
✅ **Better logging**: Added detailed console logs for debugging  
✅ **Metadata cleanup**: Ensures metadata is cleared after routing to prevent stale data  
✅ **Works for all roles**: CEO, CMO, and any future roles that might send rework

## Deployment

The fix is in the backend code (`services/supabaseDb.ts`). No Edge Function deployment needed.

**The fix is already active** since it's TypeScript code that runs in the browser/Node.js environment.

Just refresh your application and test!
