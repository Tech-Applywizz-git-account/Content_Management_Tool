# User-Specific REWORK Email Routing

## Overview
Updated the REWORK email routing to send notifications **only to the assigned user** for ALL roles (Writer, Cine, Editor, Designer, CEO), instead of broadcasting to all users with that role.

## Problem Statement

### Before
- **REWORK to Writer**: Sent to ALL writers ❌
- **REWORK to Cine**: Sent to ALL cinematographers ❌
- **REWORK to Editor**: Sent to ALL editors ❌
- **REWORK to Designer**: Sent to ALL designers ❌
- **Result**: Irrelevant notifications, confusion, and noise

### After
- **REWORK to Writer**: Sent ONLY to the assigned writer ✅
- **REWORK to Cine**: Sent ONLY to the assigned cinematographer ✅
- **REWORK to Editor**: Sent ONLY to the assigned editor ✅
- **REWORK to Designer**: Sent ONLY to the assigned designer ✅
- **Result**: Targeted notifications, clear ownership, no confusion

## Implementation

### File Modified
`supabase/functions/send-workflow-email/index.ts`

### Changes Made

#### 1. Fetch Assignment Information (Lines 87-93)
```typescript
// Fetch Project Context (including assignment info for REWORK routing)
const { data: project } = await supabaseAdmin
    .from("projects")
    .select("title, writer_id, created_by_user_id, assigned_to_user_id, assigned_to_role")
    .eq("id", project_id)
    .single();
```

**Added fields:**
- `assigned_to_user_id`: The specific user assigned to work on the project
- `assigned_to_role`: The role assigned to work on the project

#### 2. Smart REWORK Routing (Lines 129-162)
```typescript
case "REWORK":
    // REWORK emails should go to the ASSIGNED USER, not broadcast to all users of that role
    // Priority: 1) assigned_to_user_id, 2) writer_id (for WRITER role), 3) fallback to role-based
    
    let reworkRecipientId = null;
    
    // First, try to get the assigned user ID
    if (project.assigned_to_user_id) {
        reworkRecipientId = project.assigned_to_user_id;
        console.log(`REWORK: Using assigned_to_user_id: ${reworkRecipientId}`);
    } 
    // For WRITER role, use writer_id as fallback
    else if (to_role === "WRITER") {
        reworkRecipientId = project.writer_id || project.created_by_user_id;
        console.log(`REWORK: Using writer_id: ${reworkRecipientId}`);
    }
    
    // If we have a specific user ID, send to that user only
    if (reworkRecipientId) {
        const userEmail = await getUserEmail(reworkRecipientId);
        if (userEmail) {
            recipientEmails.push(userEmail);
            console.log(`REWORK: Sending to assigned user: ${userEmail}`);
        }
    } 
    // Fallback: If no specific user assigned, broadcast to all users of that role
    else if (to_role) {
        console.warn(`REWORK: No assigned user found, falling back to role-based routing for ${to_role}`);
        const emails = await getRoleEmails(to_role);
        recipientEmails.push(...emails);
    }
    break;
```

## Routing Priority

The system uses a **priority-based approach** to determine who receives the REWORK email:

### Priority 1: `assigned_to_user_id` (Highest Priority)
- **Used for**: All roles when a specific user is assigned
- **Example**: Project assigned to "John (Cinematographer)" → Email goes to John only
- **Applies to**: CINE, EDITOR, DESIGNER, CEO, SUB_EDITOR

### Priority 2: `writer_id` (Writer-Specific Fallback)
- **Used for**: WRITER role when no `assigned_to_user_id` is set
- **Fallback**: Uses `created_by_user_id` if `writer_id` is null
- **Example**: Writer-owned project → Email goes to that writer only

### Priority 3: Role-Based Routing (Last Resort)
- **Used for**: When no specific user assignment exists
- **Warning**: Logs a warning message indicating fallback
- **Example**: Project with no assignment → Email goes to all users of that role
- **Note**: This should rarely happen in production

## Data Flow

```
CMO Sends Rework to Cine
    ↓
workflow.reject() updates project
    ├─ current_stage: CINEMATOGRAPHY
    ├─ assigned_to_role: CINE
    ├─ assigned_to_user_id: [preserved from original assignment]
    └─ status: REWORK
    ↓
Database trigger fires
    ↓
Edge Function: send-workflow-email
    ↓
Fetch project with assignment info
    ↓
Check action = "REWORK"
    ↓
Priority routing:
    1. Check assigned_to_user_id → Found! Use it
    2. (Skip writer_id check - not WRITER role)
    3. (Skip role-based - we have user ID)
    ↓
Send email to assigned cinematographer ONLY
```

## Testing Scenarios

### ✅ Test Case 1: REWORK to Assigned Writer
**Setup:**
- Project created by Writer A
- `writer_id` = Writer A's ID
- `assigned_to_user_id` = null

**Action:** CMO sends rework to Writer

**Expected:**
- Email sent ONLY to Writer A
- Other writers receive NO email

**Routing:** Uses `writer_id` (Priority 2)

---

### ✅ Test Case 2: REWORK to Assigned Cinematographer
**Setup:**
- Project assigned to Cine B
- `assigned_to_user_id` = Cine B's ID
- `assigned_to_role` = CINE

**Action:** CMO sends rework to Cine

**Expected:**
- Email sent ONLY to Cine B
- Other cinematographers receive NO email

**Routing:** Uses `assigned_to_user_id` (Priority 1)

---

### ✅ Test Case 3: REWORK to Assigned Editor
**Setup:**
- Project assigned to Editor C
- `assigned_to_user_id` = Editor C's ID
- `assigned_to_role` = EDITOR

**Action:** CMO sends rework to Editor

**Expected:**
- Email sent ONLY to Editor C
- Other editors receive NO email

**Routing:** Uses `assigned_to_user_id` (Priority 1)

---

### ✅ Test Case 4: REWORK to Assigned Designer
**Setup:**
- Project assigned to Designer D
- `assigned_to_user_id` = Designer D's ID
- `assigned_to_role` = DESIGNER

**Action:** CMO sends rework to Designer

**Expected:**
- Email sent ONLY to Designer D
- Other designers receive NO email

**Routing:** Uses `assigned_to_user_id` (Priority 1)

---

### ✅ Test Case 5: Multi-Writer Approval Rework
**Setup:**
- Project in MULTI_WRITER_APPROVAL stage
- Multiple writers have approved
- `writer_id` = Original Writer E's ID

**Action:** CMO sends rework to Writer

**Expected:**
- Email sent ONLY to Writer E (original creator)
- Other writers who approved receive NO email

**Routing:** Uses `writer_id` (Priority 2)

---

### ⚠️ Test Case 6: No Assignment (Fallback)
**Setup:**
- Project with no specific assignment
- `assigned_to_user_id` = null
- `assigned_to_role` = CINE

**Action:** CMO sends rework to Cine

**Expected:**
- Warning logged: "No assigned user found, falling back..."
- Email sent to ALL cinematographers (fallback behavior)

**Routing:** Uses role-based routing (Priority 3)

## Benefits

### 1. **Eliminates Noise**
- Users only receive emails for projects they're actually working on
- No more irrelevant "someone else's rework" notifications

### 2. **Clear Ownership**
- Each rework has a single, clear recipient
- Accountability is maintained throughout the rework process

### 3. **Preserves Assignment**
- The `workflow.reject` function preserves `assigned_to_user_id`
- Rework goes back to the same person who was originally assigned

### 4. **Handles Edge Cases**
- Writer-specific logic for projects without explicit assignment
- Fallback to role-based routing prevents email delivery failures

### 5. **Comprehensive Logging**
- Logs which routing priority was used
- Warns when falling back to role-based routing
- Helps debug email delivery issues

## Database Schema Requirements

The implementation relies on these project fields:

```sql
projects (
    id UUID,
    title TEXT,
    writer_id UUID,              -- Original writer/creator
    created_by_user_id UUID,     -- Fallback for writer
    assigned_to_user_id UUID,    -- Currently assigned user (any role)
    assigned_to_role VARCHAR,    -- Currently assigned role
    ...
)
```

## Deployment

To apply this fix:

```bash
npx supabase functions deploy send-workflow-email --no-verify-jwt
```

## Monitoring

After deployment, monitor Edge Function logs for:
- `REWORK: Using assigned_to_user_id: [id]` → ✅ Normal operation
- `REWORK: Using writer_id: [id]` → ✅ Normal for writers
- `REWORK: No assigned user found, falling back...` → ⚠️ Investigate why no assignment

## Related Changes

This fix works in conjunction with:
1. **Rework Initiator Routing** (`.gemini/rework_routing_implementation.md`)
   - Routes completed rework back to the initiator (e.g., CMO)
2. **Workflow Reject Function** (`services/supabaseDb.ts`)
   - Preserves `assigned_to_user_id` when sending for rework
