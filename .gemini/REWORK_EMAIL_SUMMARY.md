# REWORK Email Routing - Quick Summary

## What Changed?

REWORK emails now go **only to the assigned person**, not to everyone with that role.

## Before vs After

| Role | Before | After |
|------|--------|-------|
| Writer | ❌ All writers | ✅ Assigned writer only |
| Cine | ❌ All cinematographers | ✅ Assigned cine only |
| Editor | ❌ All editors | ✅ Assigned editor only |
| Designer | ❌ All designers | ✅ Assigned designer only |
| CEO | ❌ All CEOs | ✅ Assigned CEO only |

## How It Works

**Priority-based routing:**
1. **First**: Check `assigned_to_user_id` → Send to that user
2. **Second**: For Writers, check `writer_id` → Send to project owner
3. **Last**: Fallback to role-based (all users) if no assignment found

## Example

**Scenario:** CMO sends rework to Cinematographer

**Old behavior:**
```
Project assigned to: John (Cine)
Email sent to: John, Sarah, Mike (all Cines) ❌
```

**New behavior:**
```
Project assigned to: John (Cine)
Email sent to: John only ✅
```

## Files Modified

1. **`supabase/functions/send-workflow-email/index.ts`**
   - Added `assigned_to_user_id` to project query
   - Updated REWORK case with priority-based routing
   - Added comprehensive logging

## Deployment

```bash
npx supabase functions deploy send-workflow-email --no-verify-jwt
```

## Testing Checklist

- [ ] CMO → Writer rework (only assigned writer gets email)
- [ ] CMO → Cine rework (only assigned cine gets email)
- [ ] CMO → Editor rework (only assigned editor gets email)
- [ ] CMO → Designer rework (only assigned designer gets email)
- [ ] Multi-writer approval rework (only original writer gets email)
- [ ] Verify other writers/cines/editors/designers do NOT get emails

## Benefits

✅ **No more spam** - Users only get relevant notifications  
✅ **Clear ownership** - One person responsible for each rework  
✅ **Better UX** - Less noise, more signal  
✅ **Preserved assignments** - Rework goes back to the same person
