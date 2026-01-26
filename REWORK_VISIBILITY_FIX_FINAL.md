# Rework Visibility & Comments Update

## Issue
Users reported that Review Comments for rework projects were not visible in the Editor Project Detail (and potentially others). This was caused by two factor:
1. **Backward Rework**: When a project is sent back to a *previous* stage (e.g. Editor -> Cine), the system couldn't find the rework comment because it expected the comment's "stage" to match the current stage.
2. **Strict Assignment Check**: The UI components explicitly checked `project.assigned_to_role === USER_ROLE`. If the assignment update lagged or had a mismatch, the box would hide even if the workflow logic correctly identified it as a rework for the user.

## Fix
1. **Core Logic (`workflowUtils.ts`)**:
   - Removed strict `h.stage === current_stage` check when searching for rework actions/comments.
   - Now relies on `to_role` matching the user, ensuring backward rework comments are found.

2. **UI Components**:
   - Updated `EditorProjectDetail.tsx`, `CineProjectDetail.tsx`, `SubEditorProjectDetail.tsx`, `DesignerProjectDetail.tsx`.
   - Removed the `&& project.assigned_to_role === ROLE` condition from the Rework Info Box.
   - Now relies entirely on the robust `isRework` / `isRejected` flags which are calculated based on targeted history.

## Outcome
- **Editor**: Rework comments are now visible regardless of where they came from.
- **Consistency**: All roles now have reliable visibility of rework instructions.
