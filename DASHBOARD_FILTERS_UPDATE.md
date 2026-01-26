# Dashboard Filters & Rework Logic Updates

## 1. Completed/Delivered Filters ("Post" vs "Posted")
**Requirement**: Add sub-filters for Completed/Delivered tabs to distinct between items finishing production ("Post") vs items that are Live ("Posted").

**Implementation**:
- **Editor Dashboard** (`COMPLETED EDITS`):
  - Added "Post" (Video Ready, Not Live) and "Posted" (Live URL exists) buttons.
- **SubEditor Dashboard** (`COMPLETED EDITS`):
  - Added "Post" and "Posted" buttons.
- **Designer Dashboard** (`DELIVERED CREATIVES`):
  - Added "Post" and "Posted" buttons.

**How to Use**:
- Click "Completed Edits" (or Delivered).
- Use the toggle buttons above the grid to switch between "Post" (Default) and "Posted".

## 2. Rework Visibility in "In Progress"
**Requirement**: Projects sent for rework should appear in the "Progress" tab.

**Implementation**:
- **Editor & SubEditor**:
  - `IN_PROGRESS` filter triggers explicitly check `getWorkflowStateForRole(p).isRework`.
  - Rejected/Rework projects now persist in the "In Progress" stats card even if they technically have/lack delivery dates differently than standard flow.
- **Cine Dashboard**:
  - `SCHEDULED` (The generic "In Progress" for Cine) now includes projects flagged for `isRework`.
  - This ensures rejected footage leads to a "Scheduled" (or re-schedule) awareness.

## Files Modified
- `components/editor/EditorDashboard.tsx`, `EditorMyWork.tsx`
- `components/subeditor/SubEditorDashboard.tsx`, `SubEditorMyWork.tsx`
- `components/designer/DesignerDashboard.tsx`, `DesignerMyWork.tsx`
- `components/cine/CineDashboard.tsx`
