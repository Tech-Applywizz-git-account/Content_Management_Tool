# CMO Rework Routing Implementation

## Overview
Implemented a system where the CMO can send projects for rework to specific roles (Cine, Editor, or Designer), and after the rework is completed and resubmitted, the project automatically returns to the CMO for review instead of following the normal workflow progression.

## Changes Made

### 1. Store Rework Initiator Information (`workflow.reject`)
**File**: `services/supabaseDb.ts` (lines ~1760-1780)

When the CMO (or any role) requests rework, the system now stores:
- `rework_initiator_role`: The role that requested the rework (e.g., "CMO")
- `rework_initiator_stage`: The stage where rework was requested (e.g., "FINAL_REVIEW_CMO")

This metadata is stored in the project's `data` field and persists throughout the rework process.

```typescript
const updatedData = {
    ...updatedProjectData,
    rework_initiator_role: isRework ? userRole : undefined,
    rework_initiator_stage: isRework ? currentProject?.current_stage : undefined
};
```

### 2. Route Back to Rework Initiator (`advanceWorkflow`)
**File**: `services/supabaseDb.ts` (lines ~2893-2930)

When a reworked project is resubmitted, the system checks for the rework initiator metadata:
- If found, it routes the project back to the initiator's stage and role
- After routing, it clears the rework metadata to prevent future confusion
- This happens **before** any other routing logic, ensuring priority

```typescript
if (isFromRework && project.data?.rework_initiator_role && project.data?.rework_initiator_stage) {
    console.log('🔄 Rework detected - routing back to initiator:', project.data.rework_initiator_role);
    
    nextStageInfo = { 
        stage: reworkInitiatorStage as WorkflowStage, 
        role: reworkInitiatorRole as Role 
    };
    
    // Clear metadata after routing
    await supabase.from('projects').update({
        data: {
            ...project.data,
            rework_initiator_role: undefined,
            rework_initiator_stage: undefined
        }
    }).eq('id', projectId);
}
```

## Workflow Example

### Scenario: CMO Requests Rework from Cine

1. **Initial State**: Project is at `FINAL_REVIEW_CMO` stage, assigned to CMO
2. **CMO Action**: CMO selects "Rework → Cinematographer (Reshoot)"
3. **System Response**:
   - Project moves to `CINEMATOGRAPHY` stage
   - Project assigned to `CINE` role
   - Status changes to `REWORK`
   - Metadata stored: `{ rework_initiator_role: "CMO", rework_initiator_stage: "FINAL_REVIEW_CMO" }`
4. **Cine Action**: Cine uploads new video and submits
5. **System Response**:
   - Detects rework metadata
   - Routes project back to `FINAL_REVIEW_CMO` stage
   - Assigns to `CMO` role
   - Clears rework metadata
   - CMO receives email notification

### Same Flow for Editor and Designer

The exact same logic applies when CMO sends rework to:
- **Editor**: Project goes to `VIDEO_EDITING`, then returns to `FINAL_REVIEW_CMO`
- **Designer**: Project goes to `CREATIVE_DESIGN` or `THUMBNAIL_DESIGN`, then returns to `FINAL_REVIEW_CMO`

## Email Notifications

The existing email system will automatically notify:
1. **When rework is requested**: The assigned role (Cine/Editor/Designer) receives a `REWORK` email
2. **When rework is resubmitted**: The CMO receives a `REWORK_VIDEO_SUBMITTED` or `SUBMITTED` email

## Benefits

1. **Direct Feedback Loop**: CMO can review rework immediately without waiting for other approvals
2. **Maintains Context**: The rework initiator's stage is preserved, so the project returns to exactly where it left off
3. **Flexible**: Works for any role requesting rework, not just CMO
4. **Clean Metadata**: Rework metadata is automatically cleared after routing to prevent stale data

## Testing Checklist

- [ ] CMO sends project to Cine for rework
- [ ] Cine uploads new video
- [ ] Project returns to CMO (not to Editor or other stages)
- [ ] CMO receives email notification
- [ ] Same test for Editor rework
- [ ] Same test for Designer rework
- [ ] Verify rework metadata is cleared after routing
- [ ] Verify normal workflow (non-rework) is unaffected
