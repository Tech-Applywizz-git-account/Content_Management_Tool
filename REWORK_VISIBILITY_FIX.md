# Rework Visibility Fix

## Issue
Review comments were not appearing for projects in "Rework" status if the rework sent the project back to a previous stage (e.g., Editor rejecting Cine work). The system failed to match the "Rework Action" (recorded at the later stage) with the "Current Stage" (the earlier stage), causing it to ignore the rework status and hide the comment box.

## Fix
Modified `services/workflowUtils.ts` to remove strict stage matching (`h.stage === project.current_stage`) in:
1. `getWorkflowStateForRole`: To correctly identify `isTargetedRework` even if stages differ.
2. `getLatestReworkRejectComment`: To retrieve the relevant comment regardless of the stage it was recorded in.

## Impact
- **Cine Dashboard**: Will now show "Review & Rework" box + comments when rejected by Editor.
- **Editor Dashboard**: Will now show "Review & Rework" box + comments when rejected by Sub-Editor or Designer (backward flows).
- **General**: Applies to all roles, ensuring that if a project is assigned to you for rework, you see the reason why.
