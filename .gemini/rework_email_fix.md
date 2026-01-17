# REWORK Email Routing Fix

## Bug Description
**Issue**: When CMO sends a project for REWORK to a Writer, ALL writers receive the email notification instead of just the assigned writer who owns the project.

**Root Cause**: The REWORK action was using role-based email routing (`getRoleEmails('WRITER')`), which broadcasts to all users with that role.

## Fix Implementation

### File Modified
`supabase/functions/send-workflow-email/index.ts` (lines 125-143)

### Changes Made

**Before:**
```typescript
case "REWORK":
    // Send to to_role (broadcasts to ALL users of that role)
    if (to_role) {
        const emails = await getRoleEmails(to_role);
        recipientEmails.push(...emails);
    }
    break;
```

**After:**
```typescript
case "REWORK":
    // For REWORK to WRITER: Send ONLY to the assigned writer (NOT all writers)
    // For REWORK to other roles (CINE, EDITOR, DESIGNER): Send to all users of that role
    if (to_role === "WRITER") {
        // Writer-specific routing: Use writer_id from project
        const assignedWriterId = project.writer_id || project.created_by_user_id;
        if (assignedWriterId) {
            const assignedWriterEmail = await getUserEmail(assignedWriterId);
            if (assignedWriterEmail) {
                recipientEmails.push(assignedWriterEmail);
            }
        } else {
            console.warn(`REWORK to WRITER but no writer_id found for project ${project_id}`);
        }
    } else if (to_role) {
        // For other roles (CINE, EDITOR, DESIGNER): Use role-based routing
        const emails = await getRoleEmails(to_role);
        recipientEmails.push(...emails);
    }
    break;
```

## How It Works

### For WRITER Rework
1. **Check**: Is `to_role === "WRITER"`?
2. **Fetch**: Get `writer_id` from project (or fallback to `created_by_user_id`)
3. **Route**: Send email ONLY to that specific writer's email
4. **Result**: Only the assigned writer receives the rework notification

### For Other Roles (CINE, EDITOR, DESIGNER)
1. **Check**: Is `to_role` something other than "WRITER"?
2. **Route**: Use role-based routing (all users of that role)
3. **Result**: All Cinematographers/Editors/Designers receive the notification

## Why This Approach?

### Writer-Specific Routing
- **Writers own projects**: Each project has a specific writer assigned via `writer_id`
- **Personal responsibility**: Only the writer who created the script should fix it
- **Prevents confusion**: Other writers shouldn't receive irrelevant rework requests

### Role-Based Routing for Others
- **Shared resources**: Cine/Editor/Designer roles are often shared
- **Flexibility**: Any available person in that role can handle the rework
- **Current workflow**: Matches existing behavior for production roles

## Testing Scenarios

### ✅ Test Case 1: CMO → Writer Rework
- **Action**: CMO sends rework to Writer
- **Expected**: Only the assigned writer receives email
- **Verify**: Other writers do NOT receive email

### ✅ Test Case 2: CMO → Cine Rework
- **Action**: CMO sends rework to Cinematographer
- **Expected**: All active cinematographers receive email
- **Verify**: Email sent to all CINE role users

### ✅ Test Case 3: CMO → Editor Rework
- **Action**: CMO sends rework to Editor
- **Expected**: All active editors receive email
- **Verify**: Email sent to all EDITOR role users

### ✅ Test Case 4: CMO → Designer Rework
- **Action**: CMO sends rework to Designer
- **Expected**: All active designers receive email
- **Verify**: Email sent to all DESIGNER role users

## Data Flow

```
CMO Sends Rework
    ↓
workflow.reject() records action
    ↓
Database trigger fires
    ↓
Edge Function: send-workflow-email
    ↓
Check action = "REWORK"
    ↓
Check to_role
    ├─ "WRITER" → Get writer_id → Send to specific writer
    └─ Other → Get all role emails → Send to all
```

## Benefits

✅ **Fixes the bug**: Writers no longer receive irrelevant rework notifications  
✅ **Maintains flexibility**: Other roles still use broadcast approach  
✅ **Uses existing data**: Leverages `writer_id` field already in projects table  
✅ **Clear logging**: Warns if writer_id is missing  
✅ **Backward compatible**: Doesn't break existing rework flows for other roles
